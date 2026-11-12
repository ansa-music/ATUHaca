import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
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
  ],
  management: [
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: 'chart' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: 'document' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: 'folder' },
    { to: '/sdg', ru: 'ЦУР 12', kk: 'ТДМ 12', icon: 'globe' },
    { to: '/live', ru: 'Табло', kk: 'Табло', icon: 'live' },
  ],
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex overflow-hidden rounded-lg text-xs font-semibold ring-1 ring-white/30">
      {(['ru', 'kk'] as const).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-2.5 py-1.5 transition-colors duration-150 ${lang === l ? 'bg-white text-brand-800' : 'text-white/80 hover:bg-white/10'}`}>
          {l === 'ru' ? 'РУ' : 'ҚАЗ'}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { profile, org, signOut } = useAuth()
  const { L, name } = useLang()
  const { pathname } = useLocation()
  if (!profile) return null
  const items = NAV[profile.role]

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print on-dark sticky top-0 z-20 bg-brand-800 text-white shadow-[0_1px_0_rgb(255_255_255/0.06),0_6px_20px_-8px_rgb(10_42_24/0.6)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 rounded-lg">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">Qadir</span>
          </Link>
          <nav className="ml-2 hidden min-w-0 flex-1 gap-1 md:flex lg:ml-4">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} title={L(i.ru, i.kk)} className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                <Icon name={i.icon} size={16} />
                <span className="hidden lg:inline">{L(i.ru, i.kk)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden max-w-56 text-right text-xs leading-tight xl:block">
              <div className="truncate font-semibold">{profile.full_name || profile.email}</div>
              <div className="truncate text-white/70">{L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}</div>
            </div>
            <Notifications />
            <LangSwitch />
            <button type="button" onClick={signOut} title={L('Выйти', 'Шығу')} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/80 ring-1 ring-white/30 transition duration-150 hover:bg-white/10 hover:text-white active:scale-95">
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

      <main key={pathname} className="page-enter mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-8">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgb(20_40_28/0.25)] backdrop-blur md:hidden">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => `relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] font-medium transition-colors duration-150 active:scale-95 ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
            {({ isActive }) => (
              <>
                <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-brand-600 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                <Icon name={i.icon} size={22} strokeWidth={isActive ? 2.1 : 1.7} />
                <span className="max-w-full truncate">{L(i.ru, i.kk)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
