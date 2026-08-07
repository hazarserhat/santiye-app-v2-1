import { useState } from 'react'
import { useSite } from '../context/SiteContext'
import { supabase } from '../lib/supabase'

export default function SiteSwitcher() {
  const { santiyeler, aktifSantiye, santiyeSec, setSantiyeler } = useSite()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniAdres, setYeniAdres] = useState('')

  const filtreli = santiyeler.filter((s) => s.ad.toLowerCase().includes(arama.toLowerCase()))

  const santiyeEkle = async () => {
    if (!yeniAd.trim()) return
    const { data, error } = await supabase.from('santiyeler').insert({ ad: yeniAd, adres: yeniAdres }).select().single()
    if (!error && data) {
      setSantiyeler((onceki) => [...onceki, data].sort((a, b) => a.ad.localeCompare(b.ad)))
      santiyeSec(data)
      setYeniAd(''); setYeniAdres(''); setYeniAcik(false)
      setAcik(false)
    }
  }

  return (
    <>
      <button className="site-switcher-buton" onClick={() => setAcik(true)}>
        {aktifSantiye?.ad || 'Şantiye seç'} <span className="chevron">▾</span>
      </button>

      {acik && (
        <div className="modal-arka-plan" onClick={() => setAcik(false)}>
          <div className="modal-kutu" onClick={(e) => e.stopPropagation()}>
            <p className="modal-baslik">Şantiye seç</p>
            <input
              type="text"
              placeholder="Şantiye ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              autoFocus
            />
            <div className="site-listesi">
              {filtreli.map((s) => (
                <div
                  key={s.id}
                  className={`site-satiri ${s.id === aktifSantiye?.id ? 'aktif' : ''}`}
                  onClick={() => {
                    santiyeSec(s)
                    setAcik(false)
                  }}
                >
                  <span>{s.ad}</span>
                  {s.id === aktifSantiye?.id && <span>✓</span>}
                </div>
              ))}
              {filtreli.length === 0 && <p className="bos-mesaj">Şantiye bulunamadı</p>}
            </div>

            {!yeniAcik ? (
              <button className="ekle-buton-genis" style={{ marginTop: 12 }} onClick={() => setYeniAcik(true)}>
                + Yeni şantiye ekle
              </button>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" placeholder="Şantiye adı" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
                <input type="text" placeholder="Adres (opsiyonel)" value={yeniAdres} onChange={(e) => setYeniAdres(e.target.value)} />
                <button className="ekle-buton-genis" onClick={santiyeEkle}>Kaydet</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
