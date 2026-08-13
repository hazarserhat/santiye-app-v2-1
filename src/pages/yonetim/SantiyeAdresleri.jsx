import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'

export default function SantiyeAdresleri() {
  const { santiyeler, setSantiyeler } = useSite()
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzLink, setDuzLink] = useState('')

  const kaydet = async (id) => {
    const { error } = await supabase.from('santiyeler').update({ google_maps_linki: duzLink }).eq('id', id)
    if (error) { alert('Kaydedilemedi: ' + error.message); return }
    setSantiyeler((onceki) => onceki.map((s) => (s.id === id ? { ...s, google_maps_linki: duzLink } : s)))
    setDuzenlenenId(null)
  }

  const paylas = async (s) => {
    const metin = `📍 ${s.ad}\n${s.google_maps_linki || s.adres || ''}`
    if (navigator.share) {
      try { await navigator.share({ text: metin }) } catch { /* iptal */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Şantiye Adresleri</h2>

      <div className="liste">
        {santiyeler.map((s) => (
          <div key={s.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{s.ad}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="sil-buton" onClick={() => paylas(s)} aria-label="Paylaş">📤</button>
                <button className="sil-buton" onClick={() => { setDuzenlenenId(s.id); setDuzLink(s.google_maps_linki || '') }} aria-label="Düzenle">✎</button>
              </div>
            </div>
            {s.adres && <p className="not-icerik" style={{ marginTop: 4 }}>{s.adres}</p>}

            {duzenlenenId === s.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input type="text" placeholder="Google Maps linki" value={duzLink} onChange={(e) => setDuzLink(e.target.value)} style={{ flex: 1 }} />
                <button onClick={() => kaydet(s.id)}>Kaydet</button>
              </div>
            ) : s.google_maps_linki ? (
              <a href={s.google_maps_linki} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontSize: 12, color: '#1D9596', fontWeight: 700 }}>
                🗺️ Haritada aç
              </a>
            ) : (
              <p className="bos-mesaj" style={{ padding: '4px 0', textAlign: 'left' }}>Henüz harita linki eklenmemiş.</p>
            )}
          </div>
        ))}
        {santiyeler.length === 0 && <p className="bos-mesaj">Henüz şantiye yok.</p>}
      </div>
    </div>
  )
}
