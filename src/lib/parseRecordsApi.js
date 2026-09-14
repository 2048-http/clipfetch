import { API_BASE_URL } from './authApi'

const REQUEST_TIMEOUT = 12000

export class ParseRecordsApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ParseRecordsApiError'
    this.details = details
  }
}

function formatRecordTime(value) {
  if (!value) return '时间未知'

  const normalized = typeof value === 'string' && !value.includes('T')
    ? value.replace(' ', 'T')
    : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)

  const elapsed = Date.now() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚'
  if (elapsed >= 0 && elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`
  if (elapsed >= 0 && elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function parseMediaUrls(value, preserveEmpty = false) {
  let items = value
  if (typeof items === 'string') {
    const text = items.trim()
    if (!text) return []
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        items = JSON.parse(text)
      } catch {
        items = [text]
      }
    } else {
      items = [text]
    }
  }
  if (!Array.isArray(items)) items = [items]

  const urls = items.map((item) => {
    if (typeof item === 'string') return item.trim()
    if (!item || typeof item !== 'object') return ''
    const candidate = item.url || item.video_url || item.live_url || item.src || item.image
    return typeof candidate === 'string' ? candidate.trim() : ''
  })
  return preserveEmpty ? urls : urls.filter(Boolean)
}

function mapRecord(record) {
  const status = String(record?.status || '').toLowerCase()
  const images = parseMediaUrls(record?.images)
  const liveVideos = parseMediaUrls(record?.live_video_url, true)
  const videoUrl = typeof record?.video_url === 'string' ? record.video_url.trim() : ''
  const proxyUrl = videoUrl && !videoUrl.includes('/video_proxy.php') && !videoUrl.includes('oss.xiaofi.cn')
    ? `${API_BASE_URL}/video_proxy.php?url=${encodeURIComponent(videoUrl)}`
    : ''

  return {
    id: Number(record?.id),
    title: record?.title?.trim() || '未命名内容',
    platform: record?.platform?.trim() || '未知平台',
    time: formatRecordTime(record?.created_at),
    createdAt: record?.created_at || '',
    status: status === 'success' ? 'ready' : (status || 'ready'),
    thumbnail: record?.cover_image || '',
    sourceUrl: record?.url || '',
    videoUrl,
    proxyUrl,
    playbackUrls: [...new Set([videoUrl, proxyUrl].filter(Boolean))],
    liveVideoUrl: liveVideos.find(Boolean) || '',
    liveVideos,
    mediaType: record?.media_type || 'video',
    author: record?.author?.trim() || '',
    avatarUrl: record?.avatar || '',
    images,
    hasLivePhotos: liveVideos.some(Boolean),
    isRemote: true,
  }
}

async function requestParseRecords(userId, body, signal) {
  const numericUserId = Number(userId)
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new ParseRecordsApiError('登录信息无效，请退出后重新登录')
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/get_parse_records.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: numericUserId,
        ...body,
      }),
      signal: controller.signal,
    })

    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ParseRecordsApiError('解析记录服务返回了无法识别的数据')
    }

    if (!response.ok) {
      throw new ParseRecordsApiError(payload?.message || `解析记录服务异常（${response.status}）`)
    }
    if (!payload?.success || !payload?.data) {
      throw new ParseRecordsApiError(payload?.message || '获取解析记录失败', payload)
    }

    return payload.data
  } catch (error) {
    if (error instanceof ParseRecordsApiError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new ParseRecordsApiError('加载解析记录超时，请检查网络后重试')
    }
    throw new ParseRecordsApiError('无法连接解析记录服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function getParseRecords(userId, { page = 1, pageSize = 20, signal } = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 20))
  const data = await requestParseRecords(userId, {
    page: safePage,
    page_size: safePageSize,
    include_total: true,
    include_images: false,
  }, signal)

  return {
    items: Array.isArray(data.list) ? data.list.map(mapRecord) : [],
    total: Math.max(0, Number(data.total) || 0),
    videoCount: Math.max(0, Number(data.video_count) || 0),
    imageCount: Math.max(0, Number(data.image_count) || 0),
    page: Math.max(1, Number(data.page) || safePage),
    pageSize: Math.max(1, Number(data.page_size) || safePageSize),
    totalPages: Math.max(0, Number(data.total_pages) || 0),
  }
}

export async function getParseRecord(userId, recordId, { signal } = {}) {
  const numericRecordId = Number(recordId)
  if (!Number.isInteger(numericRecordId) || numericRecordId <= 0) {
    throw new ParseRecordsApiError('解析记录编号无效')
  }

  const data = await requestParseRecords(userId, {
    record_id: numericRecordId,
    page: 1,
    page_size: 1,
    include_total: false,
    include_images: true,
  }, signal)
  const record = Array.isArray(data.list) ? data.list[0] : null
  if (!record) throw new ParseRecordsApiError('这条解析记录不存在或已被删除')
  return mapRecord(record)
}

export async function deleteParseRecord(userId, recordId, { signal } = {}) {
  const numericUserId = Number(userId)
  const numericRecordId = Number(recordId)
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new ParseRecordsApiError('登录信息无效，请退出后重新登录')
  }
  if (!Number.isInteger(numericRecordId) || numericRecordId <= 0) {
    throw new ParseRecordsApiError('解析记录编号无效')
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/delete_parse_record.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: numericUserId, id: numericRecordId }),
      signal: controller.signal,
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ParseRecordsApiError('删除服务返回了无法识别的数据')
    }
    if (!response.ok || !payload?.success) {
      throw new ParseRecordsApiError(payload?.message || `删除记录失败（${response.status}）`)
    }
    return payload
  } catch (error) {
    if (error instanceof ParseRecordsApiError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new ParseRecordsApiError('删除请求超时，请检查网络后重试')
    }
    throw new ParseRecordsApiError('无法连接删除服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
