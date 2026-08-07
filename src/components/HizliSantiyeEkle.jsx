import { useState } from 'react'
import { useSite } from '../context/SiteContext'
import { supabase } from '../lib/supabase'

export default function HizliSantiyeEkle() {
  const { setSantiyeler, santiyeSec } = useSite()
  const [acik, setAcik] = useState(false)
  const [ad, setAd] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const ekle = async () => {
    if (!ad.trim()) return
    setGonderiliyor(true)
    const { data, error } = await supabase.from('santiyeler').insert({ ad }).select().single()
    setGonderiliyor(false)
    if (error) {
      alert('Şantiye eklenemedi: ' + error.message)
      return
    }
    setSantiyeler((onceki) => [...onceki, data].sort((a, b) => a.ad.localeCompare(b.ad)))
    santiyeSec(data)
    setAd('')
    setAcik(false)
  }

  if (!acik) {
    return <button className="filtre-chip" onClick={() => setAcik(true)}>+ Şantiye ekle</button>
  }

  return (
    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <input
        type="text"
        placeholder="Şantiye adı"
        value={ad}
        onChange={(e) => setAd(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ekle()}
        style={{ width: 120, fontSize: 12, padding: '4px 8px' }}
        autoFocus
      />
      <button className="filtre-chip secili" onClick={ekle} disabled={gonderiliyor}>
        {gonderiliyor ? '...' : 'Ekle'}
      </button>
    </span>
  )
}
