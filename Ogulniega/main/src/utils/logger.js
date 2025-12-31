let win = null;
let lastProgressUpdate = 0;

function setWindow(window) {
    win = window;
}

function sendStatus(msg) {
    if (win && !win.isDestroyed()) {
        win.webContents.send("status", msg);
    }
}

// Just send to log (detailed info), don't update status text
function log(msg) {
    if (win && !win.isDestroyed()) {
        win.webContents.send("status", `[LOG] ${msg}`);
    }
}

function sendPercentage(msg) {
    if (win && !win.isDestroyed()) {
        win.webContents.send("percentage", msg);
    }
}

function sendProgress(p) {
    const now = Date.now();
    if (now - lastProgressUpdate > 500 || p === 0 || p === 1) {
        if (win && !win.isDestroyed()) {
            win.webContents.send("progress-bar", p);
            lastProgressUpdate = now;
        }
    }
    global.sendThrottledProgress = sendProgress; // Maintain compatibility if needed globally
}

function sendToLogs(data, isError = false) {
    const lines = data.toString().split("\n");
    lines.forEach(line => {
        if (line.trim()) {
            const prefix = isError ? "[MC ERROR]: " : "[MC]: ";
            if (win && !win.isDestroyed()) {
                win.webContents.send("status", prefix + line);
            }
        }
    });
};


module.exports = {
    setWindow,
    sendStatus,
    log,
    sendProgress,
    sendToLogs,
    sendPercentage
};
