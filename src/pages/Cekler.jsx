import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'
import { uploadToGoogleDrive, moveToSilinenler, getGoogleDriveInlineImageUrl, getGoogleDriveViewUrl } from '../lib/googleDrive'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Cekler({ yon = 'verilen' }) {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [cekler, setCekler] = useState([])
  const [bankalar, setBankalar] = useState([])
  const [taseronlar, setTaseronlar] = useState([])
  const [malikler, setMalikler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  // Ciro işlemleri için state'ler
  const [islemTuru, setIslemTuru] = useState('yeni') // 'yeni' | 'ciro'
  const [alinanCeklerListesi, setAlinanCeklerListesi] = useState([])
  const [secilenCiroCekId, setSecilenCiroCekId] = useState('')
  const [secilenCiroBelgeUrl, setSecilenCiroBelgeUrl] = useState('')
  const [kalanCekSayisi, setKalanCekSayisi] = useState(0)
  const [toplamCekSayisi, setToplamCekSayisi] = useState(0)

  // Düzenleme State'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)

  // Filtre ve Sıralama State'leri
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtreCari, setFiltreCari] = useState('hepsi')
  const [filtreBaslangic, setFiltreBaslangic] = useState('')
  const [filtreBitis, setFiltreBitis] = useState('')
  const [filtrelerAcik, setFiltrelerAcik] = useState(false)
  const [siralamaYonu, setSiralamaYonu] = useState('eklenme_yeni') // 'eklenme_yeni' | 'vade_yakin' | 'vade_uzak'

  const [odemeKonusu, setOdemeKonusu] = useState('')
  const [santiyeId, setSantiyeId] = useState('')
  const [odeyen, setOdeyen] = useState('')
  const [malikId, setMalikId] = useState('')
  const [odenen, setOdenen] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [cekSeriNo, setCekSeriNo] = useState('')
  const [banka, setBanka] = useState('')
  const [yeniBankaAcik, setYeniBankaAcik] = useState(false)
  const [yeniBankaAdi, setYeniBankaAdi] = useState('')
  const [verilisTarihi, setVerilisTarihi] = useState(bugun())
  const [cekVadesi, setCekVadesi] = useState('')
  const [tutar, setTutar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [belge, setBelge] = useState(null)
  const [cokluSantiyeAcik, setCokluSantiyeAcik] = useState(false)
  const [santiyeDagilimi, setSantiyeDagilimi] = useState([{ santiye_id: '', yuzde: '' }])
  const [duzCokluSantiyeAcik, setDuzCokluSantiyeAcik] = useState(false)
  const [duzSantiyeDagilimi, setDuzSantiyeDagilimi] = useState([])

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

  useEffect(() => {
    cekleriYukle()
    bankalariYukle()
    
    supabase.from('taseronlar').select('*').then(({ data }) => {
      setTaseronlar(data || [])
    })
    
    supabase.from('malikler').select('*').order('ad_soyad').then(({ data }) => {
      setMalikler(data || [])
    })

    if (yon === 'verilen') {
      alinanCekleriYukle()
    }

    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const yeniDosya = new File([file], `pano_gorseli_${Date.now()}.png`, { type: file.type })
            setBelge(yeniDosya)
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
            setBelge(file)
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

  const alinanCekleriYukle = async () => {
    // Hem alınan hem verilen tüm çekleri çek ki ciro eşleştirmesi yapabilelim
    const { data } = await supabase.from('cekler').select('*')
    if (!data) return
    
    // Verilen ve ciro edilen çeklerin seri numaralarını topla
    const ciroEdilenSeriNolar = data
      .filter(c => c.yon === 'verilen' && c.aciklama && c.aciklama.includes('(Ciro Edildi)'))
      .map(c => c.cek_seri_no)
      .filter(Boolean) // Boş seri noları at

    const tumAlinanlar = data.filter(c => c.yon === 'alinan')
    const kalanAlinanlar = tumAlinanlar
      .filter(c => !c.cek_seri_no || !ciroEdilenSeriNolar.includes(c.cek_seri_no))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    setAlinanCeklerListesi(kalanAlinanlar)
    setToplamCekSayisi(tumAlinanlar.length)
    setKalanCekSayisi(kalanAlinanlar.length)
  }

  const cekleriYukle = async () => {
    let query = supabase.from('cekler').select('*, santiyeler(ad), profiles(ad_soyad)').order('created_at', { ascending: false })
    const { data, error } = await query
    if (error) { alert('Çekler yüklenemedi: ' + error.message); return }
    const filtrelenmis = (data || []).filter(c => {
      if (yon === 'verilen') return c.yon === 'verilen' || !c.yon
      return c.yon === 'alinan'
    })
    setCekler(filtrelenmis)
  }

  const bankalariYukle = async () => {
    const { data } = await supabase.from('cek_bankalari').select('*').order('ad')
    setBankalar(data || [])
    if (data?.length && !banka) setBanka(data[0].ad)
  }

  const bankaEkle = async () => {
    if (!yeniBankaAdi.trim()) return
    const { data, error } = await supabase.from('cek_bankalari').insert({ ad: yeniBankaAdi }).select().single()
    if (error) { alert('Banka eklenemedi: ' + error.message); return }
    setBankalar((onceki) => [...onceki, data].sort((a, b) => a.ad.localeCompare(b.ad)))
    setBanka(data.ad)
    setYeniBankaAdi('')
    setYeniBankaAcik(false)
  }

  const formuSifirla = () => {
    setOdemeKonusu('')
    setSantiyeId('')
    setOdeyen('')
    setMalikId('')
    setOdenen('')
    setSecilenCariId(null)
    setCekSeriNo('')
    setCekVadesi('')
    setTutar('')
    setAciklama('')
    setBelge(null)
    setVerilisTarihi(bugun())
    setDuzenlenenId(null)
    setIslemTuru('yeni')
    setSecilenCiroCekId('')
    setSecilenCiroBelgeUrl('')
    setCokluSantiyeAcik(false)
    setSantiyeDagilimi([{ santiye_id: '', yuzde: '' }])
  }

  const duzenlemeyiBaslat = (c) => {
    setDuzenlenenId(c.id)
    setOdemeKonusu(c.odeme_konusu || '')
    setSantiyeId(c.santiye_id || '')
    setOdeyen(c.odeyen || '')
    setOdenen(c.odenen || '')
    setSecilenCariId(c.cari_id || null)
    setCekSeriNo(c.cek_seri_no || '')
    setBanka(c.banka || (bankalar[0]?.ad ?? ''))
    setYeniBankaAcik(false)
    setVerilisTarihi(c.verilis_tarihi ? c.verilis_tarihi.slice(0, 10) : bugun())
    setCekVadesi(c.cek_vadesi ? c.cek_vadesi.slice(0, 10) : '')
    setAciklama(c.aciklama || '')
    setBelge(null)
    if (c.santiye_dagilimi && c.santiye_dagilimi.length > 0) {
      setDuzCokluSantiyeAcik(true)
      setDuzSantiyeDagilimi(c.santiye_dagilimi)
    } else {
      setDuzCokluSantiyeAcik(false)
      setDuzSantiyeDagilimi([{ santiye_id: '', yuzde: '' }])
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const malikSecildi = (id) => {
    setMalikId(id)
    const m = malikler.find((x) => x.id === id)
    if (m) setOdeyen(m.ad_soyad)
  }

  const cariSecildi = (isim, cariId) => {
    setOdeyen(isim)
    setSecilenCariId(cariId || null)
  }

  const malikleriSantiyeyeGoreFiltrele = (sId) => malikler.filter((m) => m.santiye_id === sId)

  const cekKaydetVeyaGuncelle = async () => {
    if (!odemeKonusu.trim() || !tutar) { alert('Ödeme konusu ve tutar zorunludur.'); return }
    setYukleniyor(true)

    let finalCariId = secilenCariId
    if (!finalCariId && odenen.trim()) {
      const bulunan = taseronlar.find(t => t.ad.toLowerCase() === odenen.trim().toLowerCase() || (t.firma && t.firma.toLowerCase() === odenen.trim().toLowerCase()))
      if (bulunan) {
        finalCariId = bulunan.id
      }
    }

    let belgeUrl = null
    // Mevcut kaydı güncelliyorsak ve yeni belge seçilmediyse eski belgeyi koruyabiliriz
    if (belge) {
      const seciliSantiye = santiyeler.find((s) => s.id === santiyeId)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      const islem = islemTuru === 'ciro' ? 'Ciro Edilen Çek' : (yon === 'alinan' ? 'Alınan Çek' : 'Verilen Çek')
      const folderName = `Cekler/${santiyeAdi}/${islem}`
      
      const kisaKonu = odemeKonusu ? odemeKonusu.substring(0, 20) : 'Cek'
      const firmaKisi = odenen || odeyen || 'Bilinmiyor'
      const adSoyad = `${kisaKonu}-${firmaKisi}`

      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: belge,
          folderName,
          adSoyad,
          date: verilisTarihi,
        })
        belgeUrl = driveSonuc.url
      } catch (err) {
        alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
        setYukleniyor(false)
        return
      }
    } else if (islemTuru === 'ciro' && secilenCiroBelgeUrl) {
      belgeUrl = secilenCiroBelgeUrl
    }
    let finalDagilim = null
    const isDuz = !!duzenlenenId
    const acikMi = isDuz ? duzCokluSantiyeAcik : cokluSantiyeAcik
    const dagilimListe = isDuz ? duzSantiyeDagilimi : santiyeDagilimi

    if (acikMi) {
      let toplamYuzde = 0
      for (const d of dagilimListe) {
        toplamYuzde += Number(d.yuzde) || 0
        if (!d.santiye_id) { alert('Lütfen tüm şantiyeleri seçin.'); setYukleniyor(false); return }
      }
      if (toplamYuzde !== 100) {
        alert('Şantiye yüzdeleri toplamı 100 olmalıdır. (Şu anki: ' + toplamYuzde + ')')
        setYukleniyor(false)
        return
      }
      finalDagilim = dagilimListe.map(d => ({ santiye_id: d.santiye_id, yuzde: Number(d.yuzde) }))
    }

    const veri = {
      odeme_konusu: odemeKonusu,
      santiye_id: (acikMi || santiyeId === 'genel') ? null : (santiyeId || null),
      santiye_dagilimi: finalDagilim,
      odeyen,
      odenen,
      cari_id: finalCariId || null,
      cek_seri_no: cekSeriNo,
      banka,
      verilis_tarihi: verilisTarihi,
      cek_vadesi: cekVadesi || null,
      tutar: temizleTutar(tutar),
      aciklama: islemTuru === 'ciro' ? (aciklama ? `(Ciro Edildi) ${aciklama}` : '(Ciro Edildi)') : aciklama,
      yon,
      ...(belgeUrl ? { belge_url: belgeUrl } : {}),
      ...(!duzenlenenId ? { ekleyen: profile?.id } : {})
    }

    if (duzenlenenId) {
      const { error } = await supabase.from('cekler').update(veri).eq('id', duzenlenenId)
      if (error) { alert('Çek güncellenemedi: ' + error.message); setYukleniyor(false); return }
    } else {
      const { error } = await supabase.from('cekler').insert(veri)
      if (error) { alert('Çek eklenemedi: ' + error.message); setYukleniyor(false); return }
    }

    formuSifirla()
    setYukleniyor(false)
    cekleriYukle()
  }

  const cekSil = async (id) => {
    if (!window.confirm('Bu çek kaydını silmek istediğinize emin misiniz?')) return
    
    const silinecek = cekler.find((c) => c.id === id)
    if (silinecek?.belge_url) {
      try {
        const seciliSantiye = santiyeler.find((s) => s.id === silinecek.santiye_id)
        const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
        const islem = yon === 'alinan' ? 'Alınan Çek' : 'Verilen Çek' // Silinen çek ciro edilmişse bile kökenine göre dosyalanabilir
        const folderName = `Cekler/${santiyeAdi}/${islem}`
        await moveToSilinenler(silinecek.belge_url, folderName)
      } catch (e) {
        console.warn('Silinenlere taşıma hatası:', e)
      }
    }

    await supabase.from('cekler').delete().eq('id', id)
    cekleriYukle()
  }

  const sonradanBelgeEkle = async (c, file) => {
    if (!file) return
    setYukleniyor(true)
    
    const seciliSantiye = santiyeler.find((s) => s.id === c.santiye_id)
    const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
    const islem = yon === 'alinan' ? 'Alınan Çek' : 'Verilen Çek'
    const folderName = `Cekler/${santiyeAdi}/${islem}`
    
    const kisaKonu = c.odeme_konusu ? c.odeme_konusu.substring(0, 20) : 'Cek'
    const firmaKisi = c.odenen || c.odeyen || 'Bilinmiyor'
    const adSoyad = `${kisaKonu}-${firmaKisi}`

    try {
      const driveSonuc = await uploadToGoogleDrive({
        file,
        folderName,
        adSoyad,
        date: c.verilis_tarihi || bugun(),
      })
      await supabase.from('cekler').update({ belge_url: driveSonuc.url }).eq('id', c.id)
      cekleriYukle()
    } catch (err) {
      alert('Belge Google Drive\'a yüklenemedi: ' + err.message)
    }
    setYukleniyor(false)
  }

  // Mobil mi masaüstü mü tespiti
  const mobilCihaz = () => navigator.maxTouchPoints > 0

  // WhatsApp ile Görsel ve Metin Paylaşım Fonksiyonu
  const cekPaylas = async (c) => {
    try {
      let santiyeMetni = ''
      if (c.santiye_dagilimi && c.santiye_dagilimi.length > 0) {
        santiyeMetni = '\n' + c.santiye_dagilimi.map((d, index) => {
          const s = santiyeler.find(x => x.id === d.santiye_id)
          return `-${index + 1}- ${s ? s.ad : 'Bilinmeyen'} % ${d.yuzde}`
        }).join('\n')
      } else {
        santiyeMetni = c.santiye_id ? (santiyeler.find((s) => s.id === c.santiye_id)?.ad || 'Şantiye') : 'Genel'
      }

      const metin =
        `💳 *ÇEK / ÖDEME BİLDİRİMİ*\n` +
        `📌 *Konu:* ${c.odeme_konusu}\n` +
        `🏗 *Şantiye:* ${santiyeMetni}\n` +
        `💵 *Tutar:* ${paraFormatla(c.tutar)} ₺\n` +
        `🏦 *Banka:* ${c.banka || '—'}\n` +
        `🔢 *Seri No:* ${c.cek_seri_no || '—'}\n` +
        (c.odeyen ? `👤 *Ödeyen:* ${c.odeyen}\n` : '') +
        (c.odenen ? `👤 *Ödenen:* ${c.odenen}\n` : '') +
        `📅 *Veriliş:* ${new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}\n` +
        `⏳ *Vade:* ${c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}\n` +
        (c.aciklama ? `📝 *Not:* ${c.aciklama}` : '')

      // Mobilse: belge varsa dosya + metin birlikte paylaş
      if (mobilCihaz() && c.belge_url && navigator.canShare) {
        const response = await fetch(c.belge_url)
        const blob = await response.blob()
        const uzanti = blob.type.includes('pdf') ? 'pdf' : 'jpg'
        const dosyaAdi = c.odeme_konusu ? `${c.odeme_konusu.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${uzanti}` : `cek_belgesi.${uzanti}`
        const file = new File([blob], dosyaAdi, { type: blob.type })
        if (navigator.canShare({ files: [file], text: metin })) {
          await navigator.share({ title: 'Çek Belgesi', text: metin, files: [file] })
          return
        }
      }

      // Masaüstü veya belge yoksa: metin + link olarak paylaş
      const metinVeLink = metin + (c.belge_url ? `\n🔗 Belge: ${c.belge_url}` : '')
      if (navigator.share) {
        await navigator.share({ title: 'Çek Belgesi', text: metinVeLink })
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
    const { error } = await supabase.from('cekler').update({ muhasebe_paylasim: deger }).eq('id', id)
    if (error) {
      alert("Durum güncellenirken veritabanı hatası oluştu. Lütfen sayfayı yenileyin.\nDetay: " + error.message)
      return
    }
    setCekler((onceki) => onceki.map((c) => c.id === id ? { ...c, muhasebe_paylasim: deger } : c))
  }

  // Filtreleme ve Sıralama Mantığı
  const filtrelenmisCekler = cekler
    .filter(c => filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye)
    .filter(c => filtreBanka === 'hepsi' || c.banka === filtreBanka)
    .filter(c => filtreCari === 'hepsi' || (filtreCari === 'yok' ? !c.cari_id : c.cari_id === filtreCari))
    .filter(c => {
      if (!filtreBaslangic && !filtreBitis) return true
      if (!c.verilis_tarihi) return false
      if (filtreBaslangic && c.verilis_tarihi < filtreBaslangic) return false
      if (filtreBitis && c.verilis_tarihi > filtreBitis) return false
      return true
    })

  const siraliCekler = [...filtrelenmisCekler].sort((a, b) => {
    if (siralamaYonu === 'eklenme_yeni') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    } else if (siralamaYonu === 'vade_yakin') {
      const tarihA = a.cek_vadesi ? new Date(a.cek_vadesi) : new Date(8640000000000000)
      const tarihB = b.cek_vadesi ? new Date(b.cek_vadesi) : new Date(8640000000000000)
      return tarihA - tarihB
    } else {
      const tarihA = a.cek_vadesi ? new Date(a.cek_vadesi) : new Date(0)
      const tarihB = b.cek_vadesi ? new Date(b.cek_vadesi) : new Date(0)
      return tarihB - tarihA
    }
  })

  const aktifFiltreSayisi = [
    filtreSantiye !== 'hepsi',
    filtreBanka !== 'hepsi'
  ].filter(Boolean).length

  const siralamaMetni = 
    siralamaYonu === 'eklenme_yeni' ? 'Sıralama: Eklenme Tarihi (Yeni → Eski)' :
    siralamaYonu === 'vade_yakin' ? 'Sıralama: Vade (Yakından Uzağa)' : 'Sıralama: Vade (Uzaktan Yakına)'

  return (
    <div>
      {/* YENİ ÇEK EKLEME VEYA DÜZENLEME ALANI (EN ÜSTTE) */}
      <div className="ekleme-kutusu" style={{ marginBottom: 16, border: duzenlenenId ? '2px solid #0F6E56' : '1px solid #d3d1c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0, color: duzenlenenId ? '#0F6E56' : '#333' }}>
            {duzenlenenId ? '✏️ Çek Kaydını Düzenliyorsunuz' : '➕ Yeni Çek Ekle'}
          </h3>
          {duzenlenenId && (
            <button onClick={formuSifirla} style={{ background: '#D64545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
              Düzenlemeden Çık
            </button>
          )}
        </div>

        {!duzenlenenId && yon === 'verilen' && (
          <div className="gorunum-secici" style={{ marginBottom: 12 }}>
            <button type="button" className={islemTuru === 'yeni' ? 'secili-tab' : ''} onClick={() => { setIslemTuru('yeni'); setSecilenCiroCekId('') }}>
              Kendi Çekimizi Kes
            </button>
            <button type="button" className={islemTuru === 'ciro' ? 'secili-tab' : ''} onClick={() => setIslemTuru('ciro')}>
              Alınan Çeki Ciro Et (Devret)
            </button>
          </div>
        )}

        {islemTuru === 'ciro' && (
          <div style={{ marginBottom: 12, padding: 10, backgroundColor: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#F57F17', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ciro edilecek alınan çeki seçin:</span>
              <span style={{ background: '#FFD54F', color: '#8A5A00', padding: '2px 6px', borderRadius: 10, fontSize: 11 }}>
                Kalan: {kalanCekSayisi} / {toplamCekSayisi}
              </span>
            </label>
            <select 
              value={secilenCiroCekId} 
              onChange={(e) => {
                const secilenId = e.target.value
                setSecilenCiroCekId(secilenId)
                const secilenCek = alinanCeklerListesi.find(c => c.id === secilenId)
                if (secilenCek) {
                  setOdemeKonusu('Ödeme')
                  setCekSeriNo(secilenCek.cek_seri_no || '')
                  setCekVadesi(secilenCek.cek_vadesi ? secilenCek.cek_vadesi.slice(0, 10) : '')
                  setTutar(secilenCek.tutar ? formatInputTutar(secilenCek.tutar) : '')
                  setSecilenCiroBelgeUrl(secilenCek.belge_url || '')
                } else {
                  formuSifirla()
                  setIslemTuru('ciro')
                }
              }}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #FFD54F' }}
            >
              <option value="">-- Alınan Çek Seç --</option>
              {alinanCeklerListesi.map(c => (
                <option key={c.id} value={c.id}>
                  {c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : ''} Vadeli - {c.banka} - {paraFormatla(c.tutar)} ₺ ({c.odeyen || 'Bilinmiyor'})
                </option>
              ))}
            </select>
          </div>
        )}

        <input type="text" placeholder="Ödeme konusu..." value={odemeKonusu} onChange={(e) => setOdemeKonusu(e.target.value)} />

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#0F6E56', cursor: 'pointer' }}>
            <input type="checkbox" checked={duzenlenenId ? duzCokluSantiyeAcik : cokluSantiyeAcik} onChange={(e) => {
              if (duzenlenenId) setDuzCokluSantiyeAcik(e.target.checked)
              else setCokluSantiyeAcik(e.target.checked)
            }} style={{ width: 14, height: 14, accentColor: '#0F6E56' }} />
            Birden Fazla Şantiyeye Pay Et
          </label>
        </div>

        {!(duzenlenenId ? duzCokluSantiyeAcik : cokluSantiyeAcik) ? (
          <select value={santiyeId} onChange={(e) => { setSantiyeId(e.target.value); setMalikId('') }}>
            <option value="">Şantiye seç (opsiyonel)</option>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        ) : (
          <div style={{ background: '#F8F7F2', border: '1px solid #D3D1C7', padding: 10, borderRadius: 8, marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px 0', color: '#2C3E50' }}>Şantiye Dağılımı (%100 Olmalıdır)</p>
            {(duzenlenenId ? duzSantiyeDagilimi : santiyeDagilimi).map((dagilim, i) => (
              <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
                <select value={dagilim.santiye_id} onChange={(e) => {
                  if (duzenlenenId) {
                    const yeni = [...duzSantiyeDagilimi]; yeni[i].santiye_id = e.target.value; setDuzSantiyeDagilimi(yeni);
                  } else {
                    const yeni = [...santiyeDagilimi]; yeni[i].santiye_id = e.target.value; setSantiyeDagilimi(yeni);
                  }
                }} style={{ flex: 1, margin: 0 }}>
                  <option value="">Şantiye Seç...</option>
                  {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
                <input type="number" placeholder="% Yüzde" value={dagilim.yuzde} onChange={(e) => {
                  if (duzenlenenId) {
                    handleYuzdeDegisimi(duzSantiyeDagilimi, setDuzSantiyeDagilimi, i, e.target.value)
                  } else {
                    handleYuzdeDegisimi(santiyeDagilimi, setSantiyeDagilimi, i, e.target.value)
                  }
                }} style={{ width: 80, margin: 0 }} onKeyDown={sadeceSayiTuslari} />
                {(duzenlenenId ? duzSantiyeDagilimi : santiyeDagilimi).length > 1 && (
                  <button onClick={() => {
                    if (duzenlenenId) setDuzSantiyeDagilimi(duzSantiyeDagilimi.filter((_, index) => index !== i))
                    else setSantiyeDagilimi(santiyeDagilimi.filter((_, index) => index !== i))
                  }} style={{ padding: '0 8px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={() => {
              if (duzenlenenId) handleSantiyeEkle(duzSantiyeDagilimi, setDuzSantiyeDagilimi)
              else handleSantiyeEkle(santiyeDagilimi, setSantiyeDagilimi)
            }} style={{ fontSize: 11, padding: '6px 10px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 4 }}>
              + Yeni Şantiye Ekle
            </button>
            <div style={{ fontSize: 11, marginTop: 6, color: (duzenlenenId ? duzSantiyeDagilimi : santiyeDagilimi).reduce((acc, val) => acc + (Number(val.yuzde)||0), 0) === 100 ? '#0F6E56' : '#d9534f' }}>
              Toplam: %{(duzenlenenId ? duzSantiyeDagilimi : santiyeDagilimi).reduce((acc, val) => acc + (Number(val.yuzde)||0), 0)}
            </div>
          </div>
        )}

        {yon === 'alinan' ? (
          <>
            <select value={malikId} onChange={(e) => malikSecildi(e.target.value)}>
              <option value="">Malik seç (opsiyonel)...</option>
              {malikleriSantiyeyeGoreFiltrele(santiyeId).map((m) => <option key={m.id} value={m.id}>{m.ad_soyad}</option>)}
            </select>
            <div className="ekleme-satiri-2">
              <CariAramaSecici 
                deger={odeyen} 
                onDegisti={cariSecildi} 
                placeholder="Cari / Ortak Ara (opsiyonel)..." 
              />
              <input type="text" placeholder="Ödeyen kişi/firma..." value={odeyen} onChange={(e) => setOdeyen(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="ekleme-satiri-2">
            <input type="text" placeholder="Ödeyen" value={odeyen} onChange={(e) => setOdeyen(e.target.value)} />
            
            <CariAramaSecici 
              deger={odenen} 
              onDegisti={(isim, cariId) => { 
                setOdenen(isim)
                setSecilenCariId(cariId || null) 
              }} 
              placeholder="Ödenen kişi/firma..." 
            />
          </div>
        )}

        <input type="text" placeholder="Çek seri no..." value={cekSeriNo} onChange={(e) => setCekSeriNo(e.target.value)} />

        {!yeniBankaAcik ? (
          <div className="ekleme-satiri-2">
            <select value={banka} onChange={(e) => setBanka(e.target.value)}>
              <option value="">-- Banka Seç --</option>
              {bankalar.map((b) => <option key={b.id} value={b.ad}>{b.ad}</option>)}
              {banka && !bankalar.find(b => b.ad === banka) && (
                <option value={banka}>{banka}</option>
              )}
            </select>
            <button onClick={() => setYeniBankaAcik(true)}>+ Banka ekle</button>
          </div>
        ) : (
          <div className="ekleme-satiri-2">
            <input type="text" placeholder="Yeni banka adı" value={yeniBankaAdi} onChange={(e) => setYeniBankaAdi(e.target.value)} />
            <button onClick={bankaEkle}>Kaydet</button>
          </div>
        )}

        <div className="ekleme-satiri-2">
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A' }}>Veriliş tarihi</label>
            <input type="date" value={verilisTarihi} onChange={(e) => setVerilisTarihi(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A' }}>Çek vadesi</label>
            <input type="date" value={cekVadesi} onChange={(e) => setCekVadesi(e.target.value)} />
          </div>
        </div>

        <input type="text" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />

        <textarea
          placeholder="Açıklama / Not (opsiyonel)..."
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600 }}>Fiş / Fatura / Görsel Ekle (Opsiyonel):</label>
          {islemTuru === 'ciro' && secilenCiroBelgeUrl && !belge && (
            <div style={{ fontSize: 12, color: '#0F6E56', padding: '4px 8px', background: '#E6F9F0', borderRadius: 4, border: '1px solid #4CAF50', marginBottom: 4 }}>
              ✅ Orijinal çekin belgesi otomatik olarak aktarılacak.
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="dosya-buton" style={{ flex: 1 }}>
              📎 {belge ? belge.name.slice(0, 22) : 'Fotoğraf / Belge Değiştir'}
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBelge(e.target.files[0])} />
            </label>
            <button type="button" onClick={panodanYapistir} style={{ padding: '8px 12px', background: '#e6f0ff', color: '#0056b3', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
              📋 Yapıştır
            </button>
            {belge && (
              <button onClick={() => setBelge(null)} style={{ padding: '6px 10px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                ✕ Kaldır
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>💡 Görüntü kopyaladıktan sonra Ctrl+V ile de yapıştırabilirsiniz.</p>
        </div>

        <button className="ekle-buton-genis" onClick={cekKaydetVeyaGuncelle} disabled={yukleniyor} style={{ background: duzenlenenId ? '#0F6E56' : undefined }}>
          {yukleniyor ? 'Kaydediliyor...' : (duzenlenenId ? 'Çek Güncellemesini Kaydet' : 'Çek kaydını kaydet')}
        </button>
      </div>

      {/* FİLTRE VE SIRALAMA ALANI */}
      <div style={{ marginBottom: 14 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltrelerAcik(!filtrelerAcik)}>
          {filtrelerAcik ? 'Filtreleri Gizle' : 'Filtreleri & Sıralamayı Göster'}
        </button>
      </div>

      {filtrelerAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Sıralama</p>
          <select value={siralamaYonu} onChange={(e) => setSiralamaYonu(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="eklenme_yeni">Eklenme Tarihi (Yeni → Eski)</option>
            <option value="vade_yakin">Vade (Yakından Uzağa)</option>
            <option value="vade_uzak">Vade (Uzaktan Yakına)</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Banka Filtresi</p>
          <select value={filtreBanka} onChange={(e) => setFiltreBanka(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Bankalar</option>
            {bankalar.map((b) => (
              <option key={b.id} value={b.ad}>{b.ad}</option>
            ))}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Cari Hesap Filtresi</p>
          <select value={filtreCari} onChange={(e) => setFiltreCari(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Cari Hesaplar</option>
            {[...taseronlar].sort((a, b) => a.ad.localeCompare(b.ad)).map(t => (
              <option key={t.id} value={t.id}>{t.ad}</option>
            ))}
            <option value="yok">Cari Hesabı Olmayanlar</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Tarih Aralığı (Veriliş Tarihi)</p>
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

      {/* LİSTE / AKIŞ ALANI (ALTTA) */}
      <div className="liste">
        {siraliCekler.map((c) => (
          <div key={c.id} className="kart" style={{ border: duzenlenenId === c.id ? '2px solid #0F6E56' : undefined }}>
            <div className="kart-ust">
              <span className="kart-baslik">{c.odeme_konusu}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="kart-tutar">{paraFormatla(c.tutar)} ₺</span>
                <button className="sil-buton" onClick={() => duzenlemeyiBaslat(c)} aria-label="Düzenle">✎</button>
                <input
                  type="file"
                  id={`gorsel-sec-cek-${c.id}`}
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => sonradanBelgeEkle(c, e.target.files[0])}
                />
                <button className="sil-buton" onClick={() => document.getElementById(`gorsel-sec-cek-${c.id}`).click()} aria-label="Görsel Ekle/Değiştir" title="Görsel Ekle/Değiştir">🖼️</button>
                <button className="sil-buton" onClick={() => cekSil(c.id)} aria-label="Sil">🗑</button>
              </div>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">
                {c.santiye_dagilimi && c.santiye_dagilimi.length > 0
                  ? c.santiye_dagilimi.map(d => `${santiyeler.find(s => s.id === d.santiye_id)?.ad || 'Bilinmeyen'} (%${d.yuzde})`).join(', ')
                  : (c.santiye_id ? (santiyeler.find((s) => s.id === c.santiye_id)?.ad || 'Şantiye') : 'Genel')}
              </span>
              <span className="etiket">{c.banka}</span>
              <span className="etiket">Seri: {c.cek_seri_no || '—'}</span>
            </div>
            <div className="kart-alt-tarih">
              <span>Veriliş: {new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}</span>
              <span>Vade: {c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}</span>
            </div>
            {(c.odeyen || c.odenen) && (
              <div className="kart-alt-tarih" style={{ marginTop: 2 }}>
                {c.odeyen && <span>Ödeyen: {c.odeyen}</span>}
                {c.odenen && <span>Ödenen: {c.odenen}</span>}
              </div>
            )}
            {c.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{c.aciklama}</p>}

            {/* Belge / Fotoğraf Önizlemesi */}
            {c.belge_url && (
              <div style={{ marginTop: 8 }}>
                <a href={getGoogleDriveViewUrl(c.belge_url)} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={getGoogleDriveInlineImageUrl(c.belge_url)} 
                    alt="Çek Belgesi" 
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid #d3d1c7' }} 
                    onError={(e) => {
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

            {/* Muhasebe Paylaşım Kutucuğu */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              padding: '7px 10px',
              borderRadius: 6,
              background: c.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
              border: `1px solid ${c.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 12,
              fontWeight: 600,
              color: c.muhasebe_paylasim ? '#2E7D32' : '#F57F17',
            }}>
              <input
                type="checkbox"
                checked={!!c.muhasebe_paylasim}
                onChange={(e) => muhasebePaylasimGuncelle(c.id, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4CAF50' }}
              />
              {c.muhasebe_paylasim ? '✅ Muhasebeye gönderildi' : '⏳ Muhasebeye gönderilmedi'}
            </label>

            {/* WhatsApp ile Görsel ve Metin Gönderme Butonu */}
            <button 
              onClick={() => cekPaylas(c)}
              style={{ 
                marginTop: 6, 
                width: '100%', 
                padding: '8px 12px', 
                background: '#25D366', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer', 
                fontWeight: 600, 
                fontSize: 12, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 6 
              }}
            >
              💬 WhatsApp ile Paylaş
            </button>
          </div>
        ))}
        {siraliCekler.length === 0 && <p className="bos-mesaj">Bu filtrede çek kaydı yok.</p>}
      </div>
    </div>
  )
}