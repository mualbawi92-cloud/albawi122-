# ============================================
# سكربت التثبيت التلقائي - نظام الحوالات
# شغّل هذا السكربت كـ Administrator
# ============================================

$ErrorActionPreference = "Stop"
$InstallPath = "C:\MoneyTransfer"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "   نظام إدارة الحوالات المالية - التثبيت" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Check Admin
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ يرجى تشغيل السكربت كمسؤول (Administrator)" -ForegroundColor Red
    pause
    exit
}

# Create directory
Write-Host "📁 إنشاء مجلد التثبيت..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
Set-Location $InstallPath

# Download URLs
$PythonURL = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
$MongoURL = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.13.zip"
$GetPipURL = "https://bootstrap.pypa.io/get-pip.py"

# ============================================
# 1. تثبيت Python Embedded
# ============================================
Write-Host ""
Write-Host "🐍 [1/4] تثبيت Python..." -ForegroundColor Yellow

$PythonPath = "$InstallPath\python"
if (!(Test-Path $PythonPath)) {
    Write-Host "   جاري التنزيل..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $PythonURL -OutFile "python.zip" -UseBasicParsing
    Expand-Archive -Path "python.zip" -DestinationPath $PythonPath -Force
    Remove-Item "python.zip"
    
    # Enable pip
    $pthFile = Get-ChildItem -Path $PythonPath -Filter "*._pth"
    if ($pthFile) {
        $content = Get-Content $pthFile.FullName
        $content = $content -replace '#import site', 'import site'
        Set-Content $pthFile.FullName $content
    }
    
    # Install pip
    Write-Host "   تثبيت pip..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $GetPipURL -OutFile "get-pip.py" -UseBasicParsing
    & "$PythonPath\python.exe" get-pip.py --no-warn-script-location
    Remove-Item "get-pip.py"
}
Write-Host "   ✅ Python جاهز" -ForegroundColor Green

# ============================================
# 2. تثبيت MongoDB
# ============================================
Write-Host ""
Write-Host "🍃 [2/4] تثبيت MongoDB..." -ForegroundColor Yellow

$MongoPath = "$InstallPath\mongodb"
if (!(Test-Path $MongoPath)) {
    Write-Host "   جاري التنزيل (قد يستغرق بضع دقائق)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $MongoURL -OutFile "mongodb.zip" -UseBasicParsing
    Expand-Archive -Path "mongodb.zip" -DestinationPath "$InstallPath\mongo-temp" -Force
    
    # Move to correct location
    $extractedFolder = Get-ChildItem -Path "$InstallPath\mongo-temp" -Directory | Select-Object -First 1
    Move-Item -Path $extractedFolder.FullName -Destination $MongoPath
    Remove-Item "mongodb.zip"
    Remove-Item "$InstallPath\mongo-temp" -Recurse -Force
    
    # Create data directory
    New-Item -ItemType Directory -Force -Path "$MongoPath\data" | Out-Null
}
Write-Host "   ✅ MongoDB جاهز" -ForegroundColor Green

# ============================================
# 3. تثبيت التطبيق
# ============================================
Write-Host ""
Write-Host "📦 [3/4] تثبيت التطبيق..." -ForegroundColor Yellow

# Copy backend
if (Test-Path "$PSScriptRoot\backend") {
    Copy-Item -Path "$PSScriptRoot\backend" -Destination "$InstallPath\backend" -Recurse -Force
}

# Copy frontend build
if (Test-Path "$PSScriptRoot\frontend-build") {
    Copy-Item -Path "$PSScriptRoot\frontend-build" -Destination "$InstallPath\frontend" -Recurse -Force
}

# Install Python dependencies
Write-Host "   تثبيت مكتبات Python..." -ForegroundColor Gray
& "$PythonPath\python.exe" -m pip install -r "$InstallPath\backend\requirements.txt" --no-warn-script-location -q

Write-Host "   ✅ التطبيق جاهز" -ForegroundColor Green

# ============================================
# 4. إنشاء الاختصارات
# ============================================
Write-Host ""
Write-Host "🔗 [4/4] إنشاء الاختصارات..." -ForegroundColor Yellow

# Create start script
$StartScript = @"
@echo off
chcp 65001 > nul
title نظام الحوالات المالية
cd /d "$InstallPath"

echo.
echo جاري تشغيل النظام...
echo.

:: Start MongoDB
start /min "MongoDB" mongodb\bin\mongod.exe --dbpath mongodb\data
timeout /t 3 /nobreak > nul

:: Start Backend
start /min "Backend" python\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8001 --app-dir backend
timeout /t 3 /nobreak > nul

:: Start Frontend (using Python http.server)
start /min "Frontend" python\python.exe -m http.server 3000 --directory frontend
timeout /t 2 /nobreak > nul

:: Open browser
start http://localhost:3000

echo.
echo ✅ النظام يعمل!
echo.
echo الواجهة: http://localhost:3000
echo الدخول: admin / admin123
echo.
echo لإيقاف النظام اضغط أي زر...
pause > nul

:: Stop all
taskkill /f /im mongod.exe > nul 2>&1
taskkill /f /im python.exe > nul 2>&1
"@

$StartScript | Out-File -FilePath "$InstallPath\Start.bat" -Encoding UTF8

# Create desktop shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\نظام الحوالات.lnk")
$Shortcut.TargetPath = "$InstallPath\Start.bat"
$Shortcut.WorkingDirectory = $InstallPath
$Shortcut.Save()

# Create Start Menu shortcut
$StartMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$Shortcut2 = $WshShell.CreateShortcut("$StartMenuPath\نظام الحوالات.lnk")
$Shortcut2.TargetPath = "$InstallPath\Start.bat"
$Shortcut2.WorkingDirectory = $InstallPath
$Shortcut2.Save()

Write-Host "   ✅ تم إنشاء الاختصارات" -ForegroundColor Green

# ============================================
# انتهى
# ============================================
Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "   ✅ تم التثبيت بنجاح!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 الواجهة: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔑 الدخول: admin / admin123" -ForegroundColor Cyan
Write-Host ""
Write-Host "يمكنك تشغيل النظام من:" -ForegroundColor White
Write-Host "  - سطح المكتب: نظام الحوالات" -ForegroundColor White
Write-Host "  - قائمة Start: نظام الحوالات" -ForegroundColor White
Write-Host ""
pause
