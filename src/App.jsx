import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { siBilibili, siKuaishou, siTiktok, siXiaohongshu } from 'simple-icons'
import 'altcha/i18n/zh-cn'
import 'altcha'
import { API_BASE_URL, loginWithPassword, normalizeAvatarUrl, registerWithVerification, sendLoginCode, sendRegisterCode } from './lib/authApi'
import { getAccountProfile } from './lib/accountApi'
import { deleteParseRecord, getParseRecord, getParseRecords } from './lib/parseRecordsApi'
import { addFavorite, checkFavoriteIds, getFavorites, removeFavorite } from './lib/favoritesApi'
import { extractShareUrl, parseVideoLink } from './lib/videoParseApi'
import { LAST_PAGE_STORAGE_KEY, formatDownloadTitle, readSettings, resetSettings, writeSettings } from './lib/settings'
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardPaste, Clock3, Copy,
  Clipboard, Download, FileText, FileVideo2, FolderDown, FolderOpen, Gauge, Heart, History, Home, Images, Info, Link2, ListVideo, Maximize2, Monitor, MoreHorizontal,
  Pause, Play, RefreshCw, RotateCcw, Settings, ShieldCheck, Sparkles, Video, Volume2, VolumeX, X, Eye, EyeOff, Zap,
  KeyRound, LockKeyhole, LogOut, Mail, MousePointerClick, Smartphone, Trash2, UserRound,
} from 'lucide-react'
import './App.css'

const navigation = [
  { id: 'home', label: '解析', icon: Home },
  { id: 'history', label: '解析记录', icon: History },
  { id: 'favorites', label: '收藏', icon: Heart },
]

const AUTH_STORAGE_KEY = 'clipfetch.auth.user'
const RECORDS_PAGE_SIZE = 20

const legalDocuments = {
  terms: {
    kicker: '使用规则与双方约定',
    title: 'ClipFetch 服务条款',
    intro: '请在注册或使用 ClipFetch 前仔细阅读。本条款用于说明你可以如何使用本软件，以及你与 ClipFetch 运营方之间的权利和责任。',
    icon: FileText,
    sections: [
      { title: '1. 条款的接受与适用', paragraphs: ['当你注册账号、勾选同意或继续使用 ClipFetch，即表示你已阅读、理解并同意本条款及《隐私政策》。如果你不同意其中任何内容，请停止注册或使用。', '本条款适用于 ClipFetch Windows 客户端及其提供的账号、短视频解析、记录、收藏和下载辅助服务。'] },
      { title: '2. 账号注册与安全', bullets: ['注册信息应真实、准确、有效，不得冒用他人手机号、邮箱或身份。', '你应妥善保管密码和验证码；因主动泄露、设备失管或使用弱密码造成的风险由你承担。', '发现账号异常使用时，请及时修改密码并通过文末联系方式反馈。', '不得转让、出租、出售账号，或以批量注册方式干扰正常服务。'] },
      { title: '3. 服务内容', paragraphs: ['ClipFetch 提供分享链接识别、媒体信息展示、下载辅助、解析记录和收藏等功能。解析结果取决于来源平台、网络环境和第三方接口，可能因链接失效、权限限制或平台调整而变化。', '我们可以基于安全、合规和产品运营需要调整功能，但会尽量避免不必要地影响正常使用。'] },
      { title: '4. 合法使用与内容权利', bullets: ['仅解析和保存你有权访问、下载或使用的内容，并遵守来源平台的规则。', '视频、图片、音乐、文字、商标及其他内容的权利归原作者或相应权利人所有；ClipFetch 不因提供技术工具而取得这些权利。', '未经授权，不得将解析内容用于侵权传播、商业盗用、违法交易或其他损害权利人利益的用途。', '不得利用本软件绕过付费、访问控制、地域限制或其他技术保护措施。'] },
      { title: '5. 禁止行为', bullets: ['上传、传播或处理违法、有害、欺诈、侵权或侵犯隐私的内容。', '逆向攻击服务接口，恶意抓取、压测、注入、破解、绕过人机验证或干扰服务器运行。', '使用自动化工具批量请求、占用带宽，或以任何方式影响其他用户正常使用。', '伪造请求、冒充他人，或利用解析结果实施诈骗、骚扰及其他违法活动。'] },
      { title: '6. 第三方服务与可用性', paragraphs: ['部分功能依赖来源平台、短信和邮件服务商、对象存储及网络基础设施。第三方服务可能独立变更、限流或中断，我们无法保证所有链接在任何时间都能解析。', '第三方页面、内容与规则由相应第三方负责；访问或使用前，请自行判断其安全性与适用条款。'] },
      { title: '7. 服务暂停与账号处理', paragraphs: ['为排查故障、维护升级、应对安全风险或履行法律义务，我们可能临时限制部分功能。若账号存在违法、侵权、攻击、滥用或严重违反本条款的行为，我们可以限制功能、暂停或终止服务，并保留必要记录。'] },
      { title: '8. 免责声明与责任限制', paragraphs: ['ClipFetch 按现状提供服务，不对第三方内容的真实性、合法性、完整性或持续可用性作保证。请在下载、发布或商业使用前自行核实权利与风险。', '在法律允许的范围内，对于由第三方平台变化、网络故障、不可抗力、用户违规操作或未经授权使用造成的损失，我们不承担超出法定范围的责任。'] },
      { title: '9. 条款更新与联系我们', paragraphs: ['当服务功能或法律要求发生变化时，我们可能更新条款，并在软件内展示新的版本与生效日期。重大变化会以合理方式提示。', '如对条款、账号或内容处理有疑问，可联系 support@xiaofi.cn。'] },
    ],
  },
  privacy: {
    kicker: '数据处理与用户权利',
    title: 'ClipFetch 隐私政策',
    intro: '我们重视你的个人信息与解析记录安全。本政策说明 ClipFetch 会处理哪些信息、为何处理、如何保护，以及你可以如何管理自己的数据。',
    icon: ShieldCheck,
    sections: [
      { title: '1. 我们处理的信息', bullets: ['账号信息：用户名、用户 ID、手机号或邮箱、头像、账号状态及会员信息。', '验证信息：短信或邮箱验证码记录、人机验证结果、验证时间和请求 IP。我们不会保存明文密码，密码由服务器进行不可逆哈希处理。', '解析与收藏数据：你提交的分享链接、来源平台、标题、作者、封面、媒体地址、解析状态、解析记录及收藏关系。', '运行与安全信息：请求时间、IP 地址、接口错误和必要的安全日志，用于故障排查、反滥用和账号保护。', '本机偏好：下载目录、界面设置和登录保持选项等主要保存在你的设备上。'] },
      { title: '2. 信息的使用目的', bullets: ['创建和管理账号，完成登录、验证、找回与安全检查。', '识别分享链接、返回解析结果、同步解析记录和收藏。', '发送必要的短信或邮件验证码，以及处理用户反馈。', '维护服务稳定性，识别异常请求、攻击、欺诈和接口滥用。', '改进功能体验、修复错误并履行适用法律要求。'] },
      { title: '3. 本机保存与云端同步', paragraphs: ['界面偏好、下载位置等设置通常保存在当前 Windows 设备。账号资料、解析记录和收藏需要保存到服务器，才能在登录后展示和管理。实际下载的媒体文件保存在你选择的本机目录，除非某项解析服务明确需要临时中转。', '退出登录会清除当前客户端保存的登录状态，但不会自动删除服务器中的账号、解析记录或收藏。'] },
      { title: '4. 第三方处理者', paragraphs: ['为提供服务，我们可能使用短信服务商、邮件服务商、云存储与内容分发服务，以及访问你主动提交链接所对应的来源平台。我们仅在实现具体功能所需的范围内传递必要信息。', '人机验证采用自托管的工作量证明方案，不使用广告追踪型验证码。第三方服务可能依据其隐私政策处理网络请求，请同时查阅对应服务规则。'] },
      { title: '5. 信息保存期限', bullets: ['账号信息在账号存续期间保存；申请注销后依照注销流程和法定义务处理。', '验证码仅在短时间内有效，使用后会被标记失效；安全记录按防滥用所需的合理期限保存。', '解析记录与收藏保留至你主动删除、账号注销或服务不再需要；备份中的残留数据会在合理周期内更新或清除。', '法律法规要求保留或为处理争议所必需的信息，可能在规定期限内继续保存。'] },
      { title: '6. 信息安全', paragraphs: ['我们通过 HTTPS 传输、密码哈希、验证码一次性使用、访问控制、人机验证和请求频率限制等措施降低风险。但任何网络系统都无法保证绝对安全，请使用独立且足够强的密码，并妥善保护设备和验证码。'] },
      { title: '7. 你的权利', bullets: ['在软件中查看账号资料、解析记录和收藏。', '更正可编辑的账号信息，删除单条解析记录或收藏。', '退出登录、申请注销账号，或就个人信息访问、更正、删除和处理限制提出请求。', '撤回非必要授权；撤回后，依赖该信息的相关功能可能无法继续使用。'] },
      { title: '8. 未成年人保护', paragraphs: ['未成年人应在监护人指导下使用本服务，不应提交与使用目的无关的个人信息。若监护人发现未成年人信息被不当处理，请联系我们核实并处理。'] },
      { title: '9. 政策更新与联系我们', paragraphs: ['我们会在数据处理方式或法律要求发生变化时更新本政策，并在软件内标注新版本和生效日期。重大变化会以合理方式提示。', '如需行使数据权利、反馈安全问题或咨询本政策，请联系 support@xiaofi.cn。'] },
    ],
  },
}

const platformBrandIcons = {
  douyin: siTiktok,
  kuaishou: siKuaishou,
  redbook: siXiaohongshu,
  bilibili: siBilibili,
  tiktok: siTiktok,
}

function detectPlatform(value) {
  const link = extractShareUrl(value).toLowerCase()
  if (link.includes('douyin') || link.includes('iesdouyin')) return '抖音'
  if (link.includes('kuaishou') || link.includes('gifshow')) return '快手'
  if (link.includes('xiaohongshu') || link.includes('xhslink')) return '小红书'
  if (link.includes('bilibili') || link.includes('b23.tv')) return '哔哩哔哩'
  if (link.includes('channels.weixin') || link.includes('weixin.qq')) return '微信视频号'
  if (link.includes('weibo')) return '微博'
  if (link.includes('tiktok')) return 'TikTok'
  if (link.includes('youtube') || link.includes('youtu.be')) return 'YouTube'
  if (link.includes('instagram')) return 'Instagram'
  if (link.includes('threads.net') || link.includes('threads.com')) return 'Threads'
  if (link.includes('facebook') || link.includes('fb.watch')) return 'Facebook'
  if (link.includes('twitter') || link.includes('x.com')) return 'X / Twitter'
  return link ? '自动识别平台' : '等待粘贴链接'
}

function isLikelyVideoUrl(value) {
  const url = String(value || '').toLowerCase().split('?')[0]
  return /\.(mp4|mov|m4v|webm)$/.test(url) || url.includes('/video/') || url.includes('video_dashinit')
}

function readStoredUser() {
  try {
    const value = window.localStorage.getItem(AUTH_STORAGE_KEY) || window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!value) return null
    const user = JSON.parse(value)
    return { ...user, avatarUrl: normalizeAvatarUrl(user.avatarUrl) }
  } catch {
    return null
  }
}

