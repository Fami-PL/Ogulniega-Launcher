# 🐐 Ogulniega Launcher

**Ogulniega Launcher** to zoptymalizowany, lekki i nowoczesny Minecraft Launcher stworzony z myślą o użytkownikach Linuksa. Skupia się na wydajności, stabilności oraz pełnym wsparciu dla silnika **Fabric** i nowoczesnych rozwiązań graficznych (Vulkan).

---

## ✨ Główne cechy
- **Optymalizacja pod Linux**: Wbudowane wsparcie dla Gamescope i GameMode.
- **Wydajność Vulkan**: Dedykowana paczka 1.20.1-Vulkan dla maksymalnej ilości FPS.
- **Mod Browser**: Zintegrowana wyszukiwarka Modrinth – instaluj mody jednym kliknięciem.
- **Zarządzanie modami**: Możliwość wyłączania (`.disabled`) i usuwania modów bezpośrednio z UI.
- **Monitoring na żywo**: Odczyt zużycia procesora i pamięci RAM oraz logi gry w czasie rzeczywistym.
- **Inteligentne poprawki**: Autonaprawa błędów GLFW (Wayland), usuwanie telemetrii Mojangu i zwiększenie stosu pamięci dla stabilności.

---

## 🛠️ Wymagania systemowe

### Rdzeń (wymagane):
- **Java**: Rekomendowana 17 lub 21 (np. `zulu-jdk` lub `openjdk`).
- **Node.js**: Wersja 18 lub nowsza (potrzebna tylko przy uruchamianiu ze źródeł).

### Integracje (opcjonalne, dla power-userów):
- `gamescope`: Do uruchamiania gry w izolowanym kontenerze wideo (polecane na Wayland).
- `gamemode`: Do automatycznej optymalizacji CPU/GPU podczas gry.

---

## 🚀 Jak uruchomić?

### Opcja 1: Najszybsza (AppImage)
Jeśli posiadasz gotowy plik `.AppImage`:
1. Nadaj uprawnienia: `chmod +x Ogulniega-Launcher-Linux.AppImage`
2. Uruchom: `./Ogulniega-Launcher-Linux.AppImage`

### Opcja 2: Ze źródeł (dla deweloperów)
1. Sklonuj repozytorium:
   ```bash
   git clone https://github.com/Fami-PL/Ogulniega.git
   cd Ogulniega
   ```
2. Zainstaluj zależności:
   ```bash
   ./install.sh
   ```
3. Odpal launcher:
   ```bash
   npm start
   ```

---

## 📦 Budowanie własnej wersji AppImage
Jeśli wprowadziłeś zmiany i chcesz wyeksportować launcher do pojedynczego pliku:
```bash
bash build-appimage.sh
```
Gotowy plik znajdziesz w folderze `dist/`.

---

## 💡 Porady dla użytkowników Wayland
Jeśli masz problem z fokusem myszki, launcher automatycznie stosuje poprawkę **Extreme X11 Mode**. Zalecamy jednak korzystanie z funkcji **Gamescope** (dostępna w ustawieniach), która zapewnia najlepsze wrażenia płynności i wsparcie dla skalowania obrazu (FSR/NIS).

---

*Stworzone z pasją dla polskiej społeczności Minecrafta przez **Ogulniega**. 🇵🇱🐐*
