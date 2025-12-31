const fs = require("fs");
const path = require("path");
const axios = require("axios");
const AdmZip = require("adm-zip");
const logger = require("./logger");

function isValidZipFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const stats = fs.statSync(filePath);
        if (stats.size < 22) return false;

        const buffer = Buffer.alloc(4);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, buffer, 0, 4, 0);
        fs.closeSync(fd);

        if (buffer.toString("hex") !== "504b0304") {
            logger.log(`Invalid ZIP header for ${filePath}: ${buffer.toString("hex")}`);
            return false;
        }

        new AdmZip(filePath);
        return true;
    } catch (e) {
        logger.log(`ZIP validation error for ${filePath}: ${e.message}`);
        return false;
    }
}

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

async function downloadFile(url, dest, onProgress, maxRetries = 4) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        let writer, response;
        try {
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            if (fs.existsSync(dest)) {
                if (dest.endsWith(".jar") || dest.endsWith(".zip")) {
                    if (isValidZipFile(dest)) {
                        // logger.log(`File OK (cached): ${path.basename(dest)}`);
                        return;
                    } else {
                        logger.log(`Corrupted file detected, removing: ${path.basename(dest)}`);
                        try {
                            fs.unlinkSync(dest);
                        } catch (e) { }
                    }
                } else {
                    return;
                }
            }

            console.log(`Downloading [${attempt + 1}/${maxRetries}]: ${path.basename(dest)}`);

            writer = fs.createWriteStream(dest);
            response = await axios({
                url,
                method: "GET",
                responseType: "stream",
                timeout: 60000,
                family: 4,
            });

            const totalLength = response.headers["content-length"];
            let downloadedLength = 0;
            let timeoutHandle;
            const maxInactivityTime = 60000;

            response.data.on("data", (chunk) => {
                downloadedLength += chunk.length;
                if (onProgress && totalLength) {
                    onProgress(downloadedLength, totalLength);
                }
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
                    try {
                        writer.destroy();
                    } catch (e) { }
                }
                if (response.data.destroy) {
                    try {
                        response.data.destroy();
                    } catch (e) { }
                }
                throw err;
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on("finish", () => {
                    if (timeoutHandle) clearTimeout(timeoutHandle);
                    setTimeout(() => {
                        if (dest.endsWith(".jar") || dest.endsWith(".zip")) {
                            if (!isValidZipFile(dest)) {
                                reject(new Error("Downloaded file is corrupted or incomplete"));
                            } else {
                                // console.log(`Download OK: ${path.basename(dest)}`);
                                resolve();
                            }
                        } else {
                            // console.log(`Download OK: ${path.basename(dest)}`);
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
            if (writer && writer.destroy) {
                try {
                    writer.destroy();
                } catch (e) { }
            }
            if (response && response.data && response.data.destroy) {
                try {
                    response.data.destroy();
                } catch (e) { }
            }
            if (fs.existsSync(dest)) {
                try {
                    fs.unlinkSync(dest);
                } catch (e) { }
            }

            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 2000;
                let msg = `Error: ${err.message}`;
                if (err.response) msg += ` (Status: ${err.response.status})`;
                logger.log(`Retry ${attempt + 1}/${maxRetries} (${msg}) in ${delay}ms: ${url}`);
                await new Promise((r) => setTimeout(r, delay));
            } else {
                let msg = `Failed: ${err.message}`;
                if (err.response) msg += ` (Status: ${err.response.status})`;
                logger.log(`[Error] ${msg} - URL: ${url}`);
                throw err;
            }
        }
    }
}

async function downloadModpackFile(url, dest, onProgress) {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        let writer, response;
        try {
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
                timeout: 120000,
            });

            const totalLength = response.headers["content-length"];
            let downloadedLength = 0;
            let timeoutHandle;

            response.data.on("data", (chunk) => {
                downloadedLength += chunk.length;
                if (onProgress && totalLength) {
                    onProgress(downloadedLength, totalLength);
                }
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
                    setTimeout(() => {
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
            if (writer && writer.destroy) {
                try { writer.destroy(); } catch (e) { }
            }
            if (response && response.data && response.data.destroy) {
                try { response.data.destroy(); } catch (e) { }
            }
            if (fs.existsSync(dest)) {
                try { fs.unlinkSync(dest); } catch (e) { }
            }

            if (attempt < maxRetries - 1) {
                const delayMs = Math.pow(2, attempt + 1) * 3000;
                let msg = `Error: ${err.message}`;
                if (err.response) msg += ` (Status: ${err.response.status})`;
                logger.log(`[Modpack] Retry (${msg}) in ${delayMs}ms (${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delayMs));
            } else {
                let msg = `Failed: ${err.message}`;
                if (err.response) msg += ` (Status: ${err.response.status})`;
                logger.log(`[Modpack Error] ${msg}`);
                throw err;
            }
        }
    }
}

module.exports = {
    isValidZipFile,
    shouldLoadLibrary,
    downloadFile,
    downloadModpackFile
};