function BrandMark({ size = 36 }) {
  return (
    <svg className="brand-svg" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path d="M12.25 13.5a3 3 0 0 1 3-3h7.5a3 3 0 0 1 3 3v3.25" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M27.75 26.5a3 3 0 0 1-3 3h-7.5a3 3 0 0 1-3-3v-3.25" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <path d="m23 15 5 5-5 5M28 20H16" stroke="#9ED8FF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlatformBrandIcon({ platform }) {
  const icon = platformBrandIcons[platform]
  if (!icon) return null
  return <i className={`platform-brand-icon ${platform}`} aria-hidden="true"><svg viewBox="0 0 24 24" role="img"><path d={icon.path} /></svg></i>
}

function EmptyIllustration() {
  return (
    <svg className="empty-illustration" viewBox="0 0 240 154" fill="none" aria-hidden="true">
      <path d="M39 129.5h162" stroke="#D9E3F0" strokeWidth="2" strokeLinecap="round" />
      <rect x="65" y="28" width="110" height="88" rx="16" fill="#F6F9FD" stroke="#CAD8E8" strokeWidth="2" />
      <rect x="76" y="40" width="88" height="64" rx="10" fill="white" />
      <path d="m108 59 24 13-24 13V59Z" fill="#4E8FF7" />
      <circle cx="175" cy="39" r="17" fill="#E7F1FF" />
      <path d="M168 39h14M175 32v14" stroke="#4E8FF7" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="57" cy="105" r="11" fill="#EAF9F1" />
      <path d="m52 105 3.5 3.5 6.5-7" stroke="#28A86B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M90 94h60" stroke="#DCE5EF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function VideoThumb({ item, large = false }) {
  return (
    <div className={`video-thumb ${item.accent || 'sunset'} ${large ? 'is-large' : ''}`} style={item.thumbnail ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(8,18,32,.46)), url(${item.thumbnail})` } : undefined}>
      {large && <span className="thumb-play"><Play size={16} fill="currentColor" /></span>}
      {item.duration && <span className="thumb-duration">{item.duration}</span>}
    </div>
  )
}

function StatusPill({ status }) {
  const downloaded = status === 'downloaded'
  const failed = status === 'failed' || status === 'error'
  const pending = status === 'pending' || status === 'processing'
  const label = downloaded ? '已下载' : failed ? '解析失败' : pending ? '处理中' : '解析成功'
  return <span className={`status-pill ${downloaded ? 'is-downloaded' : ''} ${failed ? 'is-failed' : ''} ${pending ? 'is-pending' : ''}`}>{downloaded ? <Check size={12} /> : failed ? <X size={12} /> : pending ? <Clock3 size={12} /> : <CheckCircle2 size={12} />}{label}</span>
}

function UserAvatar({ user }) {
  const [imageFailed, setImageFailed] = useState(false)
  const initial = user.name?.trim().slice(0, 1).toUpperCase() || 'U'

  return (
    <span className="account-avatar">
      {user.avatarUrl && !imageFailed ? (
        <img src={user.avatarUrl} alt={`${user.name}的头像`} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      ) : initial}
    </span>
  )
}

function formatAccountDate(value) {
  if (!value) return '未记录'
  const normalized = typeof value === 'string' && !value.includes('T') ? value.replace(' ', 'T') : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function accountStatusLabel(status) {
  const normalized = String(status ?? '').toLowerCase()
  if (normalized === '1' || normalized === 'active' || normalized === 'normal') return '正常使用'
  if (normalized === 'pending_deletion') return '注销冷静期'
  if (normalized === 'deleted' || normalized === 'disabled' || normalized === '0') return '已停用'
  return normalized ? `状态：${normalized}` : '未记录'
}

function vipLevelLabel(level) {
  return ({ 0: '普通用户', 1: '月度会员', 2: '季度会员', 3: '年度会员', 4: '永久会员' })[Number(level)] || `会员等级 ${level}`
}

function AccountInfoField({ label, value, wide = false, mono = false }) {
  const displayValue = value === '' || value === null || value === undefined ? '未设置' : String(value)
  return <div className={`account-info-field ${wide ? 'is-wide' : ''}`}><span>{label}</span><strong className={mono ? 'is-mono' : ''} title={displayValue}>{displayValue}</strong></div>
}

function AccountProfileModal({ profile, loading, error, onClose, onRetry }) {
  const account = profile || {}
  const vipExpire = Number(account.vipLevel) === 4 ? '永久有效' : formatAccountDate(account.vipExpire)

  return (
    <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-profile-title">
        <header className="account-modal-header">
          <div className="account-modal-identity">
            <UserAvatar user={{ name: account.name || '用户', avatarUrl: account.avatarUrl || '' }} />
            <div><span>当前登录账号</span><h2 id="account-profile-title">{account.name || '账号资料'}</h2><p>{account.email || account.phone || `UID ${account.uid || '—'}`}</p></div>
          </div>
          <div className="account-modal-badges"><span><ShieldCheck size={14} />{accountStatusLabel(account.status)}</span><span className="is-vip"><Sparkles size={14} />{vipLevelLabel(account.vipLevel || 0)}</span></div>
          <button className="account-modal-close" type="button" aria-label="关闭账号资料" onClick={onClose}><X size={19} /></button>
        </header>

        <div className="account-modal-body">
          {loading && <div className="account-profile-loading" aria-label="正在加载账号全部信息"><span className="spinner dark" /><strong>正在同步账号全部信息…</strong><p>包括基础资料、会员、积分和第三方绑定</p></div>}
          {!loading && error && <div className="account-profile-error" role="alert"><AlertCircle size={24} /><strong>账号信息加载失败</strong><p>{error}</p><button type="button" onClick={onRetry}><RefreshCw size={14} />重新加载</button></div>}
          {!loading && !error && <>
            <div className="account-profile-summary">
              <div><span>用户 UID</span><strong>{account.uid || '未设置'}</strong></div>
              <div><span>内部账号 ID</span><strong>{account.id || '未设置'}</strong></div>
              <div><span>当前积分</span><strong>{Number(account.points || 0)}</strong></div>
              <div><span>会员身份</span><strong>{vipLevelLabel(account.vipLevel || 0)}</strong></div>
            </div>

            <section className="account-info-section">
              <div className="account-info-section-title"><UserRound size={17} /><div><h3>基础资料</h3><p>账号身份、联系方式与使用状态</p></div></div>
              <div className="account-info-grid">
                <AccountInfoField label="用户名" value={account.name} />
                <AccountInfoField label="用户 UID" value={account.uid} mono />
                <AccountInfoField label="内部账号 ID" value={account.id} mono />
                <AccountInfoField label="账号状态" value={accountStatusLabel(account.status)} />
                <AccountInfoField label="邮箱" value={account.email} />
                <AccountInfoField label="手机号" value={account.phone} />
                <AccountInfoField label="注册时间" value={formatAccountDate(account.createdAt)} />
                <AccountInfoField label="最近登录" value={formatAccountDate(account.lastLoginTime)} />
              </div>
            </section>

            <section className="account-info-section">
              <div className="account-info-section-title"><Sparkles size={17} /><div><h3>会员与积分</h3><p>会员等级、有效期和全部积分数据</p></div></div>
              <div className="account-info-grid">
                <AccountInfoField label="会员等级" value={`${vipLevelLabel(account.vipLevel || 0)}（等级 ${Number(account.vipLevel || 0)}）`} />
                <AccountInfoField label="会员有效期" value={vipExpire} />
                <AccountInfoField label="当前积分" value={`${Number(account.points || 0)} 分`} />
                <AccountInfoField label="累计积分" value={`${Number(account.totalPoints || 0)} 分`} />
              </div>
            </section>

            <section className="account-info-section">
              <div className="account-info-section-title"><Link2 size={17} /><div><h3>第三方账号绑定</h3><p>即使尚未绑定，也会完整列出对应字段</p></div></div>
              <div className="account-info-grid">
                <AccountInfoField label="QQ 昵称" value={account.qqNickname} />
                <AccountInfoField label="QQ OpenID" value={account.qqOpenId} mono />
                <AccountInfoField label="微信昵称" value={account.weixinNickname} />
                <AccountInfoField label="微信 OpenID" value={account.weixinOpenId} mono />
                <AccountInfoField label="小米昵称" value={account.xiaomiNickname} />
                <AccountInfoField label="小米 Union ID" value={account.xiaomiUnionId} mono />
                <AccountInfoField label="小米 OpenID" value={account.xiaomiOpenId} mono wide />
              </div>
            </section>

            <section className="account-info-section is-resource-section">
              <div className="account-info-section-title"><Images size={17} /><div><h3>资料资源</h3><p>头像、背景图和背景显示参数</p></div></div>
              <div className="account-info-grid">
                <AccountInfoField label="头像地址" value={account.avatarUrl} mono wide />
                <AccountInfoField label="背景图地址" value={account.profileBgUrl} mono wide />
                <AccountInfoField label="背景遮罩" value={`${Math.round(Number(account.profileBgMask ?? 0.35) * 100)}%`} />
                <AccountInfoField label="背景模糊" value={`${Number(account.profileBgBlur ?? 0)} px`} />
                <AccountInfoField label="背景亮度" value={`${Math.round(Number(account.profileBgBright ?? 1) * 100)}%`} />
              </div>
            </section>
          </>}
        </div>

        <footer className="account-modal-footer"><ShieldCheck size={15} /><span>以上为账号接口返回的全部非密码资料</span><button type="button" onClick={onClose}>完成</button></footer>
      </section>
    </div>
  )
}

function AuthVisual() {
  return (
    <div className="auth-visual" aria-hidden="true">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <div className="auth-preview-card">
        <div className="auth-preview-top"><span /><span /><span /></div>
        <div className="auth-preview-link"><Link2 size={16} /><i /><ArrowRight size={15} /></div>
        <div className="auth-preview-video"><Play size={22} fill="currentColor" /></div>
        <div className="auth-preview-copy"><i /><i /></div>
        <div className="auth-preview-success"><CheckCircle2 size={15} /><span>视频解析完成</span></div>
      </div>
      <div className="auth-floating-badge badge-shield"><ShieldCheck size={17} /><span>本地隐私保护</span></div>
      <div className="auth-floating-badge badge-download"><Download size={17} /><span>高清无水印</span></div>
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder = '请输入密码', autoComplete = 'current-password' }) {
  const [visible, setVisible] = useState(false)
  return <label className="auth-field"><span>{label}</span><div><LockKeyhole size={17} /><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} /><button type="button" aria-label={visible ? '隐藏密码' : '显示密码'} onClick={() => setVisible((shown) => !shown)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
}

function LegalDocumentModal({ documentType, onClose }) {
  const legalDocument = legalDocuments[documentType]
  const modalRef = useRef(null)
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!legalDocument) return undefined
    const previousFocus = window.document.activeElement
    closeButtonRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { onClose(); return }
      if (event.key !== 'Tab' || !modalRef.current) return
      const focusable = [...modalRef.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.() }
  }, [legalDocument, onClose])

  if (!legalDocument) return null
  const DocumentIcon = legalDocument.icon
  return (
    <div className="legal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={modalRef} className="legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-document-title" aria-describedby="legal-document-description">
        <header className="legal-modal-header">
          <div className="legal-modal-title-icon"><DocumentIcon size={21} /></div>
          <div><span>{legalDocument.kicker}</span><h2 id="legal-document-title">{legalDocument.title}</h2><p>版本 1.0 · 生效日期：2026 年 9 月 15 日</p></div>
          <button ref={closeButtonRef} type="button" aria-label={`关闭${legalDocument.title}`} onClick={onClose}><X size={19} /></button>
        </header>
        <div className="legal-modal-body">
          <div className="legal-intro"><Info size={18} /><p id="legal-document-description">{legalDocument.intro}</p></div>
          <div className="legal-sections">
            {legalDocument.sections.map((section) => <section key={section.title}>
              <h3>{section.title}</h3>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </section>)}
          </div>
        </div>
        <footer className="legal-modal-footer"><span><ShieldCheck size={15} />内容可随时在注册页面重新查看</span><button type="button" onClick={onClose}>我已了解</button></footer>
      </section>
    </div>
  )
}

function HumanVerification({ onVerified }) {
  const widgetRef = useRef(null)

  useEffect(() => {
    const widget = widgetRef.current
    if (!widget) return undefined
    const handleStateChange = (event) => {
      const detail = event.detail || {}
      onVerified(detail.state === 'verified' ? detail.payload || '' : '')
    }
    widget.addEventListener('statechange', handleStateChange)
    return () => widget.removeEventListener('statechange', handleStateChange)
  }, [onVerified])

  return (
    <div className="human-verification">
      <div className="human-verification-heading">
        <span><ShieldCheck size={15} /></span>
        <div><strong>安全验证</strong><small>验证通过后才能获取验证码</small></div>
      </div>
      <altcha-widget
        ref={widgetRef}
        challenge={`${API_BASE_URL}/auth_verify.php?action=challenge`}
        configuration='{"hideFooter":true,"hideLogo":true}'
        language="zh-cn"
        type="checkbox"
        auto="off"
      />
    </div>
  )
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [loginMethod, setLoginMethod] = useState('username')
  const [registerMethod, setRegisterMethod] = useState('phone')
  const [name, setName] = useState('')
  const [account, setAccount] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [humanPayload, setHumanPayload] = useState('')
  const [humanResetKey, setHumanResetKey] = useState(0)
  const [codeSending, setCodeSending] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)
  const [codeNotice, setCodeNotice] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [remember, setRemember] = useState(true)
  const [legalDocument, setLegalDocument] = useState(null)

  useEffect(() => {
    if (codeCountdown <= 0) return undefined
    const timer = window.setTimeout(() => setCodeCountdown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [codeCountdown])

  const switchMode = (nextMode) => {
    setMode(nextMode); setError(''); setResetSent(false); setPassword(''); setConfirmPassword(''); setLoginCode(''); setHumanPayload(''); setCodeNotice(''); setCodeCountdown(0); setHumanResetKey((key) => key + 1)
  }
  const switchLoginMethod = (method) => {
    setLoginMethod(method); setError(''); setLoginCode(''); setHumanPayload(''); setCodeNotice(''); setCodeCountdown(0); setHumanResetKey((key) => key + 1)
  }
  const switchRegisterMethod = (method) => {
    setRegisterMethod(method); setError(''); setLoginCode(''); setHumanPayload(''); setCodeNotice(''); setCodeCountdown(0); setHumanResetKey((key) => key + 1)
  }
  const validEmail = /^\S+@\S+\.\S+$/.test(email)
  const validPhone = /^1[3-9]\d{9}$/.test(phone)
  const loginIdentifier = loginMethod === 'username' ? account.trim() : loginMethod === 'phone' ? phone.trim() : email.trim()
  const verificationMethod = mode === 'register' ? registerMethod : loginMethod
  const verificationIdentifier = verificationMethod === 'phone' ? phone.trim() : email.trim()
  const needsVerification = mode === 'register' || (mode === 'login' && loginMethod !== 'username')

  const requestVerificationCode = async () => {
    setError(''); setCodeNotice('')
    if (verificationMethod === 'phone' && !validPhone) { setError('请输入有效的 11 位手机号码'); return }
    if (verificationMethod === 'email' && !validEmail) { setError('请输入有效的邮箱地址'); return }
    if (!humanPayload) { setError('请先完成人机验证'); return }
    setCodeSending(true)
    try {
      const sendCode = mode === 'register' ? sendRegisterCode : sendLoginCode
      const message = await sendCode(verificationMethod, verificationIdentifier, humanPayload)
      setCodeNotice(`${message}，10 分钟内有效`)
      setCodeCountdown(60)
      setHumanPayload('')
      setHumanResetKey((key) => key + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '验证码发送失败，请稍后重试')
      setHumanPayload('')
      setHumanResetKey((key) => key + 1)
    } finally {
      setCodeSending(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault(); setError('')
    if (mode === 'login' && loginMethod === 'username' && !account.trim()) { setError('请输入账号'); return }
    if (mode === 'login' && loginMethod === 'phone' && !validPhone) { setError('请输入有效的 11 位手机号码'); return }
    if (mode === 'login' && loginMethod === 'email' && !validEmail) { setError('请输入有效的邮箱地址'); return }
    if (mode === 'login' && loginMethod !== 'username' && !/^\d{6}$/.test(loginCode)) { setError('请输入 6 位验证码'); return }
    if (mode === 'forgot') {
      if (!validEmail) { setError('请输入有效的邮箱地址'); return }
      setError('忘记密码接口将在下一步接入'); return
    }
    if (mode === 'register' && (name.trim().length < 2 || name.trim().length > 30)) { setError('用户名长度需要在 2 到 30 个字符之间'); return }
    if (mode === 'register' && registerMethod === 'phone' && !validPhone) { setError('请输入有效的 11 位手机号码'); return }
    if (mode === 'register' && registerMethod === 'email' && !validEmail) { setError('请输入有效的邮箱地址'); return }
    if (mode === 'register' && !/^\d{6}$/.test(loginCode)) { setError('请输入 6 位验证码'); return }
    if (password.length < 6) { setError('密码至少需要 6 个字符'); return }
    if (mode === 'register' && password !== confirmPassword) { setError('两次输入的密码不一致'); return }
    if (mode === 'register' && !agreed) { setError('请先阅读并同意服务条款与隐私政策'); return }
    setLoading(true)
    try {
      if (mode === 'login') {
        const user = await loginWithPassword(loginIdentifier, password, { type: loginMethod, code: loginCode })
        onAuthenticated(user, remember)
      } else if (mode === 'register') {
        const user = await registerWithVerification({
          type: registerMethod,
          username: name,
          identifier: verificationIdentifier,
          code: loginCode,
          password,
          confirmPassword,
        })
        onAuthenticated(user, true)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand"><BrandMark size={44} /><span><strong>ClipFetch</strong><small>简单、清晰的视频解析工具</small></span></div>
        <div className="auth-brand-copy"><span className="auth-kicker"><Sparkles size={14} />专注于每一次下载</span><h1>喜欢的视频，<br />清晰地保存下来。</h1><p>支持主流短视频平台，一键解析高清无水印视频。你的链接与记录只保存在本机。</p><div className="auth-benefits"><span><Check size={15} />自动识别分享链接</span><span><Check size={15} />优先获取最高画质</span><span><Check size={15} />本地解析，保护隐私</span></div></div>
        <AuthVisual />
        <p className="auth-copyright">© 2026 ClipFetch · Desktop for Windows</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          {resetSent ? (
            <div className="reset-success"><span><KeyRound size={28} /></span><h2>重置邮件已发送</h2><p>我们已向 <strong>{email}</strong> 发送密码重置说明，请检查收件箱和垃圾邮件。</p><button className="auth-submit" type="button" onClick={() => switchMode('login')}><ChevronRight size={17} className="back-arrow" />返回登录</button><button className="auth-text-button" type="button" onClick={() => setResetSent(false)}>没有收到？重新发送</button></div>
          ) : (
            <>
              <div className="auth-mobile-brand"><BrandMark size={38} /><strong>ClipFetch</strong></div>
              <div className="auth-heading" key={mode}><span>{mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账户' : '找回密码'}</span><h2>{mode === 'login' ? '登录 ClipFetch' : mode === 'register' ? '开始使用 ClipFetch' : '重置你的密码'}</h2><p>{mode === 'login' ? '登录后继续管理你的解析记录' : mode === 'register' ? '创建账户，同步你的偏好与收藏' : '输入注册邮箱，我们会发送重置说明'}</p></div>
              {mode !== 'forgot' && <div className="auth-tabs" data-active={mode} role="tablist" aria-label="账户操作"><button className={mode === 'login' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>登录</button><button className={mode === 'register' ? 'is-active' : ''} type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')}>注册</button></div>}
              <form className="auth-form" onSubmit={submit} noValidate>
                {mode === 'login' && <div className="login-method-tabs" data-active={loginMethod} role="tablist" aria-label="登录方式">
                  <button className={loginMethod === 'username' ? 'is-active' : ''} type="button" role="tab" aria-selected={loginMethod === 'username'} onClick={() => switchLoginMethod('username')}><UserRound size={15} />账号</button>
                  <button className={loginMethod === 'phone' ? 'is-active' : ''} type="button" role="tab" aria-selected={loginMethod === 'phone'} onClick={() => switchLoginMethod('phone')}><Smartphone size={15} />手机号</button>
                  <button className={loginMethod === 'email' ? 'is-active' : ''} type="button" role="tab" aria-selected={loginMethod === 'email'} onClick={() => switchLoginMethod('email')}><Mail size={15} />邮箱</button>
                </div>}
                {mode === 'register' && <div className="login-method-tabs is-register" data-active={registerMethod} role="tablist" aria-label="注册方式">
                  <button className={registerMethod === 'phone' ? 'is-active' : ''} type="button" role="tab" aria-selected={registerMethod === 'phone'} onClick={() => switchRegisterMethod('phone')}><Smartphone size={15} />手机号注册</button>
                  <button className={registerMethod === 'email' ? 'is-active' : ''} type="button" role="tab" aria-selected={registerMethod === 'email'} onClick={() => switchRegisterMethod('email')}><Mail size={15} />邮箱注册</button>
                </div>}
                <div className="auth-form-content" key={`${mode}-${mode === 'login' ? loginMethod : mode === 'register' ? registerMethod : 'default'}`}>
                {mode === 'register' && <div className="auth-register-row">
                  <label className="auth-field"><span>用户名</span><div><UserRound size={17} /><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="2–30 个字符" autoComplete="username" /></div></label>
                  {registerMethod === 'phone' ? <label className="auth-field"><span>手机号</span><div><Smartphone size={17} /><input type="tel" inputMode="numeric" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="11 位手机号" autoComplete="tel" /></div></label> : <label className="auth-field"><span>邮箱</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div></label>}
                </div>}
                {mode === 'login' && loginMethod === 'username' && <label className="auth-field"><span>账号</span><div><UserRound size={17} /><input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="请输入账号" autoComplete="username" /></div></label>}
                {mode === 'login' && loginMethod === 'phone' && <label className="auth-field"><span>手机号</span><div><Smartphone size={17} /><input type="tel" inputMode="numeric" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="请输入 11 位手机号" autoComplete="tel" /></div></label>}
                {((mode === 'login' && loginMethod === 'email') || mode === 'forgot') && <label className="auth-field"><span>邮箱</span><div><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div></label>}
                {needsVerification && <>
                  <HumanVerification key={`${mode}-${verificationMethod}-${verificationIdentifier}-${humanResetKey}`} onVerified={setHumanPayload} />
                  <label className="auth-field auth-code-field"><span>{verificationMethod === 'phone' ? '短信验证码' : '邮箱验证码'}</span><div><KeyRound size={17} /><input inputMode="numeric" maxLength={6} value={loginCode} onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入 6 位验证码" autoComplete="one-time-code" /><button className="send-code-button" type="button" disabled={codeSending || codeCountdown > 0 || !humanPayload} onClick={requestVerificationCode}>{codeSending ? '发送中…' : codeCountdown > 0 ? `${codeCountdown}s 后重发` : '获取验证码'}</button></div></label>
                  {codeNotice && <div className="auth-code-notice" role="status"><CheckCircle2 size={15} />{codeNotice}</div>}
                </>}
                {mode === 'register' ? <div className="auth-register-row"><PasswordField label="密码" value={password} onChange={setPassword} placeholder="至少 6 个字符" autoComplete="new-password" /><PasswordField label="确认密码" value={confirmPassword} onChange={setConfirmPassword} placeholder="再次输入密码" autoComplete="new-password" /></div> : mode !== 'forgot' && <PasswordField label="密码" value={password} onChange={setPassword} placeholder="请输入密码" autoComplete="current-password" />}
                {mode === 'login' && <div className="auth-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>保持登录</span></label><button type="button" onClick={() => switchMode('forgot')}>忘记密码？</button></div>}
                {mode === 'register' && <label className="auth-agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /><span>我已阅读并同意 <button type="button" onClick={(event) => { event.preventDefault(); setLegalDocument('terms') }}>服务条款</button> 和 <button type="button" onClick={(event) => { event.preventDefault(); setLegalDocument('privacy') }}>隐私政策</button></span></label>}
                {error && <div className="auth-error" role="alert"><X size={14} />{error}</div>}
                <button className="auth-submit" type="submit" disabled={loading}>{loading ? <><span className="spinner" />请稍候…</> : <>{mode === 'login' ? '登录' : mode === 'register' ? '创建账户' : '发送重置邮件'}<ArrowRight size={17} /></>}</button>
                {mode === 'forgot' && <button className="auth-back" type="button" onClick={() => switchMode('login')}><ChevronRight size={15} />返回登录</button>}
                </div>
              </form>
              <div className="auth-security"><ShieldCheck size={14} />密码经过加密传输，ClipFetch 不会保存明文密码</div>
            </>
          )}
        </div>
      </section>
      <LegalDocumentModal documentType={legalDocument} onClose={() => setLegalDocument(null)} />
    </main>
  )
}

function App() {
  const [user, setUser] = useState(readStoredUser)
  const [settings, setSettings] = useState(readSettings)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [accountProfileOpen, setAccountProfileOpen] = useState(false)
  const [accountProfile, setAccountProfile] = useState(null)
  const [accountProfileLoading, setAccountProfileLoading] = useState(false)
  const [accountProfileError, setAccountProfileError] = useState('')
  const [active, setActive] = useState(() => {
    const savedPage = window.localStorage.getItem(LAST_PAGE_STORAGE_KEY)
    return settings.rememberLastPage && ['home', 'history', 'favorites', 'settings'].includes(savedPage) ? savedPage : 'home'
  })
  const [url, setUrl] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [notice, setNotice] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [resultAction, setResultAction] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteItems, setFavoriteItems] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(Boolean(user))
  const [favoritesError, setFavoritesError] = useState('')
  const [favoritesPage, setFavoritesPage] = useState(1)
  const [favoritesTotal, setFavoritesTotal] = useState(0)
  const [favoritesTotalPages, setFavoritesTotalPages] = useState(0)
  const [favoritesRefreshKey, setFavoritesRefreshKey] = useState(0)
  const [favoritePendingKeys, setFavoritePendingKeys] = useState([])
  const [favoriteNotice, setFavoriteNotice] = useState(null)
  const [recordsLoading, setRecordsLoading] = useState(Boolean(user))
  const [recordsError, setRecordsError] = useState('')
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotalPages, setRecordsTotalPages] = useState(0)
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0)
  const [recordDetail, setRecordDetail] = useState(null)
  const [recordDetailLoading, setRecordDetailLoading] = useState(false)
  const [recordDetailError, setRecordDetailError] = useState('')
  const [recordAction, setRecordAction] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const detailRequestId = useRef(0)
  const parseControllerRef = useRef(null)
  const accountProfileControllerRef = useRef(null)
  const lastClipboardLinkRef = useRef('')

  const selectedPlatform = useMemo(() => detectPlatform(url), [url])
  const favoriteCheckIds = useMemo(() => [...new Set([
    ...history.filter((item) => item.isRemote !== false).map((item) => Number(item.id)),
    result?.isRemote !== false ? Number(result?.id) : 0,
    recordDetail?.isRemote !== false ? Number(recordDetail?.id) : 0,
  ].filter((id) => Number.isInteger(id) && id > 0))], [history, result?.id, result?.isRemote, recordDetail?.id, recordDetail?.isRemote])

  const updateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }))
  const restoreDefaultSettings = () => setSettings(resetSettings())

  const loadAccountProfile = async () => {
    accountProfileControllerRef.current?.abort()
    const controller = new AbortController()
    accountProfileControllerRef.current = controller
    setAccountProfileLoading(true)
    setAccountProfileError('')
    try {
      const profile = await getAccountProfile(user.id, { signal: controller.signal })
      setAccountProfile({
        ...user,
        ...profile,
        avatarUrl: profile.avatarUrl || user.avatarUrl || '',
        profileBgUrl: profile.profileBgUrl || user.profileBgUrl || '',
        status: profile.status || user.status,
        vipExpire: profile.vipExpire || user.vipExpire,
        qqOpenId: profile.qqOpenId || user.qqOpenId || '',
        qqNickname: profile.qqNickname || user.qqNickname || '',
      })
    } catch (error) {
      if (error?.name !== 'AbortError') setAccountProfileError(error instanceof Error ? error.message : '账号资料加载失败')
    } finally {
      if (accountProfileControllerRef.current === controller) {
        accountProfileControllerRef.current = null
        setAccountProfileLoading(false)
      }
    }
  }

  const openAccountProfile = () => {
    setAccountProfile({ ...user })
    setAccountProfileOpen(true)
    loadAccountProfile()
  }

  const closeAccountProfile = () => {
    accountProfileControllerRef.current?.abort()
    accountProfileControllerRef.current = null
    setAccountProfileOpen(false)
    setAccountProfileLoading(false)
  }

  const parseVideo = async () => {
    if (isParsing) {
      parseControllerRef.current?.abort()
      return
    }
    const sourceUrl = extractShareUrl(url)
    if (!sourceUrl) {
      setNotice({ type: 'error', text: '请先粘贴一个短视频链接' })
      return
    }
    const controller = new AbortController()
    parseControllerRef.current = controller
    setUrl(sourceUrl)
    setIsParsing(true)
    setResult(null)
    setResultAction(null)
    setNotice({ type: 'loading', text: `正在通过多线路解析${detectPlatform(sourceUrl) === '自动识别平台' ? '分享内容' : detectPlatform(sourceUrl)}…` })
    try {
      const item = await parseVideoLink(user.id, sourceUrl, { signal: controller.signal })
      setResult(item)
      setHistory((items) => [item, ...items.filter((record) => record.sourceUrl !== item.sourceUrl)].slice(0, RECORDS_PAGE_SIZE))
      if (!history.some((record) => record.sourceUrl === item.sourceUrl)) setRecordsTotal((total) => total + 1)
      const mediaSummary = item.mediaType === 'image'
        ? `${item.images.length} 张图片${item.hasLivePhotos ? `，含 ${item.liveVideos.filter(Boolean).length} 个动态片段` : ''}`
        : item.resolution ? `${item.resolution} 高清视频` : '最高可用画质视频'
      setNotice({ type: 'success', text: `解析完成，已获取${mediaSummary}` })
    } catch (error) {
      if (error?.name === 'AbortError') setNotice({ type: 'cancelled', text: '已取消本次解析，链接仍保留在输入框中' })
      else setNotice({ type: 'error', text: error instanceof Error ? error.message : '解析失败，请稍后重试' })
    } finally {
      if (parseControllerRef.current === controller) parseControllerRef.current = null
      setIsParsing(false)
    }
  }

  const pasteLink = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText.trim()) throw new Error('剪贴板中没有内容')
      setUrl(clipboardText)
      setResult(null)
      setResultAction(null)
      setNotice(null)
    } catch {
      setNotice({ type: 'error', text: '无法读取剪贴板，请直接按 Ctrl + V 粘贴链接' })
    }
  }

  const updateUrl = (nextUrl) => {
    setUrl(nextUrl)
    if (result && extractShareUrl(nextUrl) !== result.sourceUrl) {
      setResult(null)
      setResultAction(null)
    }
    if (notice?.type === 'error' || notice?.type === 'cancelled' || notice?.type === 'success') setNotice(null)
  }

  const favoriteKey = (record) => record?.isRemote === false ? `url:${record.sourceUrl}` : `id:${record?.id}`

  const toggleFavorite = async (record) => {
    if (!record || !user?.id) return
    const key = favoriteKey(record)
    if (favoritePendingKeys.includes(key)) return

    const originalId = Number(record.id)
    const wasFavorite = record.isRemote !== false && favoriteIds.includes(originalId)
    const previousItems = favoriteItems
    const previousTotal = favoritesTotal
    setFavoritePendingKeys((keys) => [...keys, key])
    setFavoriteNotice(null)

    if (wasFavorite) {
      setFavoriteIds((ids) => ids.filter((id) => id !== originalId))
      setFavoriteItems((items) => items.filter((item) => item.id !== originalId))
      setFavoritesTotal((total) => Math.max(0, total - 1))
    }

    try {
      if (wasFavorite) {
        await removeFavorite(user.id, originalId)
        setFavoriteNotice({ type: 'success', text: '已取消收藏' })
      } else {
        let favoriteRecord = record
        if (record.isRemote === false && record.sourceUrl) {
          try {
            const latestRecords = await getParseRecords(user.id, { page: 1, pageSize: 20 })
            favoriteRecord = latestRecords.items.find((item) => item.sourceUrl === record.sourceUrl) || record
          } catch {
            // 新版收藏接口可以直接使用原始链接定位记录，列表预查询失败时继续尝试。
          }
        }
        const saved = await addFavorite(user.id, favoriteRecord)
        if (!saved.recordId) throw new Error('收藏成功，但没有返回解析记录编号')
        const savedRecord = { ...record, id: saved.recordId, favoriteId: saved.favoriteId, isRemote: true }
        setFavoriteIds((ids) => ids.includes(saved.recordId) ? ids : [...ids, saved.recordId])
        setFavoriteItems((items) => favoritesPage === 1 && !items.some((item) => item.id === saved.recordId) ? [savedRecord, ...items].slice(0, 20) : items)
        setFavoritesTotal((total) => favoriteIds.includes(saved.recordId) ? total : total + 1)
        setFavoritesTotalPages((pages) => Math.max(pages, Math.ceil((favoritesTotal + 1) / 20)))
        if (record.sourceUrl) {
          setResult((current) => current?.sourceUrl === record.sourceUrl ? { ...current, id: saved.recordId, isRemote: true } : current)
          setHistory((items) => items.map((item) => item.sourceUrl === record.sourceUrl ? { ...item, id: saved.recordId, isRemote: true } : item))
          setRecordDetail((current) => current?.sourceUrl === record.sourceUrl ? { ...current, id: saved.recordId, isRemote: true } : current)
        }
        setFavoriteNotice({ type: 'success', text: '已添加到收藏' })
      }
      setFavoritesRefreshKey((value) => value + 1)
    } catch (error) {
      if (wasFavorite) {
        setFavoriteIds((ids) => ids.includes(originalId) ? ids : [...ids, originalId])
        setFavoriteItems(previousItems)
        setFavoritesTotal(previousTotal)
      }
      setFavoriteNotice({ type: 'error', text: error instanceof Error ? error.message : '收藏操作失败，请稍后重试' })
    } finally {
      setFavoritePendingKeys((keys) => keys.filter((item) => item !== key))
    }
  }

  const handleAuthenticated = (nextUser, remember) => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    const storage = remember ? window.localStorage : window.sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
    setRecordsPage(1)
    setRecordsLoading(true)
    setRecordsError('')
    setFavoriteIds([])
    setFavoriteItems([])
    setFavoritesPage(1)
    setFavoritesLoading(true)
    setFavoritesError('')
    setUser(nextUser)
  }

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    setLogoutConfirmOpen(false)
    closeAccountProfile()
    setAccountProfile(null)
    setAccountProfileError('')
    setRecordsPage(1)
    setHistory([])
    setRecordsTotal(0)
    setRecordsTotalPages(0)
    setRecordsError('')
    setRecordsLoading(false)
    setFavoriteIds([])
    setFavoriteItems([])
    setFavoritesPage(1)
    setFavoritesTotal(0)
    setFavoritesTotalPages(0)
    setFavoritesError('')
    setFavoritesLoading(false)
    setFavoritePendingKeys([])
    setFavoriteNotice(null)
    setActive('home')
    detailRequestId.current += 1
    setRecordDetail(null)
    setUser(null)
  }

  const refreshRecords = () => {
    setRecordsLoading(true)
    setRecordsError('')
    setRecordsRefreshKey((value) => value + 1)
  }

  const refreshFavorites = () => {
    setFavoritesLoading(true)
    setFavoritesError('')
    setFavoritesRefreshKey((value) => value + 1)
  }

  const changeRecordsPage = (nextPage) => {
    setRecordsLoading(true)
    setRecordsError('')
    setRecordsPage(nextPage)
  }

  const changeFavoritesPage = (nextPage) => {
    setFavoritesLoading(true)
    setFavoritesError('')
    setFavoritesPage(nextPage)
  }

  const openRecord = async (item) => {
    const requestId = ++detailRequestId.current
    setRecordDetail(item)
    setRecordDetailError('')
    setRecordAction(null)
    setActive('record')

    if (!item?.isRemote) {
      setRecordDetailLoading(false)
      return
    }

    setRecordDetailLoading(true)
    try {
      const detail = await getParseRecord(user.id, item.id)
      if (detailRequestId.current === requestId) setRecordDetail(detail)
    } catch (error) {
      if (detailRequestId.current === requestId) {
        setRecordDetailError(error instanceof Error ? error.message : '加载解析记录详情失败')
      }
    } finally {
      if (detailRequestId.current === requestId) setRecordDetailLoading(false)
    }
  }

  const downloadRecord = async (record, selection = {}, setAction = setRecordAction) => {
    if (!record) return
    setAction({ type: 'loading', text: '正在保存媒体文件…' })
    try {
      if (!('__TAURI_INTERNALS__' in window)) throw new Error('请在 Windows 客户端中下载文件')
      const directories = []
      let fileCount = 0
      const downloadTitle = formatDownloadTitle(record, settings.filenameStyle)
      const downloadDirectory = settings.downloadDirectory || null
      if (record.mediaType === 'image') {
        const imageUrls = record.images?.length ? record.images : [record.thumbnail].filter(Boolean)
        const liveVideos = record.liveVideos || []
        const selectedIndexes = new Set(Array.isArray(selection.indexes) ? selection.indexes : imageUrls.map((_, index) => index))
        const selectedImageUrls = imageUrls.filter((_, index) => selectedIndexes.has(index))
        const selectedLiveVideos = liveVideos.filter((_, index) => selectedIndexes.has(index))
        const selectedLivePhotoUrls = imageUrls.filter((_, index) => selectedIndexes.has(index) && Boolean(liveVideos[index]))
        const mediaFiles = []
        const appendFiles = (urls, label) => urls.filter(Boolean).forEach((mediaUrl, index) => {
          const resolvedLabel = typeof label === 'function' ? label(mediaUrl) : label
          mediaFiles.push({ url: mediaUrl, label: `${resolvedLabel}-${String(index + 1).padStart(2, '0')}` })
        })

        if (selection.all) {
          appendFiles(selectedImageUrls, (mediaUrl) => isLikelyVideoUrl(mediaUrl) ? '视频片段' : '图片')
          appendFiles(selectedLiveVideos, '动图视频')
          if (record.thumbnail) mediaFiles.push({ url: record.thumbnail, label: '封面' })
        }
        else {
          if (selection.images) appendFiles(selectedImageUrls, (mediaUrl) => isLikelyVideoUrl(mediaUrl) ? '视频片段' : '图片')
          if (selection.livePhotos) appendFiles(selectedLivePhotoUrls, '动图照片')
          if (selection.liveVideos) appendFiles(selectedLiveVideos, '动图视频')
          if (selection.cover && record.thumbnail) mediaFiles.push({ url: record.thumbnail, label: '封面' })
        }

        if (!mediaFiles.length) throw new Error('请至少选择一项可保存的内容')
        directories.push(await invoke('download_files', { files: mediaFiles, title: downloadTitle, directory: downloadDirectory }))
        fileCount += mediaFiles.length
      } else {
        const mediaUrl = record.downloadUrl || record.videoUrl || record.liveVideoUrl || record.sourceUrl
        const tasks = []
        if (selection.video) {
          if (!mediaUrl) throw new Error('这条记录没有可下载的视频地址')
          const hasDirectMediaUrl = Boolean(record.downloadUrl || record.videoUrl || record.liveVideoUrl)
          tasks.push(hasDirectMediaUrl
            ? invoke('download_record_video', { url: mediaUrl, title: downloadTitle, directory: downloadDirectory })
            : invoke('download_video', { url: mediaUrl, title: downloadTitle, directory: downloadDirectory, quality: settings.videoQuality }))
          fileCount += 1
        }
        if (selection.cover) {
          if (!record.thumbnail) throw new Error('这条记录没有可下载的视频封面')
          tasks.push(invoke('download_files', { files: [{ url: record.thumbnail, label: '视频封面' }], title: `${downloadTitle} - 视频封面`, directory: downloadDirectory }))
          fileCount += 1
        }
        if (!tasks.length) throw new Error('请至少选择一项可保存的内容')
        directories.push(...await Promise.all(tasks))
      }
      const savedDirectories = [...new Set(directories)].join('、')
      let openDirectoryFailed = false
      if (settings.openAfterDownload && directories[0]) {
        try {
          await invoke('open_directory', { path: directories[0] })
        } catch {
          openDirectoryFailed = true
        }
      }
      setAction({ type: 'success', text: `已保存 ${fileCount} 个文件到 ${savedDirectories}${openDirectoryFailed ? '，但未能自动打开目录' : ''}` })
      return true
    } catch (error) {
      setAction({ type: 'error', text: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  const downloadResult = async (record, selection) => {
    const saved = await downloadRecord(record, selection, setResultAction)
    if (!saved) return
    setResult((current) => current?.id === record.id ? { ...current, status: 'downloaded' } : current)
    setHistory((items) => items.map((item) => item.id === record.id ? { ...item, status: 'downloaded' } : item))
  }

  const copyRecordSource = async (record, setAction = setRecordAction) => {
    if (!record?.sourceUrl) return
    try {
      await navigator.clipboard.writeText(record.sourceUrl)
      setAction({ type: 'success', text: '原始分享链接已复制' })
    } catch {
      setAction({ type: 'error', text: '复制失败，请稍后重试' })
    }
  }

  const copyResultCover = async (record) => {
    if (!record?.thumbnail) return
    try {
      await navigator.clipboard.writeText(record.thumbnail)
      setResultAction({ type: 'success', text: '高清封面链接已复制' })
    } catch {
      setResultAction({ type: 'error', text: '复制封面链接失败，请稍后重试' })
    }
  }

  const useRecordLink = (record) => {
    if (!record?.sourceUrl) return
    setUrl(record.sourceUrl)
    setNotice(null)
    setActive('home')
  }

  const requestDeleteRecord = (record) => {
    setDeleteError('')
    setDeleteTarget(record)
  }

  const closeDeleteDialog = () => {
    if (deleteLoading) return
    setDeleteTarget(null)
    setDeleteError('')
  }

  const confirmDeleteRecord = async () => {
    if (!deleteTarget || deleteLoading) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteParseRecord(user.id, deleteTarget.id)
      if (favoriteIds.includes(deleteTarget.id)) await removeFavorite(user.id, deleteTarget.id).catch(() => {})
      const nextTotal = Math.max(0, recordsTotal - 1)
      const nextTotalPages = Math.ceil(nextTotal / RECORDS_PAGE_SIZE)
      const nextPage = Math.min(recordsPage, Math.max(1, nextTotalPages))
      setHistory((items) => items.filter((item) => item.id !== deleteTarget.id))
      setFavoriteIds((ids) => ids.filter((id) => id !== deleteTarget.id))
      setFavoriteItems((items) => items.filter((item) => item.id !== deleteTarget.id))
      setFavoritesTotal((total) => favoriteIds.includes(deleteTarget.id) ? Math.max(0, total - 1) : total)
      setFavoritesRefreshKey((value) => value + 1)
      setRecordsTotal(nextTotal)
      setRecordsTotalPages(nextTotalPages)
      setDeleteTarget(null)
      setRecordsLoading(true)
      if (nextPage !== recordsPage) setRecordsPage(nextPage)
      else setRecordsRefreshKey((value) => value + 1)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败，请稍后重试')
    } finally {
      setDeleteLoading(false)
    }
  }

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return undefined
    const unlisten = getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault()
      setExitConfirmOpen(true)
    })
    return () => { unlisten.then((stopListening) => stopListening()) }
  }, [])

  useEffect(() => {
    if (!exitConfirmOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setExitConfirmOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [exitConfirmOpen])

  useEffect(() => {
    if (!user?.id) return undefined

    const controller = new AbortController()

    getParseRecords(user.id, {
      page: recordsPage,
      pageSize: RECORDS_PAGE_SIZE,
      signal: controller.signal,
    }).then((records) => {
      setHistory(records.items)
      setRecordsTotal(records.total)
      setRecordsTotalPages(records.totalPages)
    }).catch((error) => {
      if (error?.name !== 'AbortError') {
        setRecordsError(error instanceof Error ? error.message : '加载解析记录失败，请稍后重试')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setRecordsLoading(false)
    })

    return () => controller.abort()
  }, [user?.id, recordsPage, recordsRefreshKey])

  useEffect(() => {
    writeSettings(settings)
    if (!settings.rememberLastPage) window.localStorage.removeItem(LAST_PAGE_STORAGE_KEY)
  }, [settings])

  useEffect(() => {
    if (!user?.id || !settings.rememberLastPage) return
    window.localStorage.setItem(LAST_PAGE_STORAGE_KEY, active === 'record' ? 'history' : active)
  }, [active, settings.rememberLastPage, user?.id])

  useEffect(() => {
    if (!user?.id || !settings.autoClipboard || active !== 'home' || url.trim() || isParsing) return undefined
    const readClipboardLink = async () => {
      try {
        if (typeof navigator.clipboard?.readText !== 'function') return
        const clipboardText = await navigator.clipboard.readText()
        const link = extractShareUrl(clipboardText)
        if (!link || link === lastClipboardLinkRef.current) return
        lastClipboardLinkRef.current = link
        setUrl(link)
        setNotice({ type: 'success', text: '已从剪贴板识别并填入视频链接' })
      } catch {
        // 系统未授予剪贴板权限时保持静默，仍可使用页面上的“粘贴”按钮。
      }
    }
    const handleVisibility = () => { if (document.visibilityState === 'visible') readClipboardLink() }
    readClipboardLink()
    window.addEventListener('focus', readClipboardLink)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', readClipboardLink)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [active, isParsing, settings.autoClipboard, url, user?.id])

  useEffect(() => {
    if (!user?.id) return undefined
    const controller = new AbortController()

    getFavorites(user.id, {
      page: favoritesPage,
      pageSize: 20,
      signal: controller.signal,
    }).then((response) => {
      const lastAvailablePage = Math.max(1, response.totalPages)
      if (favoritesPage > lastAvailablePage) {
        setFavoritesPage(lastAvailablePage)
        setFavoritesLoading(true)
        return
      }
      setFavoriteItems(response.items)
      setFavoritesTotal(response.total)
      setFavoritesTotalPages(response.totalPages)
      setFavoritesError('')
      setFavoriteIds((ids) => [...new Set([...ids, ...response.items.map((item) => item.id)])])
    }).catch((error) => {
      if (error?.name !== 'AbortError') setFavoritesError(error instanceof Error ? error.message : '加载收藏失败，请稍后重试')
    }).finally(() => {
      if (!controller.signal.aborted) setFavoritesLoading(false)
    })

    return () => controller.abort()
  }, [user?.id, favoritesPage, favoritesRefreshKey])

  useEffect(() => {
    if (!user?.id || !favoriteCheckIds.length) return undefined
    const controller = new AbortController()

    checkFavoriteIds(user.id, favoriteCheckIds, { signal: controller.signal }).then((checkedIds) => {
      setFavoriteIds((ids) => [...new Set([
        ...ids.filter((id) => !favoriteCheckIds.includes(id)),
        ...checkedIds,
      ])])
    }).catch(() => {})

    return () => controller.abort()
  }, [user?.id, favoriteCheckIds])

  useEffect(() => {
    if (!favoriteNotice) return undefined
    const timeout = window.setTimeout(() => setFavoriteNotice(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [favoriteNotice])

  useEffect(() => {
    if (!logoutConfirmOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLogoutConfirmOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [logoutConfirmOpen])

  useEffect(() => {
    if (!accountProfileOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        accountProfileControllerRef.current?.abort()
        accountProfileControllerRef.current = null
        setAccountProfileOpen(false)
        setAccountProfileLoading(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [accountProfileOpen])

  useEffect(() => {
    if (!deleteTarget) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !deleteLoading) {
        setDeleteTarget(null)
        setDeleteError('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteTarget, deleteLoading])

  const exitConfirmDialog = exitConfirmOpen && <div className="confirm-backdrop exit-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExitConfirmOpen(false) }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="exit-dialog-title" aria-describedby="exit-dialog-description"><span className="confirm-dialog-icon"><LogOut size={22} /></span><div className="confirm-dialog-copy"><h2 id="exit-dialog-title">确认退出应用？</h2><p id="exit-dialog-description">退出后当前任务将停止，确定要关闭 ClipFetch 吗？</p></div><div className="confirm-dialog-actions"><button className="confirm-cancel" type="button" autoFocus onClick={() => setExitConfirmOpen(false)}>取消</button><button className="confirm-danger" type="button" onClick={() => getCurrentWindow().destroy()}><LogOut size={15} />确认退出</button></div></section></div>

  if (!user) return <><AuthScreen onAuthenticated={handleAuthenticated} />{exitConfirmDialog}</>

  return (
    <div className={`app-shell ${settings.reduceMotion ? 'reduce-motion' : ''}`}>
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setActive('home')}>
          <BrandMark />
          <span><strong>ClipFetch</strong><small>视频解析工具</small></span>
        </button>

        <nav className="nav-list" aria-label="主导航">
          <p>工作区</p>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id || (active === 'record' && id === 'history') ? 'is-active' : ''} type="button" onClick={() => { setActive(id); if (id === 'home' && recordsPage !== 1) setRecordsPage(1) }}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'history' && recordsTotal > 0 && <em>{recordsTotal > 99 ? '99+' : recordsTotal}</em>}
              {id === 'favorites' && favoritesTotal > 0 && <em>{favoritesTotal > 99 ? '99+' : favoritesTotal}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className={active === 'settings' ? 'settings-link is-active' : 'settings-link'} type="button" onClick={() => setActive('settings')}>
            <Settings size={18} strokeWidth={1.8} /><span>设置</span><ChevronRight size={15} />
          </button>
          <div className="privacy-note"><ShieldCheck size={17} /><span><strong>账号数据保护</strong><small>解析记录仅对当前账号可见</small></span></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><h1>{active === 'home' ? '视频解析' : active === 'history' ? '解析记录' : active === 'record' ? '记录详情' : active === 'favorites' ? '我的收藏' : '应用设置'}</h1><p>{active === 'home' ? '从分享链接提取清晰、无水印的视频' : active === 'history' ? '查看当前账号最近解析完成的内容' : active === 'record' ? '观看并保存这条记录中的媒体内容' : active === 'favorites' ? '集中查看你保存的视频' : '设置下载与应用行为'}</p></div>
          <div className="topbar-actions"><div className="engine-status"><span /><div><strong>解析服务可用</strong><small>云端多线路引擎</small></div></div><button className="account-chip" type="button" aria-label="查看账号全部信息" title="查看账号全部信息" onClick={openAccountProfile}><UserAvatar user={user} /><span className="account-chip-copy"><strong>{user.name}</strong><small>{user.email || `UID ${user.uid}`}</small></span><ChevronRight className="account-chip-arrow" size={15} /></button><button className="topbar-logout" type="button" aria-label="退出登录" title="退出登录" onClick={() => setLogoutConfirmOpen(true)}><LogOut size={17} /></button></div>
        </header>

        {active === 'home' && (
          <div className="home-page">
            <section className="parse-section">
              <div className="parse-heading"><span className="sparkle"><Sparkles size={17} /></span><div><h2>粘贴视频分享链接</h2><p>自动识别平台，并优先获取最高可用清晰度</p></div></div>
              <div className={`link-field ${notice?.type === 'error' ? 'has-error' : ''}`}>
                <Link2 size={20} strokeWidth={1.8} />
                <input aria-label="视频链接" value={url} onChange={(event) => updateUrl(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !isParsing && parseVideo()} placeholder="粘贴分享链接或包含链接的整段分享文案" />
                {!url && <button className="paste-link" aria-label="粘贴链接" title="从剪贴板粘贴" type="button" onClick={pasteLink}><ClipboardPaste size={15} />粘贴</button>}
                {url && !isParsing && <button className="clear-link" aria-label="清空链接" type="button" onClick={() => { setUrl(''); setResult(null); setResultAction(null); setNotice(null) }}><X size={16} /></button>}
                <button className={`parse-action ${isParsing ? 'is-cancel' : ''}`} type="button" onClick={parseVideo}>{isParsing ? <><X size={16} />取消解析</> : <>开始解析<ArrowRight size={17} /></>}</button>
              </div>
              <div className="parse-meta"><span><ShieldCheck size={14} />仅用于解析媒体，结果自动同步至当前账号</span><span className={`platform-detected ${extractShareUrl(url) ? 'is-detected' : ''}`}>{selectedPlatform}</span></div>
              {notice && <div className={`notice is-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'success' ? <CheckCircle2 size={16} /> : notice.type === 'error' ? <X size={16} /> : notice.type === 'cancelled' ? <AlertCircle size={16} /> : <span className="spinner dark" />}{notice.text}</div>}
            </section>

            <div className={`home-grid ${result || !settings.showRecentRecords ? 'has-result' : ''}`}>
              <section className={`result-card ${result ? 'has-result' : ''}`}>
                <div className="section-title"><div><span>解析结果</span><h2>{result ? result.mediaType === 'image' ? '图片已准备好' : '视频已准备好' : '等待视频链接'}</h2></div>{result && <StatusPill status={result.status} />}</div>
                {result ? (
                  <HomeParseResult key={result.id} result={result} action={resultAction} onDownload={downloadResult} onCopySource={(record) => copyRecordSource(record, setResultAction)} onCopyCover={copyResultCover} onFavorite={toggleFavorite} isFavorite={favoriteIds.includes(result.id)} favoritePending={favoritePendingKeys.includes(favoriteKey(result))} autoplayMotion={settings.autoplayMotion && !settings.reduceMotion} onReset={() => { setResult(null); setResultAction(null); setNotice(null) }} />
                ) : (
                  <div className="empty-result"><EmptyIllustration /><h3>视频信息会显示在这里</h3><p>粘贴分享链接后，你可以预览封面、确认标题并选择下载。</p></div>
                )}
              </section>

              {!result && settings.showRecentRecords && <section className="recent-card">
                <div className="section-title"><div><span>最近活动</span><h2>解析记录</h2></div><button className="view-all" type="button" onClick={() => setActive('history')}>查看全部<ArrowRight size={14} /></button></div>
                <RecentRecords items={history.slice(0, 4)} loading={recordsLoading} error={recordsError} onRetry={refreshRecords} onOpen={openRecord} />
              </section>}
            </div>

            <section className="platform-strip"><span>支持平台</span><div><PlatformBrandIcon platform="douyin" />抖音</div><div><PlatformBrandIcon platform="kuaishou" />快手</div><div><PlatformBrandIcon platform="redbook" />小红书</div><div><PlatformBrandIcon platform="bilibili" />哔哩哔哩</div><div><PlatformBrandIcon platform="tiktok" />TikTok</div><small>另支持 X、Instagram、YouTube、Facebook 等平台</small></section>
          </div>
        )}

        {active === 'history' && <LibraryPage grid title="全部解析记录" description={recordsLoading && !history.length ? '正在同步解析记录…' : `共 ${recordsTotal} 条解析记录`} items={history} loading={recordsLoading} error={recordsError} onRetry={refreshRecords} onOpen={openRecord} onUse={useRecordLink} onDelete={requestDeleteRecord} onFavorite={toggleFavorite} favoriteIds={favoriteIds} favoritePendingKeys={favoritePendingKeys} page={recordsPage} totalPages={recordsTotalPages} onPageChange={changeRecordsPage} />}
        {active === 'record' && <RecordDetailPage key={recordDetail ? `${recordDetail.id}-${recordDetail.images?.length || 0}-${recordDetail.liveVideos?.length || 0}` : 'record-loading'} record={recordDetail} loading={recordDetailLoading} error={recordDetailError} action={recordAction} onBack={() => setActive('history')} onRetry={() => openRecord(recordDetail)} onDownload={downloadRecord} onCopySource={copyRecordSource} onFavorite={toggleFavorite} isFavorite={recordDetail ? favoriteIds.includes(recordDetail.id) : false} favoritePending={recordDetail ? favoritePendingKeys.includes(favoriteKey(recordDetail)) : false} autoplayMotion={settings.autoplayMotion && !settings.reduceMotion} />}
        {active === 'favorites' && <LibraryPage title="我的收藏" description={favoritesLoading && !favoriteItems.length ? '正在同步收藏…' : `共 ${favoritesTotal} 个收藏`} items={favoriteItems} loading={favoritesLoading} error={favoritesError} onRetry={refreshFavorites} refreshLabel="刷新收藏" onOpen={openRecord} onUse={useRecordLink} onDelete={requestDeleteRecord} onFavorite={toggleFavorite} favoriteIds={favoriteIds} favoritePendingKeys={favoritePendingKeys} page={favoritesPage} totalPages={favoritesTotalPages} onPageChange={changeFavoritesPage} emptyIcon={Heart} emptyTitle="收藏夹还是空的" emptyText="解析内容后点击收藏按钮，常用内容会同步保存在当前账号下。" emptyAction="去解析视频" onEmptyAction={() => setActive('home')} />}
        {active === 'settings' && <SettingsPage settings={settings} onChange={updateSettings} onReset={restoreDefaultSettings} />}
      </main>
      {favoriteNotice && <div className={`favorite-toast is-${favoriteNotice.type}`} role={favoriteNotice.type === 'error' ? 'alert' : 'status'}>{favoriteNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>{favoriteNotice.text}</span></div>}
      {accountProfileOpen && <AccountProfileModal profile={accountProfile} loading={accountProfileLoading} error={accountProfileError} onClose={closeAccountProfile} onRetry={loadAccountProfile} />}
      {exitConfirmDialog}
      {logoutConfirmOpen && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutConfirmOpen(false) }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description"><span className="confirm-dialog-icon"><LogOut size={22} /></span><div className="confirm-dialog-copy"><h2 id="logout-dialog-title">确认退出登录？</h2><p id="logout-dialog-description">退出后将结束当前会话，下次使用需要重新输入账号和密码。</p></div><div className="confirm-dialog-actions"><button className="confirm-cancel" type="button" autoFocus onClick={() => setLogoutConfirmOpen(false)}>取消</button><button className="confirm-danger" type="button" onClick={logout}><LogOut size={15} />确认退出</button></div></section></div>}
      {deleteTarget && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteDialog() }}><section className="confirm-dialog delete-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description"><span className="confirm-dialog-icon is-delete"><Trash2 size={22} /></span><div className="confirm-dialog-copy"><h2 id="delete-dialog-title">删除这条解析记录？</h2><p id="delete-dialog-description">“{deleteTarget.title}”将从解析记录中移除，此操作无法撤销。</p></div>{deleteError && <div className="confirm-error" role="alert"><AlertCircle size={14} />{deleteError}</div>}<div className="confirm-dialog-actions"><button className="confirm-cancel" type="button" autoFocus disabled={deleteLoading} onClick={closeDeleteDialog}>取消</button><button className="confirm-danger" type="button" disabled={deleteLoading} onClick={confirmDeleteRecord}>{deleteLoading ? <><span className="spinner" />正在删除</> : <><Trash2 size={15} />确认删除</>}</button></div></section></div>}
    </div>
  )
}

