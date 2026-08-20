import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import Cekler from './Cekler'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Masraflar() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  const [sekme, setSekme] = useState('masraf')
  const [masraflar, setMasraflar] = useState([])
  const [taseronlar, setTaseronlar] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  
  const [baslik, setBaslik] = useState('')
  const [odenenKisi, setOdenenKisi] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [tutar, setTutar] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const [odemeYontemiId, setOdemeYontemiId] = useState('')
  const [harcamaTarihi, setHarcamaTarihi] = useState(bugun())
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, firma').then(({ data }) => setTaseronlar(data || []))
    supabase.from('masraf_kategorileri').select('*').then(({ data }) => setKategoriler(data || []))
    supabase.from('odeme_yontemleri').select('*').then(({ data }) => setOdemeYontemleri(data || []))
    masraflariYukle()
  }, [])

  const masraflariYukle = async () => {
    const { data } = await supabase
      .from('masraflar')
      .select('*, masraf_kategorileri(ad), odeme_yontemleri(ad)')
      .order('kayit_tarihi', { ascending: false })
    setMasraflar(data || [])
  }

  const masrafEkle = async () => {
    if (!baslik.trim() || !tutar) return
    setYukleniyor(true)

    // ID Eşleşmesi: Cari arama bileşeninden gelmediyse ismiyle bul
    let finalCariId = secilenCariId
    if (!finalCariId && odenenKisi.trim()) {
      const bulunan = taseronlar.find(t => t.ad.toLowerCase() === odenenKisi.trim().toLowerCase())
      if (bulunan) finalCariId = bulunan.id
    }

    await supabase.from('masraflar').insert({
      baslik,
      odenen_kisi: odenenKisi,
      cari_id: finalCariId, // ID artık %100 buraya gidiyor
      tutar: Number(tutar),
      kategori_id: kategoriId,
      odeme_yontemi_id: odemeYontemiId,
      harcama_tarihi: harcamaTarihi,
      ekleyen: profile?.id
    })
    
    setBaslik(''); setOdenenKisi(''); setSecilenCariId(null); setTutar(''); setYukleniyor(false)
    masraflariYukle()
  }

  return (
    <div className="sayfa">
      <h2>GİDERLER</h2>
      <div className="liste">
        {masraflar.map((m) => (
          <div key={m.id} className="kart">
             <div className="kart-ust"><span>{m.baslik}</span><span>{paraFormatla(m.tutar)} ₺</span></div>
             <p className="not-alt">Kayıt: {new Date(m.kayit_tarihi).toLocaleString('tr-TR')}</p>
          </div>
        ))}
      </div>
      <div className="ekleme-kutusu">
        <input type="text" placeholder="Başlık" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
        <CariAramaSecici deger={odenenKisi} onDegisti={(isim, id) => { setOdenenKisi(isim); setSecilenCariId(id) }} />
        <input type="number" placeholder="Tutar" value={tutar} onChange={(e) => setTutar(e.target.value)} />
        <button onClick={masrafEkle}>Kaydet</button>
      </div>
    </div>
  )
}