import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setYukleniyor(false)
    })

    const { data: dinleyici } = supabase.auth.onAuthStateChange((_event, yeniSession) => {
      setSession(yeniSession)
    })

    return () => dinleyici.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const cikisYap = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, profile, yukleniyor, cikisYap }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
