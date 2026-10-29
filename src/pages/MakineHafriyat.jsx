import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla } from '../lib/format'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from '../lib/operasyonKayit'
import { uploadToGoogleDrive, moveToSilinenler, getGoogleDriveInlineImageUrl } from '../lib/googleDrive'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihFormatlaTR = (tarihStr) => {
  if (!tarihStr) return ''
  const parts = tarihStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return tarihStr
}

const MAKINE_TURLERI = ['JCB', 'Bobcat', 'Kato', 'Manitou', 'Diğer']
const HIZLI_SAATLER = [1, 2, 3, 4, 5, 6, 7, 8]

const SANTIYE_RENKLERI = [
  '#1D9596',
  '#2563EB',
  '#D97706',
  '#9333EA',
  '#E11D48',
  '#059669',
  '#4F46E5',
  '#EA580C'
]

const LOCAL_STORAGE_MAKINE = 'santiye_makine_kayitlari_v1'
const LOCAL_STORAGE_HAFRIYAT = 'santiye_hafriyat_seferleri_v1'

// İş makinesi çalışma tutarı hesaplama (İlk saat + sonraki saatler opsiyonel)
export const hesaplaMakineTutari = (saat, ilkSaatFiyati, sonrakiSaatFiyati) => {
  const s = parseFloat(saat) || 0
  const ilk = parseFloat(ilkSaatFiyati) || 0
  const sonraki = parseFloat(sonrakiSaatFiyati) || 0

  if (s <= 0) return 0
  if (ilk > 0 && sonraki > 0) {
    if (s <= 1) return s * ilk
    return ilk + (s - 1) * sonraki
  }
  if (ilk > 0) return s * ilk
  if (sonraki > 0) return s * sonraki
  return 0
}

