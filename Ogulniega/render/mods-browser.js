/**
 * Mod Browser Implementation for Ogulniega Launcher (v2.1)
 * Handles Modrinth API integration and UI rendering for mods.
 */

(function () {
    const searchInput = document.getElementById("mods-search-input");
    const searchBtn = document.getElementById("btn-mods-search");
    const modsGrid = document.getElementById("mods-list-container");

    let isSearching = false;

    async function searchMods() {
        if (isSearching) return;
        const t = window.TRANSLATIONS[window.currentLang || "en"];
        const query = searchInput ? searchInput.value.trim() : "";
        const sortSelect = document.getElementById("mods-sort-select");
        const sortValue = sortSelect ? sortSelect.value : "downloads";

        isSearching = true;
        if (searchBtn) searchBtn.disabled = true;
        modsGrid.innerHTML = `<div class="mods-placeholder">${t["loading"] || "Searching..."}</div>`;

        try {
            // Get current version and installed mods
            const version = localStorage.getItem("selectedVersion") || "1.21.1";

            // Normalize version for Modrinth (e.g., 1.20.1-Vulkan -> 1.20.1)
            const mcVersion = version.split('-')[0];

            const installedIds = (await window.api.getInstalledModIds(version)) || [];

            // Build facets
            const facets = `[["versions:${mcVersion}"],["categories:fabric"],["project_type:mod"]]`;

            // Map our UI values to Modrinth index values
            // Modrinth index options: "relevance", "downloads", "follows", "newest", "updated"
            let indexValue = sortValue;
            if (sortValue === "newest") indexValue = "newest";

            // Modrinth API search
            const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${facets}&limit=20&index=${indexValue}`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Ogulniega-Launcher/2.1 (contact@google.com)'
                }
            });

            if (!response.ok) throw new Error('Modrinth API error');

            const data = await response.json();
            renderMods(data.hits, installedIds);
        } catch (err) {
            console.error('Mods search failed:', err);
            modsGrid.innerHTML = `<div class="mods-placeholder" style="color: var(--danger)">Error: ${err.message}</div>`;
        } finally {
            isSearching = false;
            searchBtn.disabled = false;
        }
    }

    function renderMods(hits, installedIds = []) {
        const t = window.TRANSLATIONS[window.currentLang || "en"];
        if (!hits || hits.length === 0) {
            modsGrid.innerHTML = `<div class="mods-placeholder">${t["mods-placeholder"] || "No mods found."}</div>`;
            return;
        }

        modsGrid.innerHTML = hits.map(mod => {
            const isInstalled = installedIds.includes(mod.project_id);
            const btnText = isInstalled ? t["dep-installed"] : (t["launch-btn"] === "GRAJ" ? "Zainstaluj" : "Install");
            const btnClass = isInstalled ? "install-btn installed" : "install-btn";
            const btnAttr = isInstalled ? "disabled" : `onclick="installMod('${mod.project_id}', '${mod.title}')"`;

            return `
            <div class="mod-card">
                <div class="mod-card-header">
                    <img src="${mod.icon_url || 'assets/icon.png'}" class="mod-icon" onerror="this.src='assets/icon.png'">
                    <div class="mod-info">
                        <div class="mod-name" title="${mod.title}">${mod.title}</div>
                        <div class="mod-author">by ${mod.author}</div>
                    </div>
                </div>
                <div class="mod-desc">${mod.description}</div>
                <div class="mod-footer">
                    <div class="mod-downloads"><span class="icon-dl"></span> ${formatNumber(mod.downloads)}</div>
                    <button class="${btnClass}" ${btnAttr}>${btnText}</button>
                </div>
            </div>
        `;
        }).join('');
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    }

    // Global install function (called from inline onclick)
    window.installMod = async (projectId, title) => {
        const t = window.TRANSLATIONS[window.currentLang || "en"];
        const version = localStorage.getItem("selectedVersion");
        if (!version) {
            alert(t["select-ver-first"] || "Please select a game version first!");
            return;
        }

        const btn = event.target;
        btn.disabled = true;
        btn.textContent = t["loading"] || "Installing...";

        try {
            // 1. Get project versions from Modrinth
            const mcVersion = version;
            const url = `https://api.modrinth.com/v2/project/${projectId}/version?loaders=["fabric"]&game_versions=["${mcVersion}"]`;

            const response = await fetch(url, {
                headers: { 'User-Agent': 'Ogulniega-Launcher/2.1' }
            });

            if (!response.ok) throw new Error('Failed to fetch mod versions');

            const versions = await response.json();
            if (versions.length === 0) throw new Error('No compatible version found');

            // 2. Take the latest version
            const latest = versions[0];
            const file = latest.files.find(f => f.primary) || latest.files[0];

            // 3. Request main process to download
            const success = await window.api.downloadMod({
                url: file.url,
                filename: file.filename,
                version: mcVersion,
                projectId: projectId
            });

            if (success) {
                btn.textContent = "Installed";
                btn.classList.add("installed");
            } else {
                throw new Error('Download failed');
            }
        } catch (err) {
            alert(`Failed to install ${title}: ${err.message}`);
            btn.disabled = false;
            btn.textContent = "Install";
        }
    };

    // Listeners
    if (searchBtn) searchBtn.addEventListener("click", searchMods);
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") searchMods();
        });
    }

    const sortSelect = document.getElementById("mods-sort-select");
    if (sortSelect) {
        sortSelect.addEventListener("change", searchMods);
    }

    // Expose globally
    window.refreshModBrowser = searchMods;

    // Initial load: Popular mods
    setTimeout(() => {
        searchMods(); // Search with empty query to get popular
    }, 500);
})();
