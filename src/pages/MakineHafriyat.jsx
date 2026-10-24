import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const bugun = () => new Date().toISOString().slice(0, 10)

const gunEkle = (tarihStr, gunSayisi) => {
  const d = new Date(tarihStr)
  d.setDate(d.getDate() + gunSayisi)
  return d.toISOString().slice(0, 10)
}

const tarihFormatlaTR = (tarihStr) => {
  if (!tarihStr) return ''
  const parts = tarihStr.split('-')
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  }
  return tarihStr
}

const AY_ISIMLERI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

const MAKINE_TURLERI = ['JCB', 'Bobcat', 'Kato Ekskavatör', 'Manitou', 'Diğer']

// 0.5'ten başlayıp 0.5 katları şeklinde 8.0 saate kadar
const HAZIR_SAATLER = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]

const LOCAL_STORAGE_MAKINE = 'santiye_makine_kayitlari_v1'
const LOCAL_STORAGE_HAFRIYAT = 'santiye_hafriyat_seferleri_v1'

export default function MakineHafriyat() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()

  // Aktif Sekme: 'makine' | 'hafriyat'
  const [aktifSekme, setAktifSekme] = useState('makine')

  // Seçili Tarih (Varsayılan Bugün)
  const [seciliTarih, setSeciliTarih] = useState(bugun())
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [durumFiltresi, setDurumFiltresi] = useState('hepsi') // 'hepsi' | 'aktif' | 'mutabakat'
  const [aramaMetni, setAramaMetni] = useState('')

  // Veri Listeleri
  const [makineListesi, setMakineListesi] = useState([])
  const [hafriyatListesi, setHafriyatListesi] = useState([])

  // Rehber (Cari / Taşeron) Listesi
  const [tumCariler, setTumCariler] = useState([])

  // Çoklu Seçim
  const [seciliMakineIds, setSeciliMakineIds] = useState([])
  const [seciliHafriyatIds, setSeciliHafriyatIds] = useState([])

  // Toplu Cari Atama Modalı
  const [topluCariModalAcik, setTopluCariModalAcik] = useState(false)
  const [secilenTopluCariAdi, setSecilenTopluCariAdi] = useState('')
  const [secilenTopluCariId, setSecilenTopluCariId] = useState(null)
  const [cariAramaInput, setCariAramaInput] = useState('')

  // --- MATRİS (TAKVİM) STATE'LERİ ---
  const [matrisAcik, setMatrisAcik] = useState(true)
  const [matrisYil, setMatrisYil] = useState(() => new Date().getFullYear())
  const [matrisAy, setMatrisAy] = useState(() => new Date().getMonth()) // 0 - 11

  // --- İŞ MAKİNESİ EKLEME FORMU STATE'LERİ ---
  const [formMakineTuru, setFormMakineTuru] = useState('JCB')
  const [formManuelMakine, setFormManuelMakine] = useState('')
  const [formCalismaSaati, setFormCalismaSaati] = useState(2.0)
  const [manuelSaatModu, setManuelSaatModu] = useState(false)
  const [formAciklama, setFormAciklama] = useState('')
  const [formCariAdi, setFormCariAdi] = useState('')
  const [formCariId, setFormCariId] = useState(null)
  const [duzenlenenMakineId, setDuzenlenenMakineId] = useState(null)

  // --- HAFRİYAT HIZLI SEFER BAŞLATMA & KART AÇMA STATE'LERİ ---
  const [hizliPlakaInput, setHizliPlakaInput] = useState('')
  const [duzenlenenPlaka, setDuzenlenenPlaka] = useState(null) // Inline plaka düzenleme: plaka string
  const [geciciPlakaMetni, setGeciciPlakaMetni] = useState('')
  const [acikKamyonKartlari, setAcikKamyonKartlari] = useState({}) // { [plaka]: true/false }

  // Şantiye değiştiğinde form şantiyesini güncelle
  useEffect(() => {
    if (aktifSantiye?.id) {
      setSeciliSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  // Rehberden taşeron/cari verilerini çek
  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, sifat, firma').then(({ data, error }) => {
      if (!error && data) setTumCariler(data)
    })
  }, [])

  // LocalStorage'dan kayıtları oku (Yoksa örnek veriler ile başlat)
  useEffect(() => {
    try {
      const kayitliMakine = localStorage.getItem(LOCAL_STORAGE_MAKINE)
      if (kayitliMakine) {
        setMakineListesi(JSON.parse(kayitliMakine))
      } else {
        const ornekMakine = [
          {
            id: 'm-1',
            tarih: bugun(),
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            makineTuru: 'JCB',
            calismaSaati: 4.5,
            aciklama: 'Temel hafriyatı kazı ve yükleme',
            cariAdi: 'Kaya Hafriyat Ltd.',
            cariId: null,
            mutabakat: false,
            olusturulduAt: new Date().toISOString()
          },
          {
            id: 'm-2',
            tarih: bugun(),
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            makineTuru: 'Bobcat',
            calismaSaati: 2.0,
            aciklama: 'Bodrum kat içi moloz taşıma',
            cariAdi: '',
            cariId: null,
            mutabakat: false,
            olusturulduAt: new Date().toISOString()
          },
          {
            id: 'm-3',
            tarih: gunEkle(bugun(), -1),
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            makineTuru: 'Kato Ekskavatör',
            calismaSaati: 8.0,
            aciklama: 'Kaba kazı çalışması',
            cariAdi: 'Özdemir Hafriyat',
            cariId: null,
            mutabakat: true,
            olusturulduAt: new Date().toISOString()
          }
        ]
        setMakineListesi(ornekMakine)
        localStorage.setItem(LOCAL_STORAGE_MAKINE, JSON.stringify(ornekMakine))
      }

      const kayitliHafriyat = localStorage.getItem(LOCAL_STORAGE_HAFRIYAT)
      if (kayitliHafriyat) {
        setHafriyatListesi(JSON.parse(kayitliHafriyat))
      } else {
        const ornekHafriyat = [
          {
            id: 'h-1',
            tarih: bugun(),
            saat: '09:30',
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            plaka: '34 KMY 452',
            dokumSahasi: 'Cebeci Döküm Sahası',
            cariAdi: 'Kaya Nakliyat',
            cariId: null,
            mutabakat: false,
            aciklama: 'Kaba kazı toprağı'
          },
          {
            id: 'h-2',
            tarih: bugun(),
            saat: '11:15',
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            plaka: '34 KMY 452',
            dokumSahasi: 'Cebeci Döküm Sahası',
            cariAdi: 'Kaya Nakliyat',
            cariId: null,
            mutabakat: false,
            aciklama: 'Kaba kazı toprağı'
          },
          {
            id: 'h-3',
            tarih: bugun(),
            saat: '10:45',
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            plaka: '34 TRK 980',
            dokumSahasi: 'Kemerburgaz Sahası',
            cariAdi: 'Özdemir Lojistik',
            cariId: null,
            mutabakat: true,
            aciklama: 'Moloz dökümü'
          },
          {
            id: 'h-4',
            tarih: gunEkle(bugun(), -1),
            saat: '14:20',
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            plaka: '34 TRK 980',
            dokumSahasi: 'Kemerburgaz Sahası',
            cariAdi: 'Özdemir Lojistik',
            cariId: null,
            mutabakat: true,
            aciklama: 'Temel hafriyatı'
          }
        ]
        setHafriyatListesi(ornekHafriyat)
        localStorage.setItem(LOCAL_STORAGE_HAFRIYAT, JSON.stringify(ornekHafriyat))
      }
    } catch (e) {
      console.error('LocalStorage okuma hatası:', e)
    }
  }, [])

  // Değişiklikleri LocalStorage'a yaz
  const makineListesiniKaydet = (yeniListe) => {
    setMakineListesi(yeniListe)
    try {
      localStorage.setItem(LOCAL_STORAGE_MAKINE, JSON.stringify(yeniListe))
    } catch (e) {
      console.error(e)
    }
  }

  const hafriyatListesiniKaydet = (yeniListe) => {
    setHafriyatListesi(yeniListe)
    try {
      localStorage.setItem(LOCAL_STORAGE_HAFRIYAT, JSON.stringify(yeniListe))
    } catch (e) {
      console.error(e)
    }
  }

  // --- İŞ MAKİNESİ KAYDETME ---
  const handleMakineKaydet = (e) => {
    e.preventDefault()
    const sonMakineTuru = formMakineTuru === 'Diğer' ? (formManuelMakine.trim() || 'Diğer') : formMakineTuru
    const saat = parseFloat(formCalismaSaati) || 0

    if (saat <= 0) {
      alert('Lütfen geçerli bir çalışma saati belirleyin.')
      return
    }

    const santiyeObj = santiyeler.find(s => s.id === seciliSantiyeId) || aktifSantiye

    if (duzenlenenMakineId) {
      const guncel = makineListesi.map(item => {
        if (item.id === duzenlenenMakineId) {
          return {
            ...item,
            tarih: seciliTarih,
            santiyeId: seciliSantiyeId || item.santiyeId,
            santiyeAdi: santiyeObj?.ad || item.santiyeAdi,
            makineTuru: sonMakineTuru,
            calismaSaati: saat,
            aciklama: formAciklama.trim(),
            cariAdi: formCariAdi.trim(),
            cariId: formCariId,
          }
        }
        return item
      })
      makineListesiniKaydet(guncel)
      setDuzenlenenMakineId(null)
    } else {
      const yeniKayit = {
        id: 'm-' + Date.now(),
        tarih: seciliTarih,
        santiyeId: seciliSantiyeId || aktifSantiye?.id || 'varsayilan',
        santiyeAdi: santiyeObj?.ad || aktifSantiye?.ad || 'Şantiye',
        makineTuru: sonMakineTuru,
        calismaSaati: saat,
        aciklama: formAciklama.trim(),
        cariAdi: formCariAdi.trim(),
        cariId: formCariId,
        mutabakat: false,
        olusturulduAt: new Date().toISOString()
      }
      makineListesiniKaydet([yeniKayit, ...makineListesi])
    }

    setFormAciklama('')
    setFormManuelMakine('')
    setFormCariAdi('')
    setFormCariId(null)
  }

  const handleMakineDuzenle = (item) => {
    setDuzenlenenMakineId(item.id)
    if (MAKINE_TURLERI.includes(item.makineTuru)) {
      setFormMakineTuru(item.makineTuru)
      setFormManuelMakine('')
    } else {
      setFormMakineTuru('Diğer')
      setFormManuelMakine(item.makineTuru)
    }
    setFormCalismaSaati(item.calismaSaati)
    setManuelSaatModu(!HAZIR_SAATLER.includes(item.calismaSaati))
    setFormAciklama(item.aciklama || '')
    setFormCariAdi(item.cariAdi || '')
    setFormCariId(item.cariId || null)
    setSeciliTarih(item.tarih)
    window.scrollTo({ top: 380, behavior: 'smooth' })
  }

  const handleMakineSil = (id) => {
    if (window.confirm('Bu makine çalışma kaydını silmek istediğinize emin misiniz?')) {
      const guncel = makineListesi.filter(m => m.id !== id)
      makineListesiniKaydet(guncel)
      setSeciliMakineIds(prev => prev.filter(x => x !== id))
    }
  }

  // --- HAFRİYAT: ÇOK PRATİK İLK SEFERİ BAŞLATMA ---
  const handleHizliSeferBaslat = (e) => {
    e?.preventDefault()
    let plaka = hizliPlakaInput.trim().toUpperCase()

    // Eğer plaka yazılmadıysa hızlıca geçici plaka verilebilir, sonra tıklanıp düzeltilebilir
    if (!plaka) {
      const mevcutKamyonSayisi = new Set(hafriyatListesi.map(h => h.plaka)).size
      plaka = `ARAÇ ${mevcutKamyonSayisi + 1}`
    }

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const santiyeObj = santiyeler.find(s => s.id === seciliSantiyeId) || aktifSantiye
    const onceki = hafriyatListesi.find(h => h.plaka === plaka)

    const yeniSefer = {
      id: 'h-' + Date.now(),
      tarih: seciliTarih,
      saat: saatFormat,
      santiyeId: seciliSantiyeId || aktifSantiye?.id || 'varsayilan',
      santiyeAdi: santiyeObj?.ad || aktifSantiye?.ad || 'Şantiye',
      plaka: plaka,
      dokumSahasi: onceki?.dokumSahasi || 'Cebeci Döküm Sahası',
      cariAdi: onceki?.cariAdi || '',
      cariId: onceki?.cariId || null,
      mutabakat: false,
      aciklama: 'Hafriyat seferi'
    }

    hafriyatListesiniKaydet([yeniSefer, ...hafriyatListesi])
    setHizliPlakaInput('')
  }

  // Kamyona +1 Sefer Ekle
  const handleKamyonSeferEkle = (plaka) => {
    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const santiyeObj = santiyeler.find(s => s.id === seciliSantiyeId) || aktifSantiye
    const onceki = hafriyatListesi.find(h => h.plaka === plaka)

    const yeniSefer = {
      id: 'h-' + Date.now(),
      tarih: seciliTarih,
      saat: saatFormat,
      santiyeId: seciliSantiyeId || aktifSantiye?.id || 'varsayilan',
      santiyeAdi: santiyeObj?.ad || aktifSantiye?.ad || 'Şantiye',
      plaka: plaka,
      dokumSahasi: onceki?.dokumSahasi || 'Döküm Sahası',
      cariAdi: onceki?.cariAdi || '',
      cariId: onceki?.cariId || null,
      mutabakat: false,
      aciklama: 'Hafriyat seferi'
    }

    hafriyatListesiniKaydet([yeniSefer, ...hafriyatListesi])
  }

  // Son Seferi Geri Al (-1)
  const handleSonSeferiGeriAl = (plaka) => {
    const index = hafriyatListesi.findIndex(h => h.plaka === plaka && h.tarih === seciliTarih)
    if (index !== -1) {
      if (window.confirm(`${plaka} aracının son seferi silinsin mi?`)) {
        const yeni = [...hafriyatListesi]
        yeni.splice(index, 1)
        hafriyatListesiniKaydet(yeni)
      }
    }
  }

  // Tıklanabilir Plakayı Düzenleme
  const handlePlakaKaydet = (eskiPlaka) => {
    const yeni = geciciPlakaMetni.trim().toUpperCase()
    if (!yeni) {
      setDuzenlenenPlaka(null)
      return
    }

    // Bu plakaya ait tüm seferlerin plakasını güncelle
    const guncel = hafriyatListesi.map(h => {
      if (h.plaka === eskiPlaka) {
        return { ...h, plaka: yeni }
      }
      return h
    })
    hafriyatListesiniKaydet(guncel)
    setDuzenlenenPlaka(null)
    setGeciciPlakaMetni('')
  }

  // Kamyon Kartı Detay Güncelleme (Firma, Döküm sahası vb.)
  const handleKamyonDetayGuncelle = (plaka, alan, deger) => {
    const guncel = hafriyatListesi.map(h => {
      if (h.plaka === plaka && h.tarih === seciliTarih) {
        return { ...h, [alan]: deger }
      }
      return h
    })
    hafriyatListesiniKaydet(guncel)
  }

  // Kamyon Kartı Aç/Kapat (Accordion)
  const toggleKamyonKartAc = (plaka) => {
    setAcikKamyonKartlari(prev => ({
      ...prev,
      [plaka]: !prev[plaka]
    }))
  }

  // Sefer Sil
  const handleHafriyatSil = (id) => {
    if (window.confirm('Bu sefer kaydını silmek istediğinize emin misiniz?')) {
      const guncel = hafriyatListesi.filter(h => h.id !== id)
      hafriyatListesiniKaydet(guncel)
      setSeciliHafriyatIds(prev => prev.filter(x => x !== id))
    }
  }

  // --- MÜTABAKAT (HESAP KAPATMA) ---
  const handleMakineMutabakatDegistir = (id) => {
    const guncel = makineListesi.map(m => {
      if (m.id === id) return { ...m, mutabakat: !m.mutabakat }
      return m
    })
    makineListesiniKaydet(guncel)
  }

  const handleHafriyatMutabakatDegistir = (id) => {
    const guncel = hafriyatListesi.map(h => {
      if (h.id === id) return { ...h, mutabakat: !h.mutabakat }
      return h
    })
    hafriyatListesiniKaydet(guncel)
  }

  // Bir kamyona ait bugünkü tüm seferlerin mütabakatını topluca aç/kapat
  const handleKamyonTumSeferlerMutabakat = (plaka, yeniDurum) => {
    const guncel = hafriyatListesi.map(h => {
      if (h.plaka === plaka && h.tarih === seciliTarih) {
        return { ...h, mutabakat: yeniDurum }
      }
      return h
    })
    hafriyatListesiniKaydet(guncel)
  }

  // --- ÇOKLU SEÇİM İŞLEMLERİ (BATCH ACTIONS) ---
  const handleMakineCheckbox = (id) => {
    setSeciliMakineIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleHafriyatCheckbox = (id) => {
    setSeciliHafriyatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
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
      const guncel = makineListesi.map(m => {
        if (seciliMakineIds.includes(m.id)) return { ...m, mutabakat: yeniDurum }
        return m
      })
      makineListesiniKaydet(guncel)
      setSeciliMakineIds([])
    } else {
      const guncel = hafriyatListesi.map(h => {
        if (seciliHafriyatIds.includes(h.id)) return { ...h, mutabakat: yeniDurum }
        return m
      })
      hafriyatListesiniKaydet(guncel)
      setSeciliHafriyatIds([])
    }
  }

  const handleTopluSil = () => {
    const sayi = aktifSekme === 'makine' ? seciliMakineIds.length : seciliHafriyatIds.length
    if (window.confirm(`Seçilen ${sayi} kaydı tamamen silmek istediğinize emin misiniz?`)) {
      if (aktifSekme === 'makine') {
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

  // Toplu Cari / Firma Ata
  const handleTopluCariUygula = () => {
    const firmaAdi = secilenTopluCariAdi.trim()
    if (!firmaAdi) {
      alert('Lütfen bir firma / cari seçin veya yazın.')
      return
    }

    if (aktifSekme === 'makine') {
      const guncel = makineListesi.map(m => {
        if (seciliMakineIds.includes(m.id)) {
          return { ...m, cariAdi: firmaAdi, cariId: secilenTopluCariId }
        }
        return m
      })
      makineListesiniKaydet(guncel)
      setSeciliMakineIds([])
    } else {
      const guncel = hafriyatListesi.map(h => {
        if (seciliHafriyatIds.includes(h.id)) {
          return { ...h, cariAdi: firmaAdi, cariId: secilenTopluCariId }
        }
        return h
      })
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

  // İstatistikler
  const toplamMakineSaati = useMemo(() => {
    return filtrelenmisMakineler.reduce((t, m) => t + (Number(m.calismaSaati) || 0), 0)
  }, [filtrelenmisMakineler])

  const toplamSeferSayisi = useMemo(() => {
    return filtrelenmisHafriyat.length
  }, [filtrelenmisHafriyat])

  // Kamyon bazlı günlük çetele özeti
  const kamyonOzetleri = useMemo(() => {
    const harita = {}
    hafriyatListesi.forEach(item => {
      if (!harita[item.plaka]) {
        harita[item.plaka] = {
          plaka: item.plaka,
          bugunSefer: 0,
          bugunMutabakatliSefer: 0,
          cariAdi: item.cariAdi || '',
          dokumSahasi: item.dokumSahasi || '',
          aciklama: item.aciklama || '',
          seferSaatleri: []
        }
      }
      if (item.tarih === seciliTarih && (!seciliSantiyeId || item.santiyeId === seciliSantiyeId)) {
        harita[item.plaka].bugunSefer += 1
        if (item.mutabakat) harita[item.plaka].bugunMutabakatliSefer += 1
        if (item.saat) harita[item.plaka].seferSaatleri.push({ id: item.id, saat: item.saat, mutabakat: item.mutabakat })
        if (item.cariAdi) harita[item.plaka].cariAdi = item.cariAdi
        if (item.dokumSahasi) harita[item.plaka].dokumSahasi = item.dokumSahasi
        if (item.aciklama) harita[item.plaka].aciklama = item.aciklama
      }
    })
    return Object.values(harita)
  }, [hafriyatListesi, seciliTarih, seciliSantiyeId])

  // Rehber Arama Önerileri
  const onerilenCariler = useMemo(() => {
    if (!cariAramaInput.trim()) return tumCariler.slice(0, 10)
    const aranan = cariAramaInput.toLocaleLowerCase('tr-TR')
    return tumCariler.filter(c => 
      c.ad?.toLocaleLowerCase('tr-TR').includes(aranan) || 
      c.firma?.toLocaleLowerCase('tr-TR').includes(aranan)
    ).slice(0, 10)
  }, [tumCariler, cariAramaInput])

  // =========================================================================
  // 3. TARİH MÜTABAKAT MATRİSİ HESAPLAMALARI
  // Kural:
  // - O güne ait tüm mütabakat yapılmışsa: YEŞİL
  // - Bir kısmı yapılmışsa: SARI
  // - Hiçbiri yapılmamışsa: KIRMIZI
  // - Hiç işlem yoksa: DOLGU YOK (Şeffaf / Nötr)
  // =========================================================================
  const matrisGunleri = useMemo(() => {
    const gunler = []
    const ayinIlkGunu = new Date(matrisYil, matrisAy, 1)
    const ayinSonGunu = new Date(matrisYil, matrisAy + 1, 0)
    const toplamGun = ayinSonGunu.getDate()

    // Pazartesi başlangıçlı gün indeksi (0: Pzt, 6: Paz)
    let ilkGunHaftaIndeksi = ayinIlkGunu.getDay() - 1
    if (ilkGunHaftaIndeksi === -1) ilkGunHaftaIndeksi = 6

    // Boşluklar (Önceki aydan kalan)
    for (let i = 0; i < ilkGunHaftaIndeksi; i++) {
      gunler.push({ bosluk: true, id: `bos-${i}` })
    }

    // Ayın günleri
    for (let g = 1; g <= toplamGun; g++) {
      const gStr = g < 10 ? `0${g}` : `${g}`
      const aStr = (matrisAy + 1) < 10 ? `0${matrisAy + 1}` : `${matrisAy + 1}`
      const tarihKey = `${matrisYil}-${aStr}-${gStr}`

      // Bu tarihe ait işlemler (Şantiye seçiliyse o şantiye)
      const mIslemler = makineListesi.filter(m => m.tarih === tarihKey && (!seciliSantiyeId || m.santiyeId === seciliSantiyeId))
      const hIslemler = hafriyatListesi.filter(h => h.tarih === tarihKey && (!seciliSantiyeId || h.santiyeId === seciliSantiyeId))

      const toplamIslem = mIslemler.length + hIslemler.length
      const mutabakatliIslem = mIslemler.filter(m => m.mutabakat).length + hIslemler.filter(h => h.mutabakat).length

      let durumRengi = 'yok' // 'yok' (dolgu yok) | 'yesil' | 'sari' | 'kirmizi'
      if (toplamIslem > 0) {
        if (mutabakatliIslem === toplamIslem) {
          durumRengi = 'yesil'
        } else if (mutabakatliIslem > 0) {
          durumRengi = 'sari'
        } else {
          durumRengi = 'kirmizi'
        }
      }

      gunler.push({
        bosluk: false,
        gunNo: g,
        tarihKey,
        toplamIslem,
        mutabakatliIslem,
        durumRengi,
        makineSayisi: mIslemler.length,
        hafriyatSayisi: hIslemler.length
      })
    }

    return gunler
  }, [matrisYil, matrisAy, makineListesi, hafriyatListesi, seciliSantiyeId])

  const matrisAyDegistir = (fark) => {
    let yeniAy = matrisAy + fark
    let yeniYil = matrisYil
    if (yeniAy < 0) {
      yeniAy = 11
      yeniYil -= 1
    } else if (yeniAy > 11) {
      yeniAy = 0
      yeniYil += 1
    }
    setMatrisAy(yeniAy)
    setMatrisYil(yeniYil)
  }

  const seciliSayisi = aktifSekme === 'makine' ? seciliMakineIds.length : seciliHafriyatIds.length

  return (
    <div className="sayfa makine-hafriyat-sayfasi">
      {/* 1. ÜST BAŞLIK VE GÖSTERGELER */}
      <div className="makine-ust-baslik-alani">
        <div className="makine-baslik-satiri">
          <div className="makine-baslik-metin">
            <h1>🚜 Saha Operasyon Takibi</h1>
            <p className="makine-alt-bilgi">İş makineleri çalışma saati, hafriyat sefer çetelesi ve mütabakat matrisi</p>
          </div>
          <div className="makine-canli-badge">
            <span>●</span> Yerel Çalışma Modu
          </div>
        </div>

        {/* ÖZET KARTLARI */}
        <div className="makine-kpi-kartlari">
          <div className="makine-kpi-kart turuncu">
            <div className="makine-kpi-ikon">🚜</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">{toplamMakineSaati.toFixed(1)} <small>Saat</small></span>
              <span className="makine-kpi-etiket">Seçili Gün Makine Saati</span>
            </div>
          </div>
          <div className="makine-kpi-kart mavi">
            <div className="makine-kpi-ikon">🚛</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">{toplamSeferSayisi} <small>Sefer</small></span>
              <span className="makine-kpi-etiket">Seçili Gün Hafriyat Çıkışı</span>
            </div>
          </div>
          <div className="makine-kpi-kart yesil">
            <div className="makine-kpi-ikon">⚖️</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">
                {aktifSekme === 'makine' 
                  ? filtrelenmisMakineler.filter(m => m.mutabakat).length 
                  : filtrelenmisHafriyat.filter(h => h.mutabakat).length
                } / {aktifSekme === 'makine' ? filtrelenmisMakineler.length : filtrelenmisHafriyat.length}
              </span>
              <span className="makine-kpi-etiket">Mütabakatı Kapatılanlar</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MÜTABAKAT TAKVİM MATRİSİ (Aylık Durum Haritası)          */}
      {/* ============================================================ */}
      <div className="matris-kapsayici-kart">
        <div className="matris-baslik-bar" onClick={() => setMatrisAcik(prev => !prev)}>
          <div className="matris-baslik-sol">
            <span className="matris-ikon">📅</span>
            <div>
              <h3>Aylık Mütabakat Matrisi ({AY_ISIMLERI[matrisAy]} {matrisYil})</h3>
              <p className="matris-aciklama-kucuk">Günlük operasyonların mütabakat durumunu tek bakışta görün</p>
            </div>
          </div>
          <div className="matris-baslik-sag">
            <span className="matris-ac-kapat-ok">{matrisAcik ? '▲ Gizle' : '▼ Göster'}</span>
          </div>
        </div>

        {matrisAcik && (
          <div className="matris-govde">
            {/* Ay Değiştirici */}
            <div className="matris-ay-secici">
              <button type="button" className="matris-ay-ok" onClick={() => matrisAyDegistir(-1)}>‹ Önceki Ay</button>
              <span className="matris-secili-ay-metin">{AY_ISIMLERI[matrisAy]} {matrisYil}</span>
              <button type="button" className="matris-ay-ok" onClick={() => matrisAyDegistir(1)}>Sonraki Ay ›</button>
            </div>

            {/* Matris Gün İsimleri */}
            <div className="matris-haftanin-gunleri">
              <span>Pzt</span>
              <span>Sal</span>
              <span>Çar</span>
              <span>Per</span>
              <span>Cum</span>
              <span>Cmt</span>
              <span>Paz</span>
            </div>

            {/* Matris Gün Hücreleri */}
            <div className="matris-izgara">
              {matrisGunleri.map((item, idx) => {
                if (item.bosluk) {
                  return <div key={item.id} className="matris-hucre bosluk" />
                }

                const seciliMi = item.tarihKey === seciliTarih
                const bugunMu = item.tarihKey === bugun()

                return (
                  <div
                    key={item.tarihKey}
                    className={`matris-hucre durum-${item.durumRengi} ${seciliMi ? 'aktif-gun' : ''} ${bugunMu ? 'bugun-cerceve' : ''}`}
                    onClick={() => setSeciliTarih(item.tarihKey)}
                    title={`${item.tarihKey}: ${item.toplamIslem} işlem (${item.mutabakatliIslem} mütabakat yapıldı)`}
                  >
                    <span className="matris-gun-no">{item.gunNo}</span>
                    {item.toplamIslem > 0 && (
                      <span className="matris-islem-sayac">
                        {item.mutabakatliIslem}/{item.toplamIslem}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Matris Renk Açıklamaları (Legend) */}
            <div className="matris-lejant">
              <div className="lejant-oge">
                <span className="lejant-nokta durum-yesil" />
                <span>Tümü Mütabakat Yapıldı</span>
              </div>
              <div className="lejant-oge">
                <span className="lejant-nokta durum-sari" />
                <span>Kısmi Mütabakat</span>
              </div>
              <div className="lejant-oge">
                <span className="lejant-nokta durum-kirmizi" />
                <span>Mütabakat Yok (Açık Hesap)</span>
              </div>
              <div className="lejant-oge">
                <span className="lejant-nokta durum-yok" />
                <span>İşlem Yok</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SEKME BUTONLARI (Pill Switcher) */}
      <div className="makine-sekme-secici">
        <button
          type="button"
          className={`makine-sekme-buton ${aktifSekme === 'makine' ? 'aktif' : ''}`}
          onClick={() => {
            setAktifSekme('makine')
            setSeciliMakineIds([])
            setSeciliHafriyatIds([])
          }}
        >
          <span className="sekme-ikon">🚜</span>
          <span className="sekme-baslik">İş Makineleri</span>
          <span className="sekme-sayac">{filtrelenmisMakineler.length}</span>
        </button>

        <button
          type="button"
          className={`makine-sekme-buton ${aktifSekme === 'hafriyat' ? 'aktif' : ''}`}
          onClick={() => {
            setAktifSekme('hafriyat')
            setSeciliMakineIds([])
            setSeciliHafriyatIds([])
          }}
        >
          <span className="sekme-ikon">🚛</span>
          <span className="sekme-baslik">Hafriyat Seferleri</span>
          <span className="sekme-sayac">{filtrelenmisHafriyat.length}</span>
        </button>
      </div>

      {/* 4. ŞANTİYE & TARİH FİLTRELEME ÇUBUĞU */}
      <div className="makine-kontrol-paneli">
        {/* Şantiye Seçici */}
        <div className="makine-filtre-oge santiye-secimi">
          <label>Şantiye:</label>
          <select 
            value={seciliSantiyeId} 
            onChange={(e) => setSeciliSantiyeId(e.target.value)}
            className="makine-select"
          >
            <option value="">Tüm Şantiyeler</option>
            {santiyeler.map(s => (
              <option key={s.id} value={s.id}>{s.ad}</option>
            ))}
          </select>
        </div>

        {/* Tarih Gezgini */}
        <div className="makine-filtre-oge tarih-gezgini">
          <label>Seçili Gün:</label>
          <div className="tarih-buton-grubu">
            <button 
              type="button" 
              className="tarih-ok-buton" 
              onClick={() => setSeciliTarih(prev => gunEkle(prev, -1))}
              title="Önceki Gün"
            >
              ‹
            </button>
            <input 
              type="date" 
              value={seciliTarih} 
              onChange={(e) => setSeciliTarih(e.target.value)}
              className="makine-tarih-input"
            />
            <button 
              type="button" 
              className="tarih-ok-buton" 
              onClick={() => setSeciliTarih(prev => gunEkle(prev, 1))}
              title="Sonraki Gün"
            >
              ›
            </button>
            {seciliTarih !== bugun() && (
              <button 
                type="button" 
                className="tarih-bugun-buton"
                onClick={() => setSeciliTarih(bugun())}
              >
                Bugün
              </button>
            )}
          </div>
        </div>

        {/* Durum Filtresi */}
        <div className="makine-filtre-oge durum-secimi">
          <label>Mütabakat:</label>
          <div className="durum-haplari">
            <button 
              type="button" 
              className={`durum-hap ${durumFiltresi === 'hepsi' ? 'secili' : ''}`}
              onClick={() => setDurumFiltresi('hepsi')}
            >
              Tümü
            </button>
            <button 
              type="button" 
              className={`durum-hap ${durumFiltresi === 'aktif' ? 'secili' : ''}`}
              onClick={() => setDurumFiltresi('aktif')}
            >
              Açık Hesap
            </button>
            <button 
              type="button" 
              className={`durum-hap ${durumFiltresi === 'mutabakat' ? 'secili' : ''}`}
              onClick={() => setDurumFiltresi('mutabakat')}
            >
              Kapatıldı
            </button>
          </div>
        </div>

        {/* Arama Kutusu */}
        <div className="makine-filtre-oge arama-alani">
          <input
            type="text"
            placeholder={aktifSekme === 'makine' ? "Makine, firma, açıklama ara..." : "Plaka, döküm yeri, firma ara..."}
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            className="makine-arama-input"
          />
          {aramaMetni && (
            <button type="button" className="arama-temizle" onClick={() => setAramaMetni('')}>✕</button>
          )}
        </div>
      </div>

      {/* TARİH ŞERİDİ */}
      <div className="makine-tarih-seridi">
        <span>📅 {tarihFormatlaTR(seciliTarih)}</span>
        {seciliSantiyeId && (
          <span className="santiye-etiket-rozet">
            🏗️ {santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Seçili Şantiye'}
          </span>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. SEKME 1: İŞ MAKİNELERİ ÇALIŞMA SAATİ TAKİBİ              */}
      {/* ============================================================ */}
      {aktifSekme === 'makine' && (
        <div className="makine-sekme-icerik">
          {/* HIZLI EKLEME FORMU */}
          <form className="makine-ekleme-karti" onSubmit={handleMakineKaydet}>
            <div className="form-baslik">
              <h3>
                {duzenlenenMakineId ? '✏️ İş Makinesi Kaydını Düzenle' : '➕ Hızlı İş Makinesi Çalışma Girişi'}
              </h3>
              {duzenlenenMakineId && (
                <button 
                  type="button" 
                  className="vazgec-buton-kucuk" 
                  onClick={() => {
                    setDuzenlenenMakineId(null)
                    setFormAciklama('')
                    setFormManuelMakine('')
                    setFormCariAdi('')
                  }}
                >
                  ✕ Vazgeç
                </button>
              )}
            </div>

            {/* Hızlı Makine Türü Seçimi (Chips) */}
            <div className="form-satir">
              <label className="alan-baslik">İş Makinesi Türü:</label>
              <div className="makine-turu-haplari">
                {MAKINE_TURLERI.map(tur => (
                  <button
                    key={tur}
                    type="button"
                    className={`makine-chip ${formMakineTuru === tur ? 'aktif' : ''}`}
                    onClick={() => setFormMakineTuru(tur)}
                  >
                    {tur === 'JCB' && '🚜 '}
                    {tur === 'Bobcat' && '🚜 '}
                    {tur === 'Kato Ekskavatör' && '🏗️ '}
                    {tur === 'Manitou' && '🏗️ '}
                    {tur === 'Diğer' && '⚙️ '}
                    {tur}
                  </button>
                ))}
              </div>

              {formMakineTuru === 'Diğer' && (
                <div className="manuel-makine-girisi">
                  <input
                    type="text"
                    placeholder="Örn: Silindir, Mini Ekskavatör, Vinç, Dozer..."
                    value={formManuelMakine}
                    onChange={(e) => setFormManuelMakine(e.target.value)}
                    className="makine-input"
                    autoFocus
                    required
                  />
                </div>
              )}
            </div>

            {/* Çalışma Saati: 0.5'ten başlayıp 8.0'e kadar 0.5 katları, gerisi için manuel */}
            <div className="form-satir">
              <div className="saat-baslik-satiri">
                <label className="alan-baslik">Çalışma Süresi (0.5 - 8.0 Saat):</label>
                <div className="secili-saat-vurgu">{formCalismaSaati} Saat</div>
              </div>

              <div className="hizli-saat-grid">
                {HAZIR_SAATLER.map(saat => (
                  <button
                    key={saat}
                    type="button"
                    className={`saat-chip-kare ${!manuelSaatModu && parseFloat(formCalismaSaati) === saat ? 'aktif' : ''}`}
                    onClick={() => {
                      setFormCalismaSaati(saat)
                      setManuelSaatModu(false)
                    }}
                  >
                    {saat.toFixed(1)} sa
                  </button>
                ))}

                {/* Diğer (Manuel) Butonu */}
                <button
                  type="button"
                  className={`saat-chip-kare diger-saat ${manuelSaatModu ? 'aktif' : ''}`}
                  onClick={() => setManuelSaatModu(true)}
                >
                  ✏️ Diğer
                </button>
              </div>

              {/* Diğer seçildiğinde açılan manuel giriş */}
              {manuelSaatModu && (
                <div className="ozel-saat-girisi animasyonlu-giris">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={formCalismaSaati}
                    onChange={(e) => setFormCalismaSaati(e.target.value)}
                    className="makine-input kucuk-input"
                    placeholder="Örn: 9.5 veya 12..."
                    autoFocus
                  />
                  <span className="saat-birim">Saat (8 saatin üzeri veya özel süre)</span>
                </div>
              )}
            </div>

            {/* Firma / Cari Seçimi */}
            <div className="form-satir">
              <label className="alan-baslik">Taşeron / Kiralayan Firma (Opsiyonel):</label>
              <div className="firma-secim-kutusu">
                <input
                  type="text"
                  placeholder="Rehberden firma ara veya yaz..."
                  value={formCariAdi}
                  onChange={(e) => {
                    setFormCariAdi(e.target.value)
                    setFormCariId(null)
                  }}
                  className="makine-input"
                  list="cariler-listesi-makine"
                />
                <datalist id="cariler-listesi-makine">
                  {tumCariler.map(c => (
                    <option key={c.id} value={c.ad}>
                      {c.sifat ? `${c.ad} (${c.sifat})` : c.ad}
                    </option>
                  ))}
                </datalist>
                <small className="yardim-metin">
                  Kayıt sonrasında da dilediğiniz zaman toplu olarak firma atayabilirsiniz.
                </small>
              </div>
            </div>

            {/* Açıklama */}
            <div className="form-satir">
              <label className="alan-baslik">Yapılan İş ve Notlar:</label>
              <textarea
                placeholder="Örn: 2. Etap temel hafriyatı, kırım yapıldı, operatör molası vs..."
                value={formAciklama}
                onChange={(e) => setFormAciklama(e.target.value)}
                className="makine-textarea"
                rows="2"
              />
            </div>

            <button type="submit" className="makine-kaydet-buton">
              {duzenlenenMakineId ? '💾 Değişiklikleri Kaydet' : '➕ Çalışma Kaydını Ekle'}
            </button>
          </form>

          {/* LİSTE BAŞLIĞI VE TOPLU SEÇİM BUTONU */}
          <div className="liste-ust-bar">
            <div className="liste-sayi-bilgisi">
              <span>📋 Kayıt Listesi ({filtrelenmisMakineler.length} Adet)</span>
              {filtrelenmisMakineler.length > 0 && (
                <button type="button" className="tumunu-sec-link" onClick={handleTumunuSec}>
                  {seciliMakineIds.length === filtrelenmisMakineler.length ? 'Seçimi Bırak' : 'Tümünü Seç'}
                </button>
              )}
            </div>
          </div>

          {/* İŞ MAKİNESİ KARTLARI */}
          {filtrelenmisMakineler.length === 0 ? (
            <div className="bos-kayit-paneli">
              <span className="bos-ikon">🚜</span>
              <h4>Seçili filtrelerde iş makinesi kaydı bulunamadı</h4>
              <p>Yukarıdaki formu kullanarak bugün veya seçtiğiniz tarih için çalışma süresi ekleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="makine-kart-grid">
              {filtrelenmisMakineler.map(item => {
                const seciliMi = seciliMakineIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className={`makine-kart ${item.mutabakat ? 'mutabakat-kapali' : ''} ${seciliMi ? 'kart-secili' : ''}`}
                  >
                    <div className="kart-sol-secim">
                      <input
                        type="checkbox"
                        checked={seciliMi}
                        onChange={() => handleMakineCheckbox(item.id)}
                        className="makine-checkbox"
                        aria-label="Seç"
                      />
                    </div>

                    <div className="kart-ana-icerik">
                      <div className="kart-ust-satir">
                        <div className="kart-tur-etiketi">
                          <span className="tur-rozet">{item.makineTuru}</span>
                          <span className="santiye-kucuk">{item.santiyeAdi}</span>
                        </div>
                        <div className="kart-saat-kutusu">
                          <span className="saat-rakam">{item.calismaSaati}</span>
                          <span className="saat-yazi">Saat</span>
                        </div>
                      </div>

                      {/* Firma / Cari Bilgisi */}
                      <div className="kart-cari-satiri">
                        {item.cariAdi ? (
                          <span className="cari-rozet">
                            🏢 {item.cariAdi}
                          </span>
                        ) : (
                          <span className="cari-atanmadi-rozet" onClick={() => {
                            setSeciliMakineIds([item.id])
                            setTopluCariModalAcik(true)
                          }}>
                            ⚠️ Firma Atanmadı (Ata)
                          </span>
                        )}
                        <span className="tarih-kucuk">📅 {item.tarih}</span>
                      </div>

                      {/* Açıklama */}
                      {item.aciklama && (
                        <p className="kart-aciklama-metni">📝 {item.aciklama}</p>
                      )}

                      {/* Mütabakat Durumu & Eylemler */}
                      <div className="kart-alt-eylemler">
                        <button
                          type="button"
                          className={`mutabakat-buton ${item.mutabakat ? 'kapali' : 'acik'}`}
                          onClick={() => handleMakineMutabakatDegistir(item.id)}
                          title={item.mutabakat ? 'Mütabakatı geri al' : 'Mütabakat tamamlandı / hesabı kapat'}
                        >
                          {item.mutabakat ? '✓ Mütabakat Yapıldı (Pasif)' : '🔓 Hesabı Kapat / Mütabakat Yap'}
                        </button>

                        <div className="kart-buton-grubu">
                          <button
                            type="button"
                            className="kart-icon-buton duzenle"
                            onClick={() => handleMakineDuzenle(item)}
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="kart-icon-buton sil"
                            onClick={() => handleMakineSil(item.id)}
                            title="Sil"
                          >
                            🗑️
                          </button>
                        </div>
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
      {/* 6. SEKME 2: HAFRİYAT KAMYONLARI (SEFER TAKİBİ)              */}
      {/* ============================================================ */}
      {aktifSekme === 'hafriyat' && (
        <div className="hafriyat-sekme-icerik">
          {/* SAHADA HIZLI İLK SEFERİ BAŞLATMA FORMU */}
          <div className="hizli-sefer-baslat-bari">
            <form onSubmit={handleHizliSeferBaslat} className="hizli-sefer-form">
              <div className="hizli-input-grubu">
                <span className="plaka-ikon-rozet">TR</span>
                <input
                  type="text"
                  placeholder="Araç Plakası yazın (örn: 34 KMY 452)..."
                  value={hizliPlakaInput}
                  onChange={(e) => setHizliPlakaInput(e.target.value)}
                  className="hizli-plaka-input"
                />
              </div>
              <button type="submit" className="hizli-baslat-buton">
                ⚡ İlk Seferi Başlat (+1)
              </button>
            </form>
            <small className="hizli-ipucu">
              💡 <em>Plakayı yazıp butona basmanız yeterli! Kart oluştuktan sonra plakaya tıklayarak istediğiniz zaman düzenleyebilir, karta dokunarak firma/döküm yeri ekleyebilirsiniz.</em>
            </small>
          </div>

          {/* KAMYON SAYAC KARTLARI (+1 ÇETELE) */}
          <div className="kamyon-hizli-sayac-bolumu">
            <div className="bolum-baslik-satiri">
              <div>
                <h3>🚛 Sahadaki Araçlar ({kamyonOzetleri.length} Kamyon)</h3>
                <p className="alt-aciklama">Kamyon sahadan çıktıkça tek tıkla <strong>+1 Sefer</strong> butonuna basın.</p>
              </div>
            </div>

            {kamyonOzetleri.length === 0 ? (
              <div className="bos-kayit-paneli">
                <span className="bos-ikon">🚛</span>
                <h4>Bugün henüz sahaya giren hafriyat aracı yok</h4>
                <p>Yukarıdaki hızlı kutuya plaka yazıp "İlk Seferi Başlat" butonuna dokunarak hemen başlayın.</p>
              </div>
            ) : (
              <div className="kamyon-sayac-grid">
                {kamyonOzetleri.map(kamyon => {
                  const detayAcik = !!acikKamyonKartlari[kamyon.plaka]
                  const hepsiMutabakatli = kamyon.bugunSefer > 0 && kamyon.bugunMutabakatliSefer === kamyon.bugunSefer

                  return (
                    <div 
                      key={kamyon.plaka} 
                      className={`kamyon-sayac-kart ${hepsiMutabakatli ? 'mutabakat-kapali' : ''}`}
                    >
                      {/* ÜST BİLGİ & TIKLANABİLİR PLAKA */}
                      <div className="kamyon-ust-bilgi">
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
                            <button 
                              type="button" 
                              className="plaka-kaydet-btn"
                              onClick={() => handlePlakaKaydet(kamyon.plaka)}
                            >
                              ✓
                            </button>
                            <button 
                              type="button" 
                              className="plaka-iptal-btn"
                              onClick={() => setDuzenlenenPlaka(null)}
                            >
                              ✕
                            </button>
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

                        <div className="kamyon-firma-bilgi">
                          {kamyon.cariAdi ? (
                            <span className="firma-yazi">🏢 {kamyon.cariAdi}</span>
                          ) : (
                            <span className="firma-yazi gri-metin">Firma yok (Karta tıkla)</span>
                          )}
                          {kamyon.dokumSahasi && (
                            <span className="dokum-sahasi">📍 {kamyon.dokumSahasi}</span>
                          )}
                        </div>
                      </div>

                      {/* BÜYÜK SAYAÇ VE +1 SEFER BUTONU */}
                      <div className="kamyon-sefer-sayac-kutusu">
                        <div className="sefer-gosterge">
                          <span className="sefer-sayi">{kamyon.bugunSefer}</span>
                          <span className="sefer-etiket">Bugünkü Sefer</span>
                        </div>

                        <button
                          type="button"
                          className="arti-sefer-buton"
                          onClick={() => handleKamyonSeferEkle(kamyon.plaka)}
                          title="Yeni sefer kaydet (+1)"
                        >
                          +1 Sefer
                        </button>
                      </div>

                      {/* ALT BİLGİ & KART DETAYINI AÇ/KAPAT BUTONU */}
                      <div className="kamyon-alt-bar">
                        <button
                          type="button"
                          className="detay-ac-kapat-btn"
                          onClick={() => toggleKamyonKartAc(kamyon.plaka)}
                        >
                          {detayAcik ? '▲ Detayları Kapat' : '▼ Detay & Not Ekle'}
                        </button>

                        {kamyon.bugunSefer > 0 && (
                          <button
                            type="button"
                            className="eksi-sefer-link"
                            onClick={() => handleSonSeferiGeriAl(kamyon.plaka)}
                            title="Hatalı tıklamayı geri al"
                          >
                            ↩ Son seferi sil (-1)
                          </button>
                        )}
                      </div>

                      {/* KART AÇILDIĞINDA GÖRÜNEN DETAY PANELİ */}
                      {detayAcik && (
                        <div className="kamyon-detay-paneli animasyonlu-acilis">
                          <div className="detay-satir">
                            <label>Taşeron / Nakliye Firması:</label>
                            <input
                              type="text"
                              value={kamyon.cariAdi}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'cariAdi', e.target.value)}
                              placeholder="Rehberden firma ara veya yaz..."
                              className="makine-input kucuk-input"
                              list="cariler-kamyon-detay"
                            />
                            <datalist id="cariler-kamyon-detay">
                              {tumCariler.map(c => (
                                <option key={c.id} value={c.ad}>{c.ad}</option>
                              ))}
                            </datalist>
                          </div>

                          <div className="detay-satir">
                            <label>Döküm Sahası:</label>
                            <input
                              type="text"
                              value={kamyon.dokumSahasi}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'dokumSahasi', e.target.value)}
                              placeholder="Örn: Cebeci, Kemerburgaz..."
                              className="makine-input kucuk-input"
                            />
                          </div>

                          <div className="detay-satir">
                            <label>Not / Açıklama:</label>
                            <input
                              type="text"
                              value={kamyon.aciklama}
                              onChange={(e) => handleKamyonDetayGuncelle(kamyon.plaka, 'aciklama', e.target.value)}
                              placeholder="Kaba kazı toprağı, moloz vb..."
                              className="makine-input kucuk-input"
                            />
                          </div>

                          {/* Sefer Saatleri Dökümü */}
                          <div className="detay-saatler-bolumu">
                            <label>Bugünkü Sefer Saatleri:</label>
                            <div className="saat-rozet-listesi">
                              {kamyon.seferSaatleri.length === 0 ? (
                                <span className="gri-metin">Henüz sefer yok</span>
                              ) : (
                                kamyon.seferSaatleri.map((s, i) => (
                                  <span key={s.id || i} className={`saat-etiket-rozet ${s.mutabakat ? 'kapali' : ''}`}>
                                    {s.saat}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Bu Kamyonun Tüm Seferleri İçin Mütabakat Aç/Kapat */}
                          <div className="detay-mutabakat-satiri">
                            <button
                              type="button"
                              className={`kamyon-toplu-mutabakat-btn ${hepsiMutabakatli ? 'kapali' : 'acik'}`}
                              onClick={() => handleKamyonTumSeferlerMutabakat(kamyon.plaka, !hepsiMutabakatli)}
                            >
                              {hepsiMutabakatli ? '✓ Bu Aracın Tüm Seferleri Kapatıldı' : '🔒 Tüm Seferleri Mütabakata Al (Hesabı Kapat)'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DETAYLI SEFER LOG LİSTESİ */}
          <div className="hafriyat-log-bolumu">
            <div className="liste-ust-bar">
              <div className="liste-sayi-bilgisi">
                <span>📋 Günlük Sefer Akışı ({filtrelenmisHafriyat.length} Sefer)</span>
                {filtrelenmisHafriyat.length > 0 && (
                  <button type="button" className="tumunu-sec-link" onClick={handleTumunuSec}>
                    {seciliHafriyatIds.length === filtrelenmisHafriyat.length ? 'Seçimi Bırak' : 'Tümünü Seç'}
                  </button>
                )}
              </div>
            </div>

            {filtrelenmisHafriyat.length === 0 ? (
              <div className="bos-kayit-paneli">
                <span className="bos-ikon">📝</span>
                <p>Seçili tarih ve filtrede sefer kaydı bulunamadı.</p>
              </div>
            ) : (
              <div className="sefer-log-tablosu">
                {filtrelenmisHafriyat.map(item => {
                  const seciliMi = seciliHafriyatIds.includes(item.id)
                  return (
                    <div 
                      key={item.id} 
                      className={`sefer-log-satir ${item.mutabakat ? 'mutabakat-kapali' : ''} ${seciliMi ? 'satir-secili' : ''}`}
                    >
                      <div className="satir-secim">
                        <input
                          type="checkbox"
                          checked={seciliMi}
                          onChange={() => handleHafriyatCheckbox(item.id)}
                          className="makine-checkbox"
                        />
                      </div>

                      <div className="satir-saat-rozet">
                        {item.saat || 'Saat yok'}
                      </div>

                      <div className="satir-plaka-alani">
                        <strong>{item.plaka}</strong>
                        {item.cariAdi ? <span className="satir-firma">🏢 {item.cariAdi}</span> : <span className="satir-firma atanmadi">Firma yok</span>}
                      </div>

                      <div className="satir-dokum-alani">
                        <span>📍 {item.dokumSahasi || 'Döküm Sahası'}</span>
                        {item.aciklama && <small className="satir-not">{item.aciklama}</small>}
                      </div>

                      <div className="satir-eylemler">
                        <button
                          type="button"
                          className={`mutabakat-hap ${item.mutabakat ? 'kapali' : 'acik'}`}
                          onClick={() => handleHafriyatMutabakatDegistir(item.id)}
                        >
                          {item.mutabakat ? '✓ Kapatıldı' : 'Açık'}
                        </button>
                        <button
                          type="button"
                          className="satir-sil-buton"
                          onClick={() => handleHafriyatSil(item.id)}
                          title="Seferi sil"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. ÇOKLU SEÇİM TOPLU İŞLEM ÇUBUĞU (Sticky Batch Bar)         */}
      {/* ============================================================ */}
      {seciliSayisi > 0 && (
        <div className="makine-toplu-islem-cubugu">
          <div className="toplu-secim-bilgi">
            <span className="secim-sayisi">{seciliSayisi}</span> kayıt seçildi
          </div>

          <div className="toplu-buton-grubu">
            <button
              type="button"
              className="toplu-aksiyon-buton cari-ata"
              onClick={() => setTopluCariModalAcik(true)}
            >
              🏢 Rehberden Firma Ata
            </button>

            <button
              type="button"
              className="toplu-aksiyon-buton mutabakat-kapat"
              onClick={() => handleTopluMutabakat(true)}
            >
              🔒 Mütabakatı Kapat
            </button>

            <button
              type="button"
              className="toplu-aksiyon-buton mutabakat-ac"
              onClick={() => handleTopluMutabakat(false)}
            >
              🔓 Hesabı Aç
            </button>

            <button
              type="button"
              className="toplu-aksiyon-buton sil"
              onClick={handleTopluSil}
            >
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
      {/* 8. MODAL: TOPLU CARİ / FİRMA ATAMA MODALI                    */}
      {/* ============================================================ */}
      {topluCariModalAcik && (
        <div className="modal-arka-plan" onClick={() => setTopluCariModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>🏢 Rehberden Toplu Firma Ata</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setTopluCariModalAcik(false)}>✕</button>
            </div>

            <p className="modal-aciklama">
              Seçilen <strong>{seciliSayisi} adet</strong> kayda ilişkilendirilecek firmayı veya taşeronu seçin:
            </p>

            <div className="form-satir">
              <input
                type="text"
                placeholder="Firma ara veya yeni isim yaz..."
                value={secilenTopluCariAdi}
                onChange={(e) => {
                  setSecilenTopluCariAdi(e.target.value)
                  setCariAramaInput(e.target.value)
                  setSecilenTopluCariId(null)
                }}
                className="makine-input"
                autoFocus
              />
            </div>

            {/* Hızlı Seçim Listesi (Rehber) */}
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

            <div className="modal-buton-alani">
              <button type="button" className="modal-iptal-buton" onClick={() => setTopluCariModalAcik(false)}>
                İptal
              </button>
              <button type="button" className="modal-onay-buton" onClick={handleTopluCariUygula}>
                {seciliSayisi} Kayda Uygula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
