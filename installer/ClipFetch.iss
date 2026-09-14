#define MyAppName "ClipFetch"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "QStudio"
#define MyAppExeName "clipfetch.exe"
#define ProjectRoot SourcePath + "\.."

[Setup]
AppId={{7E363941-8509-4692-9435-2E80CA8482E4}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=ClipFetch 短视频解析器安装程序
VersionInfoProductName={#MyAppName}
VersionInfoVersion={#MyAppVersion}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableWelcomePage=no
OutputDir={#ProjectRoot}\src-tauri\target\release\bundle\inno
OutputBaseFilename=ClipFetch_{#MyAppVersion}_x64_Setup
SetupIconFile={#ProjectRoot}\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
WizardSizePercent=115
WizardResizable=no
WizardImageFile={#ProjectRoot}\installer\assets\wizard-sidebar.bmp
WizardSmallImageFile={#ProjectRoot}\installer\assets\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
ShowLanguageDialog=no
LanguageDetectionMethod=uilanguage

[Languages]
Name: "chinesesimplified"; MessagesFile: "{#ProjectRoot}\installer\languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式"; Flags: unchecked

[Files]
Source: "{#ProjectRoot}\src-tauri\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行 ClipFetch"; Flags: nowait postinstall skipifsilent

[Code]
procedure InitializeWizard;
begin
  WizardForm.Caption := 'ClipFetch 安装向导';
  WizardForm.Font.Name := 'Microsoft YaHei UI';
  WizardForm.WelcomeLabel1.Caption := '欢迎使用 ClipFetch';
  WizardForm.WelcomeLabel1.Font.Name := 'Microsoft YaHei UI';
  WizardForm.WelcomeLabel1.Font.Size := 20;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel2.Caption :=
    '简洁、清晰的短视频解析与媒体保存工具。' + #13#10 + #13#10 +
    '安装向导将帮助你完成安装，并可按需创建桌面快捷方式。' + #13#10 + #13#10 +
    '点击“下一步”开始。';
  WizardForm.WelcomeLabel2.Font.Name := 'Microsoft YaHei UI';
  WizardForm.WelcomeLabel2.Font.Size := 10;
  WizardForm.SelectDirLabel.Caption := '选择 ClipFetch 的安装位置。推荐保留默认路径。';
  WizardForm.SelectTasksLabel.Caption := '选择需要创建的快捷方式，然后点击“下一步”。';
  WizardForm.ReadyLabel.Caption := '安装已准备就绪。请确认以下设置，然后开始安装 ClipFetch。';
  WizardForm.FinishedLabel.Caption := 'ClipFetch 已安装完成，可以立即开始解析与保存媒体。';
end;
