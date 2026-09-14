const DEFAULT_API_BASE_URL = 'https://xiaofi.cn/api'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

export function normalizeAvatarUrl(value) {
  const avatarUrl = typeof value === 'string' ? value.trim() : ''
  if (!avatarUrl) return ''
  try {
    return new URL(avatarUrl, `${new URL(API_BASE_URL).origin}/`).href
  } catch {
    return ''
  }
}

export class AuthApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'AuthApiError'
    this.details = details
  }
}

function mapAuthUser(user) {
  return {
    id: user.id,
    uid: user.uid,
    name: user.username,
    email: user.email || '',
    phone: user.phone || '',
    avatarUrl: normalizeAvatarUrl(user.avatar_url),
    status: user.status,
    vipLevel: Number(user.vip_level || 0),
    vipExpire: user.vip_expire || user.vip_expire_time || null,
    qqOpenId: user.qq_openid || '',
    qqNickname: user.qq_nickname || '',
  }
}

export async function loginWithPassword(identifier, password, { type = 'username', code = '' } = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)

  const loginType = ['username', 'phone', 'email'].includes(type) ? type : 'username'
  const body = {
    login_type: loginType,
    password,
    [loginType]: identifier.trim(),
  }
  if (loginType === 'phone') body.phone_code = code.trim()
  if (loginType === 'email') body.email_code = code.trim()

  try {
    const response = await fetch(`${API_BASE_URL}/desktop_login_api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new AuthApiError('登录服务返回了无法识别的数据，请稍后重试')
    }

    if (!response.ok) {
      throw new AuthApiError(data.message || `登录服务异常（${response.status}）`)
    }

    if (!data.success || !data.user) {
      throw new AuthApiError(data.message || '用户名或密码错误', data)
    }

    return mapAuthUser(data.user)
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (error?.name === 'AbortError') throw new AuthApiError('连接登录服务超时，请检查网络后重试')
    throw new AuthApiError('无法连接登录服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
  }
}

async function sendAuthCode(type, identifier, humanVerification, purpose) {
  if (!['phone', 'email'].includes(type)) throw new AuthApiError('不支持的验证码类型')
  if (!humanVerification) throw new AuthApiError('请先完成人机验证')

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  const endpoint = type === 'phone' ? 'desktop_send_sms_code.php' : 'desktop_send_email_code.php'

  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [type]: identifier.trim(),
        type: purpose,
        human_verification: humanVerification,
      }),
      signal: controller.signal,
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new AuthApiError('验证码服务返回了无法识别的数据')
    }

    if (!response.ok || Number(data.code) !== 200) {
      throw new AuthApiError(data.msg || data.message || `验证码服务异常（${response.status}）`, data)
    }
    return data.msg || '验证码已发送'
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (error?.name === 'AbortError') throw new AuthApiError('验证码发送超时，请稍后重试')
    throw new AuthApiError('无法连接验证码服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
  }
}

export function sendLoginCode(type, identifier, humanVerification) {
  return sendAuthCode(type, identifier, humanVerification, 'login')
}

export function sendRegisterCode(type, identifier, humanVerification) {
  return sendAuthCode(type, identifier, humanVerification, 'register')
}

export async function registerWithVerification({ type, username, identifier, code, password, confirmPassword }) {
  if (!['phone', 'email'].includes(type)) throw new AuthApiError('不支持的注册方式')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(`${API_BASE_URL}/desktop_register_api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        register_type: type,
        username: username.trim(),
        [type]: identifier.trim(),
        code: code.trim(),
        password,
        confirm_password: confirmPassword,
      }),
      signal: controller.signal,
    })
    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new AuthApiError('注册服务返回了无法识别的数据')
    }

    if (!response.ok || !data.success || !data.user) {
      throw new AuthApiError(data.message || `注册服务异常（${response.status}）`, data)
    }
    return mapAuthUser(data.user)
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (error?.name === 'AbortError') throw new AuthApiError('注册请求超时，请稍后重试')
    throw new AuthApiError('无法连接注册服务，请检查网络后重试')
  } finally {
    window.clearTimeout(timeout)
  }
}