function recordMeta(item) {
  return [item.platform, item.author, item.mediaType === 'image' ? '图文' : '视频', item.time].filter(Boolean).join(' · ')
}

function RecentRecords({ items, loading, error, onRetry, onOpen }) {
  if (loading && !items.length) {
    return <div className="recent-list recent-skeletons" aria-label="正在加载解析记录">{[0, 1, 2].map((value) => <div className="recent-skeleton" key={value}><i /><span><i /><i /></span></div>)}</div>
  }
  if (error && !items.length) {
    return <div className="recent-state is-error"><AlertCircle size={22} /><strong>记录加载失败</strong><p>{error}</p><button type="button" onClick={onRetry}><RefreshCw size={13} />重新加载</button></div>
  }
  if (!items.length) {
    return <div className="recent-state"><History size={23} /><strong>还没有解析记录</strong><p>成功解析的内容会自动显示在这里</p></div>
  }
  return <div className="recent-list">{items.map((item) => <button className="recent-item" key={item.id} type="button" onClick={() => onOpen(item)}><VideoThumb item={item} /><span className="recent-copy"><strong>{item.title}</strong><small>{item.platform} · {item.time}</small></span><ChevronRight size={16} /></button>)}</div>
}

function HomeParseResult({ result, action, onDownload, onCopySource, onCopyCover, onFavorite, isFavorite, favoritePending, autoplayMotion, onReset }) {
  const images = result.images?.length ? result.images : [result.thumbnail].filter(Boolean)
  const liveVideos = result.liveVideos || []
  const liveCount = liveVideos.filter(Boolean).length
  const mixedVideoCount = images.filter(isLikelyVideoUrl).length
  const isImageResult = result.mediaType === 'image'
  const [selectedIndexes, setSelectedIndexes] = useState(() => images.length === 1 ? [0] : [])
  const toggleIndex = (index) => setSelectedIndexes((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b))
  const toggleAll = () => setSelectedIndexes((current) => current.length === images.length ? [] : images.map((_, index) => index))
  const mediaLabel = isImageResult ? mixedVideoCount ? '图文与视频合集' : liveCount ? '动态图片' : '图文内容' : '视频内容'
  const detailLabel = isImageResult
    ? `${images.length} 项媒体${liveCount ? ` · ${liveCount} 个动态片段` : ''}`
    : [result.resolution, '无水印原片'].filter(Boolean).join(' · ')

  return (
    <div className="home-result-layout">
      <section className="home-result-media">
        <div className="home-result-media-head"><span>{isImageResult ? <Images size={16} /> : <FileVideo2 size={16} />}<strong>{mediaLabel}</strong></span><small>{detailLabel}</small></div>
        {isImageResult ? <ImageGallery images={images} liveVideos={liveVideos} title={result.title} selectedIndexes={selectedIndexes} onToggleIndex={toggleIndex} onToggleAll={toggleAll} autoPlayMotion={autoplayMotion} /> : <VideoPlayer src={result.videoUrl} sources={result.playbackUrls} poster={result.thumbnail} title={result.title} />}
        <footer><ShieldCheck size={13} /><span>媒体直接来自解析结果，可预览后再保存</span></footer>
      </section>

      <aside className="home-result-info">
        <div className="home-result-toolbar"><span>{result.platform}</span><button type="button" onClick={onReset}><RotateCcw size={14} />重新解析</button></div>
        <h3>{result.title}</h3>
        {result.description && result.description !== result.title && <p className="home-result-description">{result.description}</p>}
        <div className="home-result-author"><span>{result.avatarUrl ? <img src={result.avatarUrl} alt="" referrerPolicy="no-referrer" /> : (result.author?.slice(0, 1) || '创')}</span><div><small>内容作者</small><strong>{result.author || '作者信息未提供'}</strong></div></div>
        <div className="home-result-facts"><span><Clock3 size={14} /><small>解析耗时</small><strong>{result.parseTime ? `${result.parseTime.toFixed(2)} 秒` : '已完成'}</strong></span><span>{isImageResult ? <Images size={14} /> : <Video size={14} />}<small>媒体规格</small><strong>{isImageResult ? `${images.length} 项` : (result.resolution || '高清')}</strong></span></div>
        <div className="home-result-source"><span><Link2 size={14} />原始分享链接</span><button type="button" onClick={() => onCopySource(result)}><Copy size={14} />复制</button></div>
        <DownloadOptionsPanel record={result} images={images} liveVideos={liveVideos} selectedIndexes={selectedIndexes} action={action} onDownload={(selection) => onDownload(result, selection)} />
        <div className="home-result-secondary-actions">{result.thumbnail && <button type="button" onClick={() => onCopyCover(result)}><Copy size={15} />复制封面链接</button>}<button className={isFavorite ? 'is-favorite' : ''} type="button" disabled={favoritePending} onClick={() => onFavorite(result)}>{favoritePending ? <span className="spinner dark" /> : <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />}{favoritePending ? '同步中' : isFavorite ? '已收藏' : '收藏'}</button></div>
        {result.ossAsync && <div className="home-result-tip"><RefreshCw size={13} />长期下载地址正在后台同步，当前地址仍可播放和保存。</div>}
        {action && action.type !== 'loading' && <div className={`detail-action-message is-${action.type}`} role={action.type === 'error' ? 'alert' : 'status'}>{action.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span>{action.text}</span></div>}
      </aside>
    </div>
  )
}

function formatPlayerTime(value) {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const seconds = Math.floor(value)
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function VideoPlayer({ src, sources = null, poster, title }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const sourceList = useMemo(() => [...new Set([src, ...(Array.isArray(sources) ? sources : [])].filter(Boolean))], [src, sources])
  const currentSource = sourceList[sourceIndex] || ''
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0

  const tryNextSource = () => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    if (sourceIndex < sourceList.length - 1) {
      setBuffering(true)
      setSourceIndex((index) => index + 1)
      return
    }
    setBuffering(false)
    setFailed(true)
  }

  const togglePlay = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      try { await video.play() } catch { tryNextSource() }
    } else {
      video.pause()
    }
  }

  const seek = (event) => {
    const value = Number(event.target.value)
    if (videoRef.current) videoRef.current.currentTime = value
    setCurrentTime(value)
  }

  const toggleMuted = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setMuted(videoRef.current.muted)
  }

  if (failed) {
    return <div className="detail-media-empty player-error"><FileVideo2 size={31} /><strong>所有播放线路均不可用</strong><p>可能是视频编码暂不受系统支持，或媒体地址已经失效。你仍可直接保存原片。</p><button type="button" onClick={() => { setSourceIndex(0); setFailed(false); setBuffering(true) }}><RefreshCw size={14} />重新尝试播放</button></div>
  }

  return (
    <div className={`video-player ${playing ? 'is-playing' : 'is-paused'} ${buffering ? 'is-buffering' : ''}`} ref={playerRef}>
      <video key={currentSource} ref={videoRef} src={currentSource} poster={poster || undefined} playsInline preload="metadata" onClick={togglePlay} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onPlaying={() => setBuffering(false)} onWaiting={() => setBuffering(true)} onLoadStart={() => setBuffering(true)} onCanPlay={() => setBuffering(false)} onEnded={() => setPlaying(false)} onError={tryNextSource}>当前环境不支持视频播放</video>
      <div className="player-top"><span><Sparkles size={12} />无水印原片</span><small>{sourceIndex > 0 ? `备用播放线路 ${sourceIndex}` : '自动适配清晰度'}</small></div>
      <button className="player-center" type="button" aria-label={playing ? '暂停视频' : '播放视频'} onClick={togglePlay}>{buffering ? <span className="spinner" /> : playing ? <Pause size={23} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</button>
      <div className="player-controls" onClick={(event) => event.stopPropagation()}>
        <input className="player-progress" aria-label="播放进度" type="range" min="0" max={duration || 0} step="0.05" value={currentTime} onChange={seek} style={{ '--player-progress': `${progress}%` }} />
        <div className="player-control-row"><button type="button" aria-label={playing ? '暂停' : '播放'} onClick={togglePlay}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><span>{formatPlayerTime(currentTime)} <i>/</i> {formatPlayerTime(duration)}</span><button className="player-volume" type="button" aria-label={muted ? '打开声音' : '静音'} onClick={toggleMuted}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><small>{title}</small><button type="button" aria-label="全屏播放" onClick={() => playerRef.current?.requestFullscreen?.()}><Maximize2 size={17} /></button></div>
      </div>
    </div>
  )
}

