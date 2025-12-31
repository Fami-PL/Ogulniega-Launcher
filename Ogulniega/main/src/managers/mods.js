const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { modsPath } = require("../config");
const { downloadModpackFile } = require("../utils/helpers");
const logger = require("../utils/logger");
const { MODPACKS } = require("../config");

// Track Mod ID
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
            logger.log(`Untracked mod: ${filename} (ID: ${projectId})`);
        }
    } catch (err) {
        console.error("Untrack error:", err);
    }
}

function getInstalledModIds(version) {
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
}

async function downloadMod({ url, filename, version, projectId }) {
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
}

function deleteMod({ version, filename, isPreinstalled }) {
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
}

function toggleModStatus({ version, filename, isPreinstalled }) {
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
}

function getModsList(version) {
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
}

async function installModpack(mcVersion) {
    const modpack = MODPACKS[mcVersion];
    if (!modpack) {
        logger.log(`Brak modpacka dla wersji ${mcVersion}`);
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
        logger.log(`Modpack dla ${mcVersion} już zainstalowany`);
        return;
    }

    logger.sendStatus(`Pobieranie modpacka dla ${mcVersion}...`);

    try {
        if (modpack.url) {
            // Pobierz plik ZIP z modpackiem
            const zipPath = path.join(modsPath, `modpack-${mcVersion}.zip`);

            logger.log(`Pobieranie z: ${modpack.url}`);

            await downloadModpackFile(modpack.url, zipPath, (downloaded, total) => {
                const percent = ((downloaded / total) * 100).toFixed(0);
                logger.sendStatus(`Pobieranie modpacka: ${percent}%`);
                logger.sendProgress(downloaded / total);
            });

            logger.sendStatus("Rozpakowywanie modpacka...");

            try {
                // Rozpakuj ZIP do mods/wersja/Preinstalled/
                const extractPath = path.join(versionModsPath, "Preinstalled");
                if (!fs.existsSync(extractPath)) fs.mkdirSync(extractPath, { recursive: true });

                const AdmZip = require("adm-zip");
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(extractPath, true);
                logger.log(`Modpack rozpakowany do: ${extractPath}`);

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
                logger.log("Nie można usunąć pliku ZIP");
            }
        }

        // Oznacz że modpack zainstalowany
        fs.writeFileSync(modpackMarker, new Date().toISOString());
        logger.log(`Modpack dla ${mcVersion} zainstalowany!`);
        logger.sendStatus(`Modpack dla ${mcVersion} zainstalowany!`);
    } catch (err) {
        console.error(`Błąd pobierania modpacka dla ${mcVersion}:`, err);
        logger.sendStatus(`Błąd modpacka: ${err.message}`);
        throw err;
    }
}

async function openModsFolder(version) {
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
}

module.exports = {
    trackModId,
    untrackMod,
    getInstalledModIds,
    downloadMod,
    deleteMod,
    toggleModStatus,
    getModsList,
    installModpack,
    openModsFolder
};
