const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { spawn } = require("child_process");
const AdmZip = require("adm-zip");
const {
    versionsPath,
    librariesPath,
    assetsPath,
    nativesPath,
    rootPath,
    modsPath
} = require("../config");
const {
    downloadFile,
    shouldLoadLibrary
} = require("../utils/helpers");
const logger = require("../utils/logger");
const { getOptimalConcurrency } = require("../utils/system");
const { installModpack } = require("../managers/mods");
const { getGlobalSettings, getInstanceSettings } = require("../managers/settings");

const MAX_ASSET_CONCURRENCY = 25;

async function extractNatives(libraries, mcVersion) {
    const nativesTempPath = path.join(nativesPath, mcVersion);

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
                        logger.log(`Błąd wyodrębniania ${nativePath}: ${err.message}`);
                    }
                }
            }
        }
    }

    return nativesTempPath;
}

async function installFabric(mcVersion) {
    logger.sendStatus(`Pobieranie Fabric dla ${mcVersion}...`);

    const baseMcVersion = mcVersion.split("-")[0];

    const loaderResponse = await axios.get(
        "https://meta.fabricmc.net/v2/versions/loader",
    );
    const fabricLoader = loaderResponse.data[0].version;

    const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${baseMcVersion}/${fabricLoader}/profile/json`;
    const profileResponse = await axios.get(profileUrl);
    const profile = profileResponse.data;

    const fabricVersion = `fabric-loader-${fabricLoader}-${mcVersion}`;
    const fabricDir = path.join(versionsPath, fabricVersion);

    if (!fs.existsSync(fabricDir)) {
        fs.mkdirSync(fabricDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(fabricDir, `${fabricVersion}.json`),
        JSON.stringify(profile, null, 2),
    );

    logger.sendStatus(`Pobieranie Minecraft ${baseMcVersion}...`);
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

    fs.writeFileSync(
        path.join(vanillaDir, `${mcVersion}.json`),
        JSON.stringify(versionData, null, 2),
    );

    const clientJarPath = path.join(vanillaDir, `${mcVersion}.jar`);
    if (!fs.existsSync(clientJarPath)) {
        await downloadFile(versionData.downloads.client.url, clientJarPath);
    }

    logger.sendStatus("Pobieranie bibliotek Minecraft...");

    const vanillaLibsToDownload = [];
    for (const lib of versionData.libraries) {
        if (!shouldLoadLibrary(lib)) continue;

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

    const OPTIMAL_CONCURRENCY = getOptimalConcurrency();
    const CONCURRENT_LIBS = Math.min(4, Math.ceil(OPTIMAL_CONCURRENCY / 4));
    for (let i = 0; i < vanillaLibsToDownload.length; i += CONCURRENT_LIBS) {
        const batch = vanillaLibsToDownload.slice(i, i + CONCURRENT_LIBS);
        const results = await Promise.allSettled(
            batch.map(lib => downloadFile(lib.url, lib.path))
        );

        results.forEach((result, idx) => {
            if (result.status === 'rejected') {
                logger.log(`Błąd pobierania biblioteki ${batch[idx].url}: ${result.reason?.message}`);
            }
        });
    }

    logger.sendStatus("Pobieranie bibliotek Fabric...");

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

    const CONCURRENT_FABRIC = Math.min(4, Math.ceil(OPTIMAL_CONCURRENCY / 4));
    for (let i = 0; i < fabricLibsToDownload.length; i += CONCURRENT_FABRIC) {
        const batch = fabricLibsToDownload.slice(i, i + CONCURRENT_FABRIC);
        const results = await Promise.allSettled(
            batch.map(async (lib) => {
                try {
                    await downloadFile(lib.url, lib.libPath);
                } catch (err) {
                    await downloadFile(lib.fallbackUrl, lib.libPath);
                }
            })
        );

        results.forEach((result, idx) => {
            if (result.status === 'rejected') {
                logger.log(`Błąd pobierania biblioteki Fabric: ${result.reason?.message}`);
            }
        });
    }

    logger.sendStatus("Pobieranie assetów...");
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

    logger.sendStatus(`Pobieranie assetów (${totalAssets})...`);

    const CONCURRENT_DOWNLOADS = Math.min(OPTIMAL_CONCURRENCY, MAX_ASSET_CONCURRENCY);

    let assetIndex_queue = [...assets];
    let downloading = 0;

    const downloadWorker = async () => {
        while (true) {
            if (assetIndex_queue.length === 0 && downloading === 0) {
                break;
            }

            if (assetIndex_queue.length === 0) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            downloading++;
            const item = assetIndex_queue.shift();
            if (!item) {
                downloading--;
                continue;
            }
            const [name, asset] = item;

            try {
                const hash = asset.hash;
                const subPath = hash.substring(0, 2);
                const assetPath = path.join(objectsDir, subPath, hash);

                const assetUrl = `https://resources.download.minecraft.net/${subPath}/${hash}`;
                await downloadFile(assetUrl, assetPath);

                downloaded++;
                logger.sendStatus(`Assety: ${downloaded}/${totalAssets}`);
                logger.sendProgress(downloaded / totalAssets);
            } catch (err) {
                console.error(`Błąd pobierania assetu:`, err.message);
            } finally {
                downloading--;
            }
        }
    };

    const workerPromises = [];
    for (let w = 0; w < CONCURRENT_DOWNLOADS; w++) {
        workerPromises.push(downloadWorker());
    }

    await Promise.all(workerPromises);

    logger.log(`Wszystkie ${totalAssets} assetów pobrane!`);

    return { fabricVersion, versionData };
}

