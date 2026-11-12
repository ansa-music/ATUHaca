import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Icon } from './components/Icon'
import Layout from './components/Layout'
import { Btn, Card, Spinner } from './components/ui'
import { useAuth } from './lib/auth'
import { useLang } from './lib/i18n'
import type { Role } from './lib/types'
import AdminPage from './pages/Admin'
import DashboardPage from './pages/Dashboard'
import EntryPage from './pages/Entry'
import Landing from './pages/Landing'
import LivePage from './pages/Live'
import Login from './pages/Login'
import OffersPage from './pages/Offers'
import RegistryPage from './pages/Registry'
import ReportsPage from './pages/Reports'
import RescuePage from './pages/Rescue'
import PitchPage from './pages/Pitch'
import { ReviewDetail, ReviewList } from './pages/Review'
import ScaleSim from './pages/ScaleSim'
import SdgPage from './pages/Sdg'
import SummaryPage from './pages/Summary'

const HOME: Record<Role, string> = { responsible: '/entry', reviewer: '/review', admin: '/admin', management: '/dashboard' }
const STAFF: Role[] = ['reviewer', 'admin', 'management']

/**
 * Маршруты по ролям — это удобство интерфейса. Настоящая защита — на сервере:
 * политики RLS и функции workflow в базе не отдадут и не изменят чужие данные, даже если открыть страницу вручную.
 */
function Guard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile) return null
  return roles.includes(profile.role) ? <>{children}</> : <Navigate to={HOME[profile.role]} replace />
}

function Pending() {
  const { signOut } = useAuth()
  const { L } = useLang()
  return (
    <div className="grid min-h-full place-items-center bg-brand-800 p-4">
      <Card className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-wheat-soft text-wheat"><Icon name="hourglass" size={28} /></div>
        <h1 className="mt-2 text-xl font-bold">{L('Учётная запись создана', 'Тіркелгі жасалды')}</h1>
        <p className="mt-1 text-sm text-slate-600">{L('Администратор должен назначить вам организацию. После этого откроется форма ввода.', 'Әкімші сізге ұйымды тағайындауы керек. Содан кейін енгізу формасы ашылады.')}</p>
        <Btn className="mt-4" variant="ghost" onClick={signOut}>{L('Выйти', 'Шығу')}</Btn>
      </Card>
    </div>
  )
}

function Shell() {
  const { loading, profile } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner />
  if (!profile) return <Navigate to={`/login${loc.search.includes('guest') ? '?guest=1' : ''}`} replace />
  if (profile.role === 'responsible' && !profile.org_id) return <Pending />
  return <Layout />
}

function LoginRoute() {
  const { loading, profile } = useAuth()
  if (loading) return <Spinner />
  return profile ? <Navigate to={HOME[profile.role]} replace /> : <Login />
}

/** Главная: гостю — открытая страница о проекте, вошедшему — рабочий раздел его роли. */
function Home() {
  const { loading, profile } = useAuth()
  if (loading) return <Spinner />
  return profile ? <Navigate to={HOME[profile.role]} replace /> : <Landing />
}

/** Табло для проектора: без шапки и меню, только для проверяющего, администратора и руководства. */
function LiveRoute() {
  const { loading, profile } = useAuth()
  if (loading) return <Spinner />
  if (!profile) return <Navigate to="/login" replace />
  return <Guard roles={STAFF}><LivePage /></Guard>
}

function Fallback() {
  const { profile } = useAuth()
  return <Navigate to={profile ? HOME[profile.role] : '/login'} replace />
}

export default function App() {
  return (
    // reducedMotion="user": при системной настройке «меньше движения» motion отключает анимации перемещений
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/rescue" element={<RescuePage />} />
        <Route path="/pitch" element={<PitchPage />} />
        <Route path="/scale-sim" element={<ScaleSim />} />
        <Route path="/" element={<Home />} />
        <Route path="/live" element={<LiveRoute />} />
        <Route element={<Shell />}>
          <Route path="/entry" element={<Guard roles={['responsible']}><EntryPage /></Guard>} />
          <Route path="/reports" element={<Guard roles={['responsible']}><ReportsPage /></Guard>} />
          <Route path="/offers" element={<Guard roles={['responsible']}><OffersPage /></Guard>} />
          <Route path="/review" element={<Guard roles={['reviewer']}><ReviewList /></Guard>} />
          <Route path="/review/:id" element={<Guard roles={['reviewer']}><ReviewDetail /></Guard>} />
          <Route path="/registry" element={<Guard roles={STAFF}><RegistryPage /></Guard>} />
          <Route path="/summary" element={<Guard roles={STAFF}><SummaryPage /></Guard>} />
          <Route path="/sdg" element={<Guard roles={STAFF}><SdgPage /></Guard>} />
          <Route path="/admin" element={<Guard roles={['admin']}><AdminPage /></Guard>} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Fallback />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </MotionConfig>
  )
}
