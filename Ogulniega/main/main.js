const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const si = require("systeminformation");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { spawn } = require("child_process");
const os = require("os");
const crypto = require("crypto");

// Funkcja do sprawdzenia czy plik ZIP jest prawidłowy
function isValidZipFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    if (stats.size < 22) return false; // Najmniejszy ZIP to 22 bajty

    // Sprawdź nagłówek ZIP (powinien zaczynać się od PK\x03\x04)
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    if (buffer.toString('hex') !== '504b0304') {
      console.log(`Invalid ZIP header for ${filePath}: ${buffer.toString('hex')}`);
      return false;
    }

    // Spróbuj wczytać ZIP
    new AdmZip(filePath);
    return true;
  } catch (e) {
    console.log(`ZIP validation error for ${filePath}: ${e.message}`);
    return false;
  }
}

let win;
let OPTIMAL_CONCURRENCY = 10; // Default, będzie ustawione na podstawie CPU
const MAX_ASSET_CONCURRENCY = 25; // Limit dla assetów aby uniknąć zawieszania

const rootPath = path.join(process.env.HOME || os.homedir(), ".Ogulniega");
const versionsPath = path.join(rootPath, "versions");
const librariesPath = path.join(rootPath, "libraries");
const assetsPath = path.join(rootPath, "assets");
const nativesPath = path.join(rootPath, "natives");
const modsPath = path.join(rootPath, "mods");

/* ==========================================================================
   MOD BROWSER & TRACKING IPC HANDLERS
   ========================================================================== */

function trackModId(version, projectId, filename) {
  try {
    if (!version || !projectId) return;
    const versionDir = path.join(modsPath, version);
    if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });

    const trackerPath = path.join(versionDir, ".mods.json");
    let data = { installedIds: [], modMap: {} };

    if (fs.existsSync(trackerPath)) {
      try {
        data = JSON.parse(fs.readFileSync(trackerPath, "utf8"));
      } catch (e) { data = { installedIds: [], modMap: {} }; }
    }

    if (!data.installedIds) data.installedIds = [];
    if (!data.modMap) data.modMap = {};

    if (!data.installedIds.includes(projectId)) {
      data.installedIds.push(projectId);
    }

    if (filename) {
      data.modMap[filename] = projectId;
    }

    fs.writeFileSync(trackerPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Mod tracking error:", err);
  }
}

function untrackMod(version, filename) {
  try {
    const trackerPath = path.join(modsPath, version, ".mods.json");
    if (!fs.existsSync(trackerPath)) return;

    let data = JSON.parse(fs.readFileSync(trackerPath, "utf8"));
    if (!data.modMap) return;

    const projectId = data.modMap[filename];
    if (projectId) {
      data.installedIds = data.installedIds.filter(id => id !== projectId);
      delete data.modMap[filename];
      fs.writeFileSync(trackerPath, JSON.stringify(data, null, 2));
      console.log(`Untracked mod: ${filename} (ID: ${projectId})`);
    }
  } catch (err) {
    console.error("Untrack error:", err);
  }
}

ipcMain.handle("get-installed-mod-ids", async (event, version) => {
  try {
    if (!version) return [];
    const rootTracker = path.join(modsPath, version, ".mods.json");
    const preinstalledTracker = path.join(modsPath, version, "Preinstalled", ".mods.json");

    let ids = new Set();

    if (fs.existsSync(rootTracker)) {
      try {
        const data = JSON.parse(fs.readFileSync(rootTracker, "utf8"));
        if (data.installedIds) {
          data.installedIds.forEach(id => {
            // Self-healing: if we have a mapping, check if file exists
            if (data.modMap) {
              const filename = Object.keys(data.modMap).find(key => data.modMap[key] === id);
              if (filename) {
                const fpath = path.join(modsPath, version, filename);
                if (!fs.existsSync(fpath)) return; // Skip if file is gone
              }
            }
            ids.add(id);
          });
        }
      } catch (e) { }
    }

    if (fs.existsSync(preinstalledTracker)) {
      try {
        const data = JSON.parse(fs.readFileSync(preinstalledTracker, "utf8"));
        if (data.installedIds) data.installedIds.forEach(id => ids.add(id));
      } catch (e) { }
    }

    return Array.from(ids);
  } catch (err) {
    return [];
  }
});

ipcMain.handle("download-mod", async (event, { url, filename, version, projectId }) => {
  try {
    if (!version || !url) throw new Error("Missing parameters");
    const versionModsPath = path.join(modsPath, version);
    if (!fs.existsSync(versionModsPath)) {
      fs.mkdirSync(versionModsPath, { recursive: true });
    }
    const filePath = path.join(versionModsPath, filename);

    if (fs.existsSync(filePath)) {
      if (projectId) trackModId(version, projectId, filename);
      return true;
    }

    const response = await axios({ method: "get", url, responseType: "stream" });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve) => {
      writer.on("finish", () => {
        if (projectId) trackModId(version, projectId, filename);
        resolve(true);
      });
      writer.on("error", () => resolve(false));
    });
  } catch (err) {
    console.error("Mod download error:", err);
    return false;
  }
});

