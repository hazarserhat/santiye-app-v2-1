import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import HizliSantiyeEkle from '../components/HizliSantiyeEkle'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Masraflar() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  const [masraflar, setMasraflar] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [filtreKategori, setFiltreKategori] = useState('hepsi')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreKullanici, setFiltreKullanici] = useState('hepsi')
  const [yukleniyor, setYukleniyor] = useState(false)

  const [baslik, setBaslik] = useState('')
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
    supabase.from('masraf_kategorileri').select('*').order('ad').then(({ data }) => {
      setKategoriler(data || [])
      if (data?.length) setKategoriId(data[0].id)
    })
    supabase.from('odeme_yontemleri').select('*').order('ad').then(({ data }) => {
      const tumu = data || []
      const filtreli = profile?.rol === 'santiye_sefi' ? tumu.filter((o) => o.sef_gorebilir) : tumu
      setOdemeYontemleri(filtreli)
      if (filtreli.length) setOdemeYontemiId(filtreli[0].id)
    })
    supabase.from('profiles').select('*').order('ad_soyad').then(({ data }) => setKullanicilar(data || []))
  }, [profile])

  useEffect(() => {
    masraflariYukle()
  }, [])

  const masraflariYukle = async () => {
    const { data } = await supabase
      .from('masraflar')
      .select('*, masraf_kategorileri(ad), odeme_yontemleri(ad), profiles(ad_soyad)')
      .order('harcama_tarihi', { ascending: false })
    setMasraflar(data || [])
  }

  const kullaniciyaGoreFiltreli = filtreKullanici === 'hepsi'
    ? masraflar
    : masraflar.filter((m) => m.ekleyen === filtreKullanici)

  const santiyeyeGoreFiltreli = filtreSantiye === 'hepsi'
    ? kullaniciyaGoreFiltreli
    : filtreSantiye === 'genel'
      ? kullaniciyaGoreFiltreli.filter((m) => !m.santiye_id)
      : kullaniciyaGoreFiltreli.filter((m) => m.santiye_id === filtreSantiye)

  const gorunenler = filtreKategori === 'hepsi'
    ? santiyeyeGoreFiltreli
    : santiyeyeGoreFiltreli.filter((m) => m.kategori_id === filtreKategori)

  const buAy = gorunenler.filter((m) => m.harcama_tarihi.slice(0, 7) === bugun().slice(0, 7))
  const buAyToplam = buAy.reduce((t, m) => t + Number(m.tutar), 0)
  const nakitToplam = buAy.filter((m) => m.odeme_yontemleri?.ad?.includes('KASA')).reduce((t, m) => t + Number(m.tutar), 0)

  const masrafEkle = async () => {
    if (!baslik.trim() || !tutar) return
    setYukleniyor(true)

    let fotografUrl = null
    if (fotograf) {
      const dosyaAdi = `${aktifSantiye.id}/${Date.now()}_${fotograf.name}`
      const { data, error } = await supabase.storage.from('masraf-fotograflari').upload(dosyaAdi, fotograf)
      if (!error) {
        const { data: url } = supabase.storage.from('masraf-fotograflari').getPublicUrl(data.path)
        fotografUrl = url.publicUrl
      }
    }

    const { error } = await supabase.from('masraflar').insert({
      santiye_id: secilenSantiyeId === 'genel' ? null : secilenSantiyeId,
      kategori_id: kategoriId,
      baslik,
      tutar: Number(tutar),
      odeme_yontemi_id: odemeYontemiId,
      harcama_tarihi: harcamaTarihi,
      fotograf_url: fotografUrl,
      ekleyen: profile?.id,
    })

    if (error) {
      alert('Masraf eklenemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    setBaslik('')
    setTutar('')
    setFotograf(null)
    setHarcamaTarihi(bugun())
    setSecilenSantiyeId(aktifSantiye.id)
    setYukleniyor(false)
    masraflariYukle()
  }

  const masrafSil = async (id) => {
    if (!window.confirm('Bu masrafı silmek istediğinize emin misiniz?')) return
    await supabase.from('masraflar').delete().eq('id', id)
    masraflariYukle()
  }

  const sesleYaz = () => {
    const Tanima = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Tanima) {
      alert('Tarayıcınız sesli girişi desteklemiyor.')
      return
    }
    const tanima = new Tanima()
    tanima.lang = 'tr-TR'
    tanima.onresult = (e) => setBaslik((onceki) => onceki + e.results[0][0].transcript)
    tanima.onstart = () => setDinliyor(true)
    tanima.onend = () => setDinliyor(false)
    tanima.start()
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  return (
    <div className="sayfa">
      <h2>Muhasebe</h2>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Bu ay toplam</p>
          <p className="ozet-tutar">{buAyToplam.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Nakit çıkışı</p>
          <p className="ozet-tutar">{nakitToplam.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>
            {s.ad}
          </button>
        ))}
        <button className={`filtre-chip ${filtreSantiye === 'genel' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('genel')}>Genel Gider</button>
        <HizliSantiyeEkle />
      </div>

      {yonetici && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreKullanici === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKullanici('hepsi')}>Tüm kullanıcılar</button>
          {kullanicilar.map((k) => (
            <button key={k.id} className={`filtre-chip ${filtreKullanici === k.id ? 'secili' : ''}`} onClick={() => setFiltreKullanici(k.id)}>
              {k.ad_soyad}
            </button>
          ))}
        </div>
      )}

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreKategori === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKategori('hepsi')}>Tüm kategoriler</button>
        {kategoriler.map((k) => (
          <button key={k.id} className={`filtre-chip ${filtreKategori === k.id ? 'secili' : ''}`} onClick={() => setFiltreKategori(k.id)}>
            {k.ad}
          </button>
        ))}
      </div>

      <div className="liste">
        {gorunenler.map((m) => (
          <div key={m.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{m.baslik}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="kart-tutar">{Number(m.tutar).toLocaleString('tr-TR')} ₺</span>
                <button className="sil-buton" onClick={() => masrafSil(m.id)} aria-label="Masrafı sil">🗑</button>
              </div>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">
                {m.santiye_id ? (santiyeler.find((s) => s.id === m.santiye_id)?.ad || 'Şantiye') : 'Genel Gider'}
              </span>
              <span className="etiket">{m.masraf_kategorileri?.ad}</span>
              <span className="etiket">{m.odeme_yontemleri?.ad}</span>
              {m.fotograf_url && <a className="etiket" href={m.fotograf_url} target="_blank" rel="noreferrer">Fotoğraf</a>}
            </div>
            <div className="kart-alt-tarih">
              <span>Harcama: {new Date(m.harcama_tarihi).toLocaleDateString('tr-TR')}</span>
              <span>Kayıt: {new Date(m.kayit_tarihi).toLocaleDateString('tr-TR')}</span>
            </div>
            <div className="kart-alt-tarih" style={{ marginTop: 2 }}>
              <span>Ekleyen: {m.profiles?.ad_soyad || 'Bilinmiyor'}</span>
            </div>
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
      </div>

      <div className="ekleme-kutusu">
        <select value={secilenSantiyeId} onChange={(e) => setSecilenSantiyeId(e.target.value)} className="santiye-secici-form">
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          <option value="genel">Genel Gider (şantiyeye bağlı değil)</option>
        </select>
        <input type="text" placeholder="Masraf başlığı..." value={baslik} onChange={(e) => setBaslik(e.target.value)} />
        <div className="ekleme-satiri-2">
          <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} />
          <select value={kategoriId} onChange={(e) => setKategoriId(e.target.value)}>
            {kategoriler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        </div>
        <div className="ekleme-satiri-2">
          <input type="date" value={harcamaTarihi} onChange={(e) => setHarcamaTarihi(e.target.value)} />
          <select value={odemeYontemiId} onChange={(e) => setOdemeYontemiId(e.target.value)}>
            {odemeYontemleri.map((o) => <option key={o.id} value={o.id}>{o.ad}</option>)}
          </select>
        </div>
        <div className="ekleme-satiri-2">
          <label className="dosya-buton">
            📷 {fotograf ? fotograf.name.slice(0, 18) : 'Fotoğraf ekle'}
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => setFotograf(e.target.files[0])} />
          </label>
          <button className="mikrofon-buton" onClick={sesleYaz}>{dinliyor ? '●' : '🎤'}</button>
        </div>
        <button className="ekle-buton-genis" onClick={masrafEkle} disabled={yukleniyor}>
          {yukleniyor ? 'Ekleniyor...' : 'Masrafı kaydet'}
        </button>
      </div>
    </div>
  )
}
