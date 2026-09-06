import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function CariAramaSecici({ deger, onDegisti, placeholder }) {
  const [metin, setMetin] = useState(deger || '')
  const [oneriler, setOneriler] = useState([])
  const [acik, setAcik] = useState(false)
  const kutuRef = useRef(null)

  const [tumCariler, setTumCariler] = useState([])

  useEffect(() => { setMetin(deger || '') }, [deger])

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, sifat').then(({ data }) => setTumCariler(data || []))
    
    const disaTikla = (e) => { if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false) }
    document.addEventListener('mousedown', disaTikla)
    return () => document.removeEventListener('mousedown', disaTikla)
  }, [])

  const ara = (yeniMetin) => {
    setMetin(yeniMetin)
    onDegisti(yeniMetin, null)
    if (yeniMetin.trim().length < 2) { setOneriler([]); return }
    
    const aranan = yeniMetin.trim().toLocaleLowerCase('tr-TR')
    const sonuclar = tumCariler
      .filter(c => c.ad && c.ad.toLocaleLowerCase('tr-TR').includes(aranan))
      .slice(0, 6)
      
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
    
    const aranan = metin.trim().toLocaleLowerCase('tr-TR')
    const mevcut = tumCariler.find(c => c.ad && c.ad.toLocaleLowerCase('tr-TR') === aranan)

    if (mevcut) {
      secimYap(mevcut.ad, mevcut.id)
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
        placeholder={placeholder || 'Cari/Ortak Ara...'}
        value={metin}
        onChange={(e) => ara(e.target.value)}
        onFocus={() => metin.trim().length >= 2 && setAcik(true)}
        style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box', backgroundColor: '#F8F9FA', border: '1px solid #B0BEC5' }}
      />
      {acik && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #D3D1C7', borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
          {oneriler.map((t) => (
            <div
              key={t.id}
              onClick={() => secimYap(t.ad, t.id)}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #F1EFE8' }}
            >
              {t.ad}{t.sifat ? ` · ${t.sifat}` : ''}
            </div>
          ))}
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