function ImageGallery({ images, liveVideos, title, selectedIndexes, onToggleIndex, onToggleAll, autoPlayMotion = true }) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [motionEnabled, setMotionEnabled] = useState(autoPlayMotion)
  const [failedMotion, setFailedMotion] = useState('')
  const stageRef = useRef(null)
  const selectedImage = images[selectedIndex] || images[0]
  const motionUrl = liveVideos[selectedIndex] || ''
  const embeddedVideoUrl = isLikelyVideoUrl(selectedImage) ? selectedImage : ''
  const playableUrl = motionUrl || embeddedVideoUrl
  const showingMotion = Boolean(playableUrl && (embeddedVideoUrl || motionEnabled) && failedMotion !== playableUrl)
  const posterImage = embeddedVideoUrl ? images.find((item) => !isLikelyVideoUrl(item)) || '' : selectedImage
  const select = (index) => { setSelectedIndex(index); setMotionEnabled(autoPlayMotion) }
  const move = (direction) => select((selectedIndex + direction + images.length) % images.length)

  return (
    <div className={`gallery-shell ${images.length > 1 ? 'has-rail' : ''}`}>
      <div className="gallery-stage" ref={stageRef}>
        <img className="gallery-backdrop" src={selectedImage} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
        {showingMotion ? <video key={playableUrl} className="gallery-main-media" src={playableUrl} poster={posterImage || undefined} autoPlay loop muted playsInline controls={Boolean(embeddedVideoUrl)} onError={() => setFailedMotion(playableUrl)} /> : <img className="gallery-main-media" src={selectedImage} alt={`${title} 第 ${selectedIndex + 1} 张`} referrerPolicy="no-referrer" />}
        <div className="gallery-stage-top"><span>{embeddedVideoUrl ? <><FileVideo2 size={12} />视频片段</> : showingMotion ? <><Zap size={12} fill="currentColor" />实况播放中</> : '高清原图'}</span><button type="button" aria-label="全屏查看" onClick={() => stageRef.current?.requestFullscreen?.()}><Maximize2 size={16} /></button></div>
        {images.length > 1 && <><button className="gallery-arrow is-prev" type="button" aria-label="上一张" onClick={() => move(-1)}><ChevronLeft size={20} /></button><button className="gallery-arrow is-next" type="button" aria-label="下一张" onClick={() => move(1)}><ChevronRight size={20} /></button></>}
        <span className="gallery-counter">{selectedIndex + 1} / {images.length}</span>
        {motionUrl && !embeddedVideoUrl && <div className="gallery-mode"><button className={!motionEnabled ? 'is-active' : ''} type="button" onClick={() => setMotionEnabled(false)}>静态</button><button className={motionEnabled ? 'is-active' : ''} type="button" onClick={() => setMotionEnabled(true)}><Zap size={11} />动态</button></div>}
      </div>
      {images.length > 1 && <div className="gallery-rail"><div className="gallery-rail-head"><strong>选择媒体</strong><span>已选 {selectedIndexes.length} / {images.length}</span><label className="gallery-select-all"><input type="checkbox" checked={selectedIndexes.length === images.length} onChange={onToggleAll} /><i><Check size={9} /></i>全选</label></div><div className="detail-thumbnails">{images.map((imageUrl, index) => <div className="gallery-thumb-item" key={`${imageUrl}-${index}`}><button className={selectedIndex === index ? 'is-active' : ''} type="button" onClick={() => select(index)}>{isLikelyVideoUrl(imageUrl) ? <video src={imageUrl} muted playsInline preload="metadata" aria-label={`查看第 ${index + 1} 个视频`} /> : <img src={imageUrl} alt={`查看第 ${index + 1} 张`} referrerPolicy="no-referrer" />}{isLikelyVideoUrl(imageUrl) ? <i title="视频片段"><FileVideo2 size={9} /></i> : liveVideos[index] && <i title="动态照片"><Zap size={9} fill="currentColor" /></i>}<span>{index + 1}</span></button><label className={`gallery-thumb-check ${selectedIndexes.includes(index) ? 'is-checked' : ''}`} title={`选择第 ${index + 1} 项`}><input type="checkbox" checked={selectedIndexes.includes(index)} onChange={() => onToggleIndex(index)} /><span><Check size={10} /></span></label></div>)}</div></div>}
    </div>
  )
}

