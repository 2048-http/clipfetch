const SETTINGS_STORAGE_KEY = 'clipfetch.settings.v1'
export const LAST_PAGE_STORAGE_KEY = 'clipfetch.last-page'

export const DEFAULT_SETTINGS = Object.freeze({
  downloadDirectory: '',
  videoQuality: 'best',
  filenameStyle: 'title',
  openAfterDownload: false,
  autoClipboard: true,
  showRecentRecords: true,
  autoplayMotion: true,
  reduceMotion: false,
  rememberLastPage: true,
})

const allowedQuality = new Set(['best', '1080', '720', '480'])
const allowedFilenameStyle = new Set(['title', 'platform-title', 'date-title'])

function normalizeSettings(value) {
  const input = value && typeof value === 'object' ? value : {}
  return {
    downloadDirectory: typeof input.downloadDirectory === 'string' ? input.downloadDirectory.trim() : '',
    videoQuality: allowedQuality.has(input.videoQuality) ? input.videoQuality : DEFAULT_SETTINGS.videoQuality,
    filenameStyle: allowedFilenameStyle.has(input.filenameStyle) ? input.filenameStyle : DEFAULT_SETTINGS.filenameStyle,
    openAfterDownload: typeof input.openAfterDownload === 'boolean' ? input.openAfterDownload : DEFAULT_SETTINGS.openAfterDownload,
    autoClipboard: typeof input.autoClipboard === 'boolean' ? input.autoClipboard : DEFAULT_SETTINGS.autoClipboard,
    showRecentRecords: typeof input.showRecentRecords === 'boolean' ? input.showRecentRecords : DEFAULT_SETTINGS.showRecentRecords,
    autoplayMotion: typeof input.autoplayMotion === 'boolean' ? input.autoplayMotion : DEFAULT_SETTINGS.autoplayMotion,
    reduceMotion: typeof input.reduceMotion === 'boolean' ? input.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    rememberLastPage: typeof input.rememberLastPage === 'boolean' ? input.rememberLastPage : DEFAULT_SETTINGS.rememberLastPage,
  }
}

export function readSettings() {
  try {
    return normalizeSettings(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}'))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function writeSettings(settings) {
  const normalized = normalizeSettings(settings)
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function resetSettings() {
  window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
  return { ...DEFAULT_SETTINGS }
}

export function formatDownloadTitle(record, style) {
  const title = String(record?.title || '未命名内容').trim() || '未命名内容'
  if (style === 'platform-title') return `${record?.platform || '未知平台'} - ${title}`
  if (style === 'date-title') {
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return `${date} - ${title}`
  }
  return title
}
