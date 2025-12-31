const fs = require("fs");
const path = require("path");
const { rootPath } = require("../config");

// Instance Settings
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

function saveInstanceSettings(version, settings) {
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
}

// Global Settings
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
        };
    }
    return { gameMode: false, gamescope: false, customJvmArgs: "" };
}

function saveGlobalSettings(settings) {
    try {
        if (!fs.existsSync(rootPath)) {
            fs.mkdirSync(rootPath, { recursive: true });
        }
        fs.writeFileSync(globalSettingsPath, JSON.stringify(settings, null, 2));
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function resetSettings() {
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
}

module.exports = {
    getInstanceSettings,
    saveInstanceSettings,
    getGlobalSettings,
    saveGlobalSettings,
    resetSettings
};