export default function MakineHafriyat() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()

  // Yönetici kontrolü (Sadece yönetici hali hazırdaki borcu görebilir)
  const isSantiyeSefi = Boolean(
    profile?.rol === 'santiye_sefi' &&
    !profile?.sistem_yoneticisi &&
    !profile?.ad_soyad?.toLowerCase().includes('serhat') &&
    !profile?.email?.toLowerCase().includes('serhat')
  )
  const isYonetici = !isSantiyeSefi

  // Aktif Sekme: 'makine' | 'hafriyat'
  const [aktifSekme, setAktifSekme] = useState('makine')

  // Filtreler
  const [seciliTarih, setSeciliTarih] = useState('')
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [durumFiltresi, setDurumFiltresi] = useState('hepsi') // 'hepsi' | 'aktif' | 'mutabakat'
  const [aramaMetni, setAramaMetni] = useState('')

  // Simetrik Üst Kartlar (Varsayılan Kapalı)
  const [matrisAcik, setMatrisAcik] = useState(false)
  const [santiyeKartAcik, setSantiyeKartAcik] = useState(false)
  const [matrisYil] = useState(() => new Date().getFullYear())
  const [matrisAy] = useState(() => new Date().getMonth())

  // Veri Listeleri
  const [makineListesi, setMakineListesi] = useState([])
  const [hafriyatListesi, setHafriyatListesi] = useState([])
  const [tumCariler, setTumCariler] = useState([])

  // Çoklu Seçim
  const [seciliMakineIds, setSeciliMakineIds] = useState([])
  const [seciliHafriyatIds, setSeciliHafriyatIds] = useState([])

  // Toplu Cari Atama Modalı
  const [topluCariModalAcik, setTopluCariModalAcik] = useState(false)
  const [secilenTopluCariAdi, setSecilenTopluCariAdi] = useState('')
  const [secilenTopluCariId, setSecilenTopluCariId] = useState(null)
  const [cariAramaInput, setCariAramaInput] = useState('')

  // --- İŞ MAKİNESİ EKLEME / DÜZENLEME MODALI STATE'LERİ ---
  const [makineModalAcik, setMakineModalAcik] = useState(false)
  const [formSantiyeId, setFormSantiyeId] = useState('')
  const [formTarih, setFormTarih] = useState(bugun())
  const [formMakineTuru, setFormMakineTuru] = useState('JCB')
  const [formManuelMakine, setFormManuelMakine] = useState('')
  const [formCalismaSaati, setFormCalismaSaati] = useState(4)
  const [formIlkSaatFiyati, setFormIlkSaatFiyati] = useState('')
  const [formSonrakiSaatFiyati, setFormSonrakiSaatFiyati] = useState('')
  const [formAciklama, setFormAciklama] = useState('')
  const [formCariAdi, setFormCariAdi] = useState('')
  const [formCariId, setFormCariId] = useState(null)
  const [formGorselListesi, setFormGorselListesi] = useState([])
  const [gorselYukleniyor, setGorselYukleniyor] = useState(false)
  const [duzenlenenMakineId, setDuzenlenenMakineId] = useState(null)
  const [buyukGorselUrl, setBuyukGorselUrl] = useState(null)

  // --- HAFRİYAT HIZLI SEFER BAŞLATMA & KART AÇMA STATE'LERİ ---
  const [hizliPlakaInput, setHizliPlakaInput] = useState('')
  const [hizliSeferFiyatiInput, setHizliSeferFiyatiInput] = useState('')
  const [duzenlenenPlaka, setDuzenlenenPlaka] = useState(null)
  const [geciciPlakaMetni, setGeciciPlakaMetni] = useState('')
  const [acikKamyonKartlari, setAcikKamyonKartlari] = useState({})

  // Şantiye renk haritası
  const santiyeRenkHaritasi = useMemo(() => {
    const harita = {}
    santiyeler.forEach((s, idx) => {
      harita[s.id] = SANTIYE_RENKLERI[idx % SANTIYE_RENKLERI.length]
    })
    return harita
  }, [santiyeler])

  const getSantiyeRenk = (sId) => santiyeRenkHaritasi[sId] || '#1D9596'

  // Rehberden taşeron/cari verilerini çek
  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, sifat, firma, kategori').then(({ data, error }) => {
      if (!error && data) setTumCariler(data)
    })
  }, [])

  // Supabase + LocalStorage'dan kayıtları yükle
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      const [mVeri, hVeri] = await Promise.all([
        operasyonVerisiYukle(LOCAL_STORAGE_MAKINE, []),
        operasyonVerisiYukle(LOCAL_STORAGE_HAFRIYAT, [])
      ])
      if (!iptal) {
        setMakineListesi(mVeri)
        setHafriyatListesi(hVeri)
      }
    }
    yukle()
    return () => { iptal = true }
  }, [])

  const makineListesiniKaydet = (yeniListe) => {
    setMakineListesi(yeniListe)
    operasyonVerisiKaydet(LOCAL_STORAGE_MAKINE, yeniListe)
  }

  const hafriyatListesiniKaydet = (yeniListe) => {
    setHafriyatListesi(yeniListe)
    operasyonVerisiKaydet(LOCAL_STORAGE_HAFRIYAT, yeniListe)
  }

  // --- GOOGLE DRIVE GÖRSEL YÜKLEME ---
  const handleMakineGorselSec = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''

    const hedefSId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id
    const santiyeObj = santiyeler.find(s => s.id === hedefSId) || aktifSantiye
    const santiyeAdi = santiyeObj?.ad || 'Genel Şantiye'
    const yukleyenAd = profile?.ad_soyad || 'Saha'

    setGorselYukleniyor(true)
    try {
      for (const file of files) {
        const res = await uploadToGoogleDrive({
          file,
          folderName: `MakineHafriyat/${santiyeAdi}`,
          adSoyad: `${formMakineTuru}-${yukleyenAd}`,
          date: formTarih || bugun()
        })
        if (res?.success && res.url) {
          setFormGorselListesi(prev => [...prev, { id: 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), url: res.url, ad: file.name }])
        } else {
          alert('Görsel Google Drive\'a yüklenemedi: ' + (res?.error || 'Bilinmeyen hata'))
        }
      }
    } catch (err) {
      alert('Görsel yükleme hatası: ' + err.message)
    } finally {
      setGorselYukleniyor(false)
    }
  }

  const handleFormGorselSil = async (gorsel) => {
    const hedefSId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id
    const santiyeObj = santiyeler.find(s => s.id === hedefSId) || aktifSantiye
    const santiyeAdi = santiyeObj?.ad || 'Genel Şantiye'
    if (gorsel?.url && gorsel.url.includes('drive.google.com')) {
      try {
        await moveToSilinenler(gorsel.url, `MakineHafriyat/${santiyeAdi}`)
      } catch (err) {
        console.warn('Silinenlere taşıma hatası:', err)
      }
    }
    setFormGorselListesi(prev => prev.filter(g => g.id !== gorsel.id))
  }

  // --- İŞ MAKİNESİ KAYDETME ---
  const yeniMakineModalAc = () => {
    setDuzenlenenMakineId(null)
    setFormSantiyeId(seciliSantiyeId || aktifSantiye?.id || (santiyeler[0]?.id || ''))
    setFormTarih(seciliTarih || bugun())
    setFormMakineTuru('JCB')
    setFormManuelMakine('')
    setFormCalismaSaati(4)
    setFormIlkSaatFiyati('')
    setFormSonrakiSaatFiyati('')
    setFormAciklama('')
    setFormCariAdi('')
    setFormCariId(null)
    setFormGorselListesi([])
    setMakineModalAcik(true)
  }

  const handleMakineKaydet = (e) => {
    e.preventDefault()
    const sonMakineTuru = formMakineTuru === 'Diğer' ? (formManuelMakine.trim() || 'Diğer') : formMakineTuru
    const saat = parseFloat(formCalismaSaati) || 0

    if (saat <= 0) {
      alert('Lütfen geçerli bir çalışma saati belirleyin.')
      return
    }

    const hedefSId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id || ''
    const santiyeObj = santiyeler.find(s => s.id === hedefSId) || aktifSantiye
    const ilkFiyat = parseFloat(formIlkSaatFiyati) || 0
    const sonrakiFiyat = parseFloat(formSonrakiSaatFiyati) || 0
    const toplamTutar = hesaplaMakineTutari(saat, ilkFiyat, sonrakiFiyat)

    if (duzenlenenMakineId) {
      const guncel = makineListesi.map(item => {
        if (item.id === duzenlenenMakineId) {
          return {
            ...item,
            tarih: formTarih || item.tarih,
            santiyeId: hedefSId || item.santiyeId,
            santiyeAdi: santiyeObj?.ad || item.santiyeAdi,
            makineTuru: sonMakineTuru,
            calismaSaati: saat,
            ilkSaatFiyati: ilkFiyat,
            sonrakiSaatFiyati: sonrakiFiyat,
            toplamTutar,
            aciklama: formAciklama.trim(),
            cariAdi: formCariAdi.trim(),
            cariId: formCariId,
            gorseller: formGorselListesi
          }
        }
        return item
      })
      makineListesiniKaydet(guncel)
      setDuzenlenenMakineId(null)
    } else {
      const yeniKayit = {
        id: 'm-' + Date.now(),
        tarih: formTarih || bugun(),
        santiyeId: hedefSId || 'varsayilan',
        santiyeAdi: santiyeObj?.ad || 'Şantiye',
        makineTuru: sonMakineTuru,
        calismaSaati: saat,
        ilkSaatFiyati: ilkFiyat,
        sonrakiSaatFiyati: sonrakiFiyat,
        toplamTutar,
        aciklama: formAciklama.trim(),
        cariAdi: formCariAdi.trim(),
        cariId: formCariId,
        gorseller: formGorselListesi,
        mutabakat: false,
        olusturulduAt: new Date().toISOString()
      }
      makineListesiniKaydet([yeniKayit, ...makineListesi])
    }

    setMakineModalAcik(false)
  }

  const handleMakineDuzenle = (item) => {
    setDuzenlenenMakineId(item.id)
    setFormSantiyeId(item.santiyeId || seciliSantiyeId || aktifSantiye?.id || '')
    setFormTarih(item.tarih || bugun())
    if (MAKINE_TURLERI.includes(item.makineTuru)) {
      setFormMakineTuru(item.makineTuru)
      setFormManuelMakine('')
    } else {
      setFormMakineTuru('Diğer')
      setFormManuelMakine(item.makineTuru)
    }
    setFormCalismaSaati(item.calismaSaati)
    setFormIlkSaatFiyati(item.ilkSaatFiyati ? String(item.ilkSaatFiyati) : '')
    setFormSonrakiSaatFiyati(item.sonrakiSaatFiyati ? String(item.sonrakiSaatFiyati) : '')
    setFormAciklama(item.aciklama || '')
    setFormCariAdi(item.cariAdi || '')
    setFormCariId(item.cariId || null)
    setFormGorselListesi(item.gorseller || [])
    setMakineModalAcik(true)
  }

  const handleMakineSil = async (id) => {
    if (window.confirm('Bu makine çalışma kaydını silmek istediğinize emin misiniz?')) {
      const silinecek = makineListesi.find(m => m.id === id)
      if (silinecek?.gorseller?.length > 0) {
        const santiyeAdi = silinecek.santiyeAdi || 'Genel Şantiye'
        for (const g of silinecek.gorseller) {
          if (g.url && g.url.includes('drive.google.com')) {
            try {
              await moveToSilinenler(g.url, `MakineHafriyat/${santiyeAdi}`)
            } catch (err) {
              console.warn('Silinenlere taşıma hatası:', err)
            }
          }
        }
      }
      const guncel = makineListesi.filter(m => m.id !== id)
      makineListesiniKaydet(guncel)
      setSeciliMakineIds(prev => prev.filter(x => x !== id))
    }
  }

  // --- HAFRİYAT: HIZLI İLK SEFERİ BAŞLATMA ---
  const handleHizliSeferBaslat = (e) => {
    e?.preventDefault()
    let plaka = hizliPlakaInput.trim().toUpperCase()

    if (!plaka) {
      const mevcutKamyonSayisi = new Set(hafriyatListesi.map(h => h.plaka)).size
      plaka = `ARAÇ ${mevcutKamyonSayisi + 1}`
    }

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const santiyeObj = santiyeler.find(s => s.id === seciliSantiyeId) || aktifSantiye || santiyeler[0]
    const onceki = hafriyatListesi.find(h => h.plaka === plaka)
    const girilenSeferFiyati = parseFloat(hizliSeferFiyatiInput) || onceki?.seferFiyati || 0

    const yeniSefer = {
      id: 'h-' + Date.now(),
      tarih: seciliTarih || bugun(),
      saat: saatFormat,
      santiyeId: seciliSantiyeId || aktifSantiye?.id || santiyeObj?.id || 'varsayilan',
      santiyeAdi: santiyeObj?.ad || 'Şantiye',
      plaka: plaka,
      seferFiyati: girilenSeferFiyati,
      dokumSahasi: onceki?.dokumSahasi || 'Döküm Sahası',
      cariAdi: onceki?.cariAdi || '',
      cariId: onceki?.cariId || null,
      mutabakat: false,
      aciklama: 'Hafriyat seferi'
    }

    hafriyatListesiniKaydet([yeniSefer, ...hafriyatListesi])
    setHizliPlakaInput('')
    setHizliSeferFiyatiInput('')
  }

  const handleKamyonSeferEkle = (plaka) => {
    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const santiyeObj = santiyeler.find(s => s.id === seciliSantiyeId) || aktifSantiye || santiyeler[0]
    const onceki = hafriyatListesi.find(h => h.plaka === plaka)

    const yeniSefer = {
      id: 'h-' + Date.now(),
      tarih: seciliTarih || bugun(),
      saat: saatFormat,
      santiyeId: seciliSantiyeId || onceki?.santiyeId || aktifSantiye?.id || 'varsayilan',
      santiyeAdi: santiyeObj?.ad || onceki?.santiyeAdi || 'Şantiye',
      plaka: plaka,
      seferFiyati: onceki?.seferFiyati || 0,
      dokumSahasi: onceki?.dokumSahasi || 'Döküm Sahası',
      cariAdi: onceki?.cariAdi || '',
      cariId: onceki?.cariId || null,
      mutabakat: false,
      aciklama: onceki?.aciklama || 'Hafriyat seferi'
    }

    hafriyatListesiniKaydet([yeniSefer, ...hafriyatListesi])
  }

  const handleSonSeferiGeriAl = (plaka) => {
    const index = hafriyatListesi.findIndex(h => h.plaka === plaka && (!seciliTarih || h.tarih === seciliTarih))
    if (index !== -1) {
      if (window.confirm(`${plaka} aracının son seferi silinsin mi?`)) {
        const yeni = [...hafriyatListesi]
        yeni.splice(index, 1)
        hafriyatListesiniKaydet(yeni)
      }
    }
  }

  const handlePlakaKaydet = (eskiPlaka) => {
    const yeni = geciciPlakaMetni.trim().toUpperCase()
    if (!yeni) {
      setDuzenlenenPlaka(null)
      return
    }
    const guncel = hafriyatListesi.map(h => (h.plaka === eskiPlaka ? { ...h, plaka: yeni } : h))
    hafriyatListesiniKaydet(guncel)
    setDuzenlenenPlaka(null)
    setGeciciPlakaMetni('')
  }

  const handleKamyonDetayGuncelle = (plaka, alan, deger) => {
    const guncel = hafriyatListesi.map(h => {
      if (h.plaka === plaka && (!seciliTarih || h.tarih === seciliTarih)) {
        return { ...h, [alan]: alan === 'seferFiyati' ? (parseFloat(deger) || 0) : deger }
      }
      return h
    })
    hafriyatListesiniKaydet(guncel)
  }

  const toggleKamyonKartAc = (plaka) => {
    setAcikKamyonKartlari(prev => ({
      ...prev,
      [plaka]: !prev[plaka]
    }))
  }

  const handleHafriyatSil = (id) => {
    if (window.confirm('Bu sefer kaydını silmek istediğinize emin misiniz?')) {
      const guncel = hafriyatListesi.filter(h => h.id !== id)
      hafriyatListesiniKaydet(guncel)
      setSeciliHafriyatIds(prev => prev.filter(x => x !== id))
    }
  }

  // --- HESAP GÖRÜLDÜ (BORÇ DÜŞÜRME / MÜTABAKAT) ---
  const handleMakineMutabakatDegistir = (id) => {
    const guncel = makineListesi.map(m => (m.id === id ? { ...m, mutabakat: !m.mutabakat } : m))
    makineListesiniKaydet(guncel)
  }

  const handleHafriyatMutabakatDegistir = (id) => {
    const guncel = hafriyatListesi.map(h => (h.id === id ? { ...h, mutabakat: !h.mutabakat } : h))
    hafriyatListesiniKaydet(guncel)
  }

  const handleKamyonTumSeferlerMutabakat = (plaka, yeniDurum) => {
    const guncel = hafriyatListesi.map(h => {
      if (h.plaka === plaka && (!seciliTarih || h.tarih === seciliTarih)) {
        return { ...h, mutabakat: yeniDurum }
      }
      return h
    })
    hafriyatListesiniKaydet(guncel)
  }

  // --- ÇOKLU SEÇİM İŞLEMLERİ ---
  const handleMakineCheckbox = (id) => {
    setSeciliMakineIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const handleHafriyatCheckbox = (id) => {
    setSeciliHafriyatIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const handleTumunuSec = () => {
    if (aktifSekme === 'makine') {
      if (seciliMakineIds.length === filtrelenmisMakineler.length) {
        setSeciliMakineIds([])
      } else {
        setSeciliMakineIds(filtrelenmisMakineler.map(m => m.id))
      }
    } else {
      if (seciliHafriyatIds.length === filtrelenmisHafriyat.length) {
        setSeciliHafriyatIds([])
      } else {
        setSeciliHafriyatIds(filtrelenmisHafriyat.map(h => h.id))
      }
    }
  }

  const handleTopluMutabakat = (yeniDurum) => {
    if (aktifSekme === 'makine') {
      const guncel = makineListesi.map(m => (seciliMakineIds.includes(m.id) ? { ...m, mutabakat: yeniDurum } : m))
      makineListesiniKaydet(guncel)
      setSeciliMakineIds([])
    } else {
      const guncel = hafriyatListesi.map(h => (seciliHafriyatIds.includes(h.id) ? { ...h, mutabakat: yeniDurum } : h))
      hafriyatListesiniKaydet(guncel)
      setSeciliHafriyatIds([])
    }
  }

  const handleTopluSil = async () => {
    const sayi = aktifSekme === 'makine' ? seciliMakineIds.length : seciliHafriyatIds.length
    if (window.confirm(`Seçilen ${sayi} kaydı tamamen silmek istediğinize emin misiniz?`)) {
      if (aktifSekme === 'makine') {
        const silinecekler = makineListesi.filter(m => seciliMakineIds.includes(m.id))
        for (const item of silinecekler) {
          if (item.gorseller?.length > 0) {
            for (const g of item.gorseller) {
              if (g.url?.includes('drive.google.com')) {
                try {
                  await moveToSilinenler(g.url, `MakineHafriyat/${item.santiyeAdi || 'Genel Şantiye'}`)
                } catch (err) {
                  console.warn(err)
                }
              }
            }
          }
        }
        const guncel = makineListesi.filter(m => !seciliMakineIds.includes(m.id))
        makineListesiniKaydet(guncel)
        setSeciliMakineIds([])
      } else {
        const guncel = hafriyatListesi.filter(h => !seciliHafriyatIds.includes(h.id))
        hafriyatListesiniKaydet(guncel)
        setSeciliHafriyatIds([])
      }
    }
  }

  const handleTopluCariUygula = () => {
    const firmaAdi = secilenTopluCariAdi.trim()
    if (!firmaAdi) {
      alert('Lütfen bir firma / cari seçin veya yazın.')
      return
    }

    if (aktifSekme === 'makine') {
      const guncel = makineListesi.map(m => (seciliMakineIds.includes(m.id) ? { ...m, cariAdi: firmaAdi, cariId: secilenTopluCariId } : m))
      makineListesiniKaydet(guncel)
      setSeciliMakineIds([])
    } else {
      const guncel = hafriyatListesi.map(h => (seciliHafriyatIds.includes(h.id) ? { ...h, cariAdi: firmaAdi, cariId: secilenTopluCariId } : h))
      hafriyatListesiniKaydet(guncel)
      setSeciliHafriyatIds([])
    }

    setTopluCariModalAcik(false)
    setSecilenTopluCariAdi('')
    setSecilenTopluCariId(null)
    setCariAramaInput('')
  }

  // --- FİLTRELENMİŞ LİSTELER ---
  const filtrelenmisMakineler = useMemo(() => {
    return makineListesi.filter(item => {
      if (seciliSantiyeId && item.santiyeId && item.santiyeId !== seciliSantiyeId) return false
      if (seciliTarih && item.tarih !== seciliTarih) return false
      if (durumFiltresi === 'aktif' && item.mutabakat) return false
      if (durumFiltresi === 'mutabakat' && !item.mutabakat) return false
      if (aramaMetni.trim()) {
        const aranan = aramaMetni.toLocaleLowerCase('tr-TR')
        return (
          item.makineTuru?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.aciklama?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.cariAdi?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.santiyeAdi?.toLocaleLowerCase('tr-TR').includes(aranan)
        )
      }
      return true
    })
  }, [makineListesi, seciliSantiyeId, seciliTarih, durumFiltresi, aramaMetni])

  const filtrelenmisHafriyat = useMemo(() => {
    return hafriyatListesi.filter(item => {
      if (seciliSantiyeId && item.santiyeId && item.santiyeId !== seciliSantiyeId) return false
      if (seciliTarih && item.tarih !== seciliTarih) return false
      if (durumFiltresi === 'aktif' && item.mutabakat) return false
      if (durumFiltresi === 'mutabakat' && !item.mutabakat) return false
      if (aramaMetni.trim()) {
        const aranan = aramaMetni.toLocaleLowerCase('tr-TR')
        return (
          item.plaka?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.dokumSahasi?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.cariAdi?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.aciklama?.toLocaleLowerCase('tr-TR').includes(aranan)
        )
      }
      return true
    })
  }, [hafriyatListesi, seciliSantiyeId, seciliTarih, durumFiltresi, aramaMetni])

  const toplamMakineSaati = useMemo(() => {
    return filtrelenmisMakineler.reduce((t, m) => t + (Number(m.calismaSaati) || 0), 0)
  }, [filtrelenmisMakineler])

  // --- YÖNETİCİ BORÇ HESAPLAMALARI (Hesap Görülenler Düşer!) ---
  const borcOzetleri = useMemo(() => {
    const santiyeMakineleri = makineListesi.filter(m => (!seciliSantiyeId || m.santiyeId === seciliSantiyeId) && (!seciliTarih || m.tarih === seciliTarih))
    const santiyeHafriyatlari = hafriyatListesi.filter(h => (!seciliSantiyeId || h.santiyeId === seciliSantiyeId) && (!seciliTarih || h.tarih === seciliTarih))

    let makineAcikBorc = 0
    let makineGorulenBorc = 0
    santiyeMakineleri.forEach(m => {
      const tutar = m.toplamTutar !== undefined
        ? Number(m.toplamTutar)
        : hesaplaMakineTutari(m.calismaSaati, m.ilkSaatFiyati, m.sonrakiSaatFiyati)
      if (m.mutabakat) makineGorulenBorc += tutar
      else makineAcikBorc += tutar
    })

    let hafriyatAcikBorc = 0
    let hafriyatGorulenBorc = 0
    santiyeHafriyatlari.forEach(h => {
      const tutar = Number(h.seferFiyati) || 0
      if (h.mutabakat) hafriyatGorulenBorc += tutar
      else hafriyatAcikBorc += tutar
    })

    return {
      makineAcikBorc,
      makineGorulenBorc,
      hafriyatAcikBorc,
      hafriyatGorulenBorc,
      toplamAcikBorc: makineAcikBorc + hafriyatAcikBorc,
      toplamGorulenBorc: makineGorulenBorc + hafriyatGorulenBorc
    }
  }, [makineListesi, hafriyatListesi, seciliSantiyeId, seciliTarih])

  // Kamyon bazlı çetele özeti (Borç ve Hesap Görüldü durumu ile)
  const kamyonOzetleri = useMemo(() => {
    const harita = {}
    hafriyatListesi.forEach(item => {
      if (seciliSantiyeId && item.santiyeId && item.santiyeId !== seciliSantiyeId) return
      if (seciliTarih && item.tarih !== seciliTarih) return

      if (!harita[item.plaka]) {
        harita[item.plaka] = {
          plaka: item.plaka,
          toplamSefer: 0,
          acikSefer: 0,
          gorulenSefer: 0,
          seferFiyati: Number(item.seferFiyati) || 0,
          acikBorc: 0,
          cariAdi: item.cariAdi || '',
          dokumSahasi: item.dokumSahasi || '',
          aciklama: item.aciklama || '',
          seferSaatleri: []
        }
      }
      const k = harita[item.plaka]
      k.toplamSefer += 1
      const birimFiyat = Number(item.seferFiyati) || k.seferFiyati || 0
      if (birimFiyat > 0 && !k.seferFiyati) k.seferFiyati = birimFiyat

      if (item.mutabakat) {
        k.gorulenSefer += 1
      } else {
        k.acikSefer += 1
        k.acikBorc += birimFiyat
      }

      if (item.saat) k.seferSaatleri.push({ id: item.id, saat: item.saat, mutabakat: item.mutabakat })
      if (item.cariAdi) k.cariAdi = item.cariAdi
      if (item.dokumSahasi) k.dokumSahasi = item.dokumSahasi
      if (item.aciklama) k.aciklama = item.aciklama
    })
    return Object.values(harita)
  }, [hafriyatListesi, seciliTarih, seciliSantiyeId])

  const onerilenCariler = useMemo(() => {
    const filtrelenmis = tumCariler.filter(c =>
      c.kategori !== 'Kurumlar' &&
      c.kategori !== 'Resmi Kurumlar' &&
      c.kategori !== 'Resmi Kurumlar & Belediyeler' &&
      c.kategori !== 'Ortaklar' &&
      c.kategori !== 'Ortaklar & Malikler'
    )
    if (!cariAramaInput.trim()) {
      const oncelikli = filtrelenmis.filter(c =>
        c.kategori === 'İş Makinesi & Hafriyat' ||
        c.kategori === 'İş Makinesi' ||
        (c.sifat && (c.sifat.toLowerCase().includes('hafriyat') || c.sifat.toLowerCase().includes('makine') || c.sifat.toLowerCase().includes('kepçe')))
      )
      return (oncelikli.length > 0 ? oncelikli : filtrelenmis).slice(0, 10)
    }
    const aranan = cariAramaInput.toLocaleLowerCase('tr-TR')
    return filtrelenmis.filter(c =>
      c.ad?.toLocaleLowerCase('tr-TR').includes(aranan) ||
      c.firma?.toLocaleLowerCase('tr-TR').includes(aranan) ||
      c.sifat?.toLocaleLowerCase('tr-TR').includes(aranan)
    ).slice(0, 10)
  }, [tumCariler, cariAramaInput])

  // TAKVİM MATRİSİ HESAPLAMALARI (Ay bilgisi olmadan sade günler)
  const matrisGunleri = useMemo(() => {
    const gunler = []
    const ayinIlkGunu = new Date(matrisYil, matrisAy, 1)
    const ayinSonGunu = new Date(matrisYil, matrisAy + 1, 0)
    const toplamGun = ayinSonGunu.getDate()

    let ilkGunHaftaIndeksi = ayinIlkGunu.getDay() - 1
    if (ilkGunHaftaIndeksi === -1) ilkGunHaftaIndeksi = 6

    for (let i = 0; i < ilkGunHaftaIndeksi; i++) {
      gunler.push({ bosluk: true, id: `bos-${i}` })
    }

    for (let g = 1; g <= toplamGun; g++) {
      const gStr = g < 10 ? `0${g}` : `${g}`
      const aStr = (matrisAy + 1) < 10 ? `0${matrisAy + 1}` : `${matrisAy + 1}`
      const tarihKey = `${matrisYil}-${aStr}-${gStr}`

      const mIslemler = makineListesi.filter(m => m.tarih === tarihKey && (!seciliSantiyeId || m.santiyeId === seciliSantiyeId))
      const hIslemler = hafriyatListesi.filter(h => h.tarih === tarihKey && (!seciliSantiyeId || h.santiyeId === seciliSantiyeId))

      const toplamIslem = mIslemler.length + hIslemler.length
      const mutabakatliIslem = mIslemler.filter(m => m.mutabakat).length + hIslemler.filter(h => h.mutabakat).length

      const santiyeIdSet = new Set([
        ...mIslemler.map(m => m.santiyeId),
        ...hIslemler.map(h => h.santiyeId)
      ].filter(Boolean))

      let durumRengi = 'yok'
      if (toplamIslem > 0) {
        if (mutabakatliIslem === toplamIslem) durumRengi = 'yesil'
        else if (mutabakatliIslem > 0) durumRengi = 'sari'
        else durumRengi = 'kirmizi'
      }

      gunler.push({
        bosluk: false,
        gunNo: g,
        tarihKey,
        toplamIslem,
        mutabakatliIslem,
        durumRengi,
        santiyeIdleri: Array.from(santiyeIdSet)
      })
    }

    return gunler
  }, [matrisYil, matrisAy, makineListesi, hafriyatListesi, seciliSantiyeId])

  const seciliSayisi = aktifSekme === 'makine' ? seciliMakineIds.length : seciliHafriyatIds.length
  const canliModalTutar = hesaplaMakineTutari(formCalismaSaati, formIlkSaatFiyati, formSonrakiSaatFiyati)

  return (
    <div className="sayfa saha-operasyon-sayfa">
      {/* 1. SATIR: SAYFA BAŞLIĞI VE SAĞ AKSİYON BUTONU (SOL-SAĞ TAM SİMETRİK) */}
      <div className="saha-ust-baslik-bar">
        <div className="saha-ust-baslik-sol">
          <h2>🚜 Saha Operasyon Takibi</h2>
        </div>
        {aktifSekme === 'makine' && (
          <button type="button" className="saha-ana-ekle-btn" onClick={yeniMakineModalAc}>
            <span className="arti-ikon">+</span> İş Makinesi Ekle
          </button>
        )}
      </div>

      {/* 2. SATIR: TAKVİM MATRİSİ VE ŞANTİYE SEÇİMİ (1FR | 1FR TAM SİMETRİK İKİLİ KART) */}
      <div className="saha-simetrik-ikili-bar">
        <button
          type="button"
          className={`saha-secici-kart ${matrisAcik || seciliTarih ? 'aktif' : ''}`}
          onClick={() => {
            setMatrisAcik(prev => !prev)
            setSantiyeKartAcik(false)
          }}
        >
          <div className="saha-secici-sol">
            <span className="saha-secici-ikon">📅</span>
            <div className="saha-secici-metin">
              <span className="saha-secici-etiket">Takvim Matrisi</span>
              <strong className="saha-secici-deger">{seciliTarih ? tarihFormatlaTR(seciliTarih) : 'Tüm Günler'}</strong>
            </div>
          </div>
          {seciliTarih ? (
            <span
              className="saha-secici-temizle"
              onClick={(e) => {
                e.stopPropagation()
                setSeciliTarih('')
              }}
              title="Tarih filtresini kaldır"
            >
              ✕
            </span>
          ) : (
            <span className="saha-secici-ok">{matrisAcik ? '▲' : '▼'}</span>
          )}
        </button>

        <button
          type="button"
          className={`saha-secici-kart ${santiyeKartAcik || seciliSantiyeId ? 'aktif' : ''}`}
          onClick={() => {
            setSantiyeKartAcik(prev => !prev)
            setMatrisAcik(false)
          }}
        >
          <div className="saha-secici-sol">
            <span className="saha-secici-ikon">🏗️</span>
            <div className="saha-secici-metin">
              <span className="saha-secici-etiket">Şantiye Seçimi</span>
              <strong className="saha-secici-deger">
                {seciliSantiyeId
                  ? (santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Seçili Şantiye')
                  : 'Tüm Şantiyeler'}
              </strong>
            </div>
          </div>
          {seciliSantiyeId ? (
            <span
              className="saha-secici-temizle"
              onClick={(e) => {
                e.stopPropagation()
                setSeciliSantiyeId('')
              }}
              title="Şantiye filtresini kaldır"
            >
              ✕
            </span>
          ) : (
            <span className="saha-secici-ok">{santiyeKartAcik ? '▲' : '▼'}</span>
          )}
        </button>
      </div>

      {/* AÇILIR PANEL 1: TAKVİM MATRİSİ (AY BİLGİSİ YER ALMAZ, VARSAYILAN KAPALI) */}
      {matrisAcik && (
        <div className="matris-kapsayici-kart animasyonlu-acilis" style={{ marginBottom: 10 }}>
          <div className="matris-govde" style={{ padding: '10px 12px' }}>
            <div className="matris-haftanin-gunleri">
              <span>Pzt</span><span>Sal</span><span>Çar</span><span>Per</span><span>Cum</span><span>Cmt</span><span>Paz</span>
            </div>

            <div className="matris-izgara">
              {matrisGunleri.map((item) => {
                if (item.bosluk) return <div key={item.id} className="matris-hucre bosluk" />
                const seciliMi = item.tarihKey === seciliTarih
                const bugunMu = item.tarihKey === bugun()

                return (
                  <div
                    key={item.tarihKey}
                    className={`matris-hucre durum-${item.durumRengi} ${seciliMi ? 'aktif-gun' : ''} ${bugunMu ? 'bugun-cerceve' : ''}`}
                    onClick={() => setSeciliTarih(prev => (prev === item.tarihKey ? '' : item.tarihKey))}
                    title={`${item.tarihKey}: ${item.toplamIslem} işlem (${item.mutabakatliIslem} hesap görüldü)`}
                  >
                    <span className="matris-gun-no">{item.gunNo}</span>
                    {item.santiyeIdleri?.length > 0 && (
                      <div className="matris-santiye-noktalari">
                        {item.santiyeIdleri.map(sId => (
                          <span key={sId} className="santiye-renk-noktasi" style={{ backgroundColor: getSantiyeRenk(sId) }} />
                        ))}
                      </div>
                    )}
                    {item.toplamIslem > 0 && (
                      <span className="matris-islem-sayac">
                        {item.mutabakatliIslem}/{item.toplamIslem}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="matris-lejant" style={{ marginTop: 8, paddingTop: 6 }}>
              <div className="lejant-oge"><span className="lejant-nokta durum-yesil" /><span>Hesap Görüldü</span></div>
              <div className="lejant-oge"><span className="lejant-nokta durum-sari" /><span>Kısmi Görüldü</span></div>
              <div className="lejant-oge"><span className="lejant-nokta durum-kirmizi" /><span>Açık Borç Var</span></div>
            </div>
          </div>
        </div>
      )}

      {/* AÇILIR PANEL 2: ŞANTİYE SEÇİMİ (VARSAYILAN KAPALI) */}
      {santiyeKartAcik && (
        <div className="matris-kapsayici-kart animasyonlu-acilis" style={{ marginBottom: 10 }}>
          <div className="matris-govde" style={{ padding: '10px 12px' }}>
            <div className="santiye-secim-kart-izgara">
              <button
                type="button"
                className={`santiye-secim-oge-btn ${seciliSantiyeId === '' ? 'aktif' : ''}`}
                onClick={() => {
                  setSeciliSantiyeId('')
                  setSantiyeKartAcik(false)
                }}
              >
                <span className="santiye-secim-sol">
                  <span className="santiye-renk-noktasi buyuk" style={{ background: 'linear-gradient(135deg, #1D9596, #117575)' }} />
                  <span>Tüm Şantiyeler</span>
                </span>
                <span className="santiye-dokum-sayac">{makineListesi.length + hafriyatListesi.length} Kayıt</span>
              </button>

              {santiyeler.map((s) => {
                const renk = getSantiyeRenk(s.id)
                const santiyeKayitSayisi = makineListesi.filter(m => m.santiyeId === s.id).length + hafriyatListesi.filter(h => h.santiyeId === s.id).length
                const aktifMi = seciliSantiyeId === s.id

                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`santiye-secim-oge-btn ${aktifMi ? 'aktif' : ''}`}
                    onClick={() => {
                      setSeciliSantiyeId(prev => (prev === s.id ? '' : s.id))
                      setSantiyeKartAcik(false)
                    }}
                  >
                    <span className="santiye-secim-sol">
                      <span className="santiye-renk-noktasi buyuk" style={{ backgroundColor: renk }} />
                      <span>{s.ad}</span>
                    </span>
                    <span className="santiye-dokum-sayac">{santiyeKayitSayisi} Kayıt</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. SATIR: YÖNETİCİYE ÖZEL BORÇ ÖZETİ (UYGULAMANIN .ozet-satiri TEMASINDA 1FR | 1FR İKİLİ KART) */}
      {isYonetici && (
        <div className="saha-borc-ozet-ikili">
          <div className="saha-ozet-kart acik-borc">
            <span className="saha-ozet-etiket">Hali Hazırdaki Açık Borç</span>
            <strong className="saha-ozet-tutar">{paraFormatla(borcOzetleri.toplamAcikBorc)} ₺</strong>
            <span className="saha-ozet-alt">
              Makine: {paraFormatla(borcOzetleri.makineAcikBorc)} ₺ • Hafriyat: {paraFormatla(borcOzetleri.hafriyatAcikBorc)} ₺
            </span>
          </div>

          <div className="saha-ozet-kart gorulen-borc">
            <span className="saha-ozet-etiket">Hesabı Görülen (Düşülen)</span>
            <strong className="saha-ozet-tutar yesil">{paraFormatla(borcOzetleri.toplamGorulenBorc)} ₺</strong>
            <span className="saha-ozet-alt">
              Makine: {paraFormatla(borcOzetleri.makineGorulenBorc)} ₺ • Hafriyat: {paraFormatla(borcOzetleri.hafriyatGorulenBorc)} ₺
            </span>
          </div>
        </div>
      )}

      {/* 4. SATIR: TAM GENİŞLİK SİMETRİK SEKME SEÇİCİ (1FR | 1FR) */}
      <div className="saha-sekme-secici">
        <button
          type="button"
          className={`saha-sekme-buton ${aktifSekme === 'makine' ? 'aktif' : ''}`}
          onClick={() => {
            setAktifSekme('makine')
            setSeciliMakineIds([])
            setSeciliHafriyatIds([])
          }}
        >
          🚜 İş Makineleri ({filtrelenmisMakineler.length} • {toplamMakineSaati.toFixed(1)} sa)
        </button>

        <button
          type="button"
          className={`saha-sekme-buton ${aktifSekme === 'hafriyat' ? 'aktif' : ''}`}
          onClick={() => {
            setAktifSekme('hafriyat')
            setSeciliMakineIds([])
            setSeciliHafriyatIds([])
          }}
        >
          🚛 Hafriyat Seferleri ({filtrelenmisHafriyat.length} Sefer)
        </button>
      </div>

      {/* 5. SATIR: KURUMSAL FİLTRE VE ARAMA PANELİ (SİMETRİK) */}
      <div className="saha-filtre-kapsayici">
        {/* 3 Eşit Sütunlu Durum Filtresi */}
        <div className="saha-durum-uclu">
          <button
            type="button"
            className={`saha-durum-btn ${durumFiltresi === 'hepsi' ? 'aktif' : ''}`}
            onClick={() => setDurumFiltresi('hepsi')}
          >
            Tümü
          </button>
          <button
            type="button"
            className={`saha-durum-btn ${durumFiltresi === 'aktif' ? 'aktif' : ''}`}
            onClick={() => setDurumFiltresi('aktif')}
          >
            Açık Borç
          </button>
          <button
            type="button"
            className={`saha-durum-btn ${durumFiltresi === 'mutabakat' ? 'aktif' : ''}`}
            onClick={() => setDurumFiltresi('mutabakat')}
          >
            Hesap Görüldü
          </button>
        </div>

        {/* Tam Genişlik Arama + Tümünü Seç */}
        <div className="saha-arama-satiri">
          <div className="saha-arama-input-kutu">
            <span className="saha-arama-ikon">🔍</span>
            <input
              type="text"
              placeholder={aktifSekme === 'makine' ? 'Makine, firma veya açıklama ara...' : 'Plaka, döküm yeri veya firma ara...'}
              value={aramaMetni}
              onChange={(e) => setAramaMetni(e.target.value)}
              className="saha-arama-input"
            />
            {aramaMetni && (
              <button type="button" className="saha-arama-temizle" onClick={() => setAramaMetni('')}>✕</button>
            )}
          </div>

          {(aktifSekme === 'makine' ? filtrelenmisMakineler.length > 0 : filtrelenmisHafriyat.length > 0) && (
            <button type="button" className="saha-tumunu-sec-btn" onClick={handleTumunuSec}>
              {(aktifSekme === 'makine'
                ? seciliMakineIds.length === filtrelenmisMakineler.length
                : seciliHafriyatIds.length === filtrelenmisHafriyat.length)
                ? 'Seçimi Bırak'
                : 'Tümünü Seç'}
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. SEKME 1: İŞ MAKİNELERİ ÇALIŞMA SAATİ LİSTESİ              */}
      {/* ============================================================ */}
      {aktifSekme === 'makine' && (
        <div className="saha-liste-alani">
          {filtrelenmisMakineler.length === 0 ? (
            <div className="bos-kayit-paneli kompakt">
              <span className="bos-ikon">🚜</span>
              <h4>İş makinesi çalışma kaydı bulunamadı</h4>
              <p>Yeni kayıt eklemek için sağ üstteki <strong>"+ İş Makinesi Ekle"</strong> butonuna tıklayın.</p>
            </div>
          ) : (
            <div className="saha-kart-listesi">
              {filtrelenmisMakineler.map(item => {
                const seciliMi = seciliMakineIds.includes(item.id)
                const kayitTutari = item.toplamTutar !== undefined
                  ? Number(item.toplamTutar)
                  : hesaplaMakineTutari(item.calismaSaati, item.ilkSaatFiyati, item.sonrakiSaatFiyati)

                return (
                  <div
                    key={item.id}
                    className={`saha-kayit-karti ${item.mutabakat ? 'goruldu' : ''} ${seciliMi ? 'secili' : ''}`}
                  >
                    {/* 1. SATIR: SOLDA CHECKBOX + MAKİNE + ŞANTİYE | SAĞDA TUTAR + SAAT ROZETİ */}
                    <div className="saha-kart-ust">
                      <div className="saha-kart-ust-sol">
                        <input
                          type="checkbox"
                          checked={seciliMi}
                          onChange={() => handleMakineCheckbox(item.id)}
                          className="premium-checkbox"
                          aria-label="Seç"
                        />
                        <span className="saha-makine-rozet">{item.makineTuru}</span>
                        <span className="saha-santiye-etiket">
                          <span className="santiye-renk-noktasi" style={{ background: getSantiyeRenk(item.santiyeId) }} />
                          {item.santiyeAdi}
                        </span>
                      </div>

                      <div className="saha-kart-ust-sag">
                        {isYonetici && kayitTutari > 0 && (
                          <span className={`saha-tutar-etiket ${item.mutabakat ? 'odendi' : 'acik'}`}>
                            {paraFormatla(kayitTutari)} ₺
                          </span>
                        )}
                        <span className="saha-saat-rozet">
                          <strong>{item.calismaSaati}</strong> Saat
                        </span>
                      </div>
                    </div>

                    {/* 2. SATIR: SOLDA FİRMA | SAĞDA TARİH VE BİRİM FİYAT */}
                    <div className="saha-kart-orta">
                      <div className="saha-kart-orta-sol">
                        {item.cariAdi ? (
                          <span className="saha-firma-etiket">🏢 {item.cariAdi}</span>
                        ) : (
                          <button
                            type="button"
                            className="saha-firma-ata-btn"
                            onClick={() => {
                              setSeciliMakineIds([item.id])
                              setTopluCariModalAcik(true)
                            }}
                          >
                            ⚠️ Firma Atanmadı (Ata)
                          </button>
                        )}
                      </div>

                      <div className="saha-kart-orta-sag">
                        {isYonetici && (item.ilkSaatFiyati > 0 || item.sonrakiSaatFiyati > 0) && (
                          <span className="saha-birim-bilgi">
                            1.sa: {paraFormatla(item.ilkSaatFiyati || item.sonrakiSaatFiyati)} ₺
                            {item.sonrakiSaatFiyati > 0 ? ` • +sa: ${paraFormatla(item.sonrakiSaatFiyati)} ₺` : ''}
                          </span>
                        )}
                        <span className="saha-tarih-etiket">{tarihFormatlaTR(item.tarih)}</span>
                      </div>
                    </div>

                    {/* AÇIKLAMA / NOT SATIRI (VARSA) */}
                    {item.aciklama && (
                      <div className="saha-kart-aciklama">
                        📝 {item.aciklama}
                      </div>
                    )}

                    {/* 3. SATIR: SOLDA HESAP GÖRÜLDÜ & FİŞ | SAĞDA DÜZENLE & SİL */}
                    <div className="saha-kart-alt">
                      <div className="saha-kart-alt-sol">
                        <button
                          type="button"
                          className={`saha-hesap-btn ${item.mutabakat ? 'goruldu' : 'bekliyor'}`}
                          onClick={() => handleMakineMutabakatDegistir(item.id)}
                        >
                          {item.mutabakat ? '✓ Hesap Görüldü' : '💳 Hesap Görüldü İşaretle'}
                        </button>

                        {item.gorseller?.length > 0 && (
                          <button
                            type="button"
                            className="kompakt-fis-rozet"
                            onClick={() => setBuyukGorselUrl(getGoogleDriveInlineImageUrl(item.gorseller[0].url))}
                          >
                            📷 Fiş ({item.gorseller.length})
                          </button>
                        )}
                      </div>

                      <div className="saha-kart-alt-sag">
                        <button type="button" className="saha-ikon-btn" onClick={() => handleMakineDuzenle(item)} title="Düzenle">✏️</button>
                        <button type="button" className="saha-ikon-btn sil" onClick={() => handleMakineSil(item.id)} title="Sil">🗑️</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. SEKME 2: HAFRİYAT KAMYONLARI (SEFER TAKİBİ)              */}
      {/* ============================================================ */}
      {aktifSekme === 'hafriyat' && (
        <div className="saha-liste-alani">
          {/* NİZAMİ HIZLI SEFER BAŞLATMA KARTI */}
          <form onSubmit={handleHizliSeferBaslat} className="saha-sefer-baslat-kart">
            <div className="saha-sefer-ust-satir">
              <div className="hizli-input-grubu" style={{ height: 38, flex: 1 }}>
                <span className="plaka-ikon-rozet">TR</span>
                <input
                  type="text"
                  placeholder="Araç Plakası (Örn: 34 KMY 452)..."
                  value={hizliPlakaInput}
                  onChange={(e) => setHizliPlakaInput(e.target.value)}
                  className="hizli-plaka-input"
                />
              </div>

              <div className="kompakt-birim-kutu" style={{ height: 38, width: 155 }}>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Sefer Fiyatı"
                  value={hizliSeferFiyatiInput}
                  onChange={(e) => setHizliSeferFiyatiInput(e.target.value)}
                  className="kompakt-birim-input"
                />
                <span className="kompakt-birim-etiket">₺</span>
              </div>
            </div>

            <button type="submit" className="saha-ana-ekle-btn tam-genislik">
              ⚡ İlk Seferi Başlat (+1 Sefer)
            </button>
          </form>

          {kamyonOzetleri.length === 0 ? (
            <div className="bos-kayit-paneli kompakt">
              <span className="bos-ikon">🚛</span>
              <h4>Henüz kayıtlı hafriyat aracı yok</h4>
              <p>Yukarıdaki kutuya plaka yazıp <strong>"İlk Seferi Başlat"</strong> butonuna dokunarak başlayın.</p>
            </div>
          ) : (
            <div className="saha-kart-listesi" style={{ marginBottom: 12 }}>
              {kamyonOzetleri.map(kamyon => {
                const detayAcik = !!acikKamyonKartlari[kamyon.plaka]
                const hepsiGoruldu = kamyon.toplamSefer > 0 && kamyon.gorulenSefer === kamyon.toplamSefer

                return (
                  <div key={kamyon.plaka} className={`saha-kayit-karti ${hepsiGoruldu ? 'goruldu' : ''}`}>
                    {/* KAMYON ÜST SATIR */}
                    <div className="saha-kart-ust">
                      <div className="saha-kart-ust-sol">
                        {duzenlenenPlaka === kamyon.plaka ? (
                          <div className="plaka-inline-duzenle">
                            <input
                              type="text"
                              value={geciciPlakaMetni}
                              onChange={(e) => setGeciciPlakaMetni(e.target.value)}
                              className="plaka-inline-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handlePlakaKaydet(kamyon.plaka)
                                if (e.key === 'Escape') setDuzenlenenPlaka(null)
                              }}
                            />
                            <button type="button" className="plaka-kaydet-btn" onClick={() => handlePlakaKaydet(kamyon.plaka)}>✓</button>
                            <button type="button" className="plaka-iptal-btn" onClick={() => setDuzenlenenPlaka(null)}>✕</button>
                          </div>
                        ) : (
                          <div
                            className="plaka-etiket tiklanabilir"
                            onClick={() => {
                              setDuzenlenenPlaka(kamyon.plaka)
                              setGeciciPlakaMetni(kamyon.plaka)
                            }}
                            title="Plakayı değiştirmek için tıklayın"
                          >
                            <span className="tr-serit">TR</span>
                            <span className="plaka-yazi">{kamyon.plaka}</span>
                            <span className="plaka-kalem-ikon">✏️</span>
                          </div>
                        )}

                        <span className="saha-firma-etiket">
                          {kamyon.cariAdi ? `🏢 ${kamyon.cariAdi}` : 'Firma atanmadı'}
                        </span>
                      </div>

                      <div className="saha-kart-ust-sag">
                        {isYonetici && kamyon.seferFiyati > 0 && (
                          <span className={`saha-tutar-etiket ${kamyon.acikBorc === 0 ? 'odendi' : 'acik'}`}>
                            {kamyon.acikBorc === 0 ? '✓ Borç Yok' : `${paraFormatla(kamyon.acikBorc)} ₺`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* KAMYON SEFER SAYAÇ SATIRI */}
                    <div className="saha-kamyon-sayac-bar">
                      <div className="sefer-gosterge">
                        <span className="sefer-sayi" style={{ fontSize: 20 }}>{kamyon.toplamSefer}</span>
                        <span className="sefer-etiket">
                          Toplam Sefer {kamyon.gorulenSefer > 0 ? `(${kamyon.acikSefer} Açık)` : ''}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="saha-ana-ekle-btn"
                        onClick={() => handleKamyonSeferEkle(kamyon.plaka)}
                      >
                        +1 Sefer Ekle
                      </button>
                    </div>

                    {/* KAMYON ALT SATIR */}
                    <div className="saha-kart-alt">
                      <div className="saha-kart-alt-sol">
                        <button
                          type="button"
                          className={`saha-hesap-btn ${hepsiGoruldu ? 'goruldu' : 'bekliyor'}`}
                          onClick={() => handleKamyonTumSeferlerMutabakat(kamyon.plaka, !hepsiGoruldu)}
                        >
                          {hepsiGoruldu ? '✓ Hesap Görüldü' : '💳 Hesap Görüldü İşaretle'}
                        </button>
                      </div>

                      <div className="saha-kart-alt-sag">
                        <button type="button" className="detay-ac-kapat-btn" onClick={() => toggleKamyonKartAc(kamyon.plaka)}>
                          {detayAcik ? '▲ Gizle' : '▼ Detay & Fiyat'}
                        </button>
                        {kamyon.toplamSefer > 0 && (
                          <button type="button" className="eksi-sefer-link" onClick={() => handleSonSeferiGeriAl(kamyon.plaka)} title="Son seferi sil">
                            ↩ -1
                          </button>
                        )}
                      </div>
                    </div>

                    {detayAcik && (
                      <div className="kamyon-detay-paneli animasyonlu-acilis">
                        <div className="nizami-iki-sutun-grid" style={{ gap: 8 }}>
                          <div className="nizami-alan-kutu">
                            <label className="nizami-ust-etiket">SEFER FİYATI (₺)</label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={kamyon.seferFiyati || ''}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'seferFiyati', e.target.value)}
                              placeholder="Örn: 2500"
                              className="nizami-input kucuk"
                            />
                          </div>

                          <div className="nizami-alan-kutu">
                            <label className="nizami-ust-etiket">NAKLİYE FİRMASI</label>
                            <input
                              type="text"
                              value={kamyon.cariAdi}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'cariAdi', e.target.value)}
                              placeholder="Firma seç / yaz..."
                              className="nizami-input kucuk"
                              list="cariler-kamyon-detay"
                            />
                            <datalist id="cariler-kamyon-detay">
                              {tumCariler.map(c => (
                                <option key={c.id} value={c.ad}>{c.ad}</option>
                              ))}
                            </datalist>
                          </div>

                          <div className="nizami-alan-kutu">
                            <label className="nizami-ust-etiket">DÖKÜM SAHASI</label>
                            <input
                              type="text"
                              value={kamyon.dokumSahasi}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'dokumSahasi', e.target.value)}
                              placeholder="Örn: Cebeci..."
                              className="nizami-input kucuk"
                            />
                          </div>

                          <div className="nizami-alan-kutu">
                            <label className="nizami-ust-etiket">NOT / AÇIKLAMA</label>
                            <input
                              type="text"
                              value={kamyon.aciklama}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'aciklama', e.target.value)}
                              placeholder="Kazı toprağı..."
                              className="nizami-input kucuk"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {filtrelenmisHafriyat.length > 0 && (
            <div className="sefer-log-tablosu">
              {filtrelenmisHafriyat.map(item => {
                const seciliMi = seciliHafriyatIds.includes(item.id)
                const sFiyat = Number(item.seferFiyati) || 0
                return (
                  <div key={item.id} className={`sefer-log-satir ${item.mutabakat ? 'mutabakat-kapali' : ''} ${seciliMi ? 'satir-secili' : ''}`}>
                    <div className="satir-secim">
                      <input
                        type="checkbox"
                        checked={seciliMi}
                        onChange={() => handleHafriyatCheckbox(item.id)}
                        className="premium-checkbox"
                      />
                    </div>
                    <div className="satir-saat-rozet">{item.saat || '--:--'}</div>
                    <div className="satir-plaka-alani">
                      <strong>{item.plaka}</strong>
                      {item.cariAdi ? <span className="satir-firma">🏢 {item.cariAdi}</span> : <span className="satir-firma atanmadi">Firma yok</span>}
                    </div>
                    <div className="satir-dokum-alani">
                      <span>📍 {item.dokumSahasi || 'Döküm Sahası'}</span>
                    </div>
                    {isYonetici && sFiyat > 0 && (
                      <span className={`saha-tutar-etiket ${item.mutabakat ? 'odendi' : 'acik'}`}>
                        {paraFormatla(sFiyat)} ₺
                      </span>
                    )}
                    <div className="satir-eylemler">
                      <button
                        type="button"
                        className={`saha-hesap-btn kucuk ${item.mutabakat ? 'goruldu' : 'bekliyor'}`}
                        onClick={() => handleHafriyatMutabakatDegistir(item.id)}
                      >
                        {item.mutabakat ? '✓ Görüldü' : '💳 Hesap Gör'}
                      </button>
                      <button type="button" className="satir-sil-buton" onClick={() => handleHafriyatSil(item.id)} title="Seferi sil">✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 8. ÇOKLU SEÇİM TOPLU İŞLEM ÇUBUĞU */}
      {seciliSayisi > 0 && (
        <div className="makine-toplu-islem-cubugu">
          <div className="toplu-secim-bilgi">
            <span className="secim-sayisi">{seciliSayisi}</span> kayıt seçildi
          </div>

          <div className="toplu-buton-grubu">
            <button type="button" className="toplu-aksiyon-buton cari-ata" onClick={() => setTopluCariModalAcik(true)}>
              🏢 Rehberden Firma Ata
            </button>
            <button type="button" className="toplu-aksiyon-buton mutabakat-kapat" onClick={() => handleTopluMutabakat(true)}>
              ✓ Hesap Görüldü İşaretle
            </button>
            <button type="button" className="toplu-aksiyon-buton mutabakat-ac" onClick={() => handleTopluMutabakat(false)}>
              ↩ Açık Borca Al
            </button>
            <button type="button" className="toplu-aksiyon-buton sil" onClick={handleTopluSil}>
              🗑️ Sil
            </button>
            <button
              type="button"
              className="toplu-aksiyon-buton iptal"
              onClick={() => {
                setSeciliMakineIds([])
                setSeciliHafriyatIds([])
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. MODAL: ULTRA KOMPAKT & HİZALI İŞ MAKİNESİ EKLEME PANELİ   */}
      {/* ============================================================ */}
      {makineModalAcik && (
        <div className="modal-arka-plan" onClick={() => setMakineModalAcik(false)}>
          <div className="modal-kutu makine-nizami-modal" onClick={(e) => e.stopPropagation()}>
            <div className="makine-modal-kompakt-baslik">
              <h3>{duzenlenenMakineId ? '✏️ İş Makinesi Kaydını Düzenle' : '🚜 İş Makinesi Çalışma Girişi'}</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setMakineModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleMakineKaydet} className="makine-nizami-form">
              {/* 1. SATIR: ŞANTİYE & TARİH (1FR | 1FR) */}
              <div className="nizami-iki-sutun-grid">
                <div className="nizami-alan-kutu">
                  <label className="nizami-ust-etiket">ŞANTİYE</label>
                  <select
                    value={formSantiyeId}
                    onChange={(e) => setFormSantiyeId(e.target.value)}
                    className="nizami-input"
                    required
                  >
                    {santiyeler.map(s => (
                      <option key={s.id} value={s.id}>{s.ad}</option>
                    ))}
                  </select>
                </div>

                <div className="nizami-alan-kutu">
                  <label className="nizami-ust-etiket">TARİH</label>
                  <input
                    type="date"
                    value={formTarih}
                    onChange={(e) => setFormTarih(e.target.value)}
                    className="nizami-input"
                    required
                  />
                </div>
              </div>

              {/* 2. SATIR: İŞ MAKİNESİ TÜRÜ (5 EŞİT SÜTUN) */}
              <div className="nizami-alan-kutu">
                <label className="nizami-ust-etiket">İŞ MAKİNESİ TÜRÜ</label>
                <div className="nizami-besli-hap-grid">
                  {MAKINE_TURLERI.map(tur => (
                    <button
                      key={tur}
                      type="button"
                      className={`nizami-secim-hap ${formMakineTuru === tur ? 'aktif' : ''}`}
                      onClick={() => setFormMakineTuru(tur)}
                    >
                      {tur}
                    </button>
                  ))}
                </div>
                {formMakineTuru === 'Diğer' && (
                  <input
                    type="text"
                    placeholder="Makine türünü yazın (Örn: Vinç, Mini Ekskavatör...)"
                    value={formManuelMakine}
                    onChange={(e) => setFormManuelMakine(e.target.value)}
                    className="nizami-input"
                    style={{ marginTop: 4 }}
                    required
                    autoFocus
                  />
                )}
              </div>

              {/* 3. SATIR: ÇALIŞMA SÜRESİ — TEK SATIRDA 8 HIZLI BUTON + ÖZEL SAAT GİRİŞİ */}
              <div className="nizami-alan-kutu">
                <label className="nizami-ust-etiket">ÇALIŞMA SÜRESİ (SAAT)</label>
                <div className="nizami-dokuzlu-saat-grid">
                  {HIZLI_SAATLER.map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`nizami-saat-hap ${Number(formCalismaSaati) === s ? 'aktif' : ''}`}
                      onClick={() => setFormCalismaSaati(s)}
                    >
                      {s}
                    </button>
                  ))}
                  <div className="kompakt-birim-kutu saat-ozel-kutu">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={formCalismaSaati}
                      onChange={(e) => setFormCalismaSaati(e.target.value)}
                      className="kompakt-birim-input merkez"
                      title="Buçuklu veya özel çalışma saati"
                      required
                    />
                    <span className="kompakt-birim-etiket">sa</span>
                  </div>
                </div>
              </div>

              {/* 4. SATIR: SAATLİK ÜCRETLENDİRME (OPSİYONEL - 1FR | 1FR) */}
              <div className="nizami-alan-kutu">
                <div className="nizami-etiket-satiri">
                  <label className="nizami-ust-etiket">SAATLİK ÜCRET (OPSİYONEL)</label>
                  {canliModalTutar > 0 && (
                    <span className="canli-tutar-rozet">
                      Toplam: {paraFormatla(canliModalTutar)}
                    </span>
                  )}
                </div>

                <div className="nizami-iki-sutun-grid">
                  <div className="kompakt-birim-kutu">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="1. Saat (Örn: 3000)"
                      value={formIlkSaatFiyati}
                      onChange={(e) => setFormIlkSaatFiyati(e.target.value)}
                      className="kompakt-birim-input"
                    />
                    <span className="kompakt-birim-etiket">₺ (1.Sa)</span>
                  </div>

                  <div className="kompakt-birim-kutu">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      placeholder="Sonraki (Örn: 2000)"
                      value={formSonrakiSaatFiyati}
                      onChange={(e) => setFormSonrakiSaatFiyati(e.target.value)}
                      className="kompakt-birim-input"
                    />
                    <span className="kompakt-birim-etiket">₺ / Sa</span>
                  </div>
                </div>
              </div>

              {/* 5. SATIR: FİRMA & YAPILAN İŞ (1FR | 1FR) */}
              <div className="nizami-iki-sutun-grid">
                <div className="nizami-alan-kutu">
                  <label className="nizami-ust-etiket">FİRMA / TAŞERON (OPSİYONEL)</label>
                  <input
                    type="text"
                    placeholder="Rehberden seç / yaz..."
                    value={formCariAdi}
                    onChange={(e) => {
                      setFormCariAdi(e.target.value)
                      setFormCariId(null)
                    }}
                    className="nizami-input"
                    list="cariler-listesi-makine"
                  />
                  <datalist id="cariler-listesi-makine">
                    {tumCariler.map(c => (
                      <option key={c.id} value={c.ad}>{c.sifat ? `${c.ad} (${c.sifat})` : c.ad}</option>
                    ))}
                  </datalist>
                </div>

                <div className="nizami-alan-kutu">
                  <label className="nizami-ust-etiket">YAPILAN İŞ / AÇIKLAMA</label>
                  <input
                    type="text"
                    placeholder="Örn: Temel kazısı, dolgu..."
                    value={formAciklama}
                    onChange={(e) => setFormAciklama(e.target.value)}
                    className="nizami-input"
                  />
                </div>
              </div>

              {/* 6. SATIR: FİŞ EKLE + VAZGEÇ + KAYDI EKLE */}
              {formGorselListesi.length > 0 && (
                <div className="irsaliye-foto-grid" style={{ marginTop: 2 }}>
                  {formGorselListesi.map((g, i) => (
                    <div key={g.id || i} className="irsaliye-foto-kapsayici">
                      <img
                        src={getGoogleDriveInlineImageUrl(g.url)}
                        alt="Fiş"
                        onClick={() => setBuyukGorselUrl(getGoogleDriveInlineImageUrl(g.url))}
                      />
                      <button type="button" className="foto-sil-mini-btn" onClick={() => handleFormGorselSil(g)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="makine-modal-uclu-alt-bar">
                <label className="kompakt-fis-ekle-btn" title="Çalışma fişi veya saha fotoğrafı yükle">
                  <span>{gorselYukleniyor ? '⏳ Yükleniyor...' : `📷 Fiş / Görsel${formGorselListesi.length > 0 ? ` (${formGorselListesi.length})` : ''}`}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMakineGorselSec}
                    style={{ display: 'none' }}
                    disabled={gorselYukleniyor}
                  />
                </label>

                <button type="button" className="modal-iptal-buton" onClick={() => setMakineModalAcik(false)}>
                  Vazgeç
                </button>

                <button type="submit" className="modal-onay-buton" disabled={gorselYukleniyor}>
                  {duzenlenenMakineId ? '💾 Kaydet' : '✓ Kaydı Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. MODAL: TOPLU CARİ / FİRMA ATAMA MODALI */}
      {topluCariModalAcik && (
        <div className="modal-arka-plan" onClick={() => setTopluCariModalAcik(false)}>
          <div className="modal-kutu makine-nizami-modal" onClick={(e) => e.stopPropagation()}>
            <div className="makine-modal-kompakt-baslik">
              <h3>🏢 Rehberden Firma Ata ({seciliSayisi} Kayıt)</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setTopluCariModalAcik(false)}>✕</button>
            </div>

            <div className="makine-nizami-form">
              <div className="nizami-alan-kutu">
                <label className="nizami-ust-etiket">FİRMA VEYA TAŞERON ADI</label>
                <input
                  type="text"
                  placeholder="Firma ara veya yeni isim yaz..."
                  value={secilenTopluCariAdi}
                  onChange={(e) => {
                    setSecilenTopluCariAdi(e.target.value)
                    setCariAramaInput(e.target.value)
                    setSecilenTopluCariId(null)
                  }}
                  className="nizami-input"
                  autoFocus
                />
              </div>

              <div className="rehber-oneri-listesi">
                {onerilenCariler.map(c => (
                  <div
                    key={c.id}
                    className={`rehber-oneri-kart ${secilenTopluCariAdi === c.ad ? 'secili' : ''}`}
                    onClick={() => {
                      setSecilenTopluCariAdi(c.ad)
                      setSecilenTopluCariId(c.id)
                    }}
                  >
                    <span className="oneri-ad">{c.ad}</span>
                    {c.sifat && <span className="oneri-sifat">{c.sifat}</span>}
                  </div>
                ))}
              </div>

              <div className="makine-modal-alt-butonlar">
                <button type="button" className="modal-iptal-buton" onClick={() => setTopluCariModalAcik(false)}>İptal</button>
                <button type="button" className="modal-onay-buton" onClick={handleTopluCariUygula}>{seciliSayisi} Kayda Uygula</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BÜYÜK GÖRSEL MODALI */}
      {buyukGorselUrl && (
        <div className="modal-arka-plan" onClick={() => setBuyukGorselUrl(null)}>
          <div className="modal-kutu buyuk-foto-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-kapat-btn ust-sag" onClick={() => setBuyukGorselUrl(null)}>✕</button>
            <img src={buyukGorselUrl} alt="Büyük Görsel" className="buyuk-resim-icerik" />
          </div>
        </div>
      )}
    </div>
  )
}