// Zarządzanie modami (Usuwanie/Wyłączanie)
ipcMain.handle("delete-mod", async (event, { version, filename, isPreinstalled }) => {
  try {
    const dir = isPreinstalled ? path.join(modsPath, version, "Preinstalled") : path.join(modsPath, version);
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      // Clean up tracking metadata
      if (!isPreinstalled) untrackMod(version, filename);
      return { success: true };
    }
    return { success: false, error: "File not found" };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("toggle-mod-status", async (event, { version, filename, isPreinstalled }) => {
  try {
    const dir = isPreinstalled ? path.join(modsPath, version, "Preinstalled") : path.join(modsPath, version);
    const oldPath = path.join(dir, filename);
    if (!fs.existsSync(oldPath)) return { success: false, error: "File not found" };

    let newFilename;
    if (filename.endsWith(".disabled")) {
      newFilename = filename.replace(".disabled", "");
    } else {
      newFilename = filename + ".disabled";
    }

    const newPath = path.join(dir, newFilename);
    fs.renameSync(oldPath, newPath);
    return { success: true, newFilename };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Konfiguracja modpacków - pobiera z GitHub releases
const MODPACKS = {
  "1.20.1": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.20.1/modpack-1.20.1.zip",
  },
  "1.20.1-Vulkan": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.20.1-Vulkan/modpack-1.20.1-vulkan.zip",
  },
  "1.21.1": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.1/modpack.1.21.1.zip",
  },
  "1.21.4": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.4/modpack.1.21.4.zip",
  },
  "1.21.6": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.6/modpack.1.21.6.zip",
  },
  "1.21.10": {
    url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.10/modpack.1.21.10.zip",
  },
};

let isGameRunning = false;

async function initConcurrency() {
  try {
    const cpus = await si.cpu();
    const cores = cpus.cores || 4;
    // Liczba rdzeni * 2.5 = dobre dostosowanie
    OPTIMAL_CONCURRENCY = Math.max(20, Math.min(cores * 2.5, 100));
    console.log(`CPU cores: ${cores}, optimal concurrency: ${OPTIMAL_CONCURRENCY}`);
  } catch (e) {
    console.log("Nie udało się odczytać CPU, używam default: 10");
  }
}

function startMonitoring(targetWin) {
  setInterval(async () => {
    try {
      if (!targetWin || targetWin.isDestroyed()) return;

      // FPS Optimization: Skip monitoring if game is running to save CPU
      if (isGameRunning) return;

      const [load, mem] = await Promise.all([
        si.currentLoad(),
        si.mem()
      ]);

      const stats = {
        cpu: Math.round(load.currentLoad),
        ramUsed: Math.round(mem.active / 1024 / 1024 / 1024 * 10) / 10,
        ramTotal: Math.round(mem.total / 1024 / 1024 / 1024 * 10) / 10
      };

      targetWin.webContents.send("system-stats", stats);
    } catch (err) {
      console.error("Monitoring error:", err);
    }
  }, 2000);
}

function createWindow() {
  const iconPath = path.join(__dirname, "../assets/icon.png");
  console.log(`Loading icon from: ${iconPath}`);

  win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 900,
    minHeight: 600,
    title: "Ogulniega Launcher",
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  startMonitoring(win);

  win.loadFile(path.join(__dirname, "../render/index.html"));

  // Funkcja do wysyłania progress-bar z throttlingiem (maks 2x na sekundę)
  let lastProgressUpdate = 0;
  const sendThrottledProgress = (p) => {
    const now = Date.now();
    if (now - lastProgressUpdate > 500 || p === 0 || p === 1) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("progress-bar", p);
        lastProgressUpdate = now;
      }
    }
  };
  global.sendThrottledProgress = sendThrottledProgress;

  // Obsługa Waylandu
  if (process.env.WAYLAND_DISPLAY) {
    console.log("Uruchamianie w Waylandzie");
  } else {
    console.log("Uruchamianie w X11");
  }

  win.loadFile(path.join(__dirname, "../render/index.html"));
}

