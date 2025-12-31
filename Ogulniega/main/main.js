const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");

// Import Modules
const logger = require("./src/utils/logger");
const system = require("./src/utils/system");
const settingsManager = require("./src/managers/settings");
const modsManager = require("./src/managers/mods");
const gameLauncher = require("./src/game/launcher");
const { rootPath } = require("./src/config");

let win;

async function createWindow() {
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

  // Initialize Logger
  logger.setWindow(win);

  // Start System Monitoring
  system.startMonitoring(win);

  win.loadFile(path.join(__dirname, "../render/index.html"));

  // Wayland logs
  if (process.env.WAYLAND_DISPLAY) {
    console.log("Uruchamianie w Waylandzie");
  } else {
    console.log("Uruchamianie w X11");
  }
}

app.whenReady().then(async () => {
  await system.initConcurrency();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ==========================================================================
   IPC HANDLERS REGISTRATION
   ========================================================================== */

// --- System & Hardware ---
ipcMain.handle("get-system-ram", async () => system.getSystemRam());
ipcMain.handle("check-dependencies", async () => system.checkDependencies());
ipcMain.handle("delete-assets", async () => system.deleteAssets());
ipcMain.handle("reinstall-java", async () => system.reinstallJava());

// --- Settings ---
ipcMain.handle("get-global-settings", () => settingsManager.getGlobalSettings());
ipcMain.handle("save-global-settings", (e, s) => settingsManager.saveGlobalSettings(s));
ipcMain.handle("get-instance-settings", (e, v) => settingsManager.getInstanceSettings(v));
ipcMain.handle("save-instance-settings", (e, v, s) => settingsManager.saveInstanceSettings(v, s));
ipcMain.handle("reset-settings", () => settingsManager.resetSettings());

// --- Mods Management ---
ipcMain.handle("get-installed-mod-ids", (e, v) => modsManager.getInstalledModIds(v));
ipcMain.handle("download-mod", (e, params) => modsManager.downloadMod(params));
ipcMain.handle("delete-mod", (e, params) => modsManager.deleteMod(params));
ipcMain.handle("toggle-mod-status", (e, params) => modsManager.toggleModStatus(params));
ipcMain.handle("get-mods-list", (e, v) => modsManager.getModsList(v));
ipcMain.handle("open-mods-folder", (e, v) => modsManager.openModsFolder(v));

// --- Game Launching ---
ipcMain.on("launch-game", async (event, params) => {
  // Note: launchGame uses logger internally to send status updates
  gameLauncher.launchGame(params, () => {
    if (win && !win.isDestroyed()) {
      win.show();
      logger.sendStatus("Gotowy");
      logger.sendProgress(0);
    }
  });
});

// --- Misc Handlers ---
ipcMain.handle("get-fabric-versions", async () => {
  return ["1.20.1", "1.20.1-Vulkan", "1.21.1", "1.21.4", "1.21.6", "1.21.10"];
});

ipcMain.handle("get-init-data", async () => {
  return {
    versions: await ipcMain.invoke("get-fabric-versions"),
    ram: await ipcMain.invoke("get-system-ram"),
  };
});

ipcMain.handle("copy-logs", async (event, version) => {
  try {
    const logPath = path.join(rootPath, "instances", version, "logs", "latest.log");
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, "utf8");
      clipboard.writeText(content);
      return { success: true };
    }
    return { success: false, message: "Nie znaleziono logów dla tej wersji." };
  } catch (e) {
    return { success: false, message: e.message };
  }
});
