#!/bin/bash

# Ogulniega Launcher - instalator (Linux)
echo "🚀 Instalacja Ogulniega Launcher..."
echo ""

# Sprawdź czy jest Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nie jest zainstalowany!"
    echo "   Zainstaluj Node.js 18+ lub nowszy."
    echo "   Na Arch/CachyOS: sudo pacman -S nodejs npm"
    echo "   Na Debian/Ubuntu: sudo apt install nodejs npm"
    echo "   Na Fedora: sudo dnf install nodejs"
    exit 1
fi

echo "✅ Node.js znaleziony: $(node -v)"

# Zainstaluj zależności
echo "📦 Instalowanie zależności npm..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Zależności zainstalowane pomyślnie!"
else
    echo "❌ Błąd podczas npm install"
    exit 1
fi

echo ""
echo "🎉 Ogulniega Launcher gotowy!"
echo "   Uruchom go poleceniem: ./start.sh"
echo "   Lub ręcznie: npm start"
echo ""
echo "Dzięki za używanie! 🇵🇱🐐"
