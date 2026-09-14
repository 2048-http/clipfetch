import { API_BASE_URL, normalizeAvatarUrl } from './authApi'

const REQUEST_TIMEOUT = 12000

export class AccountApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'AccountApiError'
    this.details = details
  }
}

function normalizeOptionalUrl(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  try {
    return new URL(text, `${new URL(API_BASE_URL).origin}/`).href
  } catch {
    return text
  }
}

export async function getAccountProfile(userId, { signal } = {}) {
  const numericUserId = Number(userId)
  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new AccountApiError('登录信息无效，请退出后重新登录')
  }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${API_BASE_URL}/get_user_info.php?user_id=${numericUserId}`, {
      signal: controller.signal,
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new AccountApiError('账号服务返回了无法识别的数据')
    }

    if (!response.ok || !payload?.success || !payload?.data) {
      throw new AccountApiError(payload?.message || `获取账号资料失败（${response.status}）`, payload)
    }

    const data = payload.data
    return {
      id: Number(data.id) || numericUserId,
      uid: String(data.uid || ''),
      name: String(data.username || ''),
      avatarUrl: normalizeAvatarUrl(data.avatar_url),
      profileBgUrl: normalizeOptionalUrl(data.profile_bg_url),
      profileBgMask: Number(data.profile_bg_mask ?? 0.35),
      profileBgBlur: Number(data.profile_bg_blur ?? 0),
      profileBgBright: Number(data.profile_bg_bright ?? 1),
      email: String(data.email || ''),
      phone: String(data.phone || ''),
      status: data.status ?? '',
      vipLevel: Number(data.vip_level || 0),
      vipExpire: data.vip_expire_time || data.vip_expire || null,
      points: Number(data.points || 0),
      totalPoints: Number(data.total_points || 0),
      createdAt: data.created_at || null,
      lastLoginTime: data.last_login_time || null,
      qqOpenId: String(data.qq_openid || ''),
      qqNickname: String(data.qq_nickname || ''),
      weixinOpenId: String(data.weixin_openid || ''),
      weixinNickname: String(data.weixin_nickname || ''),
      xiaomiUnionId: String(data.xiaomi_union_id || ''),
      xiaomiOpenId: String(data.xiaomi_open_id || ''),
      xiaomiNickname: String(data.xiaomi_nickname || ''),
    }
  } catch (error) {
    if (error instanceof AccountApiError) throw error
    if (error?.name === 'AbortError') {
      if (signal?.aborted) throw error
      throw new AccountApiError('加载账号资料超时，请检查网络后重试')
    }
    throw new AccountApiError('无法连接账号服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
