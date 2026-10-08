#!/bin/sh
# Сборка сервера Гастрогида под Linux/macOS. Запускайте из корня проекта: sh c/build.sh
set -e
cc -std=c11 -D_DEFAULT_SOURCE -O2 -Wall -Wextra -o gastroguia c/src/*.c
# Готовый .exe для Windows, если установлен MinGW
if command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  x86_64-w64-mingw32-gcc -std=c11 -O2 -Wall -Wextra -s -o c/bin/gastroguia.exe c/src/*.c -lws2_32
fi
echo "Готово. Запуск: ./gastroguia"
