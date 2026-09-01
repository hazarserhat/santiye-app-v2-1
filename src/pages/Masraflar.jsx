import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import Cekler from './Cekler'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'
import { uploadToGoogleDrive, moveToSilinenler, getGoogleDriveInlineImageUrl, getGoogleDriveViewUrl } from '../lib/googleDrive'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Masraflar() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  const [sekme, setSekme] = useState('masraf') // 'masraf' | 'cek'

  // Yüzde Dağılım Yardımcı Fonksiyonları
  const handleYuzdeDegisimi = (liste, setListe, degisenIndex, yeniDeger) => {
    const yeniListe = [...liste]
    const val = Number(yeniDeger)
    yeniListe[degisenIndex] = { ...yeniListe[degisenIndex], yuzde: yeniDeger }
    
    if (yeniListe.length > 1 && val >= 0 && val <= 100 && yeniDeger !== '') {
      const kalan = 100 - val
      const digerAdet = yeniListe.length - 1
      const pay = Math.floor(kalan / digerAdet)
      let kalanPay = kalan - (pay * digerAdet)

      yeniListe.forEach((item, idx) => {
        if (idx !== degisenIndex) {
          if (kalanPay > 0) {
            yeniListe[idx].yuzde = (pay + 1).toString()
            kalanPay--
          } else {
            yeniListe[idx].yuzde = pay.toString()
          }
        }
      })
    }
    setListe(yeniListe)
  }

  const handleSantiyeEkle = (liste, setListe) => {
    const yeniListe = [...liste, { santiye_id: '', yuzde: '' }]
    const adet = yeniListe.length
    const pay = Math.floor(100 / adet)
    let kalanPay = 100 - (pay * adet)
    
    yeniListe.forEach((item, idx) => {
      if (kalanPay > 0) {
        yeniListe[idx].yuzde = (pay + 1).toString()
        kalanPay--
      } else {
        yeniListe[idx].yuzde = pay.toString()
      }
    })
    setListe(yeniListe)
  }

  const [masraflar, setMasraflar] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [taseronlar, setTaseronlar] = useState([])

  // Filtre ve Sıralama State'leri
  const [filtreCari, setFiltreCari] = useState('hepsi')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreKullanici, setFiltreKullanici] = useState('hepsi')
  const [filtreBaslangic, setFiltreBaslangic] = useState('')
  const [filtreBitis, setFiltreBitis] = useState('')
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
  const [taksitSayisi, setTaksitSayisi] = useState(1)
  const [harcamaTarihi, setHarcamaTarihi] = useState(bugun())
  const [fotograf, setFotograf] = useState(null)
  const [dinliyor, setDinliyor] = useState(false)
  const [secilenSantiyeId, setSecilenSantiyeId] = useState('')
  const [cokluSantiyeAcik, setCokluSantiyeAcik] = useState(false)
  const [santiyeDagilimi, setSantiyeDagilimi] = useState([{ santiye_id: '', yuzde: '' }])

  const seciliYontem = odemeYontemleri.find(o => o.id === odemeYontemiId)
  const isKrediKarti = seciliYontem && seciliYontem.ad.toLowerCase().includes('kart')

  // Düzenleme State'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzBaslik, setDuzBaslik] = useState('')
  const [duzTutar, setDuzTutar] = useState('')
  const [duzHarcamaTarihi, setDuzHarcamaTarihi] = useState('')
  const [duzAciklama, setDuzAciklama] = useState('')
  const [duzOdenenKisi, setDuzOdenenKisi] = useState('')
  const [duzKategoriId, setDuzKategoriId] = useState('')
  const [duzOdemeYontemiId, setDuzOdemeYontemiId] = useState('')
  const [duzCariId, setDuzCariId] = useState(null)
  const [duzSantiyeId, setDuzSantiyeId] = useState('')
  const [duzCokluSantiyeAcik, setDuzCokluSantiyeAcik] = useState(false)
  const [duzSantiyeDagilimi, setDuzSantiyeDagilimi] = useState([])

  // Clipboard yapıştırma (Ctrl+V ile görüntü yükleme)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const yeniDosya = new File([file], `pano_gorseli_${Date.now()}.png`, { type: file.type })
            setFotograf(yeniDosya)
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const panodanYapistir = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type)
            const file = new File([blob], `pano_gorseli_${Date.now()}.png`, { type: blob.type })
            setFotograf(file)
            return
          }
        }
      }
      alert('Panoda bir görsel bulunamadı.')
    } catch (err) {
      console.error(err)
      alert('Panoya erişim sağlanamadı. (Cihazınız bu özelliği desteklemiyor veya izin reddedildi)')
    }
  }

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
    .filter(m => filtreCari === 'hepsi' || (filtreCari === 'yok' ? !m.cari_id : m.cari_id === filtreCari))
    .filter(m => filtreSantiye === 'hepsi' || (filtreSantiye === 'genel' ? !m.santiye_id : m.santiye_id === filtreSantiye))
    .filter(m => filtreKullanici === 'hepsi' || m.ekleyen === filtreKullanici)
    .filter(m => {
      if (!filtreBaslangic && !filtreBitis) return true
      if (!m.harcama_tarihi) return false
      if (filtreBaslangic && m.harcama_tarihi < filtreBaslangic) return false
      if (filtreBitis && m.harcama_tarihi > filtreBitis) return false
      return true
    })

  islenecekListe.sort((a, b) => {
    if (siralama === 'kayit_yeni') return new Date(b.kayit_tarihi || 0) - new Date(a.kayit_tarihi || 0)
    if (siralama === 'kayit_eski') return new Date(a.kayit_tarihi || 0) - new Date(b.kayit_tarihi || 0)
    if (siralama === 'harcama_yeni') return new Date(b.harcama_tarihi || 0) - new Date(a.harcama_tarihi || 0)
    if (siralama === 'harcama_eski') return new Date(a.harcama_tarihi || 0) - new Date(b.harcama_tarihi || 0)
    return 0
  })

  // Mobil mi masaüstü mü tespiti (touch destekli cihaz = mobil)
  const mobilCihaz = () => navigator.maxTouchPoints > 0

  // WhatsApp ile Görsel ve Metin Paylaşım Fonksiyonu
  const whatsappGorselliPaylas = async (m) => {
    try {
      let santiyeMetni = ''
      if (m.santiye_dagilimi && m.santiye_dagilimi.length > 0) {
        santiyeMetni = '\n' + m.santiye_dagilimi.map((d, index) => {
          const s = santiyeler.find(x => x.id === d.santiye_id)
          return `-${index + 1}- ${s ? s.ad : 'Bilinmeyen'} % ${d.yuzde}`
        }).join('\n')
      } else {
        santiyeMetni = m.santiye_id ? (santiyeler.find((s) => s.id === m.santiye_id)?.ad || 'Şantiye') : 'Genel Gider'
      }

      const metin =
        `💰 *GİDER BİLDİRİMİ*\n` +
        `📌 *Başlık:* ${m.baslik}\n` +
        `💵 *Tutar:* ${paraFormatla(m.tutar)} ₺\n` +
        `🏗 *Şantiye:* ${santiyeMetni}\n` +
        `📁 *Kategori:* ${m.masraf_kategorileri?.ad || '—'}\n` +
        `💳 *Ödeme:* ${m.odeme_yontemleri?.ad || '—'}\n` +
        (m.taksit_sayisi && m.taksit_sayisi > 1 ? `🔄 *Taksit:* ${m.taksit_sayisi} Taksit\n` : '') +
        (m.odenen_kisi ? `👤 *Ödenen:* ${m.odenen_kisi}\n` : '') +
        `📅 *Tarih:* ${m.harcama_tarihi ? new Date(m.harcama_tarihi).toLocaleDateString('tr-TR') : '—'}\n` +
        (m.aciklama ? `📝 *Not:* ${m.aciklama}` : '')

      // Mobilse: görsel varsa dosya + metin birlikte paylaş (OS share sheet destekliyor)
      if (mobilCihaz() && m.fotograf_url && navigator.canShare) {
        const response = await fetch(m.fotograf_url)
        const blob = await response.blob()
        const uzanti = blob.type.includes('pdf') ? 'pdf' : 'jpg'
        const dosyaAdi = m.baslik ? `${m.baslik.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${uzanti}` : `masraf_belgesi.${uzanti}`
        const file = new File([blob], dosyaAdi, { type: blob.type })
        if (navigator.canShare({ files: [file], text: metin })) {
          await navigator.share({ title: 'Masraf Belgesi', text: metin, files: [file] })
          return
        }
      }

      // Masaüstü veya görsel yoksa: metin + link olarak paylaş
      const metinVeLink = metin + (m.fotograf_url ? `\n🔗 Belge: ${m.fotograf_url}` : '')
      if (navigator.share) {
        await navigator.share({ title: 'Masraf Belgesi', text: metinVeLink })
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(metinVeLink), '_blank')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Paylaşım hatası:', err)
        alert('Paylaşım sırasında bir hata oluştu.')
      }
    }
  }

  const muhasebePaylasimGuncelle = async (id, deger) => {
    const { error } = await supabase.from('masraflar').update({ muhasebe_paylasim: deger }).eq('id', id)
    if (error) {
      alert("Durum güncellenirken veritabanı hatası oluştu. Lütfen sayfayı yenileyin.\nDetay: " + error.message)
      return
    }
    setMasraflar((onceki) => onceki.map((m) => m.id === id ? { ...m, muhasebe_paylasim: deger } : m))
  }

  const masrafEkle = async () => {
    if (!baslik.trim() || !tutar) return
    setYukleniyor(true)

    let finalCariId = secilenCariId
    if (!finalCariId && odenenKisi.trim()) {
      const isim = odenenKisi.trim()

      // Bayat local state yerine veritabanında canlı arama yap
      const { data: eslesenler } = await supabase
        .from('taseronlar')
        .select('*')
        .ilike('ad', isim)
        .limit(1)

      if (eslesenler && eslesenler.length > 0) {
        finalCariId = eslesenler[0].id
      } else {
        // Cari hesap hiç yoksa, gider eklerken otomatik oluştur
        const { data: yeniTaseron, error: yeniTaseronHata } = await supabase
          .from('taseronlar')
          .insert({ ad: isim, sef_gorunur: true })
          .select()
          .single()

        if (yeniTaseronHata) {
          console.error('Otomatik cari oluşturulamadı:', yeniTaseronHata.message)
        } else if (yeniTaseron) {
          finalCariId = yeniTaseron.id
          setTaseronlar((onceki) => [...onceki, yeniTaseron])
        }
      }
    }
    
    let finalDagilim = null
    if (cokluSantiyeAcik) {
      let toplamYuzde = 0
      for (const d of santiyeDagilimi) {
        toplamYuzde += Number(d.yuzde) || 0
        if (!d.santiye_id) { alert('Lütfen tüm şantiyeleri seçin.'); setYukleniyor(false); return }
      }
      if (toplamYuzde !== 100) {
        alert('Şantiye yüzdeleri toplamı 100 olmalıdır. (Şu anki: ' + toplamYuzde + ')')
        setYukleniyor(false)
        return
      }
      finalDagilim = santiyeDagilimi.map(d => ({ santiye_id: d.santiye_id, yuzde: Number(d.yuzde) }))
    }
    
    let fotografUrl = null
    if (fotograf) {
      const seciliSantiye = santiyeler.find((s) => s.id === secilenSantiyeId)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      
      const seciliYontem = odemeYontemleri.find((o) => o.id === odemeYontemiId)
      const yontemAdi = seciliYontem ? seciliYontem.ad : 'Diger'
      
      const folderName = `Masraflar/${santiyeAdi}/${yontemAdi}`
      const adSoyad = `${baslik.substring(0, 30)}-${odenenKisi || 'Bilinmiyor'}`

      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: fotograf,
          folderName,
          adSoyad,
          date: harcamaTarihi,
        })
        fotografUrl = driveSonuc.url
      } catch (err) {
        alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
        setYukleniyor(false)
        return
      }
    }

    const baseTutar = temizleTutar(tutar)
    const adet = (isKrediKarti && taksitSayisi > 1) ? parseInt(taksitSayisi) : 1
    
    let finalBaslik = baslik
    if (adet > 1) {
      finalBaslik = `${baslik} (${adet} Taksit)`
    }

    const eklenecekMasraf = {
      santiye_id: (cokluSantiyeAcik || secilenSantiyeId === 'genel') ? null : secilenSantiyeId,
      santiye_dagilimi: finalDagilim,
      kategori_id: kategoriId,
      baslik: finalBaslik,
      odenen_kisi: odenenKisi,
      cari_id: finalCariId || null,
      aciklama,
      tutar: baseTutar,
      taksit_sayisi: adet,
      odeme_yontemi_id: odemeYontemiId,
      harcama_tarihi: harcamaTarihi,
      fotograf_url: fotografUrl,
      ekleyen: profile?.id,
    }

    const { error } = await supabase.from('masraflar').insert([eklenecekMasraf])

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
    setTaksitSayisi(1)
    setFotograf(null)
    setHarcamaTarihi(bugun())
    setCokluSantiyeAcik(false)
    setSantiyeDagilimi([{ santiye_id: '', yuzde: '' }])
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
    setYukleniyor(false)
    masraflariYukle()
  }

  const masrafSil = async (id) => {
    if (!window.confirm('Bu masrafı silmek istediğinize emin misiniz?')) return
    const silinecek = masraflar.find((m) => m.id === id)
    if (silinecek?.fotograf_url) {
      try {
        const s = santiyeler.find(x => x.id === silinecek.santiye_id)
        const y = odemeYontemleri.find(x => x.id === silinecek.odeme_yontemi_id)
        const folderName = `Masraflar/${s ? s.ad : 'Genel'}/${y ? y.ad : 'Diger'}`
        await moveToSilinenler(silinecek.fotograf_url, folderName)
      } catch (e) {
        console.warn('Silinenlere taşıma hatası:', e)
      }
    }
    await supabase.from('masraflar').delete().eq('id', id)
    masraflariYukle()
  }

  const sonradanFotografEkle = async (id, file, mSantiyeId) => {
    if (!file) return
    setYukleniyor(true)
    
    const m = masraflar.find(x => x.id === id)
    const seciliSantiye = santiyeler.find((s) => s.id === (mSantiyeId || (m ? m.santiye_id : null)))
    const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
    const seciliYontem = odemeYontemleri.find((o) => o.id === (m ? m.odeme_yontemi_id : null))
    const yontemAdi = seciliYontem ? seciliYontem.ad : 'Diger'
    
    const folderName = `Masraflar/${santiyeAdi}/${yontemAdi}`
    const adSoyad = m ? `${m.baslik.substring(0, 30)}-${m.odenen_kisi || 'Bilinmiyor'}` : 'Sonradan_Eklenen_Belge'

    try {
      const driveSonuc = await uploadToGoogleDrive({
        file,
        folderName,
        adSoyad,
        date: m ? m.harcama_tarihi : bugun(),
      })
      await supabase.from('masraflar').update({ fotograf_url: driveSonuc.url }).eq('id', id)
      masraflariYukle()
    } catch (err) {
      alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
    }
    setDuzenlenenId(null)
  }

  const masrafDuzenle = async (id) => {
    if (!duzBaslik.trim() || !duzTutar) return
    const guncelTutar = temizleTutar(duzTutar)
    
    let finalDagilim = null
    if (duzCokluSantiyeAcik) {
      let toplamYuzde = 0
      for (const d of duzSantiyeDagilimi) {
        toplamYuzde += Number(d.yuzde) || 0
        if (!d.santiye_id) { alert('Lütfen tüm şantiyeleri seçin.'); return }
      }
      if (toplamYuzde !== 100) {
        alert('Şantiye yüzdeleri toplamı 100 olmalıdır. (Şu anki: ' + toplamYuzde + ')')
        return
      }
      finalDagilim = duzSantiyeDagilimi.map(d => ({ santiye_id: d.santiye_id, yuzde: Number(d.yuzde) }))
    }

    const { error } = await supabase.from('masraflar').update({
      baslik: duzBaslik,
      tutar: guncelTutar,
      harcama_tarihi: duzHarcamaTarihi,
      aciklama: duzAciklama,
      odenen_kisi: duzOdenenKisi,
      cari_id: duzCariId || null,
      kategori_id: duzKategoriId,
      odeme_yontemi_id: duzOdemeYontemiId,
      santiye_id: duzCokluSantiyeAcik ? null : (duzSantiyeId === 'genel' ? null : duzSantiyeId),
      santiye_dagilimi: finalDagilim
    }).eq('id', id)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenId(null)
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
          {/* YENİ MASRAF EKLEME ALANI (EN ÜSTTE) */}
          <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0F6E56', cursor: 'pointer' }}>
                <input type="checkbox" checked={cokluSantiyeAcik} onChange={(e) => setCokluSantiyeAcik(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#0F6E56' }} />
                Birden Fazla Şantiyeye Pay Et
              </label>
            </div>

            {!cokluSantiyeAcik ? (
              <select value={secilenSantiyeId} onChange={(e) => setSecilenSantiyeId(e.target.value)} className="santiye-secici-form">
                {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                <option value="genel">Genel Gider (şantiyeye bağlı değil)</option>
              </select>
            ) : (
              <div style={{ background: '#F8F7F2', border: '1px solid #D3D1C7', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px 0', color: '#2C3E50' }}>Şantiye Dağılımı (%100 Olmalıdır)</p>
                {santiyeDagilimi.map((dagilim, i) => (
                  <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
                    <select value={dagilim.santiye_id} onChange={(e) => {
                      const yeni = [...santiyeDagilimi]
                      yeni[i].santiye_id = e.target.value
                      setSantiyeDagilimi(yeni)
                    }} style={{ flex: 1, margin: 0 }}>
                      <option value="">Şantiye Seç...</option>
                      {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                    </select>
                    <input type="number" placeholder="% Yüzde" value={dagilim.yuzde} onChange={(e) => {
                      handleYuzdeDegisimi(santiyeDagilimi, setSantiyeDagilimi, i, e.target.value)
                    }} style={{ width: 80, margin: 0 }} onKeyDown={sadeceSayiTuslari} />
                    {santiyeDagilimi.length > 1 && (
                      <button onClick={() => setSantiyeDagilimi(santiyeDagilimi.filter((_, index) => index !== i))} style={{ padding: '0 8px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => handleSantiyeEkle(santiyeDagilimi, setSantiyeDagilimi)} style={{ fontSize: 11, padding: '6px 10px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 4 }}>
                  + Yeni Şantiye Ekle
                </button>
                <div style={{ fontSize: 11, marginTop: 6, color: santiyeDagilimi.reduce((acc, val) => acc + (Number(val.yuzde)||0), 0) === 100 ? '#0F6E56' : '#d9534f' }}>
                  Toplam: %{santiyeDagilimi.reduce((acc, val) => acc + (Number(val.yuzde)||0), 0)}
                </div>
              </div>
            )}
            
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
              <input type="text" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
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

            {isKrediKarti && (
              <div style={{ marginTop: 8, marginBottom: 8, padding: 8, background: '#FFF3E0', borderRadius: 6, border: '1px solid #FFE0B2' }}>
                <label style={{ fontSize: 12, fontWeight: 'bold', color: '#E65100', display: 'block', marginBottom: 4 }}>Taksit Sayısı (Kredi Kartı)</label>
                <select value={taksitSayisi} onChange={(e) => setTaksitSayisi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #FFCC80' }}>
                  <option value={1}>Peşin (Tek Çekim)</option>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} Taksit</option>)}
                </select>
                {taksitSayisi > 1 && tutar && (
                  <p style={{ fontSize: 11, color: '#E65100', marginTop: 4 }}>
                    Girdiğiniz işlem <b>{taksitSayisi} Taksit</b> olarak tek bir kayıt halinde işlenecektir.
                  </p>
                )}
              </div>
            )}

            {/* Dosya / Fotoğraf / Fatura Ekleme Inputu */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600 }}>Fiş / Fatura / Görsel Ekle (Opsiyonel):</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFotograf(e.target.files[0])}
                  style={{ fontSize: 12, padding: '6px 0', flex: 1 }}
                />
                <button type="button" onClick={panodanYapistir} style={{ padding: '6px 10px', background: '#e6f0ff', color: '#0056b3', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  📋 Yapıştır
                </button>
                {fotograf && (
                  <button onClick={() => setFotograf(null)} style={{ padding: '6px 10px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✕ Kaldır
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>💡 Görüntü kopyaladıktan sonra Ctrl+V ile de yapıştırabilirsiniz.</p>
              {fotograf && <p style={{ fontSize: 11, color: '#0F6E56', margin: 0 }}>✓ Seçilen: {fotograf.name}</p>}
            </div>

            <button className="ekle-buton-genis" onClick={masrafEkle} disabled={yukleniyor}>
              {yukleniyor ? 'Ekleniyor...' : 'Masrafı kaydet'}
            </button>
          </div>

          {/* FİLTRE VE SIRALAMA ALANI */}
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

              <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Cari Hesap Filtresi</p>
              <select value={filtreCari} onChange={(e) => setFiltreCari(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
                <option value="hepsi">Tüm Cari Hesaplar</option>
                {[...taseronlar].sort((a, b) => a.ad.localeCompare(b.ad)).map(t => (
                  <option key={t.id} value={t.id}>{t.ad}</option>
                ))}
                <option value="yok">Cari Hesabı Olmayanlar</option>
              </select>

              <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Tarih Aralığı (Gerçekleşme Tarihi)</p>
              <div className="ekleme-satiri-2">
                <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} />
                <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} />
              </div>
              {(filtreBaslangic || filtreBitis) && (
                <button
                  onClick={() => { setFiltreBaslangic(''); setFiltreBitis('') }}
                  style={{ marginTop: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#0F6E56', cursor: 'pointer', padding: 0 }}
                >
                  Tarih filtresini temizle
                </button>
              )}
            </div>
          )}

          {/* LİSTE / AKIŞ ALANI */}
          <div className="liste">
            {islenecekListe.map((m) => (
              <div key={m.id} className="kart">
                {duzenlenenId === m.id && yonetici ? (
                  /* DÜZENLEME MODU */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ marginBottom: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0F6E56', cursor: 'pointer' }}>
                        <input type="checkbox" checked={duzCokluSantiyeAcik} onChange={(e) => setDuzCokluSantiyeAcik(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#0F6E56' }} />
                        Birden Fazla Şantiyeye Pay Et
                      </label>
                    </div>

                    {!duzCokluSantiyeAcik ? (
                      <select value={duzSantiyeId} onChange={(e) => setDuzSantiyeId(e.target.value)}>
                        <option value="genel">Genel Gider (şantiyeye bağlı değil)</option>
                        {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                      </select>
                    ) : (
                      <div style={{ background: '#F8F7F2', border: '1px solid #D3D1C7', padding: 10, borderRadius: 8, marginBottom: 10 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px 0', color: '#2C3E50' }}>Şantiye Dağılımı (%100 Olmalıdır)</p>
                        {duzSantiyeDagilimi.map((dagilim, i) => (
                          <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
                            <select value={dagilim.santiye_id} onChange={(e) => {
                              const yeni = [...duzSantiyeDagilimi]
                              yeni[i].santiye_id = e.target.value
                              setDuzSantiyeDagilimi(yeni)
                            }} style={{ flex: 1, margin: 0 }}>
                              <option value="">Şantiye Seç...</option>
                              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                            </select>
                            <input type="number" placeholder="% Yüzde" value={dagilim.yuzde} onChange={(e) => {
                              handleYuzdeDegisimi(duzSantiyeDagilimi, setDuzSantiyeDagilimi, i, e.target.value)
                            }} style={{ width: 80, margin: 0 }} onKeyDown={sadeceSayiTuslari} />
                            {duzSantiyeDagilimi.length > 1 && (
                              <button onClick={() => setDuzSantiyeDagilimi(duzSantiyeDagilimi.filter((_, index) => index !== i))} style={{ padding: '0 8px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => handleSantiyeEkle(duzSantiyeDagilimi, setDuzSantiyeDagilimi)} style={{ fontSize: 11, padding: '6px 10px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 4 }}>
                          + Yeni Şantiye Ekle
                        </button>
                        <div style={{ fontSize: 11, marginTop: 6, color: duzSantiyeDagilimi.reduce((acc, val) => acc + (Number(val.yuzde)||0), 0) === 100 ? '#0F6E56' : '#d9534f' }}>
                          Toplam: %{duzSantiyeDagilimi.reduce((acc, val) => acc + (Number(val.yuzde)||0), 0)}
                        </div>
                      </div>
                    )}
                    <input type="text" value={duzBaslik} onChange={(e) => setDuzBaslik(e.target.value)} placeholder="Masraf başlığı" />
                    <CariAramaSecici
                      deger={duzOdenenKisi}
                      onDegisti={(isim, id) => {
                        setDuzOdenenKisi(isim)
                        setDuzCariId(id || null)
                      }}
                      placeholder="Ödenen Kişi / Cari (opsiyonel)..."
                    />
                    <div className="ekleme-satiri-2">
                      <select value={duzKategoriId} onChange={(e) => setDuzKategoriId(e.target.value)}>
                        <option value="">Kategori...</option>
                        {kategoriler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                      </select>
                      <input type="text" placeholder="Tutar (₺)" value={duzTutar} onChange={(e) => setDuzTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
                      <input type="date" value={duzHarcamaTarihi} onChange={(e) => setDuzHarcamaTarihi(e.target.value)} />
                    </div>
                    <div className="ekleme-satiri-2">
                      <select value={duzKategoriId} onChange={(e) => setDuzKategoriId(e.target.value)}>
                        {kategoriler.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                      </select>
                      <select value={duzOdemeYontemiId} onChange={(e) => setDuzOdemeYontemiId(e.target.value)}>
                        {odemeYontemleri.map((o) => <option key={o.id} value={o.id}>{o.ad}</option>)}
                      </select>
                    </div>
                    <textarea value={duzAciklama} onChange={(e) => setDuzAciklama(e.target.value)} placeholder="Açıklama" rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setDuzenlenenId(null)} style={{ flex: 1, padding: '8px', background: '#f0f0ed', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Vazgeç</button>
                      <button onClick={() => masrafDuzenle(m.id)} style={{ flex: 1, padding: '8px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Kaydet</button>
                    </div>
                  </div>
                ) : (
                  /* NORMAL GÖRÜNÜM */
                  <>
                    <div className="kart-ust">
                      <span className="kart-baslik">{m.baslik}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="kart-tutar">{paraFormatla(m.tutar)} ₺</span>
                        {yonetici && (
                          <button className="sil-buton" onClick={() => {
                            setDuzenlenenId(m.id)
                            setDuzBaslik(m.baslik)
                            setDuzTutar(formatInputTutar(m.tutar))
                            setDuzHarcamaTarihi(m.harcama_tarihi)
                            setDuzAciklama(m.aciklama || '')
                            setDuzOdenenKisi(m.odenen_kisi || '')
                            setDuzCariId(m.cari_id || null)
                            setDuzKategoriId(m.kategori_id)
                            setDuzOdemeYontemiId(m.odeme_yontemi_id)
                            setDuzSantiyeId(m.santiye_id || 'genel')
                            if (m.santiye_dagilimi && m.santiye_dagilimi.length > 0) {
                              setDuzCokluSantiyeAcik(true)
                              setDuzSantiyeDagilimi(m.santiye_dagilimi)
                            } else {
                              setDuzCokluSantiyeAcik(false)
                              setDuzSantiyeDagilimi([{ santiye_id: '', yuzde: '' }])
                            }
                          }} aria-label="Düzenle">✎</button>
                        )}
                        <input
                          type="file"
                          id={`gorsel-sec-msf-${m.id}`}
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => sonradanFotografEkle(m.id, e.target.files[0], m.santiye_id)}
                        />
                        <button className="sil-buton" onClick={() => document.getElementById(`gorsel-sec-msf-${m.id}`).click()} aria-label="Görsel Ekle/Değiştir" title="Görsel Ekle/Değiştir">🖼️</button>
                        <button className="sil-buton" onClick={() => masrafSil(m.id)} aria-label="Masrafı sil">🗑</button>
                      </div>
                    </div>
                    <div className="etiket-satiri">
                      <span className="etiket etiket-vurgu">
                        {m.santiye_dagilimi && m.santiye_dagilimi.length > 0 
                          ? m.santiye_dagilimi.map(d => `${santiyeler.find(s => s.id === d.santiye_id)?.ad || 'Bilinmeyen'} (%${d.yuzde})`).join(', ')
                          : (m.santiye_id ? (santiyeler.find((s) => s.id === m.santiye_id)?.ad || 'Şantiye') : 'Genel Gider')}
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
    
                    {/* Fotoğraf/Belge Gösterimi */}
                    {m.fotograf_url && (
                      <div style={{ marginTop: 8 }}>
                        <a href={getGoogleDriveViewUrl(m.fotograf_url)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getGoogleDriveInlineImageUrl(m.fotograf_url)}
                            alt="Masraf Görseli"
                            style={{
                              width: '100%',
                              maxHeight: 180,
                              objectFit: 'cover',
                              borderRadius: 8,
                              border: '1px solid #ddd'
                            }}
                            onError={(e) => {
                              // Eğer resim yüklenemezse (PDF vb.)
                              e.target.style.display = 'none'
                              if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'
                            }}
                          />
                          <div style={{ display: 'none', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#F1EFE8', borderRadius: 6, color: '#2C3E50', fontWeight: 500, fontSize: 13, border: '1px solid #D3D1C7' }}>
                            📄 Belgeyi Görüntüle
                          </div>
                        </a>
                      </div>
                    )}
    
                    {/* WhatsApp ile Görsel ve Metin Gönderme Butonu */}
                    {/* Muhasebe Paylaşım Kutucuğu */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 10,
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: m.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
                      border: `1px solid ${m.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: m.muhasebe_paylasim ? '#0B6B41' : '#F57F17',
                      transition: 'all 0.2s'
                    }}>
                      <input
                        type="checkbox"
                        checked={m.muhasebe_paylasim || false}
                        onChange={(e) => muhasebePaylasimGuncelle(m.id, e.target.checked)}
                        style={{ accentColor: '#4CAF50', width: 16, height: 16 }}
                      />
                      {m.muhasebe_paylasim ? '✓ Muhasebeye gönderildi' : 'Muhasebe ile paylaşıldı mı?'}
                    </label>
    
                    <button
                      className="ekle-buton-genis"
                      onClick={() => whatsappGorselliPaylas(m)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', fontSize: 12 }}
                    >
                      💬 WhatsApp ile Paylaş
                    </button>
                  </>
                )}
              </div>
            ))}
            {islenecekListe.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
          </div>
        </>
      )}
    </div>
  )
}