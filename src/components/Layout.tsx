import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ROLE, useLang } from '../lib/i18n'
import type { Role } from '../lib/types'

type Item = { to: string; ru: string; kk: string; icon: string }

const NAV: Record<Role, Item[]> = {
  responsible: [
    { to: '/entry', ru: 'Ввод', kk: 'Енгізу', icon: '⚖️' },
    { to: '/reports', ru: 'Отчёты', kk: 'Есептер', icon: '📋' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: '📊' },
    { to: '/offers', ru: 'Порции', kk: 'Порциялар', icon: '🍲' },
  ],
  reviewer: [
    { to: '/review', ru: 'Проверка', kk: 'Тексеру', icon: '✅' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: '🗂️' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: '📑' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: '📊' },
  ],
  admin: [
    { to: '/admin', ru: 'Управление', kk: 'Басқару', icon: '⚙️' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: '🗂️' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: '📑' },
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: '📊' },
  ],
  management: [
    { to: '/dashboard', ru: 'Аналитика', kk: 'Аналитика', icon: '📊' },
    { to: '/summary', ru: 'Свод', kk: 'Жиынтық', icon: '📑' },
    { to: '/registry', ru: 'Реестр', kk: 'Тізілім', icon: '🗂️' },
    { to: '/sdg', ru: 'ЦУР 12', kk: 'ТДМ 12', icon: '🌍' },
  ],
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div className="flex overflow-hidden rounded-lg text-xs font-semibold ring-1 ring-white/30">
      {(['ru', 'kk'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={`px-2 py-1 ${lang === l ? 'bg-white text-brand-800' : 'text-white/80'}`}>
          {l === 'ru' ? 'РУ' : 'ҚАЗ'}
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const { profile, org, signOut } = useAuth()
  const { L, name } = useLang()
  if (!profile) return null
  const items = NAV[profile.role]

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-20 bg-brand-800 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-wheat text-lg">🌾</span>
            <span className="text-lg font-bold tracking-tight">Qadir</span>
          </div>
          <nav className="ml-4 hidden flex-1 gap-1 md:flex">
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-white/20' : 'text-white/80 hover:bg-white/10'}`}>
                {L(i.ru, i.kk)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-semibold">{profile.full_name || profile.email}</div>
              <div className="text-white/70">{L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}</div>
            </div>
            <LangSwitch />
            <button onClick={signOut} className="rounded-lg px-2 py-1 text-sm text-white/80 ring-1 ring-white/30 hover:bg-white/10">
              {L('Выйти', 'Шығу')}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl truncate px-4 pb-2 text-xs text-white/75 sm:hidden">
          {L(...ROLE[profile.role])}{org ? ` · ${name(org)}` : ''}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 sm:px-4 md:pb-8">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${isActive ? 'text-brand-700' : 'text-slate-500'}`}>
            <span className="text-xl leading-none">{i.icon}</span>
            {L(i.ru, i.kk)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
