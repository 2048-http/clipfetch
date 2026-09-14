use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, process::Command};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
fn hide_console(command: &mut Command) {
    command.creation_flags(0x08000000);
}

#[cfg(not(target_os = "windows"))]
fn hide_console(_command: &mut Command) {}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VideoInfo {
    title: String,
    platform: String,
    duration: String,
    thumbnail: Option<String>,
}

#[derive(Deserialize)]
struct DownloadFile {
    url: String,
    label: Option<String>,
}

fn validate_url(url: &str) -> Result<(), String> {
    if url.starts_with("https://") || url.starts_with("http://") {
        Ok(())
    } else {
        Err("请输入有效的 http(s) 视频链接".into())
    }
}

fn format_duration(seconds: f64) -> String {
    let total = seconds.max(0.0).round() as u64;
    format!("{:02}:{:02}", total / 60, total % 60)
}

fn safe_file_name(value: &str) -> String {
    let value: String = value
        .chars()
        .filter(|character| !character.is_control() && !r#"<>:"/\|?*"#.contains(*character))
        .take(60)
        .collect();
    let value = value.trim().trim_end_matches(['.', ' ']);
    if value.is_empty() { "解析图片".into() } else { value.into() }
}

fn image_extension(url: &str) -> &'static str {
    let path = url.split('?').next().unwrap_or_default().to_ascii_lowercase();
    if path.ends_with(".mp4") { "mp4" }
    else if path.ends_with(".m4v") { "mp4" }
    else if path.ends_with(".mov") { "mov" }
    else if path.ends_with(".webm") { "webm" }
    else if path.ends_with(".png") { "png" }
    else if path.ends_with(".webp") { "webp" }
    else if path.ends_with(".gif") { "gif" }
    else if path.ends_with(".avif") { "avif" }
    else { "jpg" }
}

fn available_file_path(directory: &Path, stem: &str, extension: &str) -> PathBuf {
    let initial = directory.join(format!("{stem}.{extension}"));
    if !initial.exists() {
        return initial;
    }
    for suffix in 2..10_000 {
        let candidate = directory.join(format!("{stem} ({suffix}).{extension}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    directory.join(format!("{stem} copy.{extension}"))
}

fn default_download_directory() -> PathBuf {
    dirs::video_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("ClipFetch")
}

fn resolve_download_directory(directory: Option<String>, fallback: PathBuf) -> Result<PathBuf, String> {
    let selected = directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or(fallback);
    if !selected.is_absolute() {
        return Err("下载目录必须使用完整路径".into());
    }
    fs::create_dir_all(&selected).map_err(|error| format!("创建下载目录失败：{error}"))?;
    Ok(selected)
}

fn quality_format(quality: Option<&str>) -> &'static str {
    match quality.unwrap_or("best") {
        "1080" => "bv*[height<=1080]+ba/b[height<=1080]/b",
        "720" => "bv*[height<=720]+ba/b[height<=720]/b",
        "480" => "bv*[height<=480]+ba/b[height<=480]/b",
        _ => "bv*+ba/b",
    }
}

#[tauri::command]
fn get_download_directory() -> Result<String, String> {
    let directory = resolve_download_directory(None, default_download_directory())?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn choose_download_directory(current: Option<String>) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let script = r#"
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择 ClipFetch 下载文件夹'
$dialog.ShowNewFolderButton = $true
if ($env:CLIPFETCH_CURRENT_DIRECTORY -and (Test-Path -LiteralPath $env:CLIPFETCH_CURRENT_DIRECTORY)) {
  $dialog.SelectedPath = $env:CLIPFETCH_CURRENT_DIRECTORY
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Write($dialog.SelectedPath)
}
"#;
        let mut command = Command::new("powershell.exe");
        command.args(["-NoProfile", "-STA", "-Command", script]);
        if let Some(path) = current.filter(|value| !value.trim().is_empty()) {
            command.env("CLIPFETCH_CURRENT_DIRECTORY", path);
        }
        hide_console(&mut command);
        let output = command.output().map_err(|error| format!("无法打开目录选择器：{error}"))?;
        if !output.status.success() {
            return Err("目录选择器启动失败".into());
        }
        let selected = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if selected.is_empty() { Ok(None) } else { Ok(Some(selected)) }
    })
    .await
    .map_err(|error| format!("目录选择任务失败：{error}"))?
}

