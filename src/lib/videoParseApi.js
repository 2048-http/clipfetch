import { API_BASE_URL } from './authApi'

const PARSE_TIMEOUT = 180_000

export class VideoParseApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'VideoParseApiError'
    this.details = details
  }
}

export function extractShareUrl(value) {
  const text = String(value || '').trim()
  const match = text.match(/https?:\/\/[^\s<>"']+/i)
  if (!match) return ''
  return match[0].replace(/[，。！？、；：）】》”’),.;:!?]+$/u, '')
}

function normalizeMediaUrl(value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url) return ''
  try {
    return new URL(url, `${API_BASE_URL}/`).href
  } catch {
    return ''
  }
}

function normalizeUrls(value, preserveEmpty = false) {
  let values = value
  if (typeof values === 'string') {
    const text = values.trim()
    if (!text) return []
    try {
      values = JSON.parse(text)
    } catch {
      values = text.match(/https?:\/\/[^\s,"']+/gi) || [text]
    }
  }
  if (!Array.isArray(values)) values = [values]
  const urls = values.map((item) => {
    if (typeof item === 'string') return normalizeMediaUrl(item)
    if (!item || typeof item !== 'object') return ''
    const candidate = item.url || item.video_url || item.live_url || item.src || item.image || item.cover
    return normalizeMediaUrl(candidate)
  })
  return preserveEmpty ? urls : urls.filter(Boolean)
}

function normalizeResult(data, sourceUrl) {
  const type = String(data?.type || '').toLowerCase()
  const images = normalizeUrls(data?.images)
  const rawLiveVideos = normalizeUrls(data?.images_live, true)
  const liveVideos = images.map((_, index) => rawLiveVideos[index] || '')
  const isImage = ['image', 'images', 'live', 'live_photo', 'gallery'].includes(type) || (!data?.video_url && !data?.url && images.length > 0)
  const videoUrl = isImage ? '' : normalizeMediaUrl(data?.video_url || data?.url)
  const downloadUrl = isImage ? '' : normalizeMediaUrl(data?.download_url || videoUrl)
  const proxyUrl = isImage ? '' : normalizeMediaUrl(data?.proxy_url)
  const playbackUrls = [...new Set([videoUrl, proxyUrl, downloadUrl].filter(Boolean))]
  const thumbnail = normalizeMediaUrl(data?.cover || images[0])
  const width = Math.max(0, Number(data?.download_width) || 0)
  const height = Math.max(0, Number(data?.download_height) || 0)

  if (isImage && !images.length) throw new VideoParseApiError('解析成功，但接口没有返回可用图片')
  if (!isImage && !videoUrl && !downloadUrl) throw new VideoParseApiError('解析成功，但接口没有返回可用视频')

  return {
    id: Date.now(),
    title: String(data?.title || data?.desc || '').trim() || '未命名内容',
    description: String(data?.desc || '').trim(),
    platform: String(data?.platform || '').trim() || '未知平台',
    author: String(data?.author || '').trim(),
    avatarUrl: normalizeMediaUrl(data?.avatar),
    time: '刚刚',
    createdAt: new Date().toISOString(),
    status: 'ready',
    thumbnail,
    sourceUrl,
    videoUrl,
    downloadUrl,
    proxyUrl,
    playbackUrls,
    liveVideoUrl: liveVideos.find(Boolean) || '',
    liveVideos,
    images,
    mediaType: isImage ? 'image' : 'video',
    hasLivePhotos: liveVideos.some(Boolean),
    musicUrl: normalizeMediaUrl(data?.music),
    parseTime: Math.max(0, Number(data?.parse_time) || 0),
    resolution: width && height ? `${width} × ${height}` : '',
    stats: data?.stats && typeof data.stats === 'object' ? data.stats : {},
    tokensBalance: Number.isFinite(Number(data?.tokens_balance)) ? Number(data.tokens_balance) : null,
    tokensConsumed: Math.max(0, Number(data?.tokens_consumed) || 0),
    ossAsync: Boolean(data?.oss_async),
    isRemote: false,
  }
}

function endpointForUrl(sourceUrl) {
  let host
  try {
    host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'parse_video.php'
  }
  if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com') || host.endsWith('fxtwitter.com') || host.endsWith('vxtwitter.com')) return 'parse_x.php'
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'parse_instagram.php'
  if (host === 'threads.net' || host.endsWith('.threads.net') || host === 'threads.com' || host.endsWith('.threads.com')) return 'parse_threads.php'
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'parse_youtube.php'
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') return 'parse_facebook.php'
  return 'parse_video.php'
}

export async function parseVideoLink(userId, value, { signal } = {}) {
  const numericUserId = Number(userId)
  const sourceUrl = extractShareUrl(value)
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new VideoParseApiError('登录信息无效，请退出后重新登录')
  }
  if (!sourceUrl) throw new VideoParseApiError('没有识别到有效链接，请重新粘贴分享内容')
  try {
    const parsed = new URL(sourceUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol')
  } catch {
    throw new VideoParseApiError('链接格式不正确，请重新复制分享链接')
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), PARSE_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/${endpointForUrl(sourceUrl)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: numericUserId, url: sourceUrl }),
      signal: controller.signal,
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new VideoParseApiError('解析服务返回了无法识别的数据')
    }
    if (!response.ok || !payload?.success || !payload?.data) {
      throw new VideoParseApiError(payload?.message || `解析服务异常（${response.status}）`, payload)
    }
    return normalizeResult(payload.data, sourceUrl)
  } catch (error) {
    if (error instanceof VideoParseApiError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new VideoParseApiError('解析等待时间过长，请稍后重试或更换链接')
    }
    throw new VideoParseApiError('无法连接解析服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
