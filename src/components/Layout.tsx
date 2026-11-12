import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { ROLE, useLang } from '../lib/i18n'
import type { Role } from '../lib/types'
import { Icon, Logo, type IconName } from './Icon'
import Notifications from './Notifications'

type Item = { to: string; ru: string; kk: string; icon: IconName }

const NAV: Record<Role, Item[]> = {
  responsible: [
    { to: '/entry', ru: 'Ввод', kk: 'Енгізу', icon: 'scale' },
    { to: '/reports', ru: 'Отчёты', kk: 'Есептер', icon: 'clipboard' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: 'chart' },
    { to: '/offers', ru: 'Порции', kk: 'Порциялар', icon: 'bowl' },
  ],
  reviewer: [
    { to: '/review', ru: 'Проверка', kk: 'Тексеру', icon: 'check' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: 'folder' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: 'document' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: 'chart' },
    { to: '/live', ru: 'Табло', kk: 'Табло', icon: 'live' },
  ],
  admin: [
    { to: '/admin', ru: 'Управление', kk: 'Басқару', icon: 'gear' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: 'folder' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: 'document' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: 'chart' },
    { to: '/sdg', ru: 'ЦУР 12', kk: 'ТДМ 12', icon: 'globe' },
  ],
  management: [
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: 'chart' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: 'document' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: 'folder' },
    { to: '/sdg', ru: 'ЦУР 12', kk: 'ТДМ 12', icon: 'globe' },
    { to: '/live', ru: 'Табло', kk: 'Табло', icon: 'live' },
  ],
}

const SPRING = { type: 'spring', stiffness: 460, damping: 36, mass: 0.8 } as const

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <LayoutGroup id="lang-switch">
      <div className="relative flex overflow-hidden rounded-[10px] bg-white text-xs font-semibold ring-1 ring-[var(--border)]">
        {(['ru', 'kk'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`relative min-h-9 px-2.5 py-1.5 transition-colors duration-150 ${lang === l ? 'text-[var(--accent-text)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
            {lang === l && <motion.span layoutId="lang-pill" transition={SPRING} className="absolute inset-0 bg-[var(--accent)]" />}
            <span className="relative">{l === 'ru' ? 'РУ' : 'ҚАЗ'}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}

/** Знак в шапке: логотип докручивается при входе и «дышит» (q-logo из темы), при наведении — пружинный отклик. */
function SwayLogo() {
  const reduce = useReducedMotion()
  return (
    <motion.span className="inline-grid" whileHover={reduce ? undefined : { scale: 1.08 }}>
      <Logo size={36} />
    </motion.span>
  )
}

export default function Layout() {
  const { profile, org, signOut } = useAuth()
  const { L, name } = useLang()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  if (!profile) return null
  const items = NAV[profile.role]

  return (
    <div className="flex min-h-full flex-col">
      <header className="shell-header q-header no-print sticky top-0 z-20 text-[var(--text)] shadow-[0_8px_24px_-16px_rgb(120_90_0/0.25)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg">
            <SwayLogo />
            <span className="text-lg font-bold tracking-tight">Qadir</span>
          </Link>
          <LayoutGroup id="top-nav">
            <nav className="ml-2 hidden min-w-0 flex-1 gap-1 md:flex lg:ml-4">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} title={L(i.ru, i.kk)} className={({ isActive }) => `relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${isActive ? 'text-[var(--accent-text)]' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}`}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-[10px] bg-[var(--accent)] shadow-[0_4px_12px_-6px_rgb(245_179_1/0.8)]" />
                      )}
                      <Icon name={i.icon} size={16} className="relative" />
                      <span className="relative hidden lg:inline">{L(i.ru, i.kk)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </LayoutGroup>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden max-w-56 text-right text-xs leading-tight xl:block">
              <div className="truncate font-semibold">{profile.full_name || profile.email}</div>
              <div className="truncate text-[var(--muted)]">{L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}</div>
            </div>
            <Notifications tone="light" />
            <LangSwitch />
            <button type="button" onClick={signOut} title={L('Выйти', 'Шығу')} className="flex min-h-9 items-center gap-1.5 rounded-[10px] bg-white px-2 py-1.5 text-sm text-[var(--text-2)] ring-1 ring-[var(--border)] transition duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:scale-95">
              <Icon name="logout" size={16} />
              <span className="hidden xl:inline">{L('Выйти', 'Шығу')}</span>
              <span className="sr-only xl:hidden">{L('Выйти', 'Шығу')}</span>
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs text-[var(--muted)] xl:hidden">
          {L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-5 sm:px-4 md:pb-10">
        {/* Переход между страницами — только появление (без ожидания ухода старой страницы).
            В конце анимации motion выставляет transform: none, поэтому position: fixed у модальных окон не ломается. */}
        <motion.div
          key={pathname}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>

      <LayoutGroup id="bottom-nav">
        <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(120_90_0/0.3)] md:hidden">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[11px] font-semibold transition-colors duration-150 active:scale-95 ${isActive ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="tab-active" transition={SPRING} className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-[var(--accent-soft)]/70">
                      <span className="absolute left-1/2 top-[-5px] h-[3px] w-8 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
                    </motion.span>
                  )}
                  <motion.span className="relative" animate={reduce ? undefined : { y: isActive ? -1 : 0, scale: isActive ? 1.08 : 1 }} transition={SPRING}>
                    <Icon name={i.icon} size={22} strokeWidth={isActive ? 2.1 : 1.7} />
                  </motion.span>
                  <span className="relative max-w-full truncate">{L(i.ru, i.kk)}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </LayoutGroup>
    </div>
  )
}