#[tauri::command]
fn open_directory(path: Option<String>) -> Result<String, String> {
    let directory = resolve_download_directory(path, default_download_directory())?;
    let mut command = Command::new("explorer.exe");
    command.arg(&directory);
    hide_console(&mut command);
    command.spawn().map_err(|error| format!("无法打开下载目录：{error}"))?;
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn parse_video(url: String) -> Result<VideoInfo, String> {
    validate_url(&url)?;
    let output = Command::new("yt-dlp")
        .args(["--dump-single-json", "--no-playlist", "--skip-download", &url])
        .output()
        .map_err(|_| "未找到 yt-dlp，请先安装并将它加入 PATH".to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    let data: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("解析返回数据失败：{error}"))?;
    Ok(VideoInfo {
        title: data["title"].as_str().unwrap_or("未命名视频").to_string(),
        platform: data["extractor_key"]
            .as_str()
            .or_else(|| data["extractor"].as_str())
            .unwrap_or("未知平台")
            .to_string(),
        duration: format_duration(data["duration"].as_f64().unwrap_or(0.0)),
        thumbnail: data["thumbnail"].as_str().map(ToString::to_string),
    })
}

#[tauri::command]
async fn download_video(url: String, title: Option<String>, directory: Option<String>, quality: Option<String>) -> Result<String, String> {
    validate_url(&url)?;
    let directory = resolve_download_directory(directory, default_download_directory())?;
    let template = title
        .filter(|value| !value.trim().is_empty())
        .map(|value| directory.join(format!("{} [%(id)s].%(ext)s", safe_file_name(&value))))
        .unwrap_or_else(|| directory.join("%(title).120B [%(id)s].%(ext)s"));
    let output = Command::new("yt-dlp")
        .args(["--no-playlist", "--windows-filenames", "-f", quality_format(quality.as_deref()), "--merge-output-format", "mp4", "-o"])
        .arg(&template)
        .arg(&url)
        .output()
        .map_err(|_| "未找到 yt-dlp，请先安装并将它加入 PATH".to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn download_record_video(url: String, title: String, directory: Option<String>) -> Result<String, String> {
    validate_url(&url)?;
    let directory = resolve_download_directory(directory, default_download_directory())?;
    let extension = if url.split('?').next().unwrap_or_default().to_ascii_lowercase().ends_with(".mov") {
        "mov"
    } else {
        "mp4"
    };
    let file_path = available_file_path(&directory, &safe_file_name(&title), extension);
    let output = Command::new("curl.exe")
        .args([
            "--location", "--fail", "--silent", "--show-error",
            "--retry", "2", "--retry-delay", "1", "--connect-timeout", "15",
            "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            "--output",
        ])
        .arg(&file_path)
        .arg(&url)
        .output()
        .map_err(|_| "系统未找到 curl.exe，无法下载视频".to_string())?;
    if !output.status.success() {
        let _ = fs::remove_file(&file_path);
        return Err(format!("视频下载失败：{}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(directory.to_string_lossy().into_owned())
}

#[tauri::command]
async fn download_files(files: Vec<DownloadFile>, title: String, directory: Option<String>) -> Result<String, String> {
    if files.is_empty() {
        return Err("没有可下载的媒体文件".into());
    }
    if files.len() > 100 {
        return Err("单次最多下载 100 个媒体文件".into());
    }
    for file in &files {
        validate_url(&file.url)?;
    }

    let root_directory = resolve_download_directory(
        directory,
        dirs::picture_dir().unwrap_or_else(std::env::temp_dir).join("ClipFetch"),
    )?;
    let directory = root_directory.join(safe_file_name(&title));
    fs::create_dir_all(&directory).map_err(|error| format!("创建图片目录失败：{error}"))?;

    for (index, file) in files.iter().enumerate() {
        let extension = image_extension(&file.url);
        let default_label = format!("{:02}", index + 1);
        let label = file.label.as_deref().unwrap_or(&default_label);
        let file_path = available_file_path(&directory, &safe_file_name(label), extension);
        let output = Command::new("curl.exe")
            .args([
                "--location", "--fail", "--silent", "--show-error",
                "--retry", "2", "--retry-delay", "1", "--connect-timeout", "15",
                "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
                "--output",
            ])
            .arg(&file_path)
            .arg(&file.url)
            .output()
            .map_err(|_| "系统未找到 curl.exe，无法下载图片".to_string())?;
        if !output.status.success() {
            return Err(format!(
                "第 {} 个媒体文件下载失败：{}",
                index + 1,
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }

    Ok(directory.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            parse_video,
            download_video,
            download_record_video,
            download_files,
            get_download_directory,
            choose_download_directory,
            open_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ClipFetch");
}
