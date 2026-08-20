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
  const [sekme, setSekme] = useState('masraf') // 'masraf' | 'cek'
  
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
  const [siralama, setSiralama] = useState('kayit_yeni')

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
    supabase.from('masraf_kategorileri').select('*').order('ad').then(({ data }) => {
      setKategoriler(data || [])
      if (data?.length) setKategoriId(data[0].id)
    })
    supabase.from('odeme_yontemleri').select('*').order('sira').then(({ data }) => {
      const tumu = data || []
      const filtreli = profile?.rol === 'santiye_sefi' ? tumu.filter((o) => o.sef_gorebilir) : tumu.filter((o) => o.yonetici_gorebilir)
      setOdemeYontemleri(filtreli)
      if (filtreli.length) setOdemeYontemiId(filtreli[0].id)
    })
    supabase.from('profiles').select('*').then(({ data }) => setKullanicilar(data || []))
    supabase.from('taseronlar').select('*').then(({ data }) => setTaseronlar(data || []))
    masraflariYukle()
  }, [profile])

  const masraflariYukle = async () => {
    const { data } = await supabase
      .from('masraflar')
      .select('*, masraf_kategorileri(ad), odeme_yontemleri(ad), profiles(ad_soyad)')
    setMasraflar(data || [])
  }

  // Filtreleme ve Sıralama İşlemi
  let islenecekListe = [...masraflar]
    .filter(m => filtreKategori === 'hepsi' || m.kategori_id === filtreKategori)
    .filter(m => filtreSantiye === 'hepsi' || (filtreSantiye === 'genel' ? !m.santiye_id : m.santiye_id === filtreSantiye))
    .filter(m => filtreKullanici === 'hepsi' || m.ekleyen === filtreKullanici)

  islenecekListe.sort((a, b) => {
    if (siralama === 'kayit_yeni') return new Date(b.kayit_tarihi || 0) - new Date(a.kayit_tarihi || 0)
    if (siralama === 'kayit_eski') return new Date(a.kayit_tarihi || 0) - new Date(b.kayit_tarihi || 0)
    if (siralama === 'harcama_yeni') return new Date(b.harcama_tarihi || 0) - new Date(a.harcama_tarihi || 0)
    if (siralama === 'harcama_eski') return new Date(a.harcama_tarihi || 0) - new Date(b.harcama_tarihi || 0)
    return 0
  })

  const masrafEkle = async () => {
    if (!baslik.trim() || !tutar) return
    setYukleniyor(true)

    let finalCariId = secilenCariId
    if (!finalCariId && odenenKisi.trim()) {
      const bulunan = taseronlar.find(t => t.ad.toLowerCase() === odenenKisi.trim().toLowerCase())
      if (bulunan) finalCariId = bulunan.id
    }

    let fotografUrl = null
    if (fotograf && aktifSantiye) {
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
      odenen_kisi: odenenKisi,
      cari_id: finalCariId || null,
      aciklama,
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
    setOdenenKisi('')
    setSecilenCariId(null)
    setAciklama('')
    setTutar('')
    setFotograf(null)
    setHarcamaTarihi(bugun())
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
    setYukleniyor(false)
    masraflariYukle()
  }

  const masrafSil = async (id) => {
    if (!window.confirm('Bu masrafı silmek istediğinize emin misiniz?')) return
    await supabase.from('masraflar').delete().eq('id', id)
    masraflariYukle()
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  return (
    <div className="sayfa">
      <h2>GİDERLER</h2>

      {yonetici && (
        <div className="gorunum-secici" style={{ marginBottom: 14 }}>
          <button className={sekme === 'masraf' ? 'secili-tab' : ''} onClick={() => setSekme('masraf')}>Ödeme Girdileri</button>
          <button className={sekme === 'cek' ? 'secili-tab' : ''} onClick={() => setSekme('cek')}>Çek Girdileri</button>
        </div>
      )}

      {sekme === 'cek' && yonetici ? <Cekler /> : (
      <>
        <div style={{ marginBottom: 14 }}>
          <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)}>
            {filtreAcik ? 'Filtreleri Gizle' : 'Filtreleri & Sıralamayı Göster'}
          </button>
        </div>

        {filtreAcik && (
          <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Sıralama</p>
            <select value={siralama} onChange={(e) => setSiralama(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
              <option value="kayit_yeni">Kayıt Tarihi (En yeni → Eski)</option>
              <option value="kayit_eski">Kayıt Tarihi (En eski → Yeni)</option>
              <option value="harcama_yeni">Gerçekleşme Tarihi (Yakından → Uzağa)</option>
              <option value="harcama_eski">Gerçekleşme Tarihi (Uzaktan → Yakına)</option>
            </select>

            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
            <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
              <option value="hepsi">Tüm Şantiyeler</option>
              {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
              <option value="genel">Genel Gider</option>
            </select>

            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Kategori Filtresi</p>
            <select value={filtreKategori} onChange={(e) => setFiltreKategori(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="kart-tutar">{paraFormatla(m.tutar)} ₺</span>
                  <button className="sil-buton" onClick={() => masrafSil(m.id)} aria-label="Masrafı sil">🗑</button>
                </div>
              </div>
              <div className="etiket-satiri">
                <span className="etiket etiket-vurgu">
                  {m.santiye_id ? (santiyeler.find((s) => s.id === m.santiye_id)?.ad || 'Şantiye') : 'Genel Gider'}
                </span>
                <span className="etiket">{m.masraf_kategorileri?.ad}</span>
                <span className="etiket">{m.odeme_yontemleri?.ad}</span>
              </div>
              <div className="kart-alt-tarih">
                <span>Harcama: {m.harcama_tarihi ? new Date(m.harcama_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
                <span>Kayıt: {m.kayit_tarihi ? new Date(m.kayit_tarihi).toLocaleString('tr-TR') : '—'}</span>
              </div>
              {m.odenen_kisi && <div className="kart-alt-tarih"><span>Ödenen: {m.odenen_kisi}</span></div>}
              {m.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{m.aciklama}</p>}
            </div>
          ))}
          {islenecekListe.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
        </div>

        <div className="ekleme-kutusu">
          <select value={secilenSantiyeId} onChange={(e) => setSecilenSantiyeId(e.target.value)} className="santiye-secici-form">
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            <option value="genel">Genel Gider (şantiyeye bağlı değil)</option>
          </select>
          <input type="text" placeholder="Masraf başlığı..." value={baslik} onChange={(e) => setBaslik(e.target.value)} />
          
          <CariAramaSecici 
            deger={odenenKisi} 
            onDegisti={(isim, cariId) => { 
              setOdenenKisi(isim)
              setSecilenCariId(cariId || null) 
            }} 
            placeholder="Ödenen kişi/firma (opsiyonel)..." 
          />

          <textarea
            placeholder="Açıklama / not (opsiyonel)..."
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div className="ekleme-satiri-2">
            <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />
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
          <button className="ekle-buton-genis" onClick={masrafEkle} disabled={yukleniyor}>
            {yukleniyor ? 'Ekleniyor...' : 'Masrafı kaydet'}
          </button>
        </div>
      </>
      )}
    </div>
  )
}