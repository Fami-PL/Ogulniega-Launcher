const si = require("systeminformation");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { assetsPath } = require("../config");

let OPTIMAL_CONCURRENCY = 10;
let isGameRunning = false;

function setGameRunning(status) {
    isGameRunning = status;
}

async function initConcurrency() {
    try {
        const cpus = await si.cpu();
        const cores = cpus.cores || 4;
        OPTIMAL_CONCURRENCY = Math.max(20, Math.min(cores * 2.5, 100));
        console.log(`CPU cores: ${cores}, optimal concurrency: ${OPTIMAL_CONCURRENCY}`);
    } catch (e) {
        console.log("Nie udało się odczytać CPU, używam default: 10");
    }
}

function getOptimalConcurrency() {
    return OPTIMAL_CONCURRENCY;
}

function startMonitoring(targetWin) {
    // Use a reference to check valid window inside the interval
    setInterval(async () => {
        try {
            if (!targetWin || targetWin.isDestroyed()) return;

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

async function getSystemRam() {
    const mem = await si.mem();
    const totalGB = Math.floor(mem.total / 1024 / 1024 / 1024);
    let defaultRam = 2;
    if (totalGB >= 16) defaultRam = 8;
    else if (totalGB >= 8) defaultRam = 4;
    return { total: totalGB, default: defaultRam };
}

async function checkDependencies() {
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
}

async function deleteAssets() {
    try {
        if (fs.existsSync(assetsPath)) {
            fs.rmSync(assetsPath, { recursive: true, force: true });
        }
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

async function reinstallJava() {
    const installScript = path.resolve(__dirname, "../../../install.sh");

    if (fs.existsSync(installScript)) {
        exec(`bash "${installScript}"`, (error) => {
            if (error) console.error(`Błąd reinstall: ${error}`);
        });
        return { success: true };
    }
    return { success: false, message: "Nie znaleziono pliku install.sh" };
}

module.exports = {
    initConcurrency,
    getOptimalConcurrency,
    startMonitoring,
    setGameRunning,
    getSystemRam,
    checkDependencies,
    deleteAssets,
    reinstallJava
};
