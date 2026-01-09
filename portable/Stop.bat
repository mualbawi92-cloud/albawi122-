@echo off
chcp 65001 > nul
echo.
echo جاري إيقاف النظام...
echo.

taskkill /f /im mongod.exe 2>nul
taskkill /f /fi "WINDOWTITLE eq Backend" 2>nul
taskkill /f /fi "WINDOWTITLE eq Frontend" 2>nul

echo.
echo ✅ تم إيقاف النظام
echo.
