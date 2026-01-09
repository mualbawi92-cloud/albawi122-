; ============================================
; Inno Setup Script - نظام الحوالات المالية
; استخدم Inno Setup Compiler لبناء الـ Installer
; https://jrsoftware.org/isinfo.php
; ============================================

#define MyAppName "نظام الحوالات المالية"
#define MyAppNameEn "Money Transfer System"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Your Company"
#define MyAppURL "http://localhost:3000"
#define MyAppExeName "Start.bat"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\MoneyTransfer
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=output
OutputBaseFilename=MoneyTransfer-Setup-{#MyAppVersion}
SetupIconFile=icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"; GroupDescription: "الاختصارات"; Flags: checked

[Files]
; Python Embedded
Source: "portable\python\*"; DestDir: "{app}\python"; Flags: ignoreversion recursesubdirs createallsubdirs

; MongoDB
Source: "portable\mongodb\*"; DestDir: "{app}\mongodb"; Flags: ignoreversion recursesubdirs createallsubdirs

; Backend
Source: "portable\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs

; Frontend Build
Source: "portable\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs

; Start Script
Source: "portable\Start.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "portable\Stop.bat"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\mongodb\data"
Name: "{app}\logs"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\إلغاء التثبيت"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "تشغيل النظام الآن"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/f /im mongod.exe"; Flags: runhidden
Filename: "taskkill"; Parameters: "/f /im python.exe"; Flags: runhidden

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption := 'مرحباً بك في معالج تثبيت ' + '{#MyAppName}' + #13#10#13#10 +
    'سيتم تثبيت النظام بالكامل على جهازك.' + #13#10#13#10 +
    'لا تحتاج إلى إنترنت أو برامج إضافية.' + #13#10#13#10 +
    'اضغط التالي للمتابعة.';
end;