app.whenReady().then(async () => {
  await initConcurrency();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Wykrywanie całkowitego RAMu
ipcMain.handle("get-system-ram", async () => {
  const mem = await si.mem();
  const totalGB = Math.floor(mem.total / 1024 / 1024 / 1024);
  let defaultRam = 2;
  if (totalGB >= 16) defaultRam = 8;
  else if (totalGB >= 8) defaultRam = 4;
  return { total: totalGB, default: defaultRam };
});

// Pobieranie listy wersji Fabric
ipcMain.handle("get-fabric-versions", async () => {
  try {
    const allowedVersions = ["1.20.1", "1.20.1-Vulkan", "1.21.1", "1.21.4", "1.21.6", "1.21.10"];
    return allowedVersions;
  } catch (err) {
    console.error("Błąd pobierania wersji:", err);
    return [];
  }
});

// Handler dla init-data (jeśli używasz w preload.js)
ipcMain.handle("get-init-data", async () => {
  return {
    versions: await ipcMain.invoke("get-fabric-versions"),
    ram: await ipcMain.invoke("get-system-ram"),
  };
});

// Handler do otwarcia folderu modów
ipcMain.handle("open-mods-folder", async (event, version) => {
  try {
    const { shell } = require("electron");
    const versionModsPath = path.join(modsPath, version);

    if (!fs.existsSync(versionModsPath)) {
      fs.mkdirSync(versionModsPath, { recursive: true });
    }

    await shell.openPath(versionModsPath);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// Handler do pobrania listy modów dla wersji
ipcMain.handle("get-mods-list", async (event, version) => {
  try {
    if (!version) return { root: [], preinstalled: [], installed: false };
    const versionModsPath = path.join(modsPath, version);
    const preinstalledPath = path.join(versionModsPath, "Preinstalled");

    let rootMods = [];
    let preinstalledMods = [];
    let installed = false;

    const mapFiles = (files, dir) => {
      return files.filter(f => {
        if (f === "Preinstalled" || f === ".modpack_installed" || f.startsWith(".") || f === ".mods.json") return false;
        try {
          return fs.statSync(path.join(dir, f)).isFile();
        } catch (e) { return false; }
      }).map(f => ({
        name: f,
        isEnabled: !f.endsWith(".disabled"),
        baseName: f.replace(".disabled", "")
      }));
    };

    if (fs.existsSync(versionModsPath)) {
      try {
        const files = fs.readdirSync(versionModsPath);
        rootMods = mapFiles(files, versionModsPath);
        installed = fs.existsSync(path.join(versionModsPath, ".modpack_installed"));
      } catch (e) { console.error("Error reading root mods:", e); }
    }

    if (fs.existsSync(preinstalledPath)) {
      try {
        const files = fs.readdirSync(preinstalledPath);
        preinstalledMods = mapFiles(files, preinstalledPath);
        if (!installed) {
          installed = fs.existsSync(path.join(preinstalledPath, ".modpack_installed"));
        }
      } catch (e) { console.error("Error reading preinstalled mods:", e); }
    }

    return { root: rootMods, preinstalled: preinstalledMods, installed };
  } catch (err) {
    console.error("Critical error in get-mods-list:", err);
    return { root: [], preinstalled: [], error: err.message };
  }
});



// Handler do pobierania modu z URL

function getInstanceSettings(version) {
  try {
    const instanceDir = path.join(rootPath, "instances", version);
    const settingsPath = path.join(instanceDir, "settings.json");

    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    }
  } catch (err) {
    console.error("Błąd odczytu ustawień instancji:", err);
  }
  return { ram: 2, jvmArgs: "-XX:+UseG1GC" };
}

// Handler do pobrania ustawień instancji
ipcMain.handle("get-instance-settings", async (event, version) => {
  return getInstanceSettings(version);
});

// Handler do zapisania ustawień instancji
ipcMain.handle("save-instance-settings", async (event, version, settings) => {
  try {
    const instanceDir = path.join(rootPath, "instances", version);
    if (!fs.existsSync(instanceDir)) {
      fs.mkdirSync(instanceDir, { recursive: true });
    }

    const settingsPath = path.join(instanceDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// --- NOWE: Zarządzanie globalnymi ustawieniami ---
const globalSettingsPath = path.join(rootPath, "global_settings.json");

function getGlobalSettings() {
  try {
    if (fs.existsSync(globalSettingsPath)) {
      return JSON.parse(fs.readFileSync(globalSettingsPath, "utf8"));
    }
  } catch (e) {
    console.error("Błąd odczytu globalnych ustawień:", e);
    return {
      lang: "en",
      gameMode: false,
      gamescope: false,
      customJvmArgs: "",
      ...settings,
    };
  }
  return { gameMode: false, gamescope: false, customJvmArgs: "" };
}

ipcMain.handle("get-global-settings", () => {
  return getGlobalSettings();
});

ipcMain.handle("save-global-settings", (event, settings) => {
  try {
    if (!fs.existsSync(rootPath)) {
      fs.mkdirSync(rootPath, { recursive: true });
    }
    fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// --- NOWE: Narzędzia Debugowania ---
ipcMain.handle("delete-assets", async () => {
  try {
    if (fs.existsSync(assetsPath)) {
      fs.rmSync(assetsPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle("reinstall-java", () => {
  const installScript = path.join(__dirname, "../install.sh");
  if (fs.existsSync(installScript)) {
    // Uruchomienie w nowym terminalu (zależnie od środowiska, tu po prostu exec)
    exec(`bash "${installScript}"`, (error) => {
      if (error) console.error(`Błąd reinstall: ${error}`);
    });
    return { success: true };
  }
  return { success: false, message: "Nie znaleziono pliku install.sh" };
});

ipcMain.handle("reset-settings", async () => {
  try {
    const instancesDir = path.join(rootPath, "instances");
    if (fs.existsSync(instancesDir)) {
      const versions = fs.readdirSync(instancesDir);
      for (const version of versions) {
        const optionsFile = path.join(instancesDir, version, "options.txt");
        const settingsFile = path.join(instancesDir, version, "settings.json");
        if (fs.existsSync(optionsFile)) fs.unlinkSync(optionsFile);
        if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle("copy-logs", async (event, version) => {
  try {
    const logPath = path.join(rootPath, "instances", version, "logs", "latest.log");
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      const { clipboard } = require("electron");
      clipboard.writeText(content);
      return { success: true };
    }
    return { success: false, message: "Nie znaleziono logów dla tej wersji." };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle("check-dependencies", async () => {
  const check = (cmd) => {
    return new Promise((resolve) => {
      exec(`command -v ${cmd}`, (error) => {
        resolve(!error);
      });
    });
  };

  return {
    gameMode: await check("gamemoderun"),
    gamescope: await check("gamescope"),
  };
});

// Funkcja pobierania pliku z retry logika
async function downloadFile(url, dest, onProgress, maxRetries = 4) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let writer, response;
    try {
      // Utwórz folder docelowy jeśli nie istnieje
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Jeśli plik już istnieje, sprawdź czy jest kompletny
      if (fs.existsSync(dest)) {
        // Jeśli to plik JAR/ZIP, sprawdź czy jest prawidłowy
        if (dest.endsWith('.jar') || dest.endsWith('.zip')) {
          if (isValidZipFile(dest)) {
            console.log(`File OK (cached): ${path.basename(dest)}`);
            return; // Plik OK, nie pobieraj
          } else {
            // Plik uszkodzony, usuń i pobierz ponownie
            console.log(`Corrupted file detected, removing: ${path.basename(dest)}`);
            try { fs.unlinkSync(dest); } catch (e) { }
          }
        } else {
          return; // Inne pliki - jeśli istnieją, nie pobieraj
        }
      }

      console.log(`Downloading [${attempt + 1}/${maxRetries}]: ${path.basename(dest)}`);

      writer = fs.createWriteStream(dest);
      response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        timeout: 60000,
        family: 4, // Force IPv4 for downloads to avoid ENETUNREACH
      });

      const totalLength = response.headers["content-length"];
      let downloadedLength = 0;
      let timeoutHandle;
      const maxInactivityTime = 60000; // 60 sekund bez danych = timeout

      response.data.on("data", (chunk) => {
        downloadedLength += chunk.length;
        if (onProgress && totalLength) {
          onProgress(downloadedLength, totalLength);
        }
        // Resetuj timeout na każde dane
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          console.log(`Transfer timeout: no data for ${maxInactivityTime}ms`);
          writer.destroy(new Error("Transfer timeout"));
          response.data.destroy();
        }, maxInactivityTime);
      });

      response.data.on("error", (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (writer && writer.destroy) {
          try { writer.destroy(); } catch (e) { }
        }
        if (response.data.destroy) {
          try { response.data.destroy(); } catch (e) { }
        }
        throw err;
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);

          // Czekaj aby plik się na pewno zamknął
          setTimeout(() => {
            // Sprawdź czy pobierany plik to ZIP/JAR
            if (dest.endsWith('.jar') || dest.endsWith('.zip')) {
              if (!isValidZipFile(dest)) {
                reject(new Error("Downloaded file is corrupted or incomplete"));
              } else {
                console.log(`Download OK: ${path.basename(dest)}`);
                resolve();
              }
            } else {
              console.log(`Download OK: ${path.basename(dest)}`);
              resolve();
            }
          }, 100);
        });
        writer.on("error", (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(err);
        });
      });
    } catch (err) {
      // Zamknij zasoby
      if (writer && writer.destroy) {
        try { writer.destroy(); } catch (e) { }
      }
      if (response && response.data && response.data.destroy) {
        try { response.data.destroy(); } catch (e) { }
      }

      // Usuń plik jeśli pobranie nie powiodło się
      if (fs.existsSync(dest)) {
        try {
          fs.unlinkSync(dest);
        } catch (e) { }
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 2000; // Exponential backoff (2s, 4s, 8s...)
        console.log(`Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${url}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`Failed to download after ${maxRetries} attempts: ${url}`);
        console.error(`Error: ${err.message}`);
        throw err;
      }
    }
  }
}

// Funkcja do sprawdzania czy biblioteka powinna być załadowana
function shouldLoadLibrary(lib) {
  if (!lib.rules) return true;

  const osType =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "osx"
        : "linux";

  let allowed = false;
  for (const rule of lib.rules) {
    if (rule.action === "allow") {
      if (!rule.os || rule.os.name === osType) {
        allowed = true;
      }
    } else if (rule.action === "disallow") {
      if (rule.os && rule.os.name === osType) {
        allowed = false;
      }
    }
  }
  return allowed;
}

// Wyodrębnianie natives
async function extractNatives(libraries, mcVersion) {
  const nativesTempPath = path.join(nativesPath, mcVersion);

  // Wyczyść stary folder natives
  if (fs.existsSync(nativesTempPath)) {
    fs.rmSync(nativesTempPath, { recursive: true, force: true });
  }
  fs.mkdirSync(nativesTempPath, { recursive: true });

  for (const lib of libraries) {
    if (!shouldLoadLibrary(lib)) continue;

    if (lib.downloads && lib.downloads.classifiers) {
      const osType =
        process.platform === "win32"
          ? "natives-windows"
          : process.platform === "darwin"
            ? "natives-osx"
            : "natives-linux";

      const nativeArtifact = lib.downloads.classifiers[osType];
      if (nativeArtifact) {
        const nativePath = path.join(librariesPath, nativeArtifact.path);

        if (fs.existsSync(nativePath)) {
          try {
            const zip = new AdmZip(nativePath);
            zip.extractAllTo(nativesTempPath, true);
          } catch (err) {
            console.error(`Błąd wyodrębniania ${nativePath}:`, err.message);
          }
        }
      }
    }
  }

  return nativesTempPath;
}

// Instalacja Fabric
async function installFabric(mcVersion) {
  win.webContents.send("status", `Pobieranie Fabric dla ${mcVersion}...`);

  // Normalize version for external APIs (e.g., 1.20.1-Vulkan -> 1.20.1)
  const baseMcVersion = mcVersion.split("-")[0];

  // Pobierz najnowszą wersję Fabric loader
  const loaderResponse = await axios.get(
    "https://meta.fabricmc.net/v2/versions/loader",
  );
  const fabricLoader = loaderResponse.data[0].version;

  // Pobierz profil Fabric
  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${baseMcVersion}/${fabricLoader}/profile/json`;
  const profileResponse = await axios.get(profileUrl);
  const profile = profileResponse.data;

  // Nazwa wersji Fabric
  const fabricVersion = `fabric-loader-${fabricLoader}-${mcVersion}`;
  const fabricDir = path.join(versionsPath, fabricVersion);

  if (!fs.existsSync(fabricDir)) {
    fs.mkdirSync(fabricDir, { recursive: true });
  }

  // Zapisz JSON profilu
  fs.writeFileSync(
    path.join(fabricDir, `${fabricVersion}.json`),
    JSON.stringify(profile, null, 2),
  );

  // Pobierz manifest vanilla Minecraft
  win.webContents.send("status", `Pobieranie Minecraft ${baseMcVersion}...`);
  const manifestResponse = await axios.get(
    "https://launchermeta.mojang.com/mc/game/version_manifest.json",
  );
  const versionInfo = manifestResponse.data.versions.find(
    (v) => v.id === baseMcVersion,
  );
  const versionDataResponse = await axios.get(versionInfo.url);
  const versionData = versionDataResponse.data;

  const vanillaDir = path.join(versionsPath, mcVersion);
  if (!fs.existsSync(vanillaDir)) {
    fs.mkdirSync(vanillaDir, { recursive: true });
  }

  // Zapisz vanilla JSON (potrzebny dla bibliotek)
  fs.writeFileSync(
    path.join(vanillaDir, `${mcVersion}.json`),
    JSON.stringify(versionData, null, 2),
  );

  const clientJarPath = path.join(vanillaDir, `${mcVersion}.jar`);
  if (!fs.existsSync(clientJarPath)) {
    await downloadFile(versionData.downloads.client.url, clientJarPath);
  }

  // Pobierz biblioteki vanilla (WAŻNE: zawiera joptsimple!)
  win.webContents.send("status", "Pobieranie bibliotek Minecraft...");

  // Zbierz wszystkie biblioteki do pobrania
  const vanillaLibsToDownload = [];
  for (const lib of versionData.libraries) {
    if (!shouldLoadLibrary(lib)) continue;

    // Pobierz główny artifact
    if (lib.downloads && lib.downloads.artifact) {
      const artifact = lib.downloads.artifact;
      const libPath = path.join(librariesPath, artifact.path);
      const libDir = path.dirname(libPath);

      if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
      }

      if (!fs.existsSync(libPath)) {
        vanillaLibsToDownload.push({ url: artifact.url, path: libPath });
      }
    }

    // Pobierz natives
    if (lib.downloads && lib.downloads.classifiers) {
      for (const [classifier, artifact] of Object.entries(
        lib.downloads.classifiers,
      )) {
        const libPath = path.join(librariesPath, artifact.path);
        const libDir = path.dirname(libPath);

        if (!fs.existsSync(libDir)) {
          fs.mkdirSync(libDir, { recursive: true });
        }

        if (!fs.existsSync(libPath)) {
          vanillaLibsToDownload.push({ url: artifact.url, path: libPath });
        }
      }
    }
  }

  // Pobierz biblioteki równocześnie (ograniczone na 4 aby uniknąć uszkodzenia)
  const CONCURRENT_LIBS = Math.min(4, Math.ceil(OPTIMAL_CONCURRENCY / 4));
  for (let i = 0; i < vanillaLibsToDownload.length; i += CONCURRENT_LIBS) {
    const batch = vanillaLibsToDownload.slice(i, i + CONCURRENT_LIBS);
    const results = await Promise.allSettled(
      batch.map(lib => downloadFile(lib.url, lib.path))
    );

    // Zaloguj błędy ale nie zatrzymuj całego procesu
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`Błąd pobierania biblioteki ${batch[idx].url}:`, result.reason?.message);
      }
    });
  }

  // Pobierz biblioteki Fabric
  win.webContents.send("status", "Pobieranie bibliotek Fabric...");

  // Zbierz wszystkie biblioteki Fabric do pobrania
  const fabricLibsToDownload = [];
  for (const lib of profile.libraries) {
    if (lib.name) {
      const parts = lib.name.split(":");
      const [group, artifact, version] = parts;
      const groupPath = group.replace(/\./g, "/");
      const jarName = `${artifact}-${version}.jar`;
      const libPath = path.join(
        librariesPath,
        groupPath,
        artifact,
        version,
        jarName,
      );
      const libDir = path.dirname(libPath);

      if (!fs.existsSync(libDir)) {
        fs.mkdirSync(libDir, { recursive: true });
      }

      if (!fs.existsSync(libPath)) {
        const url = lib.url
          ? `${lib.url}${groupPath}/${artifact}/${version}/${jarName}`
          : `https://maven.fabricmc.net/${groupPath}/${artifact}/${version}/${jarName}`;
        fabricLibsToDownload.push({ url, libPath, fallbackUrl: `https://repo1.maven.org/maven2/${groupPath}/${artifact}/${version}/${jarName}` });
      }
    }
  }

  // Pobierz biblioteki Fabric równocześnie (ograniczone na 4 aby uniknąć uszkodzenia)
  const CONCURRENT_FABRIC = Math.min(4, Math.ceil(OPTIMAL_CONCURRENCY / 4));
  for (let i = 0; i < fabricLibsToDownload.length; i += CONCURRENT_FABRIC) {
    const batch = fabricLibsToDownload.slice(i, i + CONCURRENT_FABRIC);
    const results = await Promise.allSettled(
      batch.map(async (lib) => {
        try {
          await downloadFile(lib.url, lib.libPath);
        } catch (err) {
          // Spróbuj fallback URL jeśli główny adres nie zadziała
          await downloadFile(lib.fallbackUrl, lib.libPath);
        }
      })
    );

    // Zaloguj błędy ale nie zatrzymuj całego procesu
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`Błąd pobierania biblioteki Fabric:`, result.reason?.message);
      }
    });
  }

  // Pobierz assety
  win.webContents.send("status", "Pobieranie assetów...");
  const assetIndexUrl = versionData.assetIndex.url;
  const assetIndexPath = path.join(
    assetsPath,
    "indexes",
    `${versionData.assetIndex.id}.json`,
  );

  if (!fs.existsSync(path.dirname(assetIndexPath))) {
    fs.mkdirSync(path.dirname(assetIndexPath), { recursive: true });
  }

  if (!fs.existsSync(assetIndexPath)) {
    await downloadFile(assetIndexUrl, assetIndexPath);
  }

  const assetIndex = JSON.parse(fs.readFileSync(assetIndexPath, "utf8"));
  const objectsDir = path.join(assetsPath, "objects");

  const assets = Object.entries(assetIndex.objects);
  const totalAssets = assets.length;
  let downloaded = 0;

  win.webContents.send("status", `Pobieranie assetów (${totalAssets})...`);

  // Pobierz assety z pool workerów (ciągłe pobieranie bez batchowania)
  const CONCURRENT_DOWNLOADS = Math.min(OPTIMAL_CONCURRENCY, MAX_ASSET_CONCURRENCY);

  let assetIndex_queue = [...assets]; // Kolejka assetów
  let downloading = 0;

  // Funkcja worker - pobiera assety z kolejki
  const downloadWorker = async () => {
    while (true) {
      if (assetIndex_queue.length === 0 && downloading === 0) {
        break; // Koniec
      }

      if (assetIndex_queue.length === 0) {
        await new Promise(r => setTimeout(r, 100)); // Czekaj na inne workery
        continue;
      }

      downloading++;
      const [name, asset] = assetIndex_queue.shift();

      try {
        const hash = asset.hash;
        const subPath = hash.substring(0, 2);
        const assetPath = path.join(objectsDir, subPath, hash);

        const assetUrl = `https://resources.download.minecraft.net/${subPath}/${hash}`;
        await downloadFile(assetUrl, assetPath);

        downloaded++;
        // Pokazuj progress co każdy asset
        win.webContents.send("status", `Assety: ${downloaded}/${totalAssets}`);
        sendThrottledProgress(downloaded / totalAssets);
      } catch (err) {
        console.error(`Błąd pobierania assetu:`, err.message);
      } finally {
        downloading--;
      }
    }
  };

  // Uruchom wszystkie workery i czekaj na WSZYSTKIE
  const workerPromises = [];
  for (let w = 0; w < CONCURRENT_DOWNLOADS; w++) {
    workerPromises.push(downloadWorker());
  }

  // Czekaj aż WSZYSTKIE workery skończą
  await Promise.all(workerPromises);

  console.log(`Wszystkie ${totalAssets} assetów pobrane!`);

  return { fabricVersion, versionData };
}

// Specjalna funkcja pobierania modpacków (wolniej, więcej retryów)
async function downloadModpackFile(url, dest, onProgress) {
  const maxRetries = 5; // Więcej prób dla modpacków

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let writer, response;
    try {
      // Utw folder docelowy
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log(`[Modpack] Attempt ${attempt + 1}/${maxRetries}: ${url}`);

      writer = fs.createWriteStream(dest);
      response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        timeout: 120000, // 120 sekund (dwukrotnie więcej dla modpacków)
      });

      const totalLength = response.headers["content-length"];
      let downloadedLength = 0;
      let timeoutHandle;

      response.data.on("data", (chunk) => {
        downloadedLength += chunk.length;
        if (onProgress && totalLength) {
          onProgress(downloadedLength, totalLength);
        }
        // Resetuj timeout
        if (timeoutHandle) clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          console.log("[Modpack] Transfer timeout");
          writer.destroy(new Error("Transfer timeout"));
          response.data.destroy();
        }, 120000);
      });

      response.data.on("error", (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (writer && writer.destroy) {
          try { writer.destroy(); } catch (e) { }
        }
        if (response.data.destroy) {
          try { response.data.destroy(); } catch (e) { }
        }
        throw err;
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          if (timeoutHandle) clearTimeout(timeoutHandle);

          // Czekaj na zamknięcie
          setTimeout(() => {
            // Sprawdź czy ZIP jest OK
            if (!isValidZipFile(dest)) {
              reject(new Error("Downloaded modpack is corrupted"));
            } else {
              console.log("[Modpack] Download OK");
              resolve();
            }
          }, 100);
        });
        writer.on("error", (err) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(err);
        });
      });
    } catch (err) {
      // Zamknij zasoby
      if (writer && writer.destroy) {
        try { writer.destroy(); } catch (e) { }
      }
      if (response && response.data && response.data.destroy) {
        try { response.data.destroy(); } catch (e) { }
      }

      // Usuń plik
      if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch (e) { }
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 3s, 6s, 12s, 24s, 48s
        const delayMs = Math.pow(2, attempt + 1) * 3000;
        console.log(`[Modpack] Retry in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error(`[Modpack] Failed after ${maxRetries} attempts`);
        throw err;
      }
    }
  }
}

// Pobieranie i instalacja modpacka
async function downloadModpack(mcVersion) {
  const modpack = MODPACKS[mcVersion];
  if (!modpack) {
    console.log(`Brak modpacka dla wersji ${mcVersion}`);
    return;
  }

  const versionModsPath = path.join(modsPath, mcVersion);

  // Utwórz folder mods/wersja
  if (!fs.existsSync(versionModsPath)) {
    fs.mkdirSync(versionModsPath, { recursive: true });
  }

  // Sprawdź czy modpack już istnieje
  const modpackMarker = path.join(versionModsPath, ".modpack_installed");
  if (fs.existsSync(modpackMarker)) {
    console.log(`Modpack dla ${mcVersion} już zainstalowany`);
    return;
  }

  win.webContents.send("status", `Pobieranie modpacka dla ${mcVersion}...`);

  try {
    if (modpack.url) {
      // Pobierz plik ZIP z modpackiem
      const zipPath = path.join(modsPath, `modpack-${mcVersion}.zip`);

      console.log(`Pobieranie z: ${modpack.url}`);

      await downloadModpackFile(modpack.url, zipPath, (downloaded, total) => {
        const percent = ((downloaded / total) * 100).toFixed(0);
        win.webContents.send("status", `Pobieranie modpacka: ${percent}%`);
        sendThrottledProgress(downloaded / total);
      });

      win.webContents.send("status", "Rozpakowywanie modpacka...");

      try {
        // Rozpakuj ZIP do mods/wersja/Preinstalled/
        const extractPath = path.join(versionModsPath, "Preinstalled");
        if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);
        console.log(`Modpack rozpakowany do: ${extractPath}`);

        // Oznacz że modpack zainstalowany (marker w folderze Preinstalled)
        const modpackMarker = path.join(extractPath, ".modpack_installed");
        fs.writeFileSync(modpackMarker, new Date().toISOString());
      } catch (extractErr) {
        console.error(`Błąd rozpakowywania: ${extractErr.message}`);
        throw new Error(`Nie można rozpakowac modpacku: ${extractErr.message}`);
      }

      // Usuń ZIP po rozpakowaniu
      try {
        fs.unlinkSync(zipPath);
      } catch (e) {
        console.log("Nie można usunąć pliku ZIP");
      }
    }

    // Oznacz że modpack zainstalowany
    fs.writeFileSync(modpackMarker, new Date().toISOString());
    console.log(`Modpack dla ${mcVersion} zainstalowany!`);
    win.webContents.send("status", `Modpack dla ${mcVersion} zainstalowany!`);
  } catch (err) {
    console.error(`Błąd pobierania modpacka dla ${mcVersion}:`, err);
    win.webContents.send("status", `Błąd modpacka: ${err.message}`);
    throw err;
  }
}

// Uruchomienie gry z Fabric
ipcMain.on("launch-game", async (event, { version, ram }) => {
  try {
    const baseMcVersion = version.split("-")[0];
    win.webContents.send("status", `Instalacja Fabric ${version}...`);
    sendThrottledProgress(0);

    const { fabricVersion, versionData } = await installFabric(version);

    // Pobierz modpack dla tej wersji
    await downloadModpack(version);

    win.webContents.send("status", "Wyodrębnianie natives...");
    const nativesDir = await extractNatives(versionData.libraries, version);

    win.webContents.send("status", "Przygotowywanie do uruchomienia...");

    // Wczytaj profil Fabric
    const fabricDir = path.join(versionsPath, fabricVersion);
    const profilePath = path.join(fabricDir, `${fabricVersion}.json`);
    const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

    // Zbuduj classpath - WAŻNA KOLEJNOŚĆ!
    const separator = process.platform === "win32" ? ";" : ":";
    const classpathLibs = [];

    // 1. Biblioteki Fabric (PIERWSZEŃSTWO!)
    for (const lib of profile.libraries) {
      if (lib.name) {
        const parts = lib.name.split(":");
        const [group, artifact, version] = parts;
        const groupPath = group.replace(/\./g, "/");
        const jarName = `${artifact}-${version}.jar`;
        const libPath = path.join(
          librariesPath,
          groupPath,
          artifact,
          version,
          jarName,
        );
        if (fs.existsSync(libPath)) {
          classpathLibs.push(libPath);
        }
      }
    }

    // 2. Biblioteki vanilla (zawiera joptsimple!)
    const vanillaJsonPath = path.join(versionsPath, baseMcVersion, `${baseMcVersion}.json`);
    const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonPath, "utf8"));

    // Biblioteki które Fabric już dostarcza (pomijamy duplikaty)
    const fabricProvidedLibs = new Set([
      "org.ow2.asm:asm",
      "org.ow2.asm:asm-analysis",
      "org.ow2.asm:asm-commons",
      "org.ow2.asm:asm-tree",
      "org.ow2.asm:asm-util",
      "net.fabricmc:sponge-mixin",
    ]);

    for (const lib of vanillaJson.libraries) {
      if (!shouldLoadLibrary(lib)) continue;

      // Sprawdź czy to nie jest biblioteka którą Fabric już dostarczył
      if (lib.name) {
        const libName = lib.name.split(":").slice(0, 2).join(":");
        if (fabricProvidedLibs.has(libName)) {
          console.log(`Pomijam duplikat: ${lib.name}`);
          continue;
        }
      }

      if (lib.downloads && lib.downloads.artifact) {
        const artifact = lib.downloads.artifact;
        const libPath = path.join(librariesPath, artifact.path);
        if (fs.existsSync(libPath)) {
          classpathLibs.push(libPath);
        }
      }
    }

    // 3. Vanilla JAR na końcu
    const vanillaJar = path.join(versionsPath, baseMcVersion, `${baseMcVersion}.jar`);
    classpathLibs.push(vanillaJar);

    const classpath = classpathLibs.join(separator);

    // Pobierz globalne ustawienia
    const globalSettings = getGlobalSettings();
    const instanceSettings = getInstanceSettings(version);

    // Argumenty JVM zoptymalizowane pod FPS
    let jvmArgs = [
      "-Djava.net.preferIPv4Stack=true",
      `-Xmx${ram}G`,
      `-Xms${ram}G`,
      `-Djava.library.path=${nativesDir}`,
      `-Dminecraft.launcher.brand=Ogulniega`,
      `-Dminecraft.launcher.version=1.0`,
      // Generational ZGC (Java 21+) jest najlepszy, ale G1 to bezpieczny fallback
      "-XX:+UseG1GC",
      "-XX:MaxGCPauseMillis=50",
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+ParallelRefProcEnabled",
      "-XX:+AlwaysPreTouch",
      "-XX:MaxTenuringThreshold=1",
      "-XX:G1NewSizePercent=30",
      "-XX:G1MaxNewSizePercent=40",
      "-XX:G1HeapRegionSize=8M",
      "-XX:G1ReservePercent=20",
      "-XX:G1HeapWastePercent=5",
      "-XX:G1MixedGCCountTarget=4",
      "-XX:InitiatingHeapOccupancyPercent=15",
      "-XX:G1MixedGCLiveThresholdPercent=90",
      "-XX:G1RSetUpdatingPauseTimePercent=5",
      "-XX:SurvivorRatio=32",
      "-XX:+PerfDisableSharedMem",
      "-XX:+UseStringDeduplication",
      "-XX:+IgnoreUnrecognizedVMOptions",
      "-Duser.language=pl",
      "-Dfabric.skipMcTelemetry=true",
      "-Dcom.mojang.telemetry.enabled=false",
      "-Dmojang.telemetry.disabled=true",
      "-Dorg.lwjgl.system.stackSize=1024", // Fix dla OutOfMemoryError: Out of stack space w VulkanMod
    ];

    // Dodaj własne argumenty JVM jeśli są
    if (globalSettings.customJvmArgs) {
      const customArgs = globalSettings.customJvmArgs.split(/\s+/).filter(a => a.trim() !== "");
      jvmArgs = [...jvmArgs, ...customArgs];
    }

    // Dodaj classpath na końcu list JVM args
    jvmArgs.push(`-cp`, classpath);

    // Main class z profilu Fabric
    const mainClass = profile.mainClass;

    // Utwórz katalog instancji
    const instanceDir = path.join(rootPath, "instances", version);
    if (!fs.existsSync(instanceDir)) {
      fs.mkdirSync(instanceDir, { recursive: true });
    }

    // Zarządzanie modami: łączymy mody z głównego folderu i sekcji Preinstalled
    const instanceModsDir = path.join(instanceDir, "mods");
    const versionModsDir = path.join(modsPath, version);
    const preinstalledDir = path.join(versionModsDir, "Preinstalled");

    // Wyczyść folder mods instancji
    if (fs.existsSync(instanceModsDir)) {
      fs.rmSync(instanceModsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(instanceModsDir, { recursive: true });

    const deployMods = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const src = path.join(dir, file);
        if (fs.statSync(src).isDirectory()) continue;
        if (file.startsWith(".") || file === ".modpack_installed" || file.endsWith(".disabled") || file === ".mods.json") continue;

        // Wykluczenia dla konkretnych wersji (Vulkan Fix)
        if (version.toLowerCase().includes("vulkan") && file.toLowerCase().includes("tutorial")) {
          console.log(`[Vulkan Fix] Pominięto problematyczny mod: ${file}`);
          continue;
        }

        const dest = path.join(instanceModsDir, file);
        try {
          fs.symlinkSync(src, dest, "file");
        } catch (e) {
          try { fs.copyFileSync(src, dest); } catch (e2) { console.error(`Błąd kopiowania moda ${file}:`, e2); }
        }
      }
    };

    // Najpierw te z folderu głównego, potem nadpisujemy/uzupełniamy z Preinstalled
    deployMods(versionModsDir);
    deployMods(preinstalledDir);

    console.log(`Zainstalowano mody w instancji: ${instanceModsDir}`);

    // Argumenty gry
    const gameArgs = [
      "--username",
      "Gracz_Ogulniega",
      "--version",
      fabricVersion,
      "--gameDir",
      instanceDir,
      "--assetsDir",
      assetsPath,
      "--assetIndex",
      versionData.assetIndex.id,
      "--uuid",
      "00000000-0000-0000-0000-000000000000",
      "--accessToken",
      "0",
      "--userType",
      "legacy",
      "--versionType",
      "release",
    ];

    win.webContents.send("status", "Gra się uruchamia...");

    console.log("Uruchamianie z argumentami:");
    console.log("JVM:", jvmArgs.join(" "));
    console.log("Main:", mainClass);
    console.log("Game:", gameArgs.join(" "));

    // Przygotuj komendę startową z wrapperami Linux
    let executable = "java";
    let args = [...jvmArgs, mainClass, ...gameArgs];

    if (globalSettings.gamescope) {
      let gsCmd = [];

      if (globalSettings.gsWidth) gsCmd.push("-w", globalSettings.gsWidth);
      if (globalSettings.gsHeight) gsCmd.push("-h", globalSettings.gsHeight);
      if (globalSettings.gsOutWidth) gsCmd.push("-W", globalSettings.gsOutWidth);
      if (globalSettings.gsOutHeight) gsCmd.push("-H", globalSettings.gsOutHeight);
      if (globalSettings.gsHz) gsCmd.push("-r", globalSettings.gsHz);

      // Skalowanie i Filtry
      if (globalSettings.gsScalingMode) gsCmd.push("-S", globalSettings.gsScalingMode);
      if (globalSettings.gsFilter) gsCmd.push("-F", globalSettings.gsFilter);

      // Fullscreen and Cursor
      if (globalSettings.gsFullscreen) gsCmd.push("-f");

      if (globalSettings.gsCursorFix === false) {
        gsCmd.push("--hide-cursor");
      } else {
        gsCmd.push("--cursor-scale", "1.0");
      }

      gsCmd.push("--");
      args = [...gsCmd, executable, ...args];
      executable = "gamescope";
    }

    if (globalSettings.gameMode) {
      args = [executable, ...args];
      executable = "gamemoderun";
    }

    // Przygotuj środowisko dla gry (Aggressive Wayland/X11 Fix)
    const gameEnv = { ...process.env };

    // Jeśli używamy Gamescope, pomijamy agresywne czyszczenie środowiska, 
    // bo gamescope samo potrzebuje WAYLAND_DISPLAY aby się uruchomić.
    if (!globalSettings.gamescope && (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland")) {
      console.log("[Wayland Extreme Fix] Wymuszanie ścisłego trybu X11 dla wszystkich bibliotek.");
      gameEnv.WAYLAND_DISPLAY = "";
      gameEnv.XDG_SESSION_TYPE = "x11";
      gameEnv.GDK_BACKEND = "x11";
      gameEnv.SDL_VIDEODRIVER = "x11";
      gameEnv.QT_QPA_PLATFORM = "xcb";
      gameEnv.GLFW_VIDEO_PROVIDER = "x11";
      gameEnv._JAVA_AWT_WM_NONREPARENTING = "1";
      gameEnv.__GL_THREADED_OPTIMIZATIONS = "0";

      if (!gameEnv.DISPLAY) gameEnv.DISPLAY = ":0";
    }

    // Uruchom Minecraft
    const minecraft = spawn(executable, args, {
      cwd: instanceDir,
      env: gameEnv,
    });

    // FPS Optimization: Pause monitoring when game starts (keeping window visible for logs)
    isGameRunning = true;
    // win.hide(); // Usunięto na prośbę użytkownika, aby logi były widoczne

    const sendToLogs = (data, isError = false) => {
      const lines = data.toString().split("\n");
      lines.forEach(line => {
        if (line.trim()) {
          const prefix = isError ? "[MC ERROR]: " : "[MC]: ";
          win.webContents.send("status", prefix + line);
        }
      });
    };

    minecraft.stdout.on("data", (data) => {
      console.log(`[MC]: ${data}`);
      sendToLogs(data, false);
    });

    minecraft.stderr.on("data", (data) => {
      console.error(`[MC ERROR]: ${data}`);
      sendToLogs(data, true);
    });

    minecraft.on("close", (code) => {
      console.log(`Minecraft zamknięty z kodem: ${code}`);
      isGameRunning = false;
      if (win && !win.isDestroyed()) {
        win.show();
        win.webContents.send("status", "Gotowy");
        sendThrottledProgress(0);
      }
    });
  } catch (err) {
    console.error("Błąd uruchamiania:", err);
    win.webContents.send("status", "Błąd: " + err.message);
  }
});
