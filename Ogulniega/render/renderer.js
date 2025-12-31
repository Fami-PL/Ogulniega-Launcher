let selectedVersion = null;
let isLaunching = false;
let currentLang = "en";

const TRANSLATIONS = {
  en: {
    "nav-home": "Main Menu",
    "nav-settings": "Settings",
    "nav-logs": "Game Logs",
    "lang-section-title": "General Settings",
    "lang-select-label": "Language",
    "linux-section-title": "Linux Integration",
    "java-section-title": "Java Parameters",
    "debug-section-title": "Debugging & Maintenance",
    "label-scaling": "Scaling",
    "label-filter": "Filter/FSR",
    "label-cursor": "Show Cursor",
    "label-fullscreen": "Force Fullscreen",
    "label-jvm-args": "Enter custom JVM arguments...",
    "btn-delete-assets": "Delete Assets",
    "btn-reinstall-java": "Reinstall Java",
    "btn-reset-settings": "Reset Settings",
    "btn-copy-logs": "Copy Logs",
    "label-ram": "RAM:",
    "status-ready": "Ready to play",
    "launch-btn": "PLAY",
    "download-mods-btn": "DOWNLOAD MODPACK",
    "logs-title": "Console Logs",
    "btn-clear-logs": "Clear",
    "log-waiting": "Waiting for game to start...",
    "opt-select-version": "Select Version...",
    "dep-installed": "✓ INSTALLED",
    "dep-missing": "✗ MISSING",
    "nav-mods": "Mods",
    "mods-browser-title": "Mod Browser",
    "mods-search-placeholder": "Search for mods...",
    "btn-mods-search": "Search",
    "btn-open-mods": "Open Folder",
    "mods-placeholder": "Search for something to get started...",
    "accent-select-label": "Accent Color",
    "opt-gold": "Original Gold",
    "opt-blue": "Sapphire Blue",
    "opt-red": "Flame Red",
    "opt-green": "Emerald Green",
    "opt-purple": "Royal Purple",
    "opt-fit": "Fit (Proportions)",
    "opt-fill": "Fill",
    "opt-stretch": "Stretch (No bars)",
    "opt-linear": "Linear",
    "opt-nearest": "Nearest Neighbor",
    "opt-fsr": "AMD FSR",
    "opt-nis": "NVIDIA NIS",
    "pro-header": "PRO CONFIGURATION",
    "label-gs-width": "Inner Width",
    "label-gs-height": "Inner Height",
    "label-gs-out-width": "Outer Width",
    "label-gs-out-height": "Outer Height",
    "label-gs-hz": "Refresh Rate (Hz)",
    "confirm-delete-assets": "Delete assets?",
    "confirm-reinstall-java": "Reinstall Java?",
    "confirm-reset-settings": "Reset settings?",
    "confirm-copy-logs": "Logs copied to clipboard",
    "error-copy-logs": "Failed to copy logs",
    "confirm-delete-mod": "Are you sure you want to delete:",
    "tab-browser": "Browser",
    "tab-installed": "Installed",
    "cat-my-mods": "My Mods",
    "cat-preinstalled": "Preinstalled",
    "no-mods": "No mods installed.",
    "no-preinstalled": "No preinstalled mods.",
    "btn-disable": "Disable",
    "opt-sort-downloads": "Most Popular",
    "opt-sort-relevance": "Best Match",
    "opt-sort-newest": "Newest",
    "opt-sort-updated": "Recently Updated"
  },
  pl: {
    "nav-home": "Menu Główne",
    "nav-settings": "Ustawienia",
    "nav-logs": "Logi Gry",
    "lang-section-title": "Ustawienia Ogólne",
    "lang-select-label": "Język",
    "linux-section-title": "Integracja Linux",
    "java-section-title": "Parametry Javy",
    "debug-section-title": "Debugowanie i Konserwacja",
    "label-scaling": "Skalowanie",
    "label-filter": "Filtr/FSR",
    "label-cursor": "Pokaż kursor",
    "label-fullscreen": "Wymuś Pełny Ekran",
    "label-jvm-args": "Wpisz własne argumenty JVM...",
    "btn-delete-assets": "Usuń Assets",
    "btn-reinstall-java": "Przeinstaluj Javę",
    "btn-reset-settings": "Resetuj Ustawienia",
    "btn-copy-logs": "Kopiuj Logi",
    "label-ram": "RAM:",
    "status-ready": "Gotowy do gry",
    "launch-btn": "GRAJ",
    "download-mods-btn": "POBIERZ MODPACK",
    "logs-title": "Logi Konsoli",
    "btn-clear-logs": "Wyczyść",
    "log-waiting": "Oczekiwanie na uruchomienie gry...",
    "opt-select-version": "Wybierz wersję...",
    "dep-installed": "✓ ZAINSTALOWANO",
    "dep-missing": "✗ BRAK",
    "nav-mods": "Mody",
    "mods-browser-title": "Przeglądarka Modów",
    "mods-search-placeholder": "Szukaj modów...",
    "btn-mods-search": "SZUKAJ",
    "btn-open-mods": "Otwórz Folder",
    "mods-placeholder": "Wyszukaj coś, aby zacząć...",
    "accent-select-label": "Kolor Akcentu",
    "opt-gold": "Oryginalny Złoty",
    "opt-blue": "Szafirowy Błękit",
    "opt-red": "Ognista Czerwień",
    "opt-green": "Szmaragdowa Zieleń",
    "opt-purple": "Królewski Fiolet",
    "opt-fit": "Dopasuj (Proporcje)",
    "opt-fill": "Wypełnij",
    "opt-stretch": "Rozciągnij (Brak pasów)",
    "opt-linear": "Liniowy",
    "opt-nearest": "Najbliższy sąsiad",
    "opt-fsr": "AMD FSR",
    "opt-nis": "NVIDIA NIS",
    "pro-header": "KONFIGURACJA PRO",
    "label-gs-width": "Szerokość (Wew.)",
    "label-gs-height": "Wysokość (Wew.)",
    "label-gs-out-width": "Szerokość (Wyj.)",
    "label-gs-out-height": "Wysokość (Wyj.)",
    "label-gs-hz": "Odświeżanie (Hz)",
    "confirm-delete-assets": "Usuń assety?",
    "confirm-reinstall-java": "Instalacja Java?",
    "confirm-reset-settings": "Reset ustawień?",
    "confirm-copy-logs": "Kopiuj OK",
    "error-copy-logs": "Błąd",
    "confirm-delete-mod": "Czy na pewno chcesz usunąć moda:",
    "tab-browser": "Przeglądarka",
    "tab-installed": "Zainstalowane",
    "cat-my-mods": "Moje Mody",
    "cat-preinstalled": "Preinstalled",
    "no-mods": "Brak zainstalowanych modów.",
    "no-preinstalled": "Brak preinstalowanych modów.",
    "select-ver-first": "Wybierz wersję gry, aby zobaczyć mody.",
    "loading": "Ładowanie...",
    "btn-disable": "Wyłącz",
    "opt-sort-downloads": "Najpopularniejsze",
    "opt-sort-relevance": "Najtrafniejsze",
    "opt-sort-newest": "Najnowsze",
    "opt-sort-updated": "Ostatnio aktualizowane"
  }
};

