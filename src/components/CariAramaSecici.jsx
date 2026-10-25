import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { matchCari, parseContacts } from '../lib/contacts'

export default function CariAramaSecici({ deger, onDegisti, placeholder }) {
  const [metin, setMetin] = useState(deger || '')
  const [oneriler, setOneriler] = useState([])
  const [acik, setAcik] = useState(false)
  const kutuRef = useRef(null)

  const [tumCariler, setTumCariler] = useState([])

  useEffect(() => { setMetin(deger || '') }, [deger])

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, firma, sifat, telefon').then(({ data }) => setTumCariler(data || []))
    
    const disaTikla = (e) => { if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false) }
    document.addEventListener('mousedown', disaTikla)
    return () => document.removeEventListener('mousedown', disaTikla)
  }, [])

  const ara = (yeniMetin) => {
    setMetin(yeniMetin)
    onDegisti(yeniMetin, null)
    if (yeniMetin.trim().length < 2) { setOneriler([]); return }
    
    const aranan = yeniMetin.trim()
    const sonuclar = []

    for (const c of tumCariler) {
      const match = matchCari(c, aranan)
      if (match.isMatch) {
        sonuclar.push({
          ...c,
          matchedKisi: match.matchedKisi
        })
      }
      if (sonuclar.length >= 8) break
    }
      
    setOneriler(sonuclar)
    setAcik(true)
  }

  const secimYap = (ad, id) => {
    setMetin(ad)
    onDegisti(ad, id)
    setAcik(false)
  }

  const hizliEkle = async () => {
    if (!metin.trim()) return
    
    const aranan = metin.trim()
    // Önce mevcut temsilci veya firmalarda var mı kontrol et
    const eslesen = tumCariler.find(c => matchCari(c, aranan).isMatch)

    if (eslesen) {
      secimYap(eslesen.ad, eslesen.id)
      return
    }

    const { data, error } = await supabase.from('taseronlar').insert({ ad: metin.trim() }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setTumCariler(prev => [...prev, data])
    secimYap(data.ad, data.id)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={kutuRef}>
      <span style={{ position: 'absolute', left: 12, color: '#888780', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
      <input
        type="text"
        placeholder={placeholder || 'Cari/Ortak/Temsilci Ara...'}
        value={metin}
        onChange={(e) => ara(e.target.value)}
        onFocus={() => metin.trim().length >= 2 && setAcik(true)}
        style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box', backgroundColor: '#F8F9FA', border: '1px solid #B0BEC5' }}
      />
      {acik && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #D3D1C7', borderRadius: 8, marginTop: 4, zIndex: 50, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}>
          {oneriler.map((t) => {
            const kisiler = parseContacts(t)
            const digerKisiler = kisiler.map(k => k.ad).filter(a => a && a !== t.ad && a !== 'Yetkili').slice(0, 3)
            return (
              <div
                key={t.id}
                onClick={() => secimYap(t.ad, t.id)}
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F1EFE8' }}
              >
                <div style={{ fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t.ad}</span>
                  {t.sifat && <span style={{ fontSize: 11, color: '#1D9596', fontWeight: 600 }}>{t.sifat}</span>}
                </div>
                {t.firma && t.firma !== t.ad && (
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>🏢 {t.firma}</div>
                )}
                {t.matchedKisi && (
                  <div style={{ fontSize: 11, color: '#0F766E', marginTop: 2, background: '#E6FFFA', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                    👤 Eşleşen Temsilci: <b>{t.matchedKisi.ad}</b> {t.matchedKisi.rol ? `(${t.matchedKisi.rol})` : ''}
                  </div>
                )}
                {!t.matchedKisi && digerKisiler.length > 0 && (
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    👥 Temsilciler: {digerKisiler.join(', ')}
                  </div>
                )}
              </div>
            )
          })}
          {oneriler.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#888780' }}>Eşleşme yok</div>
          )}
          {metin.trim().length >= 2 && (
            <div
              onClick={hizliEkle}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: '#1D9596', fontWeight: 700 }}
            >
              + "{metin}" olarak Cariler'e ekle
            </div>
          )}
        </div>
      )}
    </div>
  )
}
