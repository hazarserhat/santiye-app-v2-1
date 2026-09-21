import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SiteContext = createContext(null)

export function SiteProvider({ children }) {
  const [santiyeler, setSantiyeler] = useState([])
  const [aktifSantiye, setAktifSantiye] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [sistemAyarlari, setSistemAyarlari] = useState({})

  useEffect(() => {
    // Şantiyeleri Yükle
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

    // Sistem Ayarlarını Yükle
    ayarlariYukle()
  }, [])

  const ayarlariYukle = async () => {
    try {
      const { data } = await supabase.from('sistem_ayarlari').select('anahtar, deger')
      if (data) {
        const yeniAyarlar = {}
        data.forEach(ayar => {
          yeniAyarlar[ayar.anahtar] = ayar.deger
        })
        setSistemAyarlari(yeniAyarlar)
      }
    } catch (err) {
      console.warn('Sistem ayarları yüklenemedi (Tablo olmayabilir):', err)
    }
  }

  const santiyeSec = (santiye) => {
    setAktifSantiye(santiye)
    localStorage.setItem('aktif_santiye_id', santiye.id)
  }

  return (
    <SiteContext.Provider value={{ santiyeler, aktifSantiye, santiyeSec, yukleniyor, setSantiyeler, sistemAyarlari, ayarlariYukle }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}
