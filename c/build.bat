@echo off
rem Сборка сервера Гастрогида под Windows. Нужен gcc (MinGW-w64), например из w64devkit или WinLibs.
rem Запускайте из корня проекта: c\build.bat
gcc -std=c11 -O2 -Wall -Wextra -o c\bin\gastroguia.exe c\src\buf.c c\src\json.c c\src\site.c c\src\i18n.c c\src\pages.c c\src\main.c -lws2_32
if errorlevel 1 exit /b 1
echo Готово: c\bin\gastroguia.exe
