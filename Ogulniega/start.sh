#!/bin/bash

# Ogulniega Launcher - szybki start
echo "🚀 Uruchamianie Ogulniega Launcher..."

# Sprawdź czy node_modules istnieje
if [ ! -d "node_modules" ]; then
    echo "❌ Brak node_modules! Uruchom najpierw ./install.sh"
    exit 1
fi

# Startuj launcher
npm start
