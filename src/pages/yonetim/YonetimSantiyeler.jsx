import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'

export default function YonetimSantiyeler() {
  const { santiyeler, setSantiyeler } = useSite()
  const [yeniAd, setYeniAd] = useState('')
  const [yeniAdres, setYeniAdres] = useState('')
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzAd, setDuzAd] = useState('')
  const [duzAdres, setDuzAdres] = useState('')

  const yenile = async () => {
    const { data } = await supabase.from('santiyeler').select('*').order('ad')
    setSantiyeler(data || [])
  }

  useEffect(() => { yenile() }, [])

  const santiyeEkle = async () => {
    if (!yeniAd.trim()) return
    const { error } = await supabase.from('santiyeler').insert({ ad: yeniAd, adres: yeniAdres })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniAd(''); setYeniAdres('')
    yenile()
  }

  const santiyeGuncelle = async (id) => {
    if (!duzAd.trim()) return
    const { error } = await supabase.from('santiyeler').update({ ad: duzAd, adres: duzAdres }).eq('id', id)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenId(null)
    yenile()
  }

  const santiyeSil = async (id) => {
    if (!window.confirm('Bu şantiyeyi silmek istediğinize emin misiniz? Bağlı tüm görev/masraf/puantaj kayıtları da silinir!')) return
    const { error } = await supabase.from('santiyeler').delete().eq('id', id)
    if (error) { alert('Silinemedi: ' + error.message); return }
    yenile()
  }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Şantiye Yönetimi</h2>

      <div className="liste">
        {santiyeler.map((s) => (
          <div key={s.id} className="kart">
            {duzenlenenId === s.id ? (
              <>
                <input type="text" placeholder="Şantiye adı" value={duzAd} onChange={(e) => setDuzAd(e.target.value)} style={{ marginBottom: 6 }} />
                <input type="text" placeholder="Adres" value={duzAdres} onChange={(e) => setDuzAdres(e.target.value)} style={{ marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setDuzenlenenId(null)} style={{ fontSize: 12 }}>Vazgeç</button>
                  <button onClick={() => santiyeGuncelle(s.id)} style={{ fontSize: 12 }}>Kaydet</button>
                </div>
              </>
            ) : (
              <div className="kart-ust">
                <div style={{ flex: 1 }}>
                  <span className="kart-baslik">{s.ad}</span>
                  {s.adres && <p className="not-icerik" style={{ marginTop: 4 }}>{s.adres}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="sil-buton" onClick={() => { setDuzenlenenId(s.id); setDuzAd(s.ad); setDuzAdres(s.adres || '') }} aria-label="Düzenle">✎</button>
                  <button className="sil-buton" onClick={() => santiyeSil(s.id)} aria-label="Sil">🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {santiyeler.length === 0 && <p className="bos-mesaj">Henüz şantiye eklenmemiş.</p>}
      </div>

      <div className="ekleme-kutusu">
        <input type="text" placeholder="Şantiye adı" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
        <input type="text" placeholder="Adres (opsiyonel)" value={yeniAdres} onChange={(e) => setYeniAdres(e.target.value)} />
        <button className="ekle-buton-genis" onClick={santiyeEkle}>Şantiye ekle</button>
      </div>
    </div>
  )
}
