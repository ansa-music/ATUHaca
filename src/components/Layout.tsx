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
      <div className="relative flex overflow-hidden rounded-lg text-xs font-semibold ring-1 ring-white/30">
        {(['ru', 'kk'] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`relative min-h-9 px-2.5 py-1.5 transition-colors duration-150 ${lang === l ? 'text-brand-800' : 'text-white/80 hover:bg-white/10'}`}>
            {lang === l && <motion.span layoutId="lang-pill" transition={SPRING} className="absolute inset-0 bg-white" />}
            <span className="relative">{l === 'ru' ? 'РУ' : 'ҚАЗ'}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}

/** Знак в шапке: колос плавно покачивается, при наведении — пружинный отклик. */
function SwayLogo() {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className="inline-grid"
      animate={reduce ? undefined : { rotate: [-3, 3, -3] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={reduce ? undefined : { scale: 1.08 }}
      style={{ transformOrigin: '50% 90%' }}
    >
      <Logo size={32} className="shadow-[0_4px_14px_-4px_rgb(233_185_88/0.7)]" />
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
      <header className="shell-header no-print on-dark sticky top-0 z-20 text-white shadow-[0_8px_24px_-12px_rgb(10_42_24/0.7)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg">
            <SwayLogo />
            <span className="text-lg font-bold tracking-tight">Qadir</span>
          </Link>
          <LayoutGroup id="top-nav">
            <nav className="ml-2 hidden min-w-0 flex-1 gap-1 md:flex lg:ml-4">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} title={L(i.ru, i.kk)} className={({ isActive }) => `relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ${isActive ? 'text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span layoutId="nav-active" transition={SPRING} className="absolute inset-0 rounded-lg bg-white/[0.16] shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] ring-1 ring-white/15">
                          <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-wheat-light shadow-[0_0_10px_rgb(233_185_88/0.9)]" />
                        </motion.span>
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
              <div className="truncate text-white/70">{L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}</div>
            </div>
            <Notifications />
            <LangSwitch />
            <button type="button" onClick={signOut} title={L('Выйти', 'Шығу')} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/80 ring-1 ring-white/30 transition duration-150 hover:bg-white/10 hover:text-white active:scale-95">
              <Icon name="logout" size={16} />
              <span className="hidden xl:inline">{L('Выйти', 'Шығу')}</span>
              <span className="sr-only xl:hidden">{L('Выйти', 'Шығу')}</span>
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs text-white/75 xl:hidden">
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
        <nav className="glass no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-14px_rgb(20_40_28/0.35)] md:hidden">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[11px] font-medium transition-colors duration-150 active:scale-95 ${isActive ? 'text-brand-800' : 'text-slate-500'}`}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="tab-active" transition={SPRING} className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-brand-100/80">
                      <span className="absolute left-1/2 top-[-4px] h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand-600" />
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
