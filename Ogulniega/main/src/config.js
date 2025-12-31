const path = require("path");
const os = require("os");

const rootPath = path.join(process.env.HOME || os.homedir(), ".Ogulniega");
const versionsPath = path.join(rootPath, "versions");
const librariesPath = path.join(rootPath, "libraries");
const assetsPath = path.join(rootPath, "assets");
const nativesPath = path.join(rootPath, "natives");
const modsPath = path.join(rootPath, "mods");

const MODPACKS = {
    "1.20.1": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.20.1/modpack-1.20.1.zip",
    },
    "1.20.1-Vulkan": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.20.1-Vulkan/modpack-1.20.1-vulkan.zip",
    },
    "1.21.1": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.1/modpack-1.21.1.zip",
    },
    "1.21.4": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.4/modpack-1.21.4.zip",
    },
    "1.21.6": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.6/modpack-1.21.6.zip",
    },
    "1.21.10": {
        url: "https://github.com/Fami-PL/Ogulniega-Mods/releases/download/1.21.10/modpack.1.21.10.zip",
    },
};

module.exports = {
    rootPath,
    versionsPath,
    librariesPath,
    assetsPath,
    nativesPath,
    modsPath,
    MODPACKS,
};
