import { API_BASE_URL } from './authApi'

const REQUEST_TIMEOUT = 12000

export class FavoritesApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'FavoritesApiError'
    this.details = details
  }
}

function normalizePositiveInteger(value, message) {
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) throw new FavoritesApiError(message)
  return number
}

function formatFavoriteTime(value) {
  if (!value) return '时间未知'
  const date = new Date(typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') : value)
  if (Number.isNaN(date.getTime())) return String(value)

  const elapsed = Date.now() - date.getTime()
  if (elapsed >= 0 && elapsed < 60_000) return '刚刚'
  if (elapsed >= 0 && elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`
  if (elapsed >= 0 && elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function firstMediaUrl(value) {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return ''
    if (/^https?:\/\//i.test(text)) return text
    try {
      return firstMediaUrl(JSON.parse(text))
    } catch {
      return ''
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstMediaUrl(item)
      if (url) return url
    }
    return ''
  }
  if (value && typeof value === 'object') {
    for (const key of ['image', 'image_url', 'cover', 'url', 'src', 'url_list', 'urls']) {
      const url = firstMediaUrl(value[key])
      if (url) return url
    }
  }
  return ''
}

function mapFavorite(item) {
  const recordId = Number(item?.record_id)
  return {
    id: recordId,
    favoriteId: Number(item?.id) || 0,
    title: String(item?.title || '').trim() || '未命名内容',
    author: String(item?.author || '').trim(),
    platform: String(item?.platform || '').trim() || '未知平台',
    mediaType: item?.media_type === 'image' ? 'image' : 'video',
    thumbnail: firstMediaUrl(item?.cover_image),
    videoUrl: String(item?.video_url || '').trim(),
    sourceUrl: String(item?.url || '').trim(),
    status: 'ready',
    createdAt: item?.created_at || '',
    time: formatFavoriteTime(item?.created_at),
    images: [],
    liveVideos: [],
    isRemote: true,
  }
}

async function requestFavorites(userId, body, { signal, allowMissing = false } = {}) {
  const numericUserId = normalizePositiveInteger(userId, '登录信息无效，请退出后重新登录')
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/favorites.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: numericUserId, ...body }),
      signal: controller.signal,
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new FavoritesApiError('收藏服务返回了无法识别的数据')
    }

    if (!response.ok) throw new FavoritesApiError(payload?.message || `收藏服务异常（${response.status}）`, payload)
    if (!payload?.success) {
      if (allowMissing && /已经收藏|不存在/.test(payload?.message || '')) return payload
      throw new FavoritesApiError(payload?.message || '收藏操作失败', payload)
    }
    return payload
  } catch (error) {
    if (error instanceof FavoritesApiError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new FavoritesApiError('收藏请求超时，请检查网络后重试')
    }
    throw new FavoritesApiError('无法连接收藏服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function getFavorites(userId, { page = 1, pageSize = 20, signal } = {}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 20))
  const payload = await requestFavorites(userId, {
    action: 'list', page: safePage, page_size: safePageSize,
  }, { signal })
  const data = payload?.data || {}
  return {
    items: Array.isArray(data.list) ? data.list.map(mapFavorite).filter((item) => item.id > 0) : [],
    total: Math.max(0, Number(data.total) || 0),
    page: Math.max(1, Number(data.page) || safePage),
    pageSize: Math.max(1, Number(data.page_size) || safePageSize),
    totalPages: Math.max(0, Number(data.total_pages) || 0),
  }
}

export async function checkFavoriteIds(userId, recordIds, { signal } = {}) {
  const ids = [...new Set((recordIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  if (!ids.length) return []
  const payload = await requestFavorites(userId, { action: 'check', record_ids: ids }, { signal })
  return Array.isArray(payload?.data?.favorites)
    ? payload.data.favorites.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : []
}

export async function addFavorite(userId, record, { signal } = {}) {
  if (!record?.sourceUrl) throw new FavoritesApiError('这条内容缺少原始链接，暂时无法收藏')
  const recordId = record.isRemote ? Number(record.id) : 0
  const payload = await requestFavorites(userId, {
    action: 'add',
    record_id: Number.isInteger(recordId) && recordId > 0 ? recordId : 0,
    title: record.title || '',
    author: record.author || '',
    platform: record.platform || '',
    media_type: record.mediaType || 'video',
    cover_image: record.thumbnail || '',
    video_url: record.videoUrl || record.downloadUrl || '',
    url: record.sourceUrl,
  }, { signal, allowMissing: true })
  return {
    recordId: Number(payload?.data?.record_id) || (Number.isInteger(recordId) ? recordId : 0),
    favoriteId: Number(payload?.data?.favorite_id) || 0,
    message: payload?.message || '收藏成功',
  }
}

export async function removeFavorite(userId, recordId, { signal } = {}) {
  const numericRecordId = normalizePositiveInteger(recordId, '收藏记录编号无效')
  const payload = await requestFavorites(userId, {
    action: 'remove', record_id: numericRecordId,
  }, { signal, allowMissing: true })
  return payload?.message || '已取消收藏'
}
