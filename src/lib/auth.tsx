import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Org, Profile } from './types'

type Ctx = {
  loading: boolean
  profile: Profile | null
  org: Org | null
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

const AuthCtx = createContext<Ctx>(null as unknown as Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [org, setOrg] = useState<Org | null>(null)

  async function load(userId: string | undefined) {
    if (!userId) {
      setProfile(null); setOrg(null); setLoading(false)
      return
    }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((p as Profile) ?? null)
    if (p?.org_id) {
      const { data: o } = await supabase.from('organizations').select('*').eq('id', p.org_id).maybeSingle()
      setOrg((o as Org) ?? null)
    } else setOrg(null)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Запросы к базе нельзя делать прямо внутри обработчика — откладываем.
      setTimeout(() => load(session?.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: Ctx = {
    loading, profile, org,
    signOut: async () => { await supabase.auth.signOut() },
    reload: async () => { const { data } = await supabase.auth.getSession(); await load(data.session?.user.id) },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