function DownloadOptionIcon({ type }) {
  if (type === 'all') return <FolderDown size={18} />
  if (type === 'liveVideos' || type === 'video') return <FileVideo2 size={18} />
  if (type === 'livePhotos') return <Zap size={18} />
  return <Images size={18} />
}

function DownloadOptionsPanel({ record, images, liveVideos, selectedIndexes, action, onDownload }) {
  const isImageRecord = record.mediaType === 'image'
  const liveCount = liveVideos.filter(Boolean).length
  const hasLivePhotos = isImageRecord && liveCount > 0
  const hasMixedMedia = isImageRecord && images.some(isLikelyVideoUrl)
  const hasCover = Boolean(record.thumbnail)
  const hasVideo = Boolean(record.videoUrl || record.liveVideoUrl || record.sourceUrl)
  const selectedLiveCount = liveVideos.filter((url, index) => Boolean(url) && selectedIndexes.includes(index)).length
  const selectedImageCount = selectedIndexes.length
  const options = hasLivePhotos ? [
    { id: 'all', label: '保存全部所选素材', description: '照片、动态视频与封面一次保存', available: selectedImageCount > 0, primary: true },
    { id: 'livePhotos', label: '保存为照片', description: `${selectedLiveCount} 张`, available: selectedLiveCount > 0 },
    { id: 'liveVideos', label: '保存动态视频', description: `${selectedLiveCount} 个`, available: selectedLiveCount > 0 },
    { id: 'cover', label: '保存封面', description: '高清图片', available: hasCover },
  ] : isImageRecord ? [
    { id: 'images', label: hasMixedMedia ? '保存已选媒体' : '保存已选图片', description: hasMixedMedia ? `${selectedImageCount} 项图片或视频` : `${selectedImageCount} 张高清无水印图片`, available: selectedImageCount > 0, primary: true },
    { id: 'cover', label: '单独保存封面', description: '高清图片', available: hasCover },
  ] : [
    { id: 'video', label: '保存视频原片', description: '最高可用画质 · 无水印', available: hasVideo, primary: true },
    { id: 'cover', label: '保存视频封面', description: '高清图片', available: hasCover },
  ]
  const primaryOption = options.find((option) => option.primary)
  const secondaryOptions = options.filter((option) => !option.primary)
  const selectionProgress = isImageRecord && images.length ? Math.round((selectedImageCount / images.length) * 100) : 100
  const saveOption = (option) => onDownload({ [option.id]: true, indexes: selectedIndexes })
  const isSaving = action?.type === 'loading'
  const statusText = isImageRecord && images.length > 1 ? selectedImageCount ? `已选 ${selectedImageCount} 项` : '等待选择' : '资源就绪'

  return (
    <section className={`detail-download-panel download-workspace ${isImageRecord && !selectedImageCount ? 'is-empty' : ''}`} aria-labelledby="download-options-title">
      <header className="download-workspace-header"><span className="download-workspace-symbol"><FolderDown size={18} /></span><div><strong id="download-options-title">下载保存</strong><small>{isImageRecord ? images.length === 1 ? '原图与封面可分别保存' : '勾选左侧媒体后选择保存格式' : '原片与视频封面可分别保存'}</small></div><span className={`download-ready-state ${isImageRecord && images.length > 1 && !selectedImageCount ? 'is-waiting' : ''}`}><i />{statusText}</span></header>
      {isImageRecord && images.length > 1 && <div className="download-selection-progress" aria-label={`已选择 ${selectedImageCount} / ${images.length} 张`}><span style={{ width: `${selectionProgress}%` }} /></div>}
      <div className="download-save-options">
        <button className="download-save-row is-primary" type="button" disabled={!primaryOption.available || isSaving} onClick={() => saveOption(primaryOption)}><span className="download-save-icon">{isSaving ? <span className="spinner" /> : <DownloadOptionIcon type={primaryOption.id} />}</span><span className="download-save-copy"><strong>{isSaving ? '正在保存媒体…' : primaryOption.label}</strong><small>{primaryOption.available ? primaryOption.description : '请先勾选需要保存的媒体'}</small></span><span className="download-save-trigger"><Download size={15} /></span></button>
        {secondaryOptions.map((option, index) => <button className={`download-save-row ${index === secondaryOptions.length - 1 && secondaryOptions.length % 2 ? 'is-wide' : ''}`} key={option.id} type="button" disabled={!option.available || isSaving} onClick={() => saveOption(option)}><span className="download-save-icon"><DownloadOptionIcon type={option.id} /></span><span className="download-save-copy"><strong>{option.label}</strong><small>{option.available ? option.description : '暂无可保存内容'}</small></span><span className="download-save-trigger"><Download size={14} /></span></button>)}
      </div>
      <footer className="download-workspace-footer"><ShieldCheck size={13} /><span>文件将安全保存至 ClipFetch 默认目录</span></footer>
    </section>
  )
}

