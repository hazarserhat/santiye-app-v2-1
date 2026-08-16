import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function CariAramaSecici({ deger, onDegisti, placeholder }) {
  const [metin, setMetin] = useState(deger || '')
  const [oneriler, setOneriler] = useState([])
  const [acik, setAcik] = useState(false)
  const kutuRef = useRef(null)

  useEffect(() => { setMetin(deger || '') }, [deger])

  useEffect(() => {
    const disaTikla = (e) => { if (kutuRef.current && !kutuRef.current.contains(e.target)) setAcik(false) }
    document.addEventListener('mousedown', disaTikla)
    return () => document.removeEventListener('mousedown', disaTikla)
  }, [])

  const ara = async (yeniMetin) => {
    setMetin(yeniMetin)
    onDegisti(yeniMetin)
    if (yeniMetin.trim().length < 2) { setOneriler([]); return }
    const { data } = await supabase.from('taseronlar').select('id, ad, sifat').ilike('ad', `%${yeniMetin}%`).limit(6)
    setOneriler(data || [])
    setAcik(true)
  }

  const secimYap = (ad) => {
    setMetin(ad)
    onDegisti(ad)
    setAcik(false)
  }

  const hizliEkle = async () => {
    if (!metin.trim()) return
    const { data, error } = await supabase.from('taseronlar').insert({ ad: metin }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    secimYap(data.ad)
  }

  return (
    <div style={{ position: 'relative' }} ref={kutuRef}>
      <input
        type="text"
        placeholder={placeholder || 'Ödenen kişi/firma...'}
        value={metin}
        onChange={(e) => ara(e.target.value)}
        onFocus={() => metin.trim().length >= 2 && setAcik(true)}
      />
      {acik && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #D3D1C7', borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
          {oneriler.map((t) => (
            <div
              key={t.id}
              onClick={() => secimYap(t.ad)}
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
