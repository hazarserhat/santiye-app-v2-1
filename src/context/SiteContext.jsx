import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SiteContext = createContext(null)

export function SiteProvider({ children }) {
  const [santiyeler, setSantiyeler] = useState([])
  const [aktifSantiye, setAktifSantiye] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  useEffect(() => {
    supabase
      .from('santiyeler')
      .select('*')
      .order('ad')
      .then(({ data }) => {
        setSantiyeler(data || [])
        const kayitliId = localStorage.getItem('aktif_santiye_id')
        const kayitli = data?.find((s) => s.id === kayitliId)
        setAktifSantiye(kayitli || data?.[0] || null)
        setYukleniyor(false)
      })
  }, [])

  const santiyeSec = (santiye) => {
    setAktifSantiye(santiye)
    localStorage.setItem('aktif_santiye_id', santiye.id)
  }

  return (
    <SiteContext.Provider value={{ santiyeler, aktifSantiye, santiyeSec, yukleniyor, setSantiyeler }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}