window.TRANSLATIONS = TRANSLATIONS;
window.currentLang = currentLang;

document.addEventListener("DOMContentLoaded", async () => {
  // Elements - CACHED
  const els = {
    ramSlider: document.getElementById("ram-slider"),
    ramValue: document.getElementById("ram-value"),
    versionSelect: document.getElementById("version-select"),
    launchBtn: document.getElementById("launch-btn"),
    modsBtn: document.getElementById("download-mods-btn"),
    progressBar: document.getElementById("progress-bar"),
    statusLine: document.getElementById("status"),
    logContainer: document.getElementById("log-output"),
    btnClearLogs: document.getElementById("btn-clear-logs"),
    gmToggle: document.getElementById("setting-gamemode"),
    gsToggle: document.getElementById("setting-gamescope"),
    jvmArgsArea: document.getElementById("setting-jvm-args"),
    gsParams: document.getElementById("gamescope-params"),
    gsOptionsContainer: document.getElementById("gamescope-options-container"),
    statusGM: document.getElementById("status-gamemode"),
    statusGS: document.getElementById("status-gamescope"),
    langSelect: document.getElementById("setting-lang"),
    accentSelect: document.getElementById("setting-accent"),
    dashCPU: document.getElementById("dash-cpu-bar"),
    dashRAM: document.getElementById("dash-ram-bar"),
    dashCPUVal: document.getElementById("dash-cpu-val"),
    dashRAMVal: document.getElementById("dash-ram-val"),
    modsBrowserTab: document.getElementById("tab-mods-browser"),
    modsInstalledTab: document.getElementById("tab-mods-installed"),
    modsBrowserView: document.getElementById("mods-browser-view"),
    modsInstalledView: document.getElementById("mods-installed-view"),
    myModsList: document.getElementById("my-mods-list"),
    preinstalledModsList: document.getElementById("preinstalled-mods-list")
  };

  const gsControls = {
    gsW: document.getElementById("gs-width"),
    gsH: document.getElementById("gs-height"),
    gsOutW: document.getElementById("gs-out-width"),
    gsOutH: document.getElementById("gs-out-height"),
    gsHz: document.getElementById("gs-hz"),
    gsScalingMode: document.getElementById("gs-scaling-mode"),
    gsFilter: document.getElementById("gs-filter"),
    gsCursorFix: document.getElementById("gs-cursor-fix"),
    gsFullscreen: document.getElementById("gs-fullscreen")
  };

  const sidebarBtns = {
    home: document.getElementById("nav-home"),
    settings: document.getElementById("nav-settings"),
    logs: document.getElementById("nav-logs"),
    mods: document.getElementById("nav-mods"),
  };
  const views = {
    home: document.getElementById("view-home"),
    settings: document.getElementById("view-settings"),
    logs: document.getElementById("view-logs"),
    mods: document.getElementById("view-mods"),
  };

  const applyAccent = (accent) => {
    document.body.className = accent === "gold" ? "" : `theme-${accent}`;
    if (els.accentSelect) els.accentSelect.value = accent;
  };

  // Translation function
  const applyLanguage = (lang) => {
    currentLang = lang;
    window.currentLang = lang; // Synchronize global
    const t = TRANSLATIONS[lang];
    if (!t) return;

    if (els.langSelect) els.langSelect.value = lang;

    // Sidebar
    if (sidebarBtns.home) sidebarBtns.home.innerHTML = `<span class="icon">🏠</span> <span>${t["nav-home"]}</span>`;
    if (sidebarBtns.settings) sidebarBtns.settings.innerHTML = `<span class="icon">⚙️</span> <span>${t["nav-settings"]}</span>`;
    if (sidebarBtns.logs) sidebarBtns.logs.innerHTML = `<span class="icon">📜</span> <span>${t["nav-logs"]}</span>`;
    if (sidebarBtns.mods) sidebarBtns.mods.innerHTML = `<span class="icon">🧩</span> <span>${t["nav-mods"]}</span>`;

    // Section Titles & Labels
    const directUpdates = {
      "mods-browser-title": t["mods-browser-title"],
      "btn-mods-search": t["btn-mods-search"],
      "lang-section-title": t["lang-section-title"],
      "lang-select-label": t["lang-select-label"],
      "accent-select-label": t["accent-select-label"],
      "linux-section-title": t["linux-section-title"],
      "java-section-title": t["java-section-title"],
      "debug-section-title": t["debug-section-title"],
      "logs-view-title": t["logs-title"],
      "btn-clear-logs": t["btn-clear-logs"],
      "category-my-mods": t["cat-my-mods"],
      "category-preinstalled": t["cat-preinstalled"],
      "tab-mods-browser": t["tab-browser"],
      "tab-mods-installed": t["tab-installed"],
      "launch-btn": isLaunching ? t["launching"] || "Launching..." : t["launch-btn"],
      "btn-delete-assets": t["btn-delete-assets"],
      "btn-reinstall-java": t["btn-reinstall-java"],
      "btn-reset-settings": t["btn-reset-settings"],
      "btn-copy-logs": t["btn-copy-logs"]
    };

    Object.entries(directUpdates).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });

    if (els.modsBtn) els.modsBtn.textContent = t["download-mods-btn"];
    if (document.getElementById("mods-search-input")) document.getElementById("mods-search-input").placeholder = t["mods-search-placeholder"];
    if (els.jvmArgsArea) els.jvmArgsArea.placeholder = t["label-jvm-args"];

    if (document.getElementById("btn-open-mods")) {
      document.getElementById("btn-open-mods").innerHTML = `<span class="icon-folder"></span> ${t["btn-open-mods"]}`;
    }

    const placeholder = document.querySelector(".mods-placeholder");
    if (placeholder) placeholder.textContent = t["mods-placeholder"];

    // Gamescope labels & options
    const gsLabels = {
      "gs-scaling-label": t["label-scaling"],
      "gs-filter-label": t["label-filter"],
      "gs-cursor-fix-label": t["label-cursor"], // Fixed ID reference
      "gs-fullscreen-label": t["label-fullscreen"],
      "pro-header-text": t["pro-header"],
      "gs-width-label": t["label-gs-width"],
      "gs-height-label": t["label-gs-height"],
      "gs-out-width-label": t["label-gs-out-width"],
      "gs-out-height-label": t["label-gs-out-height"],
      "gs-hz-label": t["label-gs-hz"]
    };

    Object.entries(gsLabels).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });

    if (gsControls.gsScalingMode) {
      gsControls.gsScalingMode.options[0].textContent = t["opt-fit"];
      gsControls.gsScalingMode.options[1].textContent = t["opt-fill"];
      gsControls.gsScalingMode.options[2].textContent = t["opt-stretch"];
    }
    if (gsControls.gsFilter) {
      gsControls.gsFilter.options[0].textContent = t["opt-linear"];
      gsControls.gsFilter.options[1].textContent = t["opt-nearest"];
      gsControls.gsFilter.options[2].textContent = t["opt-fsr"];
      gsControls.gsFilter.options[3].textContent = t["opt-nis"];
    }

    if (els.accentSelect) {
      els.accentSelect.options[0].textContent = t["opt-gold"];
      els.accentSelect.options[1].textContent = t["opt-blue"];
      els.accentSelect.options[2].textContent = t["opt-red"];
      els.accentSelect.options[3].textContent = t["opt-green"];
      els.accentSelect.options[4].textContent = t["opt-purple"];
    }

    const sortSelect = document.getElementById("mods-sort-select");
    if (sortSelect && sortSelect.options.length >= 4) {
      sortSelect.options[0].textContent = t["opt-sort-downloads"];
      sortSelect.options[1].textContent = t["opt-sort-relevance"];
      sortSelect.options[2].textContent = t["opt-sort-newest"];
      sortSelect.options[3].textContent = t["opt-sort-updated"];
    }
    // Home
    if (document.getElementById("ram-label-text")) document.getElementById("ram-label-text").textContent = t["label-ram"];
    if (els.launchBtn) els.launchBtn.textContent = t["launch-btn"];
    if (els.modsBtn) els.modsBtn.textContent = t["download-mods-btn"];
    if (els.statusLine && els.statusLine.textContent === TRANSLATIONS.en["status-ready"] || els.statusLine.textContent === TRANSLATIONS.pl["status-ready"]) {
      els.statusLine.textContent = t["status-ready"];
    }

    if (els.logContainer && els.logContainer.querySelector(".system")) {
      els.logContainer.querySelector(".system").textContent = t["log-waiting"];
    }

    if (els.versionSelect && els.versionSelect.options[0]) {
      els.versionSelect.options[0].textContent = t["opt-select-version"];
    }

    // Debug buttons
    const debugBtns = {
      "btn-delete-assets": t["btn-delete-assets"],
      "btn-reinstall-java": t["btn-reinstall-java"],
      "btn-reset-settings": t["btn-reset-settings"],
      "btn-copy-logs": t["btn-copy-logs"]
    };
    Object.entries(debugBtns).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });

    if (els.jvmArgsArea) els.jvmArgsArea.placeholder = t["label-jvm-args"];
  };

  // 1. Initial Data Fetch
  const [ramInfo, versionsArray] = await Promise.all([
    window.api.getSystemRam(),
    window.api.getFabricVersions()
  ]);

  // Populate Versions
  if (els.ramSlider) els.ramSlider.max = ramInfo.total;
  if (els.versionSelect) {
    console.log("[Renderer] Populating versions:", versionsArray);
    els.versionSelect.innerHTML = `<option value="" disabled selected>${TRANSLATIONS[currentLang]["opt-select-version"]}</option>`;

    versionsArray.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = `Minecraft ${v}`;
      els.versionSelect.appendChild(opt);
    });
  }

  // Load Saved State
  const lastVersion = localStorage.getItem("selectedVersion");
  const lastRam = localStorage.getItem("selectedRam");

  if (lastVersion && versionsArray.includes(lastVersion)) {
    if (els.versionSelect) els.versionSelect.value = lastVersion;
    selectedVersion = lastVersion;
    if (els.launchBtn) els.launchBtn.disabled = false;
    if (els.modsBtn) els.modsBtn.disabled = false;
  }

  if (els.ramSlider) {
    els.ramSlider.value = lastRam || ramInfo.default;
    if (els.ramValue) els.ramValue.textContent = els.ramSlider.value;
  }

  // 2. Navigation Logic
  const switchTab = (tab) => {
    Object.keys(sidebarBtns).forEach(key => {
      if (sidebarBtns[key] && views[key]) {
        sidebarBtns[key].classList.toggle("active", key === tab);
        views[key].classList.toggle("active", key === tab);
      }
    });
    // Auto-refresh mods if switching to mods view
    if (tab === "mods") {
      renderInstalledMods();
    }
  };

  Object.entries(sidebarBtns).forEach(([tab, btn]) => {
    if (btn) btn.addEventListener("click", () => switchTab(tab));
  });

  // 3. Log Batching Implementation
  let logBuffer = [];
  let isLogUpdateScheduled = false;
  let isAutoScrollEnabled = true;
  const MAX_LOGS = 2000;

  if (els.logContainer) {
    els.logContainer.addEventListener("scroll", () => {
      const { scrollTop, scrollHeight, clientHeight } = els.logContainer;
      // If user scrolls up, disable auto-scroll. If they hit bottom, re-enable.
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      isAutoScrollEnabled = isAtBottom;
    });
  }

  const processLogBatch = () => {
    if (logBuffer.length === 0) {
      isLogUpdateScheduled = false;
      return;
    }

    // FPS Optimization: Skip DOM updates if window is hidden
    if (document.hidden) {
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.splice(0, logBuffer.length - MAX_LOGS);
      }
      isLogUpdateScheduled = false;
      return;
    }

    const fragment = document.createDocumentFragment();
    const batch = logBuffer.splice(0, 100); // Process 100 logs per frame

    batch.forEach(message => {
      const div = document.createElement("div");
      div.className = "log-line";
      if (message.includes("[MC ERROR]")) div.classList.add("log-error");
      else if (message.includes("[MC]")) div.classList.add("log-game");
      else div.classList.add("log-status");
      div.textContent = message;
      fragment.appendChild(div);
    });

    if (els.logContainer) {
      els.logContainer.appendChild(fragment);
      // Limit total lines
      while (els.logContainer.children.length > MAX_LOGS) {
        els.logContainer.removeChild(els.logContainer.firstChild);
      }

      if (isAutoScrollEnabled) {
        els.logContainer.scrollTop = els.logContainer.scrollHeight;
      }
    }

    if (logBuffer.length > 0) {
      requestAnimationFrame(processLogBatch);
    } else {
      isLogUpdateScheduled = false;
    }
  };

  const appendLog = (message) => {
    logBuffer.push(message);
    if (!isLogUpdateScheduled) {
      isLogUpdateScheduled = true;
      requestAnimationFrame(processLogBatch);
    }
  };

  // 4. IPC Listeners
  window.api.onStatus((status) => {
    if (els.statusLine && !status.startsWith("[MC")) {
      els.statusLine.textContent = status;
    }
    appendLog(status);
  });

  window.api.onProgressBar((p) => {
    if (document.hidden) return;
    if (els.progressBar) els.progressBar.style.width = (p * 100) + "%";
  });

  window.api.onSystemStats((stats) => {
    if (document.hidden) return;
    if (els.dashCPU) els.dashCPU.style.width = stats.cpu + "%";
    if (els.dashRAM) els.dashRAM.style.width = (stats.ramUsed / stats.ramTotal * 100) + "%";
    if (els.dashCPUVal) els.dashCPUVal.textContent = stats.cpu + "%";
    if (els.dashRAMVal) els.dashRAMVal.textContent = `${stats.ramUsed}/${stats.ramTotal}GB`;
  });

  // 5. Main Listeners
  if (els.ramSlider) {
    els.ramSlider.addEventListener("input", (e) => {
      if (els.ramValue) els.ramValue.textContent = e.target.value;
      localStorage.setItem("selectedRam", e.target.value);
    });
  }

  if (els.versionSelect) {
    els.versionSelect.addEventListener("change", (e) => {
      selectedVersion = e.target.value;
      localStorage.setItem("selectedVersion", selectedVersion);
      if (els.launchBtn) els.launchBtn.disabled = !selectedVersion;
      if (els.modsBtn) els.modsBtn.disabled = !selectedVersion;

      // Auto-refresh installed mods list if in mods view
      if (views.mods && views.mods.classList.contains("active")) {
        renderInstalledMods();
      }
    });
  }

  // Setup Mods Folder Button
  const openModsBtn = document.getElementById("btn-open-mods");
  if (openModsBtn) {
    openModsBtn.addEventListener("click", openModsFolder);
  }

  // Mods Tab Logic
  const switchModsTab = async (tab) => {
    if (els.modsBrowserTab) els.modsBrowserTab.classList.toggle("active", tab === "browser");
    if (els.modsInstalledTab) els.modsInstalledTab.classList.toggle("active", tab === "installed");
    if (els.modsBrowserView) els.modsBrowserView.classList.toggle("active", tab === "browser");
    if (els.modsInstalledView) els.modsInstalledView.classList.toggle("active", tab === "installed");

    if (tab === "installed") {
      await renderInstalledMods();
    }
  };

  if (els.modsBrowserTab) els.modsBrowserTab.addEventListener("click", () => switchModsTab("browser"));
  if (els.modsInstalledTab) els.modsInstalledTab.addEventListener("click", () => switchModsTab("installed"));

  async function renderInstalledMods() {
    const rootContainer = document.getElementById("my-mods-list");
    const preContainer = document.getElementById("preinstalled-mods-list");

    const t = TRANSLATIONS[currentLang];

    if (!selectedVersion) {
      selectedVersion = localStorage.getItem("selectedVersion");
    }

    if (!selectedVersion) {
      if (rootContainer) rootContainer.innerHTML = `<div class="local-mods-placeholder">${t["select-ver-first"] || "Wybierz wersję gry..."}</div>`;
      return;
    }

    // Show loading state
    if (rootContainer) rootContainer.innerHTML = `<div class="local-mods-placeholder">${t["loading"] || "Ładowanie..."}</div>`;
    if (preContainer) preContainer.innerHTML = `<div class="local-mods-placeholder">${t["loading"] || "Ładowanie..."}</div>`;

    try {
      const res = await window.api.getModsList(selectedVersion);
      const root = res.root || [];
      const preinstalled = res.preinstalled || [];

      if (res.error) {
        if (rootContainer) rootContainer.innerHTML = `<div class="local-mods-placeholder">Błąd: ${res.error}</div>`;
        return;
      }

      const renderList = (container, list, isPre) => {
        if (!container) return;
        if (list.length === 0) {
          container.innerHTML = `<div class="local-mods-placeholder">${isPre ? t["no-preinstalled"] : t["no-mods"]}</div>`;
          return;
        }
        container.innerHTML = list.map(mod => `
          <div class="local-mod-item ${mod.isEnabled ? '' : 'disabled'}" data-filename="${mod.name}">
            <span class="mod-file-icon">📄</span>
            <span class="mod-filename" title="${mod.baseName}">${mod.baseName}</span>
            <div class="mod-actions">
              ${isPre ? `
                <label class="mod-toggle" title="${mod.isEnabled ? t["btn-disable"] : t["btn-enable"]}">
                  <input type="checkbox" ${mod.isEnabled ? 'checked' : ''} onchange="handleToggleMod('${mod.name}', true)">
                  <span class="slider"></span>
                </label>
              ` : `
                <button class="mod-delete-btn" onclick="handleDeleteMod('${mod.name}')" title="${t["btn-delete"]}">🗑️</button>
              `}
            </div>
          </div>
        `).join('');
      };

      renderList(rootContainer, root, false);
      renderList(preContainer, preinstalled, true);
    } catch (err) {
      console.error("[Renderer] Error in renderInstalledMods:", err);
      if (rootContainer) rootContainer.innerHTML = `<div class="local-mods-placeholder">Błąd krytyczny.</div>`;
    }
  }

  // Mod management functions (exposed to window for onclick)
  window.handleDeleteMod = async (filename) => {
    if (!selectedVersion) return;
    const t = TRANSLATIONS[currentLang];
    if (confirm(t["confirm-delete-mod"] ? t["confirm-delete-mod"] + " " + filename : `Usuń ${filename}?`)) {
      const res = await window.api.deleteMod({ version: selectedVersion, filename, isPreinstalled: false });
      if (res.success) {
        await renderInstalledMods();
        // Refresh mods browser if available
        if (typeof window.refreshModBrowser === "function") {
          window.refreshModBrowser();
        }
      } else {
        alert("Błąd podczas usuwania: " + res.error);
      }
    }
  };

  window.handleToggleMod = async (filename, isPreinstalled) => {
    if (!selectedVersion) return;
    const res = await window.api.toggleModStatus({ version: selectedVersion, filename, isPreinstalled });
    if (res.success) {
      await renderInstalledMods();
    } else {
      alert("Błąd podczas zmiany statusu: " + res.error);
    }
  };

  if (els.launchBtn) els.launchBtn.addEventListener("click", launchGame);
  if (els.modsBtn) els.modsBtn.addEventListener("click", openModsFolder);

  if (els.btnClearLogs) {
    els.btnClearLogs.addEventListener("click", () => {
      if (els.logContainer) els.logContainer.innerHTML = '';
      logBuffer = [];
    });
  }

  // 6. Settings Implementation
  const globalSettings = await window.api.getGlobalSettings();
  if (els.gmToggle) els.gmToggle.checked = globalSettings.gameMode || false;
  if (els.gsToggle) els.gsToggle.checked = globalSettings.gamescope || false;
  if (els.jvmArgsArea) els.jvmArgsArea.value = globalSettings.customJvmArgs || "";

  const lang = globalSettings.lang || "en";
  applyLanguage(lang);

  const accent = globalSettings.accent || "gold";
  applyAccent(accent);

  Object.entries(gsControls).forEach(([key, el]) => {
    if (!el) return;
    const settingsKey = {
      gsW: "gsWidth", gsH: "gsHeight", gsOutW: "gsOutWidth", gsOutH: "gsOutHeight",
      gsHz: "gsHz", gsScalingMode: "gsScalingMode", gsFilter: "gsFilter",
      gsCursorFix: "gsCursorFix", gsFullscreen: "gsFullscreen"
    }[key];

    if (el.type === "checkbox") {
      el.checked = globalSettings[settingsKey] !== (settingsKey === "gsCursorFix" ? false : undefined);
    } else {
      el.value = globalSettings[settingsKey] || (key.includes("Mode") ? "fit" : key.includes("Filter") ? "linear" : "");
    }
  });

  const updateGSVisibility = () => {
    if (els.gsOptionsContainer && els.gsToggle) {
      els.gsOptionsContainer.style.display = els.gsToggle.checked ? "block" : "none";
    }
  };
  updateGSVisibility();

  const saveGlobal = () => {
    updateGSVisibility();
    window.api.saveGlobalSettings({
      lang: els.langSelect ? els.langSelect.value : currentLang,
      accent: els.accentSelect ? els.accentSelect.value : "gold",
      gameMode: els.gmToggle ? els.gmToggle.checked : false,
      gamescope: els.gsToggle ? els.gsToggle.checked : false,
      customJvmArgs: els.jvmArgsArea ? els.jvmArgsArea.value : "",
      gsWidth: gsControls.gsW?.value || "",
      gsHeight: gsControls.gsH?.value || "",
      gsOutWidth: gsControls.gsOutW?.value || "",
      gsOutHeight: gsControls.gsOutH?.value || "",
      gsHz: gsControls.gsHz?.value || "",
      gsScalingMode: gsControls.gsScalingMode?.value || "fit",
      gsFilter: gsControls.gsFilter?.value || "linear",
      gsCursorFix: gsControls.gsCursorFix?.checked ?? true,
      gsFullscreen: gsControls.gsFullscreen?.checked || false,
    });
  };

  [els.gmToggle, els.gsToggle, els.jvmArgsArea, els.langSelect, els.accentSelect].forEach(el => el?.addEventListener("change", () => {
    if (el === els.langSelect) applyLanguage(els.langSelect.value);
    if (el === els.accentSelect) applyAccent(els.accentSelect.value);
    saveGlobal();
  }));
  if (els.jvmArgsArea) els.jvmArgsArea.addEventListener("input", saveGlobal);
  Object.values(gsControls).forEach(el => el?.addEventListener(el.type === "checkbox" ? "change" : "input", saveGlobal));

  const refreshDepStatus = async () => {
    const deps = await window.api.checkDependencies();
    const t = TRANSLATIONS[currentLang];
    if (els.statusGM) {
      els.statusGM.textContent = deps.gameMode ? t["dep-installed"] : t["dep-missing"];
      els.statusGM.className = `dep-status ${deps.gameMode ? "installed" : "missing"}`;
    }
    if (els.statusGS) {
      els.statusGS.textContent = deps.gamescope ? t["dep-installed"] : t["dep-missing"];
      els.statusGS.className = `dep-status ${deps.gamescope ? "installed" : "missing"}`;
    }
  };
  refreshDepStatus();

  // Debug Buttons
  const debugActions = {
    "btn-delete-assets": async () => {
      const t = TRANSLATIONS[currentLang];
      if (confirm(t["confirm-delete-assets"])) {
        const res = await window.api.deleteAssets();
        alert(res.success ? "OK" : "Błąd");
      }
    },
    "btn-reinstall-java": () => {
      const t = TRANSLATIONS[currentLang];
      confirm(t["confirm-reinstall-java"]) && window.api.reinstallJava();
    },
    "btn-reset-settings": async () => {
      const t = TRANSLATIONS[currentLang];
      confirm(t["confirm-reset-settings"]) && (await window.api.resetSettings()) && alert("OK");
    },
    "btn-copy-logs": async () => {
      const t = TRANSLATIONS[currentLang];
      const res = await window.api.copyLogs(selectedVersion);
      res.success ? alert(t["confirm-copy-logs"]) : alert(t["error-copy-logs"]);
    }
  };

  Object.entries(debugActions).forEach(([id, fn]) => {
    document.getElementById(id)?.addEventListener("click", fn);
  });
});

async function openModsFolder() {
  if (!selectedVersion) return;
  try { await window.api.openModsFolder(selectedVersion); } catch (e) { }
}

async function launchGame() {
  if (!selectedVersion || isLaunching) return;
  isLaunching = true;

  const launchBtn = document.getElementById("launch-btn");
  if (launchBtn) launchBtn.disabled = true;

  const ram = parseInt(document.getElementById("ram-slider")?.value || "2");
  const settings = await window.api.getGlobalSettings();

  await window.api.saveInstanceSettings(selectedVersion, {
    ram,
    jvmArgs: settings.customJvmArgs || "-XX:+UseG1GC",
    lastLaunched: new Date().toISOString()
  });

  window.api.launchGame({ version: selectedVersion, ram });
  setTimeout(() => {
    isLaunching = false;
    if (launchBtn) launchBtn.disabled = false;
  }, 2000);
}