function RecordDetailPage({ record, loading, error, action, onBack, onRetry, onDownload, onCopySource, onFavorite, isFavorite, favoritePending, autoplayMotion }) {
  const images = record?.images?.length ? record.images : [record?.thumbnail].filter(Boolean)
  const liveVideos = record?.liveVideos || []
  const liveCount = liveVideos.filter(Boolean).length
  const isImageRecord = record?.mediaType === 'image'
  const mixedVideoCount = images.filter(isLikelyVideoUrl).length
  const [selectedImageIndexes, setSelectedImageIndexes] = useState(() => images.length === 1 ? [0] : [])
  const toggleImageSelection = (index) => setSelectedImageIndexes((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b))
  const toggleAllImages = () => setSelectedImageIndexes((current) => current.length === images.length ? [] : images.map((_, index) => index))

  if (!record && loading) {
    return <div className="detail-page"><button className="detail-back" type="button" onClick={onBack}><ChevronLeft size={16} />返回解析记录</button><div className="detail-skeleton"><i /><span><i /><i /><i /><b /></span></div></div>
  }
  if (!record) {
    return <div className="detail-page"><button className="detail-back" type="button" onClick={onBack}><ChevronLeft size={16} />返回解析记录</button><div className="detail-fatal"><AlertCircle size={28} /><h2>无法打开这条记录</h2><p>{error || '记录数据不存在'}</p><button type="button" onClick={onBack}>返回解析记录</button></div></div>
  }

  const mediaDescription = isImageRecord ? `${images.length} 项媒体${mixedVideoCount ? ` · ${mixedVideoCount} 个视频片段` : liveCount ? ` · ${liveCount} 个动态片段` : ''}` : '在线播放 · 无水印原片'
  return (
    <div className="detail-page">
      <div className="detail-toolbar"><button className="detail-back" type="button" onClick={onBack}><ChevronLeft size={16} />返回解析记录</button><span>记录编号 #{record.id}</span></div>
      {loading && <div className="detail-syncing"><span className="spinner dark" />正在同步完整媒体数据…</div>}
      {error && <div className="records-error detail-error" role="alert"><AlertCircle size={16} /><span><strong>详情加载失败</strong>{error}</span><button type="button" onClick={onRetry}>重新加载</button></div>}
      <div className="detail-layout">
        <section className="detail-viewer-card">
          <div className="detail-viewer-heading"><div><span className="detail-viewer-icon">{isImageRecord ? <Images size={17} /> : <FileVideo2 size={17} />}</span><span><strong>{isImageRecord ? liveCount ? '动态图集' : '图片合集' : '视频播放器'}</strong><small>{mediaDescription}</small></span></div><StatusPill status={record.status} /></div>
          {isImageRecord ? images.length ? <ImageGallery images={images} liveVideos={liveVideos} title={record.title} selectedIndexes={selectedImageIndexes} onToggleIndex={toggleImageSelection} onToggleAll={toggleAllImages} autoPlayMotion={autoplayMotion} /> : <div className="detail-media-empty"><Images size={30} /><strong>暂无可预览图片</strong><p>接口没有返回这条记录的图片地址。</p></div> : record.videoUrl ? <VideoPlayer src={record.videoUrl} sources={record.playbackUrls} poster={record.thumbnail} title={record.title} /> : <div className="detail-media-empty has-cover" style={record.thumbnail ? { backgroundImage: `linear-gradient(rgba(13,24,39,.68), rgba(13,24,39,.78)), url(${record.thumbnail})` } : undefined}><FileVideo2 size={31} /><strong>暂无可播放地址</strong><p>详情接口没有返回视频文件地址，你仍可尝试下载原始内容。</p></div>}
          <div className="detail-viewer-foot"><span><ShieldCheck size={13} />媒体直接来自解析结果</span><small>{isImageRecord ? '点击缩略图切换，带闪电标记的图片支持动态预览' : '支持拖动进度、静音和全屏播放'}</small></div>
        </section>

        <aside className="detail-info-card">
          <div className="detail-platform"><span>{record.platform}</span><small>{isImageRecord ? mixedVideoCount ? '图文与视频合集' : liveCount ? '动态图片' : '图文内容' : '视频内容'}</small></div>
          <h2>{record.title}</h2>
          <div className="detail-author"><span>{record.avatarUrl && <img src={record.avatarUrl} alt="" referrerPolicy="no-referrer" />}{record.author?.slice(0, 1) || '创'}</span><div><small>内容作者</small><strong>{record.author || '作者信息未提供'}</strong></div></div>
          <div className="detail-facts"><div><CalendarDays size={15} /><span><small>解析时间</small><strong>{record.time}</strong></span></div><div>{isImageRecord ? <Images size={15} /> : <FileVideo2 size={15} />}<span><small>媒体内容</small><strong>{isImageRecord ? `${images.length} 项` : '视频'}</strong></span></div>{isImageRecord && <div>{mixedVideoCount ? <FileVideo2 size={15} /> : <Zap size={15} />}<span><small>{mixedVideoCount ? '视频片段' : '动态片段'}</small><strong>{mixedVideoCount || liveCount} 个</strong></span></div>}</div>
          <div className="detail-source"><label>原始分享链接</label><div><span>{record.sourceUrl || '未提供原链接'}</span><button type="button" aria-label="复制原始链接" disabled={!record.sourceUrl} onClick={() => onCopySource(record)}><Copy size={15} /></button></div></div>
          <DownloadOptionsPanel record={record} images={images} liveVideos={liveVideos} selectedIndexes={selectedImageIndexes} action={action} onDownload={(selection) => onDownload(record, selection)} />
          <div className="detail-actions"><button className={`detail-favorite is-wide ${isFavorite ? 'is-favorite' : ''}`} type="button" disabled={favoritePending} onClick={() => onFavorite(record)}>{favoritePending ? <span className="spinner dark" /> : <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />}{favoritePending ? '正在同步收藏…' : isFavorite ? '已收藏' : '收藏这条记录'}</button></div>
          {action && action.type !== 'loading' && <div className={`detail-action-message is-${action.type}`} role={action.type === 'error' ? 'alert' : 'status'}>{action.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}<span>{action.text}</span></div>}
        </aside>
      </div>
    </div>
  )
}

