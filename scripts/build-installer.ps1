$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
$innoCandidates = @(
  "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
  (Join-Path $programFilesX86 'Inno Setup 6\ISCC.exe')
)
$iscc = $innoCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $iscc) {
  throw 'Inno Setup 6 was not found. Install JRSoftware.InnoSetup first.'
}

$assetsDir = Join-Path $projectRoot 'installer\assets'
$iconPath = Join-Path $projectRoot 'src-tauri\icons\icon.png'
$sidebarPath = Join-Path $assetsDir 'wizard-sidebar.bmp'
$smallPath = Join-Path $assetsDir 'wizard-small.bmp'
New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-ClipFetchWizardImage {
  param(
    [string]$Destination,
    [int]$Width,
    [int]$Height,
    [bool]$Compact
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $bounds = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bounds,
    [System.Drawing.Color]::FromArgb(18, 34, 58),
    [System.Drawing.Color]::FromArgb(54, 125, 245),
    55
  )
  $graphics.FillRectangle($gradient, $bounds)

  $glowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(32, 151, 205, 255))
  $graphics.FillEllipse($glowBrush, [int]($Width * 0.28), [int](-$Width * 0.2), [int]($Width * 1.15), [int]($Width * 1.15))

  $icon = [System.Drawing.Image]::FromFile($iconPath)
  if ($Compact) {
    $padding = [int]($Width * 0.13)
    $graphics.DrawImage($icon, $padding, $padding, $Width - ($padding * 2), $Height - ($padding * 2))
  } else {
    $iconSize = [int]($Width * 0.55)
    $iconX = [int](($Width - $iconSize) / 2)
    $iconY = [int]($Height * 0.22)
    $graphics.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)

    $titleFont = [System.Drawing.Font]::new('Microsoft YaHei UI', 14, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = [System.Drawing.Font]::new('Microsoft YaHei UI', 9, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(205, 225, 244, 255))
    $center = [System.Drawing.StringFormat]::new()
    $center.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('ClipFetch', $titleFont, $textBrush, [System.Drawing.RectangleF]::new(0, $iconY + $iconSize + 18, $Width, 26), $center)
    $graphics.DrawString('Parse  |  Preview  |  Save', $subtitleFont, $mutedBrush, [System.Drawing.RectangleF]::new(0, $iconY + $iconSize + 45, $Width, 22), $center)
    $center.Dispose()
    $mutedBrush.Dispose()
    $textBrush.Dispose()
    $subtitleFont.Dispose()
    $titleFont.Dispose()
  }

  $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $icon.Dispose()
  $glowBrush.Dispose()
  $gradient.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-ClipFetchWizardImage -Destination $sidebarPath -Width 164 -Height 314 -Compact $false
New-ClipFetchWizardImage -Destination $smallPath -Width 55 -Height 55 -Compact $true

Push-Location $projectRoot
try {
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed.' }

  & npm.cmd run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw 'Tauri release build failed.' }

  & $iscc /Qp (Join-Path $projectRoot 'installer\ClipFetch.iss')
  if ($LASTEXITCODE -ne 0) { throw 'Inno Setup compilation failed.' }
} finally {
  Pop-Location
}

$outputPath = Join-Path $projectRoot 'src-tauri\target\release\bundle\inno\ClipFetch_0.1.1_x64_Setup.exe'
if (-not (Test-Path -LiteralPath $outputPath)) {
  throw "Installer output was not found: $outputPath"
}

Write-Host "Installer created: $outputPath"
