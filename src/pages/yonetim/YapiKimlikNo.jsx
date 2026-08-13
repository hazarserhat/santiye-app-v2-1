import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'

export default function YapiKimlikNo() {
  const { santiyeler } = useSite()
  const [kayitlar, setKayitlar] = useState([])
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzNumara, setDuzNumara] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniNumara, setYeniNumara] = useState('')

  const yenile = async () => {
    const { data, error } = await supabase.from('yapi_kimlik_numaralari').select('*, santiyeler(ad)').order('created_at', { ascending: false })
    if (error) { alert('Yüklenemedi: ' + error.message); return }
    setKayitlar(data || [])
  }

  useEffect(() => { yenile() }, [])

  const ekle = async () => {
    if (!yeniSantiyeId || !yeniNumara.trim()) { alert('Şantiye ve numara zorunludur.'); return }
    const { error } = await supabase.from('yapi_kimlik_numaralari').insert({ santiye_id: yeniSantiyeId, numara: yeniNumara })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniNumara(''); yenile()
  }

  const guncelle = async (id) => {
    await supabase.from('yapi_kimlik_numaralari').update({ numara: duzNumara }).eq('id', id)
    setDuzenlenenId(null); yenile()
  }

  const sil = async (id) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('yapi_kimlik_numaralari').delete().eq('id', id)
    yenile()
  }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Bina Yapı Kimlik Numaraları</h2>

      <div className="liste">
        {kayitlar.map((k) => (
          <div key={k.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{k.santiyeler?.ad}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="sil-buton" onClick={() => { setDuzenlenenId(k.id); setDuzNumara(k.numara || '') }} aria-label="Düzenle">✎</button>
                <button className="sil-buton" onClick={() => sil(k.id)} aria-label="Sil">🗑</button>
              </div>
            </div>
            {duzenlenenId === k.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input type="text" value={duzNumara} onChange={(e) => setDuzNumara(e.target.value)} style={{ flex: 1 }} />
                <button onClick={() => guncelle(k.id)}>Kaydet</button>
              </div>
            ) : (
              <p className="not-icerik" style={{ marginTop: 4 }}>{k.numara}</p>
            )}
          </div>
        ))}
        {kayitlar.length === 0 && <p className="bos-mesaj">Henüz kayıt yok.</p>}
      </div>

      <div className="ekleme-kutusu">
        <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
          <option value="">Şantiye seç...</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        <input type="text" placeholder="Yapı kimlik numarası" value={yeniNumara} onChange={(e) => setYeniNumara(e.target.value)} />
        <button className="ekle-buton-genis" onClick={ekle}>Ekle</button>
      </div>
    </div>
  )
}