function RecordActions({ item, open, onToggle, onUse, onDelete }) {
  return <div className={`record-action-menu-wrap ${open ? 'is-open' : ''}`}><button className="row-icon" aria-label="更多操作" aria-expanded={open} aria-haspopup="menu" type="button" onClick={onToggle}><MoreHorizontal size={18} /></button>{open && <div className="record-action-menu" role="menu"><button type="button" role="menuitem" disabled={!item.sourceUrl} onClick={() => onUse(item)}><span className="record-action-icon is-use"><MousePointerClick size={15} /></span><span><strong>使用</strong><small>{item.sourceUrl ? '填入视频解析链接' : '原始链接不可用'}</small></span></button><button className="is-danger" type="button" role="menuitem" onClick={() => onDelete(item)}><span className="record-action-icon"><Trash2 size={15} /></span><span><strong>删除</strong><small>移除此条解析记录</small></span></button></div>}</div>
}

function LibraryPage({ title, description, items, loading, error, onRetry, refreshLabel = '刷新记录', onOpen, onUse, onDelete, onFavorite, favoriteIds, favoritePendingKeys = [], page = 1, totalPages = 0, onPageChange, grid = false, emptyIcon: EmptyIcon = History, emptyTitle = '暂无解析记录', emptyText = '成功解析的内容会保存在当前账号下，并显示在这里。', emptyAction = '', onEmptyAction }) {
  const [openActionId, setOpenActionId] = useState(null)

  useEffect(() => {
    if (openActionId === null) return undefined
    const closeMenu = (event) => {
      if (!event.target.closest?.('.record-action-menu-wrap')) setOpenActionId(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenActionId(null)
    }
    document.addEventListener('mousedown', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [openActionId])

  const actionMenu = (item) => <RecordActions item={item} open={openActionId === item.id} onToggle={() => setOpenActionId((id) => id === item.id ? null : item.id)} onUse={(record) => { setOpenActionId(null); onUse(record) }} onDelete={(record) => { setOpenActionId(null); onDelete(record) }} />

  return (
    <div className="library-page">
      <div className={`library-card ${grid ? 'is-grid-view' : ''}`}>
        <div className="library-header">
          <div><h2>{title}</h2><p>{description}</p></div>
          {onRetry ? <button className="soft-button" type="button" onClick={onRetry} disabled={loading}><RefreshCw className={loading ? 'is-spinning' : ''} size={16} />{loading ? '正在刷新' : refreshLabel}</button> : <button className="soft-button" type="button"><FolderDown size={16} />打开下载目录</button>}
        </div>
        {error && <div className="records-error" role="alert"><AlertCircle size={16} /><span><strong>同步失败</strong>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
        {loading && !items.length ? (
          grid ? <div className="record-grid record-grid-skeletons" aria-label="正在加载解析记录">{[0, 1, 2, 3, 4, 5].map((value) => <div className="record-card-skeleton" key={value}><i /><span><i /><i /><i /></span></div>)}</div> : <div className="library-list library-skeletons" aria-label="正在加载解析记录">{[0, 1, 2, 3, 4].map((value) => <div className="library-skeleton" key={value}><i /><span><i /><i /></span><b /></div>)}</div>
        ) : items.length ? (
          grid ? <div className="record-grid">{items.map((item) => { const pending = favoritePendingKeys.includes(`id:${item.id}`); return <article className="record-card" key={item.id}><button className="record-card-main" type="button" onClick={() => onOpen(item)}><div className="record-card-media"><VideoThumb item={item} large /><StatusPill status={item.status} /></div><div className="record-card-copy"><span className="record-card-kind">{item.mediaType === 'image' ? '图文内容' : '视频内容'}</span><h3>{item.title}</h3><p>{item.author ? `@${item.author}` : item.platform}</p></div></button><footer><span><Clock3 size={13} />{item.time}</span><div><button className={`row-icon ${favoriteIds.includes(item.id) ? 'is-favorite' : ''}`} aria-label={favoriteIds.includes(item.id) ? '取消收藏' : '收藏'} type="button" disabled={pending} onClick={() => onFavorite(item)}>{pending ? <span className="spinner dark" /> : <Heart size={16} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} />}</button>{actionMenu(item)}</div></footer></article> })}</div> : <div className="library-list">{items.map((item) => { const pending = favoritePendingKeys.includes(`id:${item.id}`); return <div className="library-row" key={item.id}><button className="row-main" type="button" onClick={() => onOpen(item)}><VideoThumb item={item} /><span><strong>{item.title}</strong><small>{recordMeta(item)}</small></span></button><StatusPill status={item.status} /><button className={`row-icon ${favoriteIds.includes(item.id) ? 'is-favorite' : ''}`} aria-label={favoriteIds.includes(item.id) ? '取消收藏' : '收藏'} type="button" disabled={pending} onClick={() => onFavorite(item)}>{pending ? <span className="spinner dark" /> : <Heart size={17} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} />}</button>{actionMenu(item)}</div> })}</div>
        ) : !error && (
          <div className="records-empty"><span><EmptyIcon size={25} /></span><h3>{emptyTitle}</h3><p>{emptyText}</p>{emptyAction && <button type="button" onClick={onEmptyAction}>{emptyAction}<ArrowRight size={14} /></button>}</div>
        )}
        {totalPages > 1 && <div className="records-pagination"><span>第 {page} / {totalPages} 页</span><div><button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={15} />上一页</button><button type="button" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页<ChevronRight size={15} /></button></div></div>}
      </div>
    </div>
  )
}

function SettingsSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const listboxId = useId()
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selectedOption = options[selectedIndex] || options[0]

  const openMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    const menuHeight = Math.min(options.length * 58 + 12, 300)
    const roomBelow = rect ? window.innerHeight - rect.bottom : menuHeight
    const roomAbove = rect?.top || 0
    setDropUp(roomBelow < menuHeight && roomAbove > roomBelow)
    setHighlightedIndex(selectedIndex)
    setOpen(true)
  }

  const closeMenu = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const selectOption = (option) => {
    if (option.value !== value) onChange(option.value)
    closeMenu(true)
  }

  useEffect(() => {
    if (!open) return undefined
    const handleOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) closeMenu()
    }
    const handleViewportChange = () => closeMenu()
    document.addEventListener('pointerdown', handleOutsidePointer)
    window.addEventListener('resize', handleViewportChange)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [open])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      closeMenu(true)
      return
    }

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openMenu()
      return
    }

    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const offset = event.key === 'ArrowDown' ? 1 : -1
      setHighlightedIndex((current) => (current + offset + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setHighlightedIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(options[highlightedIndex])
    } else if (event.key === 'Tab') {
      closeMenu()
    }
  }

  return (
    <div className={`settings-select${open ? ' is-open' : ''}${dropUp ? ' is-drop-up' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className="settings-select-trigger"
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-option-${highlightedIndex}` : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="settings-select-value">{selectedOption?.label}</span>
        <span className="settings-select-chevron"><ChevronRight size={14} /></span>
      </button>
      {open && (
        <div className="settings-select-menu" id={listboxId} role="listbox" aria-label={label}>
          {options.map((option, index) => {
            const selected = option.value === value
            return (
              <button
                className={`settings-select-option${selected ? ' is-selected' : ''}${highlightedIndex === index ? ' is-highlighted' : ''}`}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span className="settings-select-option-copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
                <span className="settings-select-check" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettingToggle({ checked, onChange, label }) {
  return <label className="switch" aria-label={label}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span /></label>
}

function SettingsPage({ settings, onChange, onReset }) {
  const [effectiveDirectory, setEffectiveDirectory] = useState(settings.downloadDirectory || '系统视频 / ClipFetch')
  const [directoryBusy, setDirectoryBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const isDesktop = '__TAURI_INTERNALS__' in window
  const displayedDirectory = settings.downloadDirectory || effectiveDirectory

  useEffect(() => {
    if (settings.downloadDirectory || !isDesktop) return undefined
    let cancelled = false
    invoke('get_download_directory').then((directory) => {
      if (!cancelled) setEffectiveDirectory(directory)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isDesktop, settings.downloadDirectory])

  useEffect(() => {
    if (!feedback) return undefined
    const timeout = window.setTimeout(() => setFeedback(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const chooseDirectory = async () => {
    if (!isDesktop) {
      setFeedback({ type: 'error', text: '请在 Windows 客户端中选择下载目录' })
      return
    }
    setDirectoryBusy(true)
    try {
      const selected = await invoke('choose_download_directory', { current: settings.downloadDirectory || effectiveDirectory })
      if (selected) {
        onChange({ downloadDirectory: selected })
        setEffectiveDirectory(selected)
        setFeedback({ type: 'success', text: '下载位置已更新' })
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setDirectoryBusy(false)
    }
  }

  const openDownloadDirectory = async () => {
    if (!isDesktop) {
      setFeedback({ type: 'error', text: '请在 Windows 客户端中打开下载目录' })
      return
    }
    setDirectoryBusy(true)
    try {
      const opened = await invoke('open_directory', { path: settings.downloadDirectory || null })
      setEffectiveDirectory(opened)
      setFeedback({ type: 'success', text: '已打开下载目录' })
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setDirectoryBusy(false)
    }
  }

  const confirmReset = () => {
    onReset()
    setEffectiveDirectory('系统视频 / ClipFetch')
    setResetConfirmOpen(false)
    setFeedback({ type: 'success', text: '已恢复默认设置' })
  }

  return (
    <div className="settings-page settings-page-redesign">
      <section className="settings-overview">
        <div className="settings-overview-icon"><Settings size={22} /></div>
        <div><span>本机偏好</span><h2>让 ClipFetch 更符合你的使用习惯</h2><p>所有设置仅保存在这台电脑上，更改后立即生效。</p></div>
        <div className="settings-overview-status"><span><ShieldCheck size={13} />本地保存</span><span><CheckCircle2 size={13} />自动生效</span></div>
        <button type="button" onClick={() => setResetConfirmOpen(true)}><RotateCcw size={14} />恢复默认</button>
      </section>

      {feedback && <div className={`settings-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}{feedback.text}</div>}

      <div className="settings-grid">
        <section className="settings-card settings-download-card">
          <div className="settings-header"><div><span className="settings-section-icon is-blue"><FolderDown size={17} /></span><div><h2>下载与文件</h2><p>设置文件保存位置、清晰度与命名方式</p></div></div></div>
          <div className="setting-directory">
            <div className="setting-directory-label"><span><FolderOpen size={16} /></span><div><strong>下载位置</strong><p title={displayedDirectory}>{displayedDirectory}</p></div></div>
            <div><button type="button" disabled={directoryBusy} onClick={openDownloadDirectory}><FolderOpen size={14} />打开目录</button><button className="is-primary" type="button" disabled={directoryBusy} onClick={chooseDirectory}>{directoryBusy ? <span className="spinner" /> : <FolderDown size={14} />}更改位置</button></div>
          </div>
          <div className="setting-row"><span className="setting-icon"><Gauge size={18} /></span><div><strong>默认视频质量</strong><p>存在多条清晰度线路时优先使用此画质</p></div><SettingsSelect label="默认视频质量" value={settings.videoQuality} options={[{ value: 'best', label: '最高可用画质', description: '优先选择解析结果中的最高画质' }, { value: '1080', label: '最高 1080P', description: '兼顾清晰度与文件大小' }, { value: '720', label: '最高 720P', description: '适合日常保存与分享' }, { value: '480', label: '流畅 480P', description: '文件更小，下载速度更快' }]} onChange={(videoQuality) => onChange({ videoQuality })} /></div>
          <div className="setting-row"><span className="setting-icon"><FileText size={18} /></span><div><strong>文件命名方式</strong><p>统一视频、图片文件夹与封面的名称</p></div><SettingsSelect label="文件命名方式" value={settings.filenameStyle} options={[{ value: 'title', label: '仅内容标题', description: '保持文件名简洁直观' }, { value: 'platform-title', label: '平台 + 标题', description: '方便区分内容来源' }, { value: 'date-title', label: '日期 + 标题', description: '按照保存日期整理文件' }]} onChange={(filenameStyle) => onChange({ filenameStyle })} /></div>
          <div className="setting-row"><span className="setting-icon"><FolderOpen size={18} /></span><div><strong>下载完成后打开目录</strong><p>每次保存成功后自动在资源管理器中定位文件夹</p></div><SettingToggle label="下载完成后打开目录" checked={settings.openAfterDownload} onChange={(value) => onChange({ openAfterDownload: value })} /></div>
        </section>

        <section className="settings-card">
          <div className="settings-header"><div><span className="settings-section-icon is-violet"><Clipboard size={17} /></span><div><h2>解析体验</h2><p>控制链接识别和媒体预览行为</p></div></div></div>
          <div className="setting-row"><span className="setting-icon"><ClipboardPaste size={18} /></span><div><strong>自动读取剪贴板链接</strong><p>回到应用且输入框为空时自动识别分享链接</p></div><SettingToggle label="自动读取剪贴板链接" checked={settings.autoClipboard} onChange={(value) => onChange({ autoClipboard: value })} /></div>
          <div className="setting-row"><span className="setting-icon"><ListVideo size={18} /></span><div><strong>首页显示最近记录</strong><p>在解析输入区下方展示最近成功解析的内容</p></div><SettingToggle label="首页显示最近记录" checked={settings.showRecentRecords} onChange={(value) => onChange({ showRecentRecords: value })} /></div>
          <div className="setting-row"><span className="setting-icon"><Images size={18} /></span><div><strong>自动播放动态图片</strong><p>打开动态图集时优先播放对应的动态片段</p></div><SettingToggle label="自动播放动态图片" checked={settings.autoplayMotion} onChange={(value) => onChange({ autoplayMotion: value })} /></div>
        </section>

        <section className="settings-card">
          <div className="settings-header"><div><span className="settings-section-icon is-green"><Monitor size={17} /></span><div><h2>界面与启动</h2><p>调整界面动效以及页面记忆方式</p></div></div></div>
          <div className="setting-row"><span className="setting-icon"><Sparkles size={18} /></span><div><strong>减少界面动效</strong><p>关闭过渡和装饰动画，同时停止动态图自动播放</p></div><SettingToggle label="减少界面动效" checked={settings.reduceMotion} onChange={(value) => onChange({ reduceMotion: value })} /></div>
          <div className="setting-row"><span className="setting-icon"><Clock3 size={18} /></span><div><strong>记住上次页面</strong><p>下次登录后回到最近使用的解析、记录或设置页面</p></div><SettingToggle label="记住上次页面" checked={settings.rememberLastPage} onChange={(value) => onChange({ rememberLastPage: value })} /></div>
        </section>

        <section className="settings-card settings-about-card">
          <div className="settings-header"><div><span className="settings-section-icon is-slate"><Info size={17} /></span><div><h2>关于 ClipFetch</h2><p>应用版本与本机运行状态</p></div></div></div>
          <div className="settings-about-body"><BrandMark size={42} /><div><strong>ClipFetch for Windows</strong><p>轻量、清晰的短视频解析与媒体保存工具</p><span>版本 0.1.0</span></div><button type="button" disabled={directoryBusy} onClick={openDownloadDirectory}><FolderOpen size={14} />下载文件</button></div>
          <footer><span><ShieldCheck size={13} />设置、登录状态与操作偏好仅保存在本机</span><span><CheckCircle2 size={13} />解析服务当前可用</span></footer>
        </section>
      </div>

      {resetConfirmOpen && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetConfirmOpen(false) }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-reset-title"><span className="confirm-dialog-icon settings-reset-icon"><RotateCcw size={21} /></span><div className="confirm-dialog-copy"><h2 id="settings-reset-title">恢复全部默认设置？</h2><p>下载位置、画质、文件命名和应用偏好都会恢复为初始状态，不会删除解析记录与收藏。</p></div><div className="confirm-dialog-actions"><button className="confirm-cancel" type="button" autoFocus onClick={() => setResetConfirmOpen(false)}>取消</button><button className="settings-reset-confirm" type="button" onClick={confirmReset}><RotateCcw size={14} />恢复默认</button></div></section></div>}
    </div>
  )
}

export default App
