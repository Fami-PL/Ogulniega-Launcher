#!/bin/bash
# Ogulniega Launcher - AppImage Build Script
echo "🏗️ Rozpoczynam budowanie AppImage..."

# Sprawdź czy node_modules istnieje
if [ ! -d "node_modules" ]; then
    echo "📦 Zależności nie znalezione. Instalowanie..."
    npm install
fi

# Uruchom electron-builder
echo "🚀 Uruchamiam electron-builder..."
# Uruchom electron-builder
echo "🚀 Uruchamiam electron-builder (target: AppImage)..."
npx electron-builder --linux AppImage --x64

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Sukces! Plik AppImage znajdziesz w folderze 'dist/'"
    echo "   Plik: dist/Ogulniega-Launcher-Linux.AppImage"
else
    echo "❌ Błąd podczas budowania AppImage."
    exit 1
fi
