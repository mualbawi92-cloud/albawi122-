@echo off
chcp 65001 > nul
title تثبيت نظام الحوالات المالية
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║        نظام إدارة الحوالات المالية - التثبيت                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: Check if Python exists
if not exist "python\python.exe" (
    echo ❌ خطأ: مجلد python غير موجود!
    echo.
    echo يرجى تنزيل Python Embedded من:
    echo https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip
    echo.
    echo وفك الضغط في مجلد: python\
    echo.
    pause
    exit /b 1
)

:: Check if MongoDB exists
if not exist "mongodb\bin\mongod.exe" (
    echo ❌ خطأ: MongoDB غير موجود!
    echo.
    echo يرجى تنزيل MongoDB من:
    echo https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.13.zip
    echo.
    echo وفك الضغط في مجلد: mongodb\
    echo.
    pause
    exit /b 1
)

:: Create data directory
if not exist "mongodb\data" mkdir mongodb\data

echo [1/3] تفعيل pip في Python...

:: Enable pip in Python embedded
set PTH_FILE=
for %%f in (python\*._pth) do set PTH_FILE=%%f

if defined PTH_FILE (
    powershell -Command "(Get-Content '%PTH_FILE%') -replace '#import site', 'import site' | Set-Content '%PTH_FILE%'"
)

:: Install pip if not exists
if not exist "python\Scripts\pip.exe" (
    echo [2/3] تثبيت pip...
    python\python.exe -c "import urllib.request; urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', 'get-pip.py')"
    python\python.exe get-pip.py --no-warn-script-location -q
    del get-pip.py 2>nul
)

echo [3/3] تثبيت مكتبات Python...
python\python.exe -m pip install -r backend\requirements.txt --no-warn-script-location -q

echo.
echo ══════════════════════════════════════════════════════════════
echo.
echo ✅ تم التثبيت بنجاح!
echo.
echo لتشغيل النظام: انقر مرتين على Start.bat
echo.
echo 🌐 الواجهة: http://localhost:3000
echo 🔑 الدخول: admin / admin123
echo.
echo ══════════════════════════════════════════════════════════════
echo.
pause
