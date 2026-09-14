# ClipFetch · 短视频解析器

一个面向 Windows 的轻量短视频解析桌面应用，界面参考 [SkyMusicPlay Lite](https://github.com/Whitewind0987/sky-music-play-lite) 的布局语言：窄侧栏、浅灰工作区、蓝色强调色与卡片化面板。

## 技术栈

- Tauri v2（Windows 桌面壳）
- React 19 + Vite
- Rust（`src-tauri`，用于后续接入解析、下载与文件系统能力）

## 本地开发

```bash
npm install
npm run dev
```

浏览器访问终端输出的本地地址即可预览。浏览器模式使用演示数据；Tauri 桌面模式会调用本机 `yt-dlp` 执行真实解析与下载。

登录已连接 `login_api.php`。默认接口根地址为 `https://xiaofi.cn/api`，如需切换测试环境，可复制 `.env.example` 为 `.env.local` 并修改 `VITE_API_BASE_URL`。

真实解析前请确保 `yt-dlp` 已加入系统 PATH；高清视频合并建议同时安装 FFmpeg。

## 构建 Windows 安装包

安装 Rust stable 与 Windows WebView2 后执行：

```bash
npm run tauri build
```

安装包输出在 `src-tauri/target/release/bundle/nsis/`。

也可以使用项目内置的现代 Inno Setup 安装器：

```bash
npm run build:installer
```

## 下载与代码签名

正式版本将发布在 [GitHub Releases](https://github.com/2048-http/clipfetch/releases)。

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/). 详细流程与维护者职责请参阅[代码签名政策](CODE_SIGNING_POLICY.md)。

## 隐私

ClipFetch 会连接 `xiaofi.cn` 完成账号、解析记录和收藏等功能。数据处理方式与用户权利请参阅[隐私政策](PRIVACY.md)。服务端源码和凭据不属于本客户端仓库，也不会提交到 GitHub。

## 下一步接入真实解析

前端解析入口位于 `src/App.jsx` 的 `parseVideo`。将演示定时器替换为 Tauri `invoke` 调用，并在 `src-tauri/src/lib.rs` 中注册 Rust command，即可接入自有解析服务或本地解析模块。