async function launchGame({ version, ram }, onFinish) {
    try {
        const baseMcVersion = version.split("-")[0];
        logger.sendStatus(`Instalacja Fabric ${version}...`);
        logger.sendProgress(0);

        const { fabricVersion, versionData } = await installFabric(version);

        await installModpack(version);

        logger.sendStatus("Wyodrębnianie natives...");
        const nativesDir = await extractNatives(versionData.libraries, version);

        logger.sendStatus("Przygotowywanie do uruchomienia...");

        const fabricDir = path.join(versionsPath, fabricVersion);
        const profilePath = path.join(fabricDir, `${fabricVersion}.json`);
        const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

        const separator = process.platform === "win32" ? ";" : ":";
        const classpathLibs = [];

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

        const vanillaJsonPath = path.join(versionsPath, baseMcVersion, `${baseMcVersion}.json`);
        const vanillaJson = JSON.parse(fs.readFileSync(vanillaJsonPath, "utf8"));

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

            if (lib.name) {
                const libName = lib.name.split(":").slice(0, 2).join(":");
                if (fabricProvidedLibs.has(libName)) {
                    logger.log(`Pomijam duplikat: ${lib.name}`);
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

        const vanillaJar = path.join(versionsPath, baseMcVersion, `${baseMcVersion}.jar`);
        classpathLibs.push(vanillaJar);

        const classpath = classpathLibs.join(separator);

        const globalSettings = getGlobalSettings();

        let jvmArgs = [
            "-Djava.net.preferIPv4Stack=true",
            `-Xmx${ram}G`,
            `-Xms${ram}G`,
            `-Djava.library.path=${nativesDir}`,
            `-Dminecraft.launcher.brand=Ogulniega`,
            `-Dminecraft.launcher.version=1.0`,
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
            "-Dorg.lwjgl.system.stackSize=1024",
        ];

        if (globalSettings.customJvmArgs) {
            const customArgs = globalSettings.customJvmArgs.split(/\s+/).filter(a => a.trim() !== "");
            jvmArgs = [...jvmArgs, ...customArgs];
        }

        jvmArgs.push(`-cp`, classpath);

        const mainClass = profile.mainClass;

        const instanceDir = path.join(rootPath, "instances", version);
        if (!fs.existsSync(instanceDir)) {
            fs.mkdirSync(instanceDir, { recursive: true });
        }

        const instanceModsDir = path.join(instanceDir, "mods");
        const versionModsDir = path.join(modsPath, version);
        const preinstalledDir = path.join(versionModsDir, "Preinstalled");

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

                if (version.toLowerCase().includes("vulkan") && file.toLowerCase().includes("tutorial")) {
                    logger.log(`[Vulkan Fix] Pominięto problematyczny mod: ${file}`);
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

        deployMods(versionModsDir);
        deployMods(preinstalledDir);

        logger.log(`Zainstalowano mody w instancji: ${instanceModsDir}`);

        const gameArgs = [
            "--username", "Gracz_Ogulniega",
            "--version", fabricVersion,
            "--gameDir", instanceDir,
            "--assetsDir", assetsPath,
            "--assetIndex", versionData.assetIndex.id,
            "--uuid", "00000000-0000-0000-0000-000000000000",
            "--accessToken", "0",
            "--userType", "legacy",
            "--versionType", "release",
        ];

        logger.sendStatus("Gra się uruchamia...");

        let executable = "java";
        let args = [...jvmArgs, mainClass, ...gameArgs];

        if (globalSettings.gamescope) {
            let gsCmd = [];

            if (globalSettings.gsWidth) gsCmd.push("-w", globalSettings.gsWidth);
            if (globalSettings.gsHeight) gsCmd.push("-h", globalSettings.gsHeight);
            if (globalSettings.gsOutWidth) gsCmd.push("-W", globalSettings.gsOutWidth);
            if (globalSettings.gsOutHeight) gsCmd.push("-H", globalSettings.gsOutHeight);
            if (globalSettings.gsHz) gsCmd.push("-r", globalSettings.gsHz);
            if (globalSettings.gsScalingMode) gsCmd.push("-S", globalSettings.gsScalingMode);
            if (globalSettings.gsFilter) gsCmd.push("-F", globalSettings.gsFilter);
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

        const gameEnv = { ...process.env };

        if (!globalSettings.gamescope && (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland")) {
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

        const minecraft = spawn(executable, args, {
            cwd: instanceDir,
            env: gameEnv,
        });

        // Set game running status
        const { setGameRunning } = require("../utils/system");
        setGameRunning(true);

        minecraft.stdout.on("data", (data) => {
            // console.log(`[MC]: ${data}`);
            logger.sendToLogs(data, false);
        });

        minecraft.stderr.on("data", (data) => {
            // console.error(`[MC ERROR]: ${data}`);
            logger.sendToLogs(data, true);
        });

        minecraft.on("close", (code) => {
            logger.log(`Minecraft zamknięty z kodem: ${code}`);
            setGameRunning(false);
            if (onFinish) onFinish();
        });

    } catch (err) {
        logger.log("Błąd uruchamiania: " + err.message);
        logger.sendStatus("Błąd: " + err.message);
    }
}

module.exports = {
    launchGame
};
