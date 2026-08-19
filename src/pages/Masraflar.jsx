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
  const [kullanicilar, setKullanicilar] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [taseronlar, setTaseronlar] = useState([])
  
  // Filtre ve Sıralama State'leri
  const [filtreKategori, setFiltreKategori] = useState('hepsi')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreKullanici, setFiltreKullanici] = useState('hepsi')
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [siralama, setSiralama] = useState('kayit_yeni') // kayit_yeni, kayit_eski, harcama_yeni, harcama_eski

  const [yukleniyor, setYukleniyor] = useState(false)
  const [baslik, setBaslik] = useState('')
  const [odenenKisi, setOdenenKisi] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [aciklama, setAciklama] = useState('')
  const [tutar, setTutar] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const [odemeYontemiId, setOdemeYontemiId] = useState('')
  const [harcamaTarihi, setHarcamaTarihi] = useState(bugun())
  const [fotograf, setFotograf] = useState(null)
  const [dinliyor, setDinliyor] = useState(false)
  const [secilenSantiyeId, setSecilenSantiyeId] = useState('')

  useEffect(() => {
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    supabase.from('masraf_kategorileri').select('*').order('ad').then(({ data }) => setKategoriler(data || []))
    supabase.from('odeme_yontemleri').select('*').order('sira').then(({ data }) => setOdemeYontemleri(data || []))
    supabase.from('profiles').select('*').then(({ data }) => setKullanicilar(data || []))
    supabase.from('taseronlar').select('*').then(({ data }) => setTaseronlar(data || []))
  }, [])

  useEffect(() => { masraflariYukle() }, [])

  const masraflariYukle = async () => {
    const { data } = await supabase
      .from('masraflar')
      .select('*, masraf_kategorileri(ad), odeme_yontemleri(ad), profiles(ad_soyad)')
    setMasraflar(data || [])
  }

  // SIRALAMA VE FİLTRELEME MANTIĞI
  let islenecekListe = [...masraflar]
    .filter(m => filtreKategori === 'hepsi' || m.kategori_id === filtreKategori)
    .filter(m => filtreSantiye === 'hepsi' || (filtreSantiye === 'genel' ? !m.santiye_id : m.santiye_id === filtreSantiye))
    .filter(m => filtreKullanici === 'hepsi' || m.ekleyen === filtreKullanici)

  islenecekListe.sort((a, b) => {
    if (siralama === 'kayit_yeni') return new Date(b.kayit_tarihi) - new Date(a.kayit_tarihi)
    if (siralama === 'kayit_eski') return new Date(a.kayit_tarihi) - new Date(b.kayit_tarihi)
    if (siralama === 'harcama_yeni') return new Date(b.harcama_tarihi) - new Date(a.harcama_tarihi)
    if (siralama === 'harcama_eski') return new Date(a.harcama_tarihi) - new Date(b.harcama_tarihi)
    return 0
  })

  const masrafEkle = async () => {
    if (!baslik.trim() || !tutar) return
    setYukleniyor(true)
    let bulutCariId = secilenCariId
    if (!bulutCariId && odenenKisi.trim()) {
      const bulunan = taseronlar.find(t => t.ad.toLowerCase() === odenenKisi.trim().toLowerCase())
      if (bulunan) bulutCariId = bulunan.id
    }

    await supabase.from('masraflar').insert({
      santiye_id: secilenSantiyeId === 'genel' ? null : secilenSantiyeId,
      kategori_id: kategoriId,
      baslik,
      odenen_kisi: odenenKisi,
      cari_id: bulutCariId || null,
      aciklama,
      tutar: Number(tutar),
      odeme_yontemi_id: odemeYontemiId,
      harcama_tarihi: harcamaTarihi,
      ekleyen: profile?.id,
    })
    setYukleniyor(false)
    masraflariYukle()
  }

  return (
    <div className="sayfa">
      <h2>GİDERLER</h2>
      
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)}>
          {filtreAcik ? 'Filtreleri Gizle' : 'Filtreleri & Sıralamayı Göster'}
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#f9f9f9' }}>
          <p style={{ fontWeight: 'bold', fontSize: 13 }}>Sıralama</p>
          <select value={siralama} onChange={(e) => setSiralama(e.target.value)} style={{ marginBottom: 10 }}>
            <option value="kayit_yeni">Kayıt Tarihi (En yeni → Eski)</option>
            <option value="kayit_eski">Kayıt Tarihi (En eski → Yeni)</option>
            <option value="harcama_yeni">Gerçekleşme Tarihi (Yakından → Uzağa)</option>
            <option value="harcama_eski">Gerçekleşme Tarihi (Uzaktan → Yakına)</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13 }}>Filtreler</p>
          <select onChange={(e) => setFiltreSantiye(e.target.value)} style={{ marginBottom: 5 }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
          <select onChange={(e) => setFiltreKategori(e.target.value)}>
            <option value="hepsi">Tüm Kategoriler</option>
            {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        </div>
      )}

      <div className="liste">
        {islenecekListe.map((m) => (
          <div key={m.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{m.baslik}</span>
              <span className="kart-tutar">{paraFormatla(m.tutar)} ₺</span>
            </div>
            <div className="kart-alt-tarih">
              <span>Harcama: {new Date(m.harcama_tarihi).toLocaleDateString('tr-TR')}</span>
              <span>Kayıt: {new Date(m.kayit_tarihi).toLocaleTimeString('tr-TR')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ekleme-kutusu">
        {/* ... (Ekleme formu aynı kalabilir) ... */}
      </div>
    </div>
  )
}