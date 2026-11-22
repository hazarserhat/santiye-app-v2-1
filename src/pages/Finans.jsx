import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import {
  paraFormatla,
  sadeceSayiTuslari,
  formatInputTutar,
  temizleTutar,
  isOtoparkSantiye
} from '../lib/format'
import {
  uploadToGoogleDrive,
  moveToSilinenler,
  getGoogleDriveInlineImageUrl,
  getGoogleDriveViewUrl
} from '../lib/googleDrive'
import CariAramaSecici from '../components/CariAramaSecici'
import { SayfaBaslik, BosDurum } from '../components/OrtakBilesenler'
import Cekler from './Cekler'
import PlanlananOdemeler from './PlanlananOdemeler'
import OdemeVaatleri from './OdemeVaatleri'
import {
  YASIN_CICEN_PROJE,
  YASIN_CICEN_CARI_SEED,
  YASIN_CICEN_IMALAT_SEED,
  YASIN_CICEN_NOTLAR_SEED
} from '../data/yasinCicenSeed'

const bugun = () => new Date().toISOString().slice(0, 10)
const DANISMANLIK_STORAGE_KEY = 'danismanlik_verileri_v1'

const VARSAYILAN_DANISMANLIK = {
  aktifProjeId: 'yasin-cicen',
  projeler: [YASIN_CICEN_PROJE],
  cariKayitlar: { 'yasin-cicen': YASIN_CICEN_CARI_SEED },
  imalatKayitlar: { 'yasin-cicen': YASIN_CICEN_IMALAT_SEED },
  calismaNotlari: { 'yasin-cicen': YASIN_CICEN_NOTLAR_SEED }
}

const TAHSILAT_NOKTALARI = [
  'Merkez Kasa', 'Serhat Kasa', 'Abdullah Kasa', 'Fuat Kasa', 'Engin Hazar ( Fırat Tekstil Diyarbakır )',
  'Ruha Ziraat', 'Ruha QNB', 'Ruha Garanti', 'Ruha Emlak Bank',
  'Ziraat Kredi Kartı', 'Garanti Kredi Kartı', 'Qnb Kredi Kartı',
  'Ödeme Yapılmadı'
]

const VIRMAN_KASALAR = [
  'Merkez Kasa', 'Serhat Kasa', 'Abdullah Kasa', 'Fuat Kasa', 'Engin Hazar ( Fırat Tekstil Diyarbakır )',
  'Ziraat', 'QNB', 'Garanti', 'Garanti Havale', 'Emlak Bank Havale',
  'Ziraat Kredi Kartı', 'Garanti Kredi Kartı', 'Qnb Kredi Kartı'
]

const ASAMALAR_YARISI_BIZDEN = [
  { anahtar: 'asama1_odendi', yuzde: 0.30, etiket: '1. Aşama (%30)', aciklama: 'Kat İrtifakı Kurulunca' },
  { anahtar: 'asama2_odendi', yuzde: 0.30, etiket: '2. Aşama (%30)', aciklama: 'Kaba İnşaatın Bitiminde' },
  { anahtar: 'asama3_odendi', yuzde: 0.30, etiket: '3. Aşama (%30)', aciklama: 'Sıva ve İç Detayların Tamamlanınca' },
  { anahtar: 'asama4_odendi', yuzde: 0.10, etiket: '4. Aşama (%10)', aciklama: 'Yapı Kullanım İzin Belgesi Alınınca' }
]

const isYasinCicenSantiyeAdi = (ad = '') => {
  const norm = ad
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
  return norm.includes('yasin') && norm.includes('cicen')
}

const tarihGrupBasligi = (tarihStr) => {
  if (!tarihStr) return 'Tarihsiz İşlemler'
  const d = new Date(tarihStr.length === 10 ? `${tarihStr}T12:00:00` : tarihStr)
  if (isNaN(d.getTime())) return tarihStr
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  })
}

const kayitZamaniFormatla = (isoStr) => {
  if (!isoStr) return ''
  const saatVar = isoStr.includes('T') || isoStr.includes(':')
  const d = new Date(saatVar ? isoStr : `${isoStr}T12:00:00`)
  if (isNaN(d.getTime())) return isoStr
  if (!saatVar) {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const tarihGunAnahtari = (isoStr) => {
  if (!isoStr) return ''
  if (isoStr.length === 10) return isoStr
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return isoStr.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

const INPUT_STIL = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  color: '#0F172A',
  fontSize: 13,
  fontWeight: 500,
  margin: 0,
  boxSizing: 'border-box',
  outline: 'none'
}

export default function Finans() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const isSantiyeSefi = profile?.rol === 'santiye_sefi'
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'

  // Üst Alt-Modül Sekmesi
  const [altModul, setAltModul] = useState('timeline') // 'timeline' | 'cek' | 'planli' | 'vaat'
  const [cekYonu, setCekYonu] = useState('verilen') // 'verilen' (Verilen / Ciro) | 'alinan' (Maliklerden)

  // Veri Kaynakları
  const [masraflar, setMasraflar] = useState([])
  const [gelirler, setGelirler] = useState([])
  const [kasaIslemleri, setKasaIslemleri] = useState([])
  const [cekler, setCekler] = useState([])
  const [danismanlikVeri, setDanismanlikVeri] = useState(() => {
    try {
      const kayitli = localStorage.getItem(DANISMANLIK_STORAGE_KEY)
      if (kayitli) {
        const parsed = JSON.parse(kayitli)
        if (parsed?.projeler?.length) return parsed
      }
    } catch { /* ignore */ }
    return VARSAYILAN_DANISMANLIK
  })

  // Yardımcı Sözlükler
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [malikler, setMalikler] = useState([])
  const [taseronlar, setTaseronlar] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [panelAcik, setPanelAcik] = useState(true)

  // =========================================================
  // VERİ GİRİŞ PANELİ STATE'LERİ
  // =========================================================
  const [girisModu, setGirisModu] = useState('gider') // 'gider' | 'gelir' | 'virman' | 'yasin_cicen'
  const [secilenSantiyeId, setSecilenSantiyeId] = useState('')

  // 1) GİDER FORMU
  const [gBaslik, setGBaslik] = useState('')
  const [gOdenenKisi, setGOdenenKisi] = useState('')
  const [gCariId, setGCariId] = useState(null)
  const [gTutar, setGTutar] = useState('')
  const [gTarih, setGTarih] = useState(bugun())
  const [gKategoriId, setGKategoriId] = useState('')
  const [gOdemeYontemiId, setGOdemeYontemiId] = useState('')
  const [gTaksitSayisi, setGTaksitSayisi] = useState(1)
  const [gAciklama, setGAciklama] = useState('')
  const [gFotograf, setGFotograf] = useState(null)
  const [gCokluSantiye, setGCokluSantiye] = useState(false)
  const [gSantiyeDagilimi, setGSantiyeDagilimi] = useState([{ santiye_id: '', yuzde: '', miktar_gosterim: '' }])

  // 2) GELİR FORMU
  const [glMalikId, setGlMalikId] = useState('')
  const [glCariId, setGlCariId] = useState(null)
  const [glOdemeYapan, setGlOdemeYapan] = useState('')
  const [glTutar, setGlTutar] = useState('')
  const [glTarih, setGlTarih] = useState(bugun())
  const [glTahsilatNoktasi, setGlTahsilatNoktasi] = useState('Merkez Kasa')
  const [glGecmisDonem, setGlGecmisDonem] = useState(false)
  const [glVergiHarc, setGlVergiHarc] = useState(false)
  const [glHarcTuru, setGlHarcTuru] = useState('genel')
  const [glDevletDestegi, setGlDevletDestegi] = useState(false)
  const [glDevletAsama, setGlDevletAsama] = useState('')
  const [glNot, setGlNot] = useState('')
  const [glBelge, setGlBelge] = useState(null)
  const [yeniMalikAcik, setYeniMalikAcik] = useState(false)
  const [yeniMalikAd, setYeniMalikAd] = useState('')
  const [yeniMalikTel, setYeniMalikTel] = useState('')
  const [yeniMalikMesken, setYeniMalikMesken] = useState('')
  const [yeniMalikDaire, setYeniMalikDaire] = useState('')

  // 3) VİRMAN / KASA FORMU
  const [vTip, setVTip] = useState('virman') // 'virman' | 'mutabakat'
  const [vCikisKasasi, setVCikisKasasi] = useState(VIRMAN_KASALAR[0])
  const [vGirisKasasi, setVGirisKasasi] = useState(VIRMAN_KASALAR[1])
  const [vMutabakatYonu, setVMutabakatYonu] = useState('arti') // 'arti' | 'eksi'
  const [vTutar, setVTutar] = useState('')
  const [vTarih, setVTarih] = useState(bugun())
  const [vNot, setVNot] = useState('')

  // 4) DANIŞMANLIK FORMU (Varsayılan: Yasin Çiçen, yeni proje eklenebilir)
  const [seciliDanismanlikProjeId, setSeciliDanismanlikProjeId] = useState('yasin-cicen')
  const [yeniDanismanlikAcik, setYeniDanismanlikAcik] = useState(false)
  const [yeniDanProjeAd, setYeniDanProjeAd] = useState('')
  const [yeniDanMusteriAd, setYeniDanMusteriAd] = useState('')
  const [yeniDanKarOrani, setYeniDanKarOrani] = useState('15')
  const [yeniDanAciklama, setYeniDanAciklama] = useState('')

  const [ycKategori, setYcKategori] = useState('resmi_harcama') // 'resmi_harcama' | 'gayriresmi_harcama' | 'tahsilat_resmi' | 'tahsilat_gayriresmi' | 'mutabakat'
  const [ycGayriGiderAlt, setYcGayriGiderAlt] = useState('ruha_yapti') // 'ruha_yapti' | 'yasin_odedi'
  const [ycGayriTahsilatAlt, setYcGayriTahsilatAlt] = useState('nakit_getirdi') // 'nakit_getirdi' | 'direkt_odedi'
  const [ycTarih, setYcTarih] = useState(bugun())
  const [ycEvrakNo, setYcEvrakNo] = useState('')
  const [ycAciklama, setYcAciklama] = useState('')
  const [ycTutar, setYcTutar] = useState('')
  const [ycNot, setYcNot] = useState('')
  const [ycBelge, setYcBelge] = useState(null)

  // KPI Kartı Hover Bilgi Kutusu & Gizlilik Yıldızlama
  const [acikKpiTooltip, setAcikKpiTooltip] = useState(null) // 'gider' | 'gelir' | 'net' | 'virman' | null
  const [kpiTutarlarGizli, setKpiTutarlarGizli] = useState(true)

  // =========================================================
  // TİMELİNE FİLTRE STATE'LERİ
  // =========================================================
  const [filtreTip, setFiltreTip] = useState('hepsi') // 'hepsi' | 'gider' | 'gelir' | 'virman' | 'danismanlik'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreArama, setFiltreArama] = useState('')
  const [filtreMuhasebe, setFiltreMuhasebe] = useState('hepsi')
  const [filtreBaslangic, setFiltreBaslangic] = useState('')
  const [filtreBitis, setFiltreBitis] = useState('')
  const [filtreSiralama, setFiltreSiralama] = useState('kayit_yeni') // 'kayit_yeni' | 'kayit_eski' | 'tarih_yeni' | 'tarih_eski'
  const [gelismisFiltreAcik, setGelismisFiltreAcik] = useState(false)
  const [gorunenAdet, setGorunenAdet] = useState(40)

  // Belge Önizleme Lightbox
  const [onizlemeBelge, setOnizlemeBelge] = useState(null)

  // Satır İçi Hızlı Düzenleme & Universal Paylaş Menüsü
  const [duzenlenenKey, setDuzenlenenKey] = useState(null)
  const [duzForm, setDuzForm] = useState({})
  const [paylasMenuKey, setPaylasMenuKey] = useState(null)
  const [kopyalandiKey, setKopyalandiKey] = useState(null)

  // =========================================================
  // VERİ YÜKLEME
  // =========================================================
  const yasinCicenSantiye = useMemo(() => {
    return santiyeler.find((s) => isYasinCicenSantiyeAdi(s.ad)) || null
  }, [santiyeler])

  const danismanlikProjeleri = useMemo(() => {
    return danismanlikVeri?.projeler?.length ? danismanlikVeri.projeler : [YASIN_CICEN_PROJE]
  }, [danismanlikVeri])

  const aktifYcProje = useMemo(() => {
    return danismanlikProjeleri.find((p) => p.id === seciliDanismanlikProjeId) ||
      danismanlikProjeleri[0] ||
      YASIN_CICEN_PROJE
  }, [danismanlikProjeleri, seciliDanismanlikProjeId])

  const seciliYontem = odemeYontemleri.find((o) => o.id === gOdemeYontemiId)
  const isKrediKarti = Boolean(seciliYontem && seciliYontem.ad.toLowerCase().includes('kart'))

  useEffect(() => {
    if (aktifSantiye && !secilenSantiyeId) {
      setSecilenSantiyeId(aktifSantiye.id)
      if (isOtoparkSantiye(aktifSantiye.ad)) setGlHarcTuru('otopark')
      if (!isSantiyeSefi && isYasinCicenSantiyeAdi(aktifSantiye.ad)) {
        setGirisModu('yasin_cicen')
      }
    }
  }, [aktifSantiye])

  useEffect(() => {
    tumVerileriYukle()
  }, [profile])

  // HMR veya sekme geçişlerinde çek listesi boş kaldıysa otomatik yükle
  useEffect(() => {
    if (!isSantiyeSefi && filtreTip === 'cek' && cekler.length === 0) {
      tumVerileriYukle()
    }
  }, [filtreTip, isSantiyeSefi])

  // Ctrl+V ile aktif sekmeye göre görsel yapıştırma
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const yeniDosya = new File([file], `pano_gorseli_${Date.now()}.png`, { type: file.type })
            if (girisModu === 'gider') setGFotograf(yeniDosya)
            else if (girisModu === 'gelir') setGlBelge(yeniDosya)
            else if (girisModu === 'yasin_cicen') setYcBelge(yeniDosya)
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [girisModu])

  const tumVerileriYukle = async () => {
    const sorgular = [
      supabase.from('masraf_kategorileri').select('*').order('ad'),
      supabase.from('odeme_yontemleri').select('*').order('sira'),
      supabase.from('profiles').select('*'),
      supabase.from('masraflar').select('*, masraf_kategorileri(ad), odeme_yontemleri(ad), profiles(ad_soyad)'),
      supabase.from('taseronlar').select('id, ad, firma')
    ]

    if (!isSantiyeSefi) {
      sorgular.push(
        supabase.from('gelirler').select('*, santiyeler(ad), malikler(ad_soyad)').order('tarih', { ascending: false }),
        supabase.from('kasa_islemleri').select('*, profiles(ad_soyad)').order('kayit_tarihi', { ascending: false }),
        supabase.from('malikler').select('*').order('ad_soyad'),
        supabase.from('sistem_ayarlari').select('deger').eq('anahtar', DANISMANLIK_STORAGE_KEY).maybeSingle(),
        supabase.from('cekler').select('*, santiyeler(ad), profiles(ad_soyad)').order('created_at', { ascending: false })
      )
    }

    const sonuclar = await Promise.all(sorgular)

    // Kategoriler
    const katData = sonuclar[0]?.data || []
    setKategoriler(katData)
    if (katData.length && !gKategoriId) setGKategoriId(katData[0].id)

    // Ödeme yöntemleri
    let oyData = sonuclar[1]?.data || []
    const filtreliOy = isSantiyeSefi ? oyData.filter((o) => o.sef_gorebilir) : oyData.filter((o) => o.yonetici_gorebilir)
    setOdemeYontemleri(filtreliOy)
    if (filtreliOy.length && !gOdemeYontemiId) setGOdemeYontemiId(filtreliOy[0].id)

    // Kullanıcılar, Masraflar & Cariler
    setKullanicilar(sonuclar[2]?.data || [])
    let gelenMasraflar = sonuclar[3]?.data || []
    let gelenCariler = sonuclar[4]?.data || []
    setMasraflar(gelenMasraflar)
    setTaseronlar(gelenCariler)

    let gelenGelirler = []
    if (!isSantiyeSefi) {
      gelenGelirler = sonuclar[5]?.data || []
      setGelirler(gelenGelirler)
      setKasaIslemleri(sonuclar[6]?.data || [])
      setMalikler(sonuclar[7]?.data || [])

      if (sonuclar[9]?.error) {
        const { data: fallbackCekler } = await supabase.from('cekler').select('*, santiyeler(ad)')
        setCekler(fallbackCekler || [])
      } else {
        setCekler(sonuclar[9]?.data || [])
      }

      const danismanlikRaw = sonuclar[8]?.data?.deger
      if (danismanlikRaw) {
        try {
          const parsed = JSON.parse(danismanlikRaw)
          if (parsed?.projeler?.length) {
            setDanismanlikVeri(parsed)
            localStorage.setItem(DANISMANLIK_STORAGE_KEY, JSON.stringify(parsed))
          }
        } catch { /* ignore */ }
      }
    }

    // Eksik cari_id'si olan mevcut gider ve gelir kayıtlarını otomatik carilere işle (yoksa oluştur)
    try {
      const eksikMasraflar = gelenMasraflar.filter((m) => !m.cari_id && m.odenen_kisi && m.odenen_kisi.trim())
      const eksikGelirler = gelenGelirler.filter((g) => !g.cari_id && g.odeme_yapan_adi && g.odeme_yapan_adi.trim())
      if (eksikMasraflar.length > 0 || eksikGelirler.length > 0) {
        const cariHarita = new Map()
        gelenCariler.forEach((c) => {
          if (c.ad) cariHarita.set(c.ad.trim().toLocaleLowerCase('tr-TR'), c.id)
        })

        const idBulVeyaYarat = async (adHam) => {
          const temiz = adHam.trim()
          const key = temiz.toLocaleLowerCase('tr-TR')
          if (cariHarita.has(key)) return cariHarita.get(key)
          const { data: yeniC } = await supabase
            .from('taseronlar')
            .insert({ ad: temiz, sef_gorunur: true })
            .select('id, ad, firma')
            .single()
          if (yeniC) {
            cariHarita.set(key, yeniC.id)
            gelenCariler = [...gelenCariler, yeniC]
            return yeniC.id
          }
          return null
        }

        let degisiklikOldu = false
        for (const m of eksikMasraflar) {
          const cid = await idBulVeyaYarat(m.odenen_kisi)
          if (cid) {
            await supabase.from('masraflar').update({ cari_id: cid }).eq('id', m.id)
            m.cari_id = cid
            degisiklikOldu = true
          }
        }
        for (const g of eksikGelirler) {
          const cid = await idBulVeyaYarat(g.odeme_yapan_adi)
          if (cid) {
            await supabase.from('gelirler').update({ cari_id: cid }).eq('id', g.id)
            g.cari_id = cid
            degisiklikOldu = true
          }
        }
        if (degisiklikOldu) {
          setTaseronlar([...gelenCariler])
          setMasraflar([...gelenMasraflar])
          if (!isSantiyeSefi) setGelirler([...gelenGelirler])
        }
      }
    } catch (syncErr) {
      console.warn('Otomatik cari senkronizasyon uyarısı:', syncErr)
    }
  }

  // Şantiye değiştiğinde Yasin Çiçen algılama
  const santiyeSecimiDegisti = (yeniId) => {
    setSecilenSantiyeId(yeniId)
    const secilen = santiyeler.find((s) => s.id === yeniId)
    if (secilen && isOtoparkSantiye(secilen.ad)) {
      setGlHarcTuru('otopark')
    } else {
      setGlHarcTuru('genel')
    }

    if (!isSantiyeSefi && secilen && isYasinCicenSantiyeAdi(secilen.ad)) {
      if (girisModu === 'gelir') setYcKategori('tahsilat_resmi')
      else if (girisModu === 'gider') setYcKategori('resmi_harcama')
      setGirisModu('yasin_cicen')
    } else if (girisModu === 'yasin_cicen') {
      // Yasin Çiçen'den başka bir şantiyeye geçildi
      const isTahsilat = ycKategori === 'tahsilat_resmi' || ycKategori === 'tahsilat_gayriresmi'
      setGirisModu(isTahsilat ? 'gelir' : 'gider')
    }
  }

  const panodanGorselYapistir = async (hedefSetter) => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type)
            const file = new File([blob], `pano_gorseli_${Date.now()}.png`, { type: blob.type })
            hedefSetter(file)
            return
          }
        }
      }
      alert('Panoda bir görsel bulunamadı.')
    } catch {
      alert('Panoya erişim sağlanamadı. Ctrl+V ile yapıştırabilir veya dosya seçebilirsiniz.')
    }
  }

  // Çoklu şantiye dağılım yardımcısı
  const handleDagilimDegisimi = (index, field, value) => {
    const yeniListe = [...gSantiyeDagilimi]
    const globalTutarNum = Number(temizleTutar(gTutar)) || 0
    const item = { ...yeniListe[index] }
    if (field === 'yuzde') {
      item.yuzde = value
      const yNum = Number(value.replace(',', '.'))
      item.miktar_gosterim = globalTutarNum > 0 && value !== '' && !isNaN(yNum) ? ((globalTutarNum * yNum) / 100).toFixed(2) : ''
    } else if (field === 'miktar') {
      item.miktar_gosterim = value
      const mNum = Number(value.replace(',', '.'))
      item.yuzde = globalTutarNum > 0 && value !== '' && !isNaN(mNum) ? ((mNum / globalTutarNum) * 100).toFixed(2).replace(/\.00$/, '') : ''
    } else {
      item[field] = value
    }
    yeniListe[index] = item
    setGSantiyeDagilimi(yeniListe)
  }

  // =========================================================
  // KAYIT FONKSİYONLARI
  // =========================================================
  const giderKaydet = async (e) => {
    e.preventDefault()
    if (!gBaslik.trim() || !gTutar) {
      alert('Başlık ve tutar zorunludur.')
      return
    }
    setYukleniyor(true)

    let finalCariId = gCariId
    if (!finalCariId && gOdenenKisi.trim()) {
      const isim = gOdenenKisi.trim()
      const { data: eslesenler } = await supabase.from('taseronlar').select('*').ilike('ad', isim).limit(1)
      if (eslesenler?.length) {
        finalCariId = eslesenler[0].id
      } else {
        const { data: yeniTaseron } = await supabase.from('taseronlar').insert({ ad: isim, sef_gorunur: true }).select().single()
        if (yeniTaseron) finalCariId = yeniTaseron.id
      }
    }

    let finalDagilim = null
    if (gCokluSantiye) {
      let toplamYuzde = 0
      for (const d of gSantiyeDagilimi) {
        toplamYuzde += Number(d.yuzde) || 0
        if (!d.santiye_id) {
          alert('Lütfen tüm şantiyeleri seçin.')
          setYukleniyor(false)
          return
        }
      }
      if (Math.abs(toplamYuzde - 100) > 0.1) {
        alert(`Şantiye yüzdeleri toplamı 100 olmalıdır. (Şu anki: ${toplamYuzde.toFixed(2)})`)
        setYukleniyor(false)
        return
      }
      finalDagilim = gSantiyeDagilimi.map((d) => ({ santiye_id: d.santiye_id, yuzde: Number(d.yuzde) }))
    }

    let fotografUrl = null
    if (gFotograf) {
      const seciliSantiye = santiyeler.find((s) => s.id === secilenSantiyeId)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      const yontemAdi = seciliYontem ? seciliYontem.ad : 'Diger'
      const folderName = `Masraflar/${santiyeAdi}/${yontemAdi}`
      const adSoyad = `${gBaslik.substring(0, 30)}-${gOdenenKisi || 'Bilinmiyor'}`
      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: gFotograf,
          folderName,
          adSoyad,
          date: gTarih
        })
        fotografUrl = driveSonuc.url
      } catch (err) {
        alert("Görsel Google Drive'a yüklenemedi: " + err.message)
        setYukleniyor(false)
        return
      }
    }

    const baseTutar = temizleTutar(gTutar)
    const adet = isKrediKarti && gTaksitSayisi > 1 ? parseInt(gTaksitSayisi, 10) : 1
    const finalBaslik = adet > 1 ? `${gBaslik.trim()} (${adet} Taksit)` : gBaslik.trim()

    const { error } = await supabase.from('masraflar').insert([{
      santiye_id: (gCokluSantiye || !secilenSantiyeId || secilenSantiyeId === 'genel') ? null : secilenSantiyeId,
      santiye_dagilimi: finalDagilim,
      kategori_id: gKategoriId || null,
      baslik: finalBaslik,
      odenen_kisi: gOdenenKisi,
      cari_id: finalCariId || null,
      aciklama: gAciklama,
      tutar: baseTutar,
      taksit_sayisi: adet,
      odeme_yontemi_id: gOdemeYontemiId || null,
      harcama_tarihi: gTarih,
      kayit_tarihi: new Date().toISOString(),
      fotograf_url: fotografUrl,
      ekleyen: profile?.id
    }])

    if (error) {
      alert('Gider kaydedilemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    setGBaslik('')
    setGOdenenKisi('')
    setGCariId(null)
    setGTutar('')
    setGTaksitSayisi(1)
    setGAciklama('')
    setGFotograf(null)
    setGTarih(bugun())
    setGCokluSantiye(false)
    setGSantiyeDagilimi([{ santiye_id: '', yuzde: '', miktar_gosterim: '' }])
    setYukleniyor(false)
    tumVerileriYukle()
  }

  const malikEkleHizli = async () => {
    if (!yeniMalikAd.trim() || !secilenSantiyeId || secilenSantiyeId === 'genel') {
      alert('Ad ve şantiye zorunludur.')
      return
    }
    setYukleniyor(true)
    const { data, error } = await supabase.from('malikler').insert({
      ad_soyad: yeniMalikAd,
      telefon: yeniMalikTel,
      mesken_turu: yeniMalikMesken,
      daire_no: yeniMalikDaire,
      santiye_id: secilenSantiyeId
    }).select().single()

    if (error) {
      alert('Malik eklenemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    const bosAsamalar = Array.from({ length: 4 }).map((_, i) => ({
      malik_id: data.id, ad: '', tutar: 0, tamamlandi: false, sira: i + 1
    }))
    await supabase.from('malik_asamalari').insert(bosAsamalar)
    const { data: mData } = await supabase.from('malikler').select('*').order('ad_soyad')
    setMalikler(mData || [])
    setGlMalikId(data.id)
    setGlOdemeYapan(data.ad_soyad)
    setYeniMalikAd('')
    setYeniMalikTel('')
    setYeniMalikMesken('')
    setYeniMalikDaire('')
    setYeniMalikAcik(false)
    setYukleniyor(false)
  }

  const gelirKaydet = async (e) => {
    e.preventDefault()
    if (!secilenSantiyeId || secilenSantiyeId === 'genel' || !glTutar) {
      alert('Şantiye ve tutar zorunludur.')
      return
    }
    setYukleniyor(true)

    let belgeUrl = null
    if (glBelge) {
      const seciliSantiye = santiyeler.find((s) => s.id === secilenSantiyeId)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      const folderName = `Gelirler/${santiyeAdi}/${glTahsilatNoktasi || 'Diger'}`
      const seciliMalik = malikler.find((x) => x.id === glMalikId)
      const odenenAdi = glOdemeYapan || seciliMalik?.ad_soyad || profile?.ad_soyad || 'ISIMSIZ'
      const kisaNot = glNot ? glNot.substring(0, 20) : 'Tahsilat'
      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: glBelge,
          folderName,
          adSoyad: `${kisaNot}-${odenenAdi}`,
          date: glTarih
        })
        belgeUrl = driveSonuc.url
      } catch (err) {
        alert("Belge Google Drive'a yüklenemedi: " + err.message)
        setYukleniyor(false)
        return
      }
    }

    let hedefAsama = glDevletAsama
    const girilenTutar = Number(temizleTutar(glTutar))
    const seciliSantiyeDevletDestegi = malikler
      .filter((m) => m.santiye_id === secilenSantiyeId)
      .reduce((t, m) => t + Number(m.devlet_destegi || 0), 0)

    if (glDevletDestegi && !hedefAsama && seciliSantiyeDevletDestegi > 0) {
      const eslesen = ASAMALAR_YARISI_BIZDEN.find((a) => Math.abs(girilenTutar - Math.round(seciliSantiyeDevletDestegi * a.yuzde)) <= 5)
      if (eslesen) hedefAsama = eslesen.anahtar
    }

    const finalGelirCariId = await cariBulVeyaOlustur(glOdemeYapan, glCariId)

    const gelirPayload = {
      santiye_id: secilenSantiyeId,
      malik_id: glMalikId || null,
      cari_id: finalGelirCariId || null,
      odeme_yapan_adi: glOdemeYapan,
      tutar: temizleTutar(glTutar),
      tarih: glTarih,
      tahsilat_noktasi: glGecmisDonem ? 'Geçmiş Dönem (Devir)' : glTahsilatNoktasi,
      belge_url: belgeUrl,
      not_metni: glVergiHarc && glHarcTuru === 'otopark' && !glNot.includes('[Otopark Harcı]')
        ? (glNot ? `${glNot} [Otopark Harcı]` : '[Otopark Harcı]')
        : glNot,
      ekleyen: profile?.id,
      is_vergi_harc: glVergiHarc,
      is_otopark_harci: glVergiHarc && glHarcTuru === 'otopark',
      harc_turu: glVergiHarc ? glHarcTuru : null,
      is_devlet_destegi: glDevletDestegi,
      devlet_destegi_asama: glDevletDestegi ? (hedefAsama || null) : null,
      kayit_tarihi: new Date().toISOString()
    }

    let { error } = await supabase.from('gelirler').insert(gelirPayload)
    if (error && (error.message.includes('is_otopark_harci') || error.message.includes('harc_turu') || error.message.includes('kayit_tarihi'))) {
      if (error.message.includes('is_otopark_harci')) delete gelirPayload.is_otopark_harci
      if (error.message.includes('harc_turu')) delete gelirPayload.harc_turu
      if (error.message.includes('kayit_tarihi')) delete gelirPayload.kayit_tarihi
      const fb = await supabase.from('gelirler').insert(gelirPayload)
      error = fb.error
    }

    if (error) {
      alert('Gelir kaydedilemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    if (glDevletDestegi && hedefAsama) {
      try {
        const { data: ybRow } = await supabase.from('yarisi_bizden_odemeleri').select('*').eq('santiye_id', secilenSantiyeId).maybeSingle()
        if (ybRow) await supabase.from('yarisi_bizden_odemeleri').update({ [hedefAsama]: true }).eq('id', ybRow.id)
        else await supabase.from('yarisi_bizden_odemeleri').insert({ santiye_id: secilenSantiyeId, [hedefAsama]: true })
      } catch { /* ignore */ }
    }

    setGlMalikId('')
    setGlCariId(null)
    setGlOdemeYapan('')
    setGlTutar('')
    setGlNot('')
    setGlBelge(null)
    setGlTarih(bugun())
    setGlTahsilatNoktasi('Merkez Kasa')
    setGlGecmisDonem(false)
    setGlVergiHarc(false)
    setGlHarcTuru('genel')
    setGlDevletDestegi(false)
    setGlDevletAsama('')
    setYukleniyor(false)
    tumVerileriYukle()
  }

  const virmanKaydet = async (e) => {
    e.preventDefault()
    if (!vTutar || Number(temizleTutar(vTutar)) <= 0) {
      alert('Geçerli bir tutar giriniz.')
      return
    }
    setYukleniyor(true)
    let tip = vTip
    let cikis = null
    let giris = null

    if (vTip === 'virman') {
      if (!vCikisKasasi || !vGirisKasasi) {
        alert('Lütfen çıkış ve giriş kasasını seçin.')
        setYukleniyor(false)
        return
      }
      if (vCikisKasasi === vGirisKasasi) {
        alert('Çıkış ve giriş kasası aynı olamaz.')
        setYukleniyor(false)
        return
      }
      cikis = vCikisKasasi
      giris = vGirisKasasi
    } else {
      if (!vCikisKasasi) {
        alert('Lütfen kasa seçin.')
        setYukleniyor(false)
        return
      }
      if (vMutabakatYonu === 'arti') {
        tip = 'mutabakat_arti'
        giris = vCikisKasasi
      } else {
        tip = 'mutabakat_eksi'
        cikis = vCikisKasasi
      }
    }

    const { error } = await supabase.from('kasa_islemleri').insert({
      tip,
      cikis_noktasi: cikis,
      giris_noktasi: giris,
      tutar: temizleTutar(vTutar),
      tarih: vTarih,
      kayit_tarihi: new Date().toISOString(),
      not_metni: vNot,
      ekleyen: profile?.id
    })

    if (error) {
      alert('Virman kaydedilemedi: ' + error.message)
    } else {
      setVTutar('')
      setVNot('')
      setVTarih(bugun())
      tumVerileriYukle()
    }
    setYukleniyor(false)
  }

  const danismanlikVeriKaydet = async (yeniVeri) => {
    setDanismanlikVeri(yeniVeri)
    const jsonStr = JSON.stringify(yeniVeri)
    localStorage.setItem(DANISMANLIK_STORAGE_KEY, jsonStr)
    try {
      const { data: mevcut } = await supabase
        .from('sistem_ayarlari')
        .select('id')
        .eq('anahtar', DANISMANLIK_STORAGE_KEY)
        .maybeSingle()

      if (mevcut) {
        await supabase.from('sistem_ayarlari').update({ deger: jsonStr }).eq('anahtar', DANISMANLIK_STORAGE_KEY)
      } else {
        await supabase.from('sistem_ayarlari').insert({ anahtar: DANISMANLIK_STORAGE_KEY, deger: jsonStr })
      }
    } catch (err) {
      console.warn('Supabase danışmanlık kaydı uyarı:', err)
    }
  }

  const yasinCicenKaydet = async (e) => {
    e.preventDefault()
    const tutarSayi = temizleTutar(ycTutar)
    const aciklamaTemiz = ycAciklama.trim()

    if (ycKategori !== 'mutabakat' && tutarSayi <= 0) {
      alert('Lütfen geçerli bir işlem tutarı giriniz.')
      return
    }
    if (ycKategori !== 'mutabakat' && !aciklamaTemiz) {
      alert('Lütfen işlem açıklamasını giriniz.')
      return
    }

    let rHarcama = 0
    let gHarcama = 0
    let rTahsilat = 0
    let eTahsilat = 0
    let gAciklama = ''
    let tAciklama = ''

    if (ycKategori === 'resmi_harcama') {
      rHarcama = tutarSayi
      gAciklama = aciklamaTemiz
    } else if (ycKategori === 'gayriresmi_harcama') {
      gHarcama = tutarSayi
      gAciklama = aciklamaTemiz
      if (ycGayriGiderAlt === 'yasin_odedi') {
        eTahsilat = tutarSayi
        tAciklama = `${aciklamaTemiz} (${aktifYcProje.musteri_adi} Kendisi Ödedi)`
      }
    } else if (ycKategori === 'tahsilat_resmi') {
      rTahsilat = tutarSayi
      tAciklama = aciklamaTemiz
    } else if (ycKategori === 'tahsilat_gayriresmi') {
      eTahsilat = tutarSayi
      tAciklama = aciklamaTemiz
      if (ycGayriTahsilatAlt === 'direkt_odedi') {
        gHarcama = tutarSayi
        gAciklama = aciklamaTemiz
      }
    } else if (ycKategori === 'mutabakat') {
      const tarihTr = new Date(ycTarih || bugun()).toLocaleDateString('tr-TR')
      gAciklama = aciklamaTemiz || `Mutabakat Tarihi ${tarihTr}`
      tAciklama = aciklamaTemiz || `Mutabakat Tarihi ${tarihTr}`
    }

    setYukleniyor(true)
    let belgeUrl = ''
    if (ycBelge) {
      try {
        const driveRes = await uploadToGoogleDrive({
          file: ycBelge,
          folderName: `Danismanliklar/${aktifYcProje.ad}`,
          adSoyad: profile?.ad_soyad || aktifYcProje.musteri_adi || 'DANISMANLIK',
          date: ycTarih || bugun()
        })
        belgeUrl = driveRes.url
      } catch (err) {
        alert("Belge Google Drive'a yüklenemedi: " + err.message)
        setYukleniyor(false)
        return
      }
    }

    const mevcutListe = danismanlikVeri?.cariKayitlar?.[aktifYcProje.id] || []
    const yeniKayit = {
      id: `yc-cari-${Date.now()}`,
      sira: mevcutListe.length + 1,
      tarih: ycTarih || bugun(),
      islem_turu: ycKategori,
      evrak_no: ycEvrakNo.trim(),
      gider_aciklama: gAciklama,
      resmi_harcama: rHarcama,
      gayriresmi_harcama: gHarcama,
      tarih_tahsilat: ycTarih || bugun(),
      gelir_aciklama: tAciklama,
      tahsilat_resmi: rTahsilat,
      tahsilat_elden: eTahsilat,
      not_metni: ycNot.trim(),
      belge_url: belgeUrl,
      kayit_tarihi: new Date().toISOString()
    }

    await danismanlikVeriKaydet({
      ...danismanlikVeri,
      cariKayitlar: {
        ...danismanlikVeri.cariKayitlar,
        [aktifYcProje.id]: [...mevcutListe, yeniKayit]
      }
    })

    setYcEvrakNo('')
    setYcAciklama('')
    setYcTutar('')
    setYcNot('')
    setYcBelge(null)
    setYcTarih(bugun())
    setYukleniyor(false)
  }

  const yeniDanismanlikProjesiEkle = async () => {
    if (!yeniDanProjeAd.trim() || !yeniDanMusteriAd.trim()) {
      alert('Proje adı ve müşteri adı zorunludur.')
      return
    }
    const yeniId = `dan-${Date.now()}`
    const yeniProje = {
      id: yeniId,
      ad: yeniDanProjeAd.trim(),
      musteri_adi: yeniDanMusteriAd.trim(),
      kar_payi_orani: Number(yeniDanKarOrani) || 15,
      aciklama: yeniDanAciklama.trim(),
      olusturma_tarihi: bugun()
    }
    await danismanlikVeriKaydet({
      ...danismanlikVeri,
      aktifProjeId: yeniId,
      projeler: [...danismanlikProjeleri, yeniProje],
      cariKayitlar: { ...danismanlikVeri.cariKayitlar, [yeniId]: [] },
      imalatKayitlar: { ...danismanlikVeri.imalatKayitlar, [yeniId]: [] },
      calismaNotlari: { ...danismanlikVeri.calismaNotlari, [yeniId]: [] }
    })
    setSeciliDanismanlikProjeId(yeniId)
    setYeniDanProjeAd('')
    setYeniDanMusteriAd('')
    setYeniDanKarOrani('15')
    setYeniDanAciklama('')
    setYeniDanismanlikAcik(false)
  }

  // =========================================================
  // TİMELİNE AKSİYONLARI (SİL, MUHASEBE, BELGE, PAYLAŞ)
  // =========================================================
  const timelineKayitSil = async (item) => {
    if (!window.confirm('Bu finans kaydını silmek istediğinize emin misiniz?')) return

    if (item.kaynak === 'gider') {
      const m = item.ham
      const { error } = await supabase.from('masraflar').delete().eq('id', m.id)
      if (error) { alert('Silinemedi: ' + error.message); return }
      if (m.fotograf_url) {
        try {
          const s = santiyeler.find((x) => x.id === m.santiye_id)
          const y = odemeYontemleri.find((x) => x.id === m.odeme_yontemi_id)
          await moveToSilinenler(m.fotograf_url, `Masraflar/${s ? s.ad : 'Genel'}/${y ? y.ad : 'Diger'}`)
        } catch { /* ignore */ }
      }
      tumVerileriYukle()
    } else if (item.kaynak === 'gelir') {
      const g = item.ham
      const { error } = await supabase.from('gelirler').delete().eq('id', g.id)
      if (error) { alert('Silinemedi: ' + error.message); return }
      if (g.belge_url) {
        try {
          const s = santiyeler.find((x) => x.id === g.santiye_id)
          await moveToSilinenler(g.belge_url, `Gelirler/${s ? s.ad : 'Genel'}/${g.tahsilat_noktasi || 'Diger'}`)
        } catch { /* ignore */ }
      }
      tumVerileriYukle()
    } else if (item.kaynak === 'virman') {
      const { error } = await supabase.from('kasa_islemleri').delete().eq('id', item.ham.id)
      if (error) { alert('Silinemedi: ' + error.message); return }
      tumVerileriYukle()
    } else if (item.kaynak === 'cek') {
      const c = item.ham
      const { error } = await supabase.from('cekler').delete().eq('id', c.id)
      if (error) { alert('Silinemedi: ' + error.message); return }
      if (c.belge_url) {
        try {
          const s = santiyeler.find((x) => x.id === c.santiye_id)
          const turKlasor = c.yon === 'alinan' ? 'Alınan Çek' : (c.aciklama?.includes('(Ciro Edildi)') ? 'Ciro Edilen Çek' : 'Verilen Çek')
          await moveToSilinenler(c.belge_url, `Cekler/${s ? s.ad : 'Genel'}/${turKlasor}`)
        } catch { /* ignore */ }
      }
      tumVerileriYukle()
    } else if (item.kaynak === 'danismanlik') {
      const r = item.ham
      const hedefProjeId = item.projeId || aktifYcProje.id
      if (r.belge_url) {
        try {
          await moveToSilinenler(r.belge_url, `Danismanliklar/${item.santiyeAd || aktifYcProje.ad}`)
        } catch { /* ignore */ }
      }
      const mevcutListe = danismanlikVeri?.cariKayitlar?.[hedefProjeId] || []
      await danismanlikVeriKaydet({
        ...danismanlikVeri,
        cariKayitlar: {
          ...danismanlikVeri.cariKayitlar,
          [hedefProjeId]: mevcutListe.filter((x) => x.id !== r.id)
        }
      })
    }
  }

  const muhasebeToggle = async (item) => {
    const yeniDeger = !item.muhasebePaylasim
    const tablo = item.kaynak === 'gider' ? 'masraflar' : item.kaynak === 'gelir' ? 'gelirler' : item.kaynak === 'cek' ? 'cekler' : 'kasa_islemleri'
    const { error } = await supabase.from(tablo).update({ muhasebe_paylasim: yeniDeger }).eq('id', item.ham.id)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    if (item.kaynak === 'gider') setMasraflar((p) => p.map((x) => x.id === item.ham.id ? { ...x, muhasebe_paylasim: yeniDeger } : x))
    if (item.kaynak === 'gelir') setGelirler((p) => p.map((x) => x.id === item.ham.id ? { ...x, muhasebe_paylasim: yeniDeger } : x))
    if (item.kaynak === 'cek') setCekler((p) => p.map((x) => x.id === item.ham.id ? { ...x, muhasebe_paylasim: yeniDeger } : x))
    if (item.kaynak === 'virman') setKasaIslemleri((p) => p.map((x) => x.id === item.ham.id ? { ...x, muhasebe_paylasim: yeniDeger } : x))
  }

  const sonradanBelgeYukle = async (item, file) => {
    if (!file) return
    setYukleniyor(true)
    try {
      if (item.kaynak === 'gider') {
        const m = item.ham
        const s = santiyeler.find((x) => x.id === m.santiye_id)
        const y = odemeYontemleri.find((x) => x.id === m.odeme_yontemi_id)
        const driveRes = await uploadToGoogleDrive({
          file,
          folderName: `Masraflar/${s ? s.ad : 'Genel'}/${y ? y.ad : 'Diger'}`,
          adSoyad: `${(m.baslik || 'Masraf').substring(0, 30)}-${m.odenen_kisi || 'Bilinmiyor'}`,
          date: m.harcama_tarihi || bugun()
        })
        await supabase.from('masraflar').update({ fotograf_url: driveRes.url }).eq('id', m.id)
        tumVerileriYukle()
      } else if (item.kaynak === 'gelir') {
        const g = item.ham
        const s = santiyeler.find((x) => x.id === g.santiye_id)
        const driveRes = await uploadToGoogleDrive({
          file,
          folderName: `Gelirler/${s ? s.ad : 'Genel'}/${g.tahsilat_noktasi || 'Diger'}`,
          adSoyad: `${(g.not_metni || 'Tahsilat').substring(0, 20)}-${g.odeme_yapan_adi || 'ISIMSIZ'}`,
          date: g.tarih || bugun()
        })
        await supabase.from('gelirler').update({ belge_url: driveRes.url }).eq('id', g.id)
        tumVerileriYukle()
      } else if (item.kaynak === 'cek') {
        const c = item.ham
        const s = santiyeler.find((x) => x.id === c.santiye_id)
        const turKlasor = c.yon === 'alinan' ? 'Alınan Çek' : (c.aciklama?.includes('(Ciro Edildi)') ? 'Ciro Edilen Çek' : 'Verilen Çek')
        const driveRes = await uploadToGoogleDrive({
          file,
          folderName: `Cekler/${s ? s.ad : 'Genel'}/${turKlasor}`,
          adSoyad: `${(c.odeme_konusu || turKlasor).substring(0, 25)}-${c.cek_seri_no || 'CEK'}`,
          date: c.verilis_tarihi || bugun()
        })
        await supabase.from('cekler').update({ belge_url: driveRes.url }).eq('id', c.id)
        tumVerileriYukle()
      } else if (item.kaynak === 'danismanlik') {
        const r = item.ham
        const hedefProjeId = item.projeId || aktifYcProje.id
        const driveRes = await uploadToGoogleDrive({
          file,
          folderName: `Danismanliklar/${item.santiyeAd || aktifYcProje.ad}`,
          adSoyad: profile?.ad_soyad || item.kisi || 'DANISMANLIK',
          date: r.tarih || bugun()
        })
        const mevcutListe = danismanlikVeri?.cariKayitlar?.[hedefProjeId] || []
        await danismanlikVeriKaydet({
          ...danismanlikVeri,
          cariKayitlar: {
            ...danismanlikVeri.cariKayitlar,
            [hedefProjeId]: mevcutListe.map((x) => x.id === r.id ? { ...x, belge_url: driveRes.url } : x)
          }
        })
      }
    } catch (err) {
      alert("Belge yüklenemedi: " + err.message)
    }
    setYukleniyor(false)
  }

  const cariBulVeyaOlustur = async (isimStr, mevcutCariId) => {
    if (mevcutCariId) return mevcutCariId
    const isim = (isimStr || '').trim()
    if (!isim) return null
    const { data: eslesenler } = await supabase.from('taseronlar').select('id').ilike('ad', isim).limit(1)
    if (eslesenler?.length) return eslesenler[0].id
    const { data: yeniTaseron } = await supabase.from('taseronlar').insert({ ad: isim, sef_gorunur: true }).select('id').single()
    return yeniTaseron?.id || null
  }

  const duzenlemeBaslat = (item) => {
    setDuzenlenenKey(item.key)
    if (item.kaynak === 'gider') {
      setDuzForm({
        baslik: item.ham.baslik || '',
        tutar: formatInputTutar(item.ham.tutar),
        tarih: item.ham.harcama_tarihi || '',
        odenen_kisi: item.ham.odenen_kisi || item.kisi || '',
        cari_id: item.ham.cari_id || null,
        aciklama: item.ham.aciklama || ''
      })
    } else if (item.kaynak === 'gelir') {
      setDuzForm({
        tutar: formatInputTutar(item.ham.tutar),
        tarih: item.ham.tarih || '',
        odeme_yapan_adi: item.ham.odeme_yapan_adi || item.kisi || '',
        cari_id: item.ham.cari_id || null,
        tahsilat_noktasi: item.ham.tahsilat_noktasi || '',
        not_metni: item.ham.not_metni || ''
      })
    } else if (item.kaynak === 'virman') {
      setDuzForm({
        tutar: formatInputTutar(item.ham.tutar),
        tarih: item.ham.tarih || '',
        not_metni: item.ham.not_metni || ''
      })
    }
  }

  const duzenlemeKaydet = async (item) => {
    if (item.kaynak === 'gider') {
      const finalCariId = await cariBulVeyaOlustur(duzForm.odenen_kisi, duzForm.cari_id)
      const { error } = await supabase.from('masraflar').update({
        baslik: duzForm.baslik,
        tutar: temizleTutar(duzForm.tutar),
        harcama_tarihi: duzForm.tarih,
        odenen_kisi: duzForm.odenen_kisi,
        cari_id: finalCariId || null,
        aciklama: duzForm.aciklama
      }).eq('id', item.ham.id)
      if (error) { alert('Güncellenemedi: ' + error.message); return }
    } else if (item.kaynak === 'gelir') {
      const finalCariId = await cariBulVeyaOlustur(duzForm.odeme_yapan_adi, duzForm.cari_id)
      const { error } = await supabase.from('gelirler').update({
        tutar: temizleTutar(duzForm.tutar),
        tarih: duzForm.tarih,
        odeme_yapan_adi: duzForm.odeme_yapan_adi,
        cari_id: finalCariId || null,
        tahsilat_noktasi: duzForm.tahsilat_noktasi,
        not_metni: duzForm.not_metni
      }).eq('id', item.ham.id)
      if (error) { alert('Güncellenemedi: ' + error.message); return }
    } else if (item.kaynak === 'virman') {
      const { error } = await supabase.from('kasa_islemleri').update({
        tutar: temizleTutar(duzForm.tutar),
        tarih: duzForm.tarih,
        not_metni: duzForm.not_metni
      }).eq('id', item.ham.id)
      if (error) { alert('Güncellenemedi: ' + error.message); return }
    }
    setDuzenlenenKey(null)
    tumVerileriYukle()
  }

  const paylasMetniOlustur = (item, linkDahil = true) => {
    const tarihStr = item.tarih ? new Date(`${item.tarih.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR') : '—'
    return (
      `💳 *${item.etiket} BİLDİRİMİ*\n` +
      (item.santiyeAd ? `🏗️ *Şantiye:* ${item.santiyeAd}\n` : '') +
      (item.kisi ? `👤 *Kişi/Cari:* ${item.kisi}\n` : '') +
      `📌 *Başlık:* ${item.baslik}\n` +
      `💵 *Tutar:* ${paraFormatla(item.tutar)} ₺\n` +
      (item.hesapBilgisi ? `🏦 *Hesap/Kasa:* ${item.hesapBilgisi}\n` : '') +
      `📅 *İşlem Tarihi:* ${tarihStr}\n` +
      `🕒 *Kayıt:* ${kayitZamaniFormatla(item.kayitTarihi || item.tarih)}\n` +
      (item.notMetni ? `📝 *Açıklama:* ${item.notMetni}\n` : '') +
      (linkDahil && item.belgeUrl ? `🔗 *Belge:* ${item.belgeUrl}` : '')
    ).trim()
  }

  const sistemPaylas = async (item) => {
    const metin = paylasMetniOlustur(item, false)
    const metinVeLink = paylasMetniOlustur(item, true)
    try {
      let dosyalar = []
      if (item.belgeUrl && navigator.canShare) {
        try {
          const fetchUrl = getGoogleDriveInlineImageUrl(item.belgeUrl)
          const response = await fetch(fetchUrl)
          const blob = await response.blob()
          let mime = blob.type
          if (!mime || mime.includes('octet-stream') || mime.includes('binary')) {
            mime = fetchUrl.toLowerCase().includes('pdf') ? 'application/pdf' : 'image/jpeg'
          }
          const ext = mime.includes('pdf') ? 'pdf' : 'jpg'
          const ad = (item.baslik || 'finans_belgesi').replace(/[^a-zA-Z0-9]/gi, '_').toLowerCase()
          dosyalar.push(new File([blob], `${ad}.${ext}`, { type: mime }))
        } catch { /* dosya alınamazsa link ile paylaşılır */ }
      }

      if (dosyalar.length > 0 && navigator.canShare && navigator.canShare({ files: dosyalar })) {
        await navigator.share({ title: `${item.etiket} - ${item.baslik}`, text: metin, files: dosyalar })
      } else if (navigator.share) {
        await navigator.share({ title: `${item.etiket} - ${item.baslik}`, text: metinVeLink })
      }
      setPaylasMenuKey(null)
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('Sistem paylaşımı başarısız:', err)
      }
    }
  }

  const universalPaylasTetikle = (item) => {
    const isMobil = navigator.maxTouchPoints > 0
    if (isMobil && navigator.share) {
      sistemPaylas(item)
      return
    }
    setPaylasMenuKey((prev) => (prev === item.key ? null : item.key))
  }

  const metinPanoyaKopyala = async (item) => {
    const metin = paylasMetniOlustur(item, true)
    try {
      await navigator.clipboard.writeText(metin)
      setKopyalandiKey(item.key)
      setTimeout(() => {
        setKopyalandiKey(null)
        setPaylasMenuKey(null)
      }, 1200)
    } catch {
      alert('Panoya kopyalanamadı.')
    }
  }

  // =========================================================
  // BİRLEŞİK TİMELİNE OLUŞTURMA (GİDER + GELİR + VİRMAN + DANIŞMANLIK)
  // =========================================================
  const birlesikTimeline = useMemo(() => {
    const liste = []

    // 1. Giderler
    masraflar.forEach((m) => {
      let sAd = 'Genel Gider'
      if (m.santiye_dagilimi && Array.isArray(m.santiye_dagilimi) && m.santiye_dagilimi.length > 0) {
        sAd = m.santiye_dagilimi.map((d) => {
          const s = santiyeler.find((x) => x.id === d.santiye_id)
          return `${s ? s.ad : '?'} (%${d.yuzde})`
        }).join(', ')
      } else if (m.santiye_id) {
        sAd = santiyeler.find((x) => x.id === m.santiye_id)?.ad || 'Şantiye'
      }

      liste.push({
        key: `gider-${m.id}`,
        kaynak: 'gider',
        etiket: 'GİDER',
        renk: '#E11D48',
        bg: '#FFF1F2',
        border: '#FECDD3',
        tarih: m.harcama_tarihi || (m.kayit_tarihi ? m.kayit_tarihi.slice(0, 10) : ''),
        kayitTarihi: m.kayit_tarihi || m.harcama_tarihi || '',
        baslik: m.baslik || 'Masraf Kaydı',
        tutar: Number(m.tutar) || 0,
        yon: 'cikis',
        santiyeId: m.santiye_id || 'genel',
        santiyeAd: sAd,
        kisi: m.odenen_kisi || taseronlar.find((t) => t.id === m.cari_id)?.ad || '',
        kategori: m.masraf_kategorileri?.ad || '',
        hesapBilgisi: m.odeme_yontemleri?.ad || '',
        ekleyen: m.profiles?.ad_soyad || '',
        notMetni: m.aciklama || '',
        belgeUrl: m.fotograf_url || '',
        muhasebePaylasim: !!m.muhasebe_paylasim,
        ham: m
      })
    })

    if (!isSantiyeSefi) {
      // 2. Gelirler
      gelirler.forEach((g) => {
        const sAd = g.santiyeler?.ad || santiyeler.find((x) => x.id === g.santiye_id)?.ad || 'Şantiye'
        const yatan = g.odeme_yapan_adi || g.malikler?.ad_soyad || 'Tahsilat'
        const ekEtiketler = []
        if (g.is_devlet_destegi) ekEtiketler.push('Yarısı Bizden')
        if (g.is_vergi_harc) ekEtiketler.push(g.is_otopark_harci ? 'Otopark Harcı' : 'Vergi/Harç')

        liste.push({
          key: `gelir-${g.id}`,
          kaynak: 'gelir',
          etiket: 'GELİR',
          renk: '#059669',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          tarih: g.tarih || (g.kayit_tarihi ? g.kayit_tarihi.slice(0, 10) : (g.created_at ? g.created_at.slice(0, 10) : '')),
          kayitTarihi: g.kayit_tarihi || g.created_at || g.tarih || '',
          baslik: `${yatan}${ekEtiketler.length ? ` (${ekEtiketler.join(', ')})` : ''}`,
          tutar: Number(g.tutar) || 0,
          yon: 'giris',
          santiyeId: g.santiye_id || 'genel',
          santiyeAd: sAd,
          kisi: yatan,
          kategori: ekEtiketler.join(', ') || 'Tahsilat',
          hesapBilgisi: g.tahsilat_noktasi || '',
          ekleyen: kullanicilar.find((u) => u.id === g.ekleyen)?.ad_soyad || '',
          notMetni: g.not_metni || '',
          belgeUrl: g.belge_url || '',
          muhasebePaylasim: !!g.muhasebe_paylasim,
          ham: g
        })
      })

      // 3. Virman & Kasa İşlemleri
      kasaIslemleri.forEach((k) => {
        const isVirman = k.tip === 'virman'
        const isArti = k.tip === 'mutabakat_arti'
        const baslik = isVirman
          ? `${k.cikis_noktasi} → ${k.giris_noktasi}`
          : isArti
            ? `Kasa Mutabakatı (+): ${k.giris_noktasi}`
            : `Kasa Mutabakatı (-): ${k.cikis_noktasi}`

        liste.push({
          key: `virman-${k.id}`,
          kaynak: 'virman',
          etiket: isVirman ? 'VİRMAN' : 'KASA MUTABAKAT',
          renk: isVirman ? '#2563EB' : '#7C3AED',
          bg: isVirman ? '#EFF6FF' : '#F5F3FF',
          border: isVirman ? '#BFDBFE' : '#DDD6FE',
          tarih: k.tarih || (k.kayit_tarihi ? k.kayit_tarihi.slice(0, 10) : ''),
          kayitTarihi: k.kayit_tarihi || k.tarih || '',
          baslik,
          tutar: Number(k.tutar) || 0,
          yon: 'transfer',
          santiyeId: 'virman',
          santiyeAd: 'Kasa / Banka Transferi',
          kisi: k.profiles?.ad_soyad || '',
          kategori: isVirman ? 'Virman' : 'Mutabakat',
          hesapBilgisi: isVirman ? `${k.cikis_noktasi} → ${k.giris_noktasi}` : (k.giris_noktasi || k.cikis_noktasi || ''),
          ekleyen: k.profiles?.ad_soyad || '',
          notMetni: k.not_metni || '',
          belgeUrl: '',
          muhasebePaylasim: !!k.muhasebe_paylasim,
          ham: k
        })
      })

      // 4. Çekler (Alınan, Verilen & Ciro Edilen Çekler)
      cekler.forEach((c) => {
        const isAlinan = c.yon === 'alinan'
        const isCiro = !isAlinan && c.aciklama && c.aciklama.includes('(Ciro Edildi)')
        const sAd = c.santiyeler?.ad || santiyeler.find((x) => x.id === c.santiye_id)?.ad || 'Genel'
        const vadeStr = c.cek_vadesi ? `Vade: ${new Date(`${c.cek_vadesi}T12:00:00`).toLocaleDateString('tr-TR')}` : 'Çek'

        liste.push({
          key: `cek-${c.id}`,
          kaynak: 'cek',
          etiket: isAlinan ? 'ALINAN ÇEK' : isCiro ? 'CİRO ÇEK' : 'VERİLEN ÇEK',
          renk: isAlinan ? '#0F766E' : isCiro ? '#D97706' : '#B91C1C',
          bg: isAlinan ? '#F0FDFA' : isCiro ? '#FFFBEB' : '#FEF2F2',
          border: isAlinan ? '#99F6E4' : isCiro ? '#FDE68A' : '#FECACA',
          tarih: c.verilis_tarihi || c.cek_vadesi || (c.created_at ? c.created_at.slice(0, 10) : ''),
          kayitTarihi: c.created_at || c.verilis_tarihi || '',
          baslik: c.odeme_konusu || (isAlinan ? 'Alınan Çek / Senet' : isCiro ? 'Ciro Edilen Çek' : 'Verilen Çek'),
          tutar: Number(c.tutar) || 0,
          yon: isAlinan ? 'giris' : 'cikis',
          santiyeId: c.santiye_id || 'genel',
          santiyeAd: sAd,
          kisi: isAlinan ? (c.odeyen || '') : (c.odenen || ''),
          kategori: vadeStr,
          hesapBilgisi: [c.banka, c.cek_seri_no ? `No: ${c.cek_seri_no}` : ''].filter(Boolean).join(' • '),
          ekleyen: c.profiles?.ad_soyad || '',
          notMetni: c.aciklama || '',
          belgeUrl: c.belge_url || '',
          muhasebePaylasim: !!c.muhasebe_paylasim,
          ham: c
        })
      })

      // 5. Tüm Danışmanlık Projelerinin Kayıtları
      danismanlikProjeleri.forEach((proje) => {
        const projeKayitlar = danismanlikVeri?.cariKayitlar?.[proje.id] || []
        const eslesenSantiye = santiyeler.find((s) =>
          (proje.id === 'yasin-cicen' && isYasinCicenSantiyeAdi(s.ad)) ||
          (s.ad || '').toLocaleLowerCase('tr-TR') === (proje.ad || '').toLocaleLowerCase('tr-TR')
        )

        projeKayitlar.forEach((r) => {
          const rHarcama = Number(r.resmi_harcama) || 0
          const gHarcama = Number(r.gayriresmi_harcama) || 0
          const rTahsilat = Number(r.tahsilat_resmi) || 0
          const eTahsilat = Number(r.tahsilat_elden) || 0
          const topHarcama = rHarcama + gHarcama
          const topTahsilat = rTahsilat + eTahsilat

          let altEtiket = 'DANIŞMANLIK'
          let yon = 'cikis'
          let tutar = topHarcama || topTahsilat
          let renk = '#4F46E5'
          let bg = '#EEF2FF'
          let border = '#C7D2FE'

          if (topHarcama > 0 && topTahsilat > 0) {
            altEtiket = 'DANIŞMANLIK (KARŞILIKLI)'
            yon = 'transfer'
            tutar = topHarcama
            renk = '#D97706'
            bg = '#FFFBEB'
            border = '#FDE68A'
          } else if (topTahsilat > 0) {
            altEtiket = rTahsilat > 0 ? 'DANIŞMANLIK • TAHSİLAT RESMİ' : 'DANIŞMANLIK • TAHSİLAT ELDEN'
            yon = 'giris'
            tutar = topTahsilat
            renk = '#0D9488'
            bg = '#F0FDFA'
            border = '#99F6E4'
          } else if (topHarcama > 0) {
            altEtiket = rHarcama > 0 ? 'DANIŞMANLIK • RESMİ HARCAMA' : 'DANIŞMANLIK • GAYRİ RESMİ'
            yon = 'cikis'
            tutar = topHarcama
            renk = '#EA580C'
            bg = '#FFF7ED'
            border = '#FED7AA'
          } else {
            altEtiket = 'DANIŞMANLIK • MUTABAKAT'
            yon = 'transfer'
            tutar = 0
          }

          liste.push({
            key: `danismanlik-${proje.id}-${r.id}`,
            kaynak: 'danismanlik',
            projeId: proje.id,
            etiket: altEtiket,
            renk,
            bg,
            border,
            tarih: r.tarih || r.tarih_tahsilat || '',
            kayitTarihi: r.kayit_tarihi || r.tarih || '',
            baslik: r.gider_aciklama || r.gelir_aciklama || 'Danışmanlık İşlemi',
            tutar,
            yon,
            santiyeId: eslesenSantiye?.id || `danismanlik:${proje.id}`,
            santiyeAd: proje.ad || 'Danışmanlık',
            kisi: proje.musteri_adi || '',
            kategori: r.evrak_no ? `Evrak: ${r.evrak_no}` : `%${proje.kar_payi_orani ?? 15} Danışmanlık`,
            hesapBilgisi: topHarcama > 0 && topTahsilat > 0 ? 'Karşılıklı Mahsup' : (rHarcama > 0 ? 'Resmi Harcama' : gHarcama > 0 ? 'Gayri Resmi' : rTahsilat > 0 ? 'Resmi Tahsilat' : 'Elden / Direkt'),
            ekleyen: '',
            notMetni: r.not_metni || '',
            belgeUrl: r.belge_url || '',
            muhasebePaylasim: false,
            ham: r
          })
        })
      })
    }

    return liste
  }, [masraflar, gelirler, kasaIslemleri, cekler, danismanlikVeri, danismanlikProjeleri, santiyeler, taseronlar, kullanicilar, isSantiyeSefi])

  // Filtrelenmiş & Sıralanmış Timeline
  const filtrelenmisTimeline = useMemo(() => {
    const q = filtreArama.trim().toLocaleLowerCase('tr-TR')

    return birlesikTimeline
      .filter((item) => filtreTip === 'hepsi' || item.kaynak === filtreTip)
      .filter((item) => {
        if (filtreSantiye === 'hepsi') return true
        if (filtreSantiye.startsWith('danismanlik:')) {
          const pId = filtreSantiye.replace('danismanlik:', '')
          return item.projeId === pId || (pId === 'yasin-cicen' && yasinCicenSantiye && item.santiyeId === yasinCicenSantiye.id)
        }
        return item.santiyeId === filtreSantiye
      })
      .filter((item) => {
        if (filtreMuhasebe === 'paylasildi') return item.muhasebePaylasim
        if (filtreMuhasebe === 'paylasilmadi') return !item.muhasebePaylasim
        return true
      })
      .filter((item) => {
        if (!filtreBaslangic && !filtreBitis) return true
        if (!item.tarih) return false
        if (filtreBaslangic && item.tarih < filtreBaslangic) return false
        if (filtreBitis && item.tarih > filtreBitis) return false
        return true
      })
      .filter((item) => {
        if (!q) return true
        return (
          (item.baslik || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.santiyeAd || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.kisi || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.hesapBilgisi || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.kategori || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (item.notMetni || '').toLocaleLowerCase('tr-TR').includes(q) ||
          String(item.tutar || '').includes(q)
        )
      })
      .sort((a, b) => {
        const tA = new Date(a.kayitTarihi || a.tarih || 0).getTime()
        const tB = new Date(b.kayitTarihi || b.tarih || 0).getTime()
        if (filtreSiralama === 'kayit_yeni') return tB - tA
        if (filtreSiralama === 'kayit_eski') return tA - tB
        if (filtreSiralama === 'tarih_eski') {
          const cmp = (a.tarih || '').localeCompare(b.tarih || '')
          return cmp !== 0 ? cmp : tA - tB
        }
        // tarih_yeni (aynı günde kayıt saat:dakika:saniyeye göre en yeni üstte)
        const cmp = (b.tarih || '').localeCompare(a.tarih || '')
        return cmp !== 0 ? cmp : tB - tA
      })
  }, [birlesikTimeline, filtreTip, filtreSantiye, filtreMuhasebe, filtreBaslangic, filtreBitis, filtreArama, filtreSiralama, yasinCicenSantiye])

  // KPI Özetleri (Filtrelenmiş Veriye Göre + Hover Açıklama Verileri)
  const kpiOzet = useMemo(() => {
    let toplamGider = 0
    let toplamGelir = 0
    let toplamVirman = 0
    let giderAdet = 0
    let gelirAdet = 0
    let cekGiderAdet = 0
    let cekGelirAdet = 0
    let danismanlikGiderAdet = 0
    let danismanlikGelirAdet = 0
    let virmanAdet = 0
    let minTarih = ''
    let maxTarih = ''

    filtrelenmisTimeline.forEach((item) => {
      if (item.tarih) {
        if (!minTarih || item.tarih < minTarih) minTarih = item.tarih
        if (!maxTarih || item.tarih > maxTarih) maxTarih = item.tarih
      }

      if (item.kaynak === 'gider') {
        toplamGider += item.tutar
        giderAdet += 1
      } else if (item.kaynak === 'gelir') {
        toplamGelir += item.tutar
        gelirAdet += 1
      } else if (item.kaynak === 'virman') {
        toplamVirman += item.tutar
        virmanAdet += 1
      } else if (item.kaynak === 'cek') {
        if (item.yon === 'giris') {
          toplamGelir += item.tutar
          cekGelirAdet += 1
        } else {
          toplamGider += item.tutar
          cekGiderAdet += 1
        }
      } else if (item.kaynak === 'danismanlik') {
        if (item.yon === 'cikis') {
          toplamGider += item.tutar
          danismanlikGiderAdet += 1
        } else if (item.yon === 'giris') {
          toplamGelir += item.tutar
          danismanlikGelirAdet += 1
        }
      }
    })

    const fmtTr = (t) => t ? new Date(`${t.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR') : '—'
    let tarihAraligiMetni = 'Tüm Zamanlar'
    if (filtreBaslangic || filtreBitis) {
      tarihAraligiMetni = `Filtreli Aralık: ${filtreBaslangic ? fmtTr(filtreBaslangic) : 'Başlangıç'} – ${filtreBitis ? fmtTr(filtreBitis) : 'Bugün'}`
    } else if (minTarih && maxTarih) {
      tarihAraligiMetni = `Tüm Zamanlar (${fmtTr(minTarih)} – ${fmtTr(maxTarih)})`
    }

    let kapsamMetni = 'Tüm Şantiyeler & Danışmanlıklar'
    if (filtreSantiye === 'genel') kapsamMetni = 'Sadece Genel Giderler'
    else if (filtreSantiye.startsWith('danismanlik:')) {
      const p = danismanlikProjeleri.find((x) => x.id === filtreSantiye.replace('danismanlik:', ''))
      kapsamMetni = `Danışmanlık: ${p?.ad || 'Seçili Proje'}`
    } else if (filtreSantiye !== 'hepsi') {
      const s = santiyeler.find((x) => x.id === filtreSantiye)
      kapsamMetni = `Şantiye: ${s?.ad || 'Seçili Şantiye'}`
    }

    return {
      toplamGider,
      toplamGelir,
      netAkis: toplamGelir - toplamGider,
      toplamVirman,
      giderAdet,
      gelirAdet,
      cekGiderAdet,
      cekGelirAdet,
      danismanlikGiderAdet,
      danismanlikGelirAdet,
      virmanAdet,
      tarihAraligiMetni,
      kapsamMetni
    }
  }, [filtrelenmisTimeline, filtreBaslangic, filtreBitis, filtreSantiye, santiyeler, danismanlikProjeleri])

  // Günlere Göre Gruplanmış Timeline (Kayıt sıralamasında kayıt gününe, işlem sıralamasında işlem gününe göre gruplar)
  const gunGruplari = useMemo(() => {
    const gorunen = filtrelenmisTimeline.slice(0, gorunenAdet)
    const gruplar = []
    const map = new Map()
    const kayitBazli = filtreSiralama === 'kayit_yeni' || filtreSiralama === 'kayit_eski'

    gorunen.forEach((item) => {
      const gunKey = (kayitBazli ? tarihGunAnahtari(item.kayitTarihi || item.tarih) : item.tarih) || 'tarihsiz'
      if (!map.has(gunKey)) {
        const grup = { gunKey, baslik: tarihGrupBasligi(gunKey === 'tarihsiz' ? '' : gunKey), gunGider: 0, gunGelir: 0, kayitlar: [] }
        map.set(gunKey, grup)
        gruplar.push(grup)
      }
      const g = map.get(gunKey)
      g.kayitlar.push(item)
      if (item.yon === 'cikis') g.gunGider += item.tutar
      if (item.yon === 'giris') g.gunGelir += item.tutar
    })

    return gruplar
  }, [filtrelenmisTimeline, gorunenAdet, filtreSiralama])

  const aktifSantiyeMalikleri = useMemo(() => {
    return malikler.filter((m) => m.santiye_id === secilenSantiyeId)
  }, [malikler, secilenSantiyeId])

  if (!aktifSantiye) {
    return (
      <div className="sayfa">
        <BosDurum ikon="⏳" baslik="Finans Verileri Yükleniyor..." aciklama="Şantiye ve kasa bilgileri hazırlanıyor." />
      </div>
    )
  }

  return (
    <div className="sayfa" style={{ maxWidth: 1120, margin: '0 auto', paddingBottom: 90 }}>
      {/* ÜST BAŞLIK VE ALT MODÜL SEÇİCİ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <SayfaBaslik
          ikon="💳"
          baslik="Finans Merkezi"
          altBaslik="Gider, Gelir, Virman ve Danışmanlık işlemlerinin birleşik zaman çizelgesi"
        />

        {yonetici && (
          <div className="gorunum-secici" style={{ margin: 0 }}>
            <button className={altModul === 'timeline' ? 'secili-tab' : ''} onClick={() => { setAltModul('timeline'); tumVerileriYukle() }}>
              📊 Timeline
            </button>
            <button className={altModul === 'planli' ? 'secili-tab' : ''} onClick={() => setAltModul('planli')}>
              🗓️ Düzenli Ödemeler
            </button>
            <button className={altModul === 'vaat' ? 'secili-tab' : ''} onClick={() => setAltModul('vaat')}>
              🤝 Ödeme Vaatleri
            </button>
          </div>
        )}
      </div>

      {/* ALT MODÜLLER */}
      {altModul === 'planli' && yonetici ? (
        <PlanlananOdemeler />
      ) : altModul === 'vaat' && yonetici ? (
        <OdemeVaatleri />
      ) : (
        <>
          {/* KPI ÖZET KARTLARI (Varsayılan yıldızlı/gizli, tek tıkla görünür yapılabilir) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setKpiTutarlarGizli((p) => !p)}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: '1px solid #CBD5E1',
                background: kpiTutarlarGizli ? '#F8FAFC' : '#EEF2FF',
                color: kpiTutarlarGizli ? '#475569' : '#3730A3',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              title={kpiTutarlarGizli ? 'Bilgi kartlarındaki tutarları görünür yap' : 'Bilgi kartlarındaki tutarları yıldızla gizle'}
            >
              {kpiTutarlarGizli ? '👁️ Tutarları Göster' : '🙈 Tutarları Gizle'}
            </button>
          </div>

          <div className="finans-kpi-grid">
            {[
              {
                id: 'gider',
                goster: true,
                baslik: 'Toplam Gider',
                deger: `${paraFormatla(kpiOzet.toplamGider)} ₺`,
                renk: '#E11D48',
                baslikRenk: '#BE123C',
                border: '#FFE4E6',
                golge: 'rgba(225,29,72,0.05)',
                aciklama: 'Şantiye/genel masraf kayıtları, verilen/ciro çekler ve danışmanlık harcamalarının toplamını gösterir. Kasalar arası virmanlar gidere dahil edilmez.',
                detay: `${kpiOzet.giderAdet} masraf${kpiOzet.cekGiderAdet > 0 ? ` + ${kpiOzet.cekGiderAdet} verilen/ciro çek` : ''}${kpiOzet.danismanlikGiderAdet > 0 ? ` + ${kpiOzet.danismanlikGiderAdet} danışmanlık harcaması` : ''}`
              },
              {
                id: 'gelir',
                goster: !isSantiyeSefi,
                baslik: 'Toplam Gelir',
                deger: `${paraFormatla(kpiOzet.toplamGelir)} ₺`,
                renk: '#059669',
                baslikRenk: '#047857',
                border: '#D1FAE5',
                golge: 'rgba(5,150,105,0.05)',
                aciklama: 'Malik tahsilatları, alınan çek/senetler, Yarısı Bizden ödemeleri, vergi/harç tahsilatları ve danışmanlık tahsilatlarının toplamıdır.',
                detay: `${kpiOzet.gelirAdet} gelir${kpiOzet.cekGelirAdet > 0 ? ` + ${kpiOzet.cekGelirAdet} alınan çek` : ''}${kpiOzet.danismanlikGelirAdet > 0 ? ` + ${kpiOzet.danismanlikGelirAdet} danışmanlık tahsilatı` : ''}`
              },
              {
                id: 'net',
                goster: !isSantiyeSefi,
                baslik: 'Net Nakit Akışı',
                deger: `${kpiOzet.netAkis >= 0 ? '+' : ''}${paraFormatla(kpiOzet.netAkis)} ₺`,
                renk: kpiOzet.netAkis >= 0 ? '#0F766E' : '#BE123C',
                baslikRenk: '#475569',
                border: '#E2E8F0',
                golge: 'rgba(15,23,42,0.05)',
                aciklama: 'Hesaplama Mantığı: (Toplam Gelir − Toplam Gider). Artı (+) değer ilgili aralıkta tahsilat fazlasını, eksi (−) değer gider fazlasını ifade eder.',
                detay: kpiTutarlarGizli ? '****** ₺ − ****** ₺' : `${paraFormatla(kpiOzet.toplamGelir)} ₺ − ${paraFormatla(kpiOzet.toplamGider)} ₺`
              },
              {
                id: 'virman',
                goster: !isSantiyeSefi,
                baslik: `Virman / Kasa (${kpiOzet.virmanAdet})`,
                deger: `${paraFormatla(kpiOzet.toplamVirman)} ₺`,
                renk: '#2563EB',
                baslikRenk: '#1D4ED8',
                border: '#DBEAFE',
                golge: 'rgba(37,99,235,0.05)',
                aciklama: 'Kendi kasa ve banka hesaplarınız arasındaki transferler (virman) ile kasa mutabakat düzeltmelerinin toplam hacmidir. Gelir/Gider toplamlarını etkilemez.',
                detay: `${kpiOzet.virmanAdet} adet kasa/virman hareketi`
              }
            ].filter((k) => k.goster).map((kart) => {
              const acikMi = acikKpiTooltip === kart.id
              return (
                <div
                  key={kart.id}
                  className="finans-kpi-kart"
                  onMouseEnter={() => setAcikKpiTooltip(kart.id)}
                  onMouseLeave={() => setAcikKpiTooltip(null)}
                  onClick={() => setKpiTutarlarGizli((p) => !p)}
                  style={{
                    border: `1px solid ${kart.border}`,
                    boxShadow: `0 2px 10px ${kart.golge}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: kart.baslikRenk, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      {kart.baslik}
                    </div>
                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700 }}>ⓘ</span>
                  </div>
                  <div className="finans-kpi-deger" style={{ color: kpiTutarlarGizli ? '#94A3B8' : kart.renk, letterSpacing: kpiTutarlarGizli ? 2 : 0 }}>
                    {kpiTutarlarGizli ? '****** ₺' : kart.deger}
                  </div>

                  {acikMi && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        minWidth: 250,
                        zIndex: 50,
                        background: '#0F172A',
                        color: '#F8FAFC',
                        borderRadius: 12,
                        padding: '11px 13px',
                        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.28)',
                        border: '1px solid #334155',
                        fontSize: 11.5,
                        lineHeight: 1.45
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#FFFFFF', marginBottom: 5, fontSize: 12 }}>
                        ℹ️ {kart.baslik} — Hesaplama Mantığı
                      </div>
                      <div style={{ color: '#CBD5E1', marginBottom: 7 }}>{kart.aciklama}</div>
                      <div style={{ borderTop: '1px solid #334155', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
                        <div><strong style={{ color: '#93C5FD' }}>📅 Tarih Aralığı:</strong> {kpiOzet.tarihAraligiMetni}</div>
                        <div><strong style={{ color: '#A7F3D0' }}>🏗️ Kapsam:</strong> {kpiOzet.kapsamMetni}</div>
                        <div><strong style={{ color: '#FDE68A' }}>📊 Veri:</strong> {kart.detay}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ========================================================= */}
          {/* BİRLEŞİK VERİ GİRİŞ PANELİ                                */}
          {/* ========================================================= */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 18,
            border: '1px solid #E2E8F0',
            boxShadow: '0 6px 24px rgba(15, 23, 42, 0.06)',
            marginBottom: 18,
            overflow: 'hidden'
          }}>
            {/* Panel Başlığı ve İşlem Türü Sekmeleri */}
            <div style={{
              padding: '12px 16px',
              background: '#F8FAFC',
              borderBottom: panelAcik ? '1px solid #E2E8F0' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setGirisModu('gider')
                    setPanelAcik(true)
                    if (yasinCicenSantiye && secilenSantiyeId === yasinCicenSantiye.id) {
                      const ilkDiger = santiyeler.find((s) => s.id !== yasinCicenSantiye.id)
                      if (ilkDiger) setSecilenSantiyeId(ilkDiger.id)
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: girisModu === 'gider' ? '1.5px solid #E11D48' : '1px solid #CBD5E1',
                    background: girisModu === 'gider' ? '#FFF1F2' : '#FFFFFF',
                    color: girisModu === 'gider' ? '#BE123C' : '#475569'
                  }}
                >
                  💸 Gider Ekle
                </button>

                {!isSantiyeSefi && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setGirisModu('gelir')
                        setPanelAcik(true)
                        if (yasinCicenSantiye && secilenSantiyeId === yasinCicenSantiye.id) {
                          const ilkDiger = santiyeler.find((s) => s.id !== yasinCicenSantiye.id)
                          if (ilkDiger) setSecilenSantiyeId(ilkDiger.id)
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: girisModu === 'gelir' ? '1.5px solid #059669' : '1px solid #CBD5E1',
                        background: girisModu === 'gelir' ? '#ECFDF5' : '#FFFFFF',
                        color: girisModu === 'gelir' ? '#047857' : '#475569'
                      }}
                    >
                      💰 Gelir Ekle
                    </button>

                    {yonetici && (
                      <button
                        type="button"
                        onClick={() => { setGirisModu('cek'); setPanelAcik(true) }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: girisModu === 'cek' ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
                          background: girisModu === 'cek' ? '#F0FDFA' : '#FFFFFF',
                          color: girisModu === 'cek' ? '#0F766E' : '#475569'
                        }}
                      >
                        🧾 Çekler
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (girisModu === 'cek') tumVerileriYukle()
                        setGirisModu('virman')
                        setPanelAcik(true)
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: girisModu === 'virman' ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                        background: girisModu === 'virman' ? '#EFF6FF' : '#FFFFFF',
                        color: girisModu === 'virman' ? '#1D4ED8' : '#475569'
                      }}
                    >
                      🔄 Virman / Kasa
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGirisModu('yasin_cicen')
                        setPanelAcik(true)
                        if (yasinCicenSantiye && !seciliDanismanlikProjeId) {
                          setSeciliDanismanlikProjeId('yasin-cicen')
                        }
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: girisModu === 'yasin_cicen' ? '1.5px solid #4F46E5' : '1px solid #C7D2FE',
                        background: girisModu === 'yasin_cicen' ? '#EEF2FF' : '#F5F3FF',
                        color: '#4338CA'
                      }}
                    >
                      💼 Danışmanlık
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPanelAcik((p) => !p)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                {panelAcik ? '▲ Paneli Gizle' : '▼ Veri Girişini Aç'}
              </button>
            </div>

            {panelAcik && (
              <div style={{ padding: '16px 18px' }}>
                {/* ==================== 1. GİDER FORMU ==================== */}
                {girisModu === 'gider' && (
                  <form onSubmit={giderKaydet}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#0F6E56', cursor: 'pointer' }}>
                        <input type="checkbox" checked={gCokluSantiye} onChange={(e) => setGCokluSantiye(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#0F6E56' }} />
                        Birden Fazla Şantiyeye Pay Et
                      </label>
                      <span style={{ fontSize: 11.5, color: '#64748B' }}>
                        Yasin Çiçen seçilirse otomatik Danışmanlık girişine geçer
                      </span>
                    </div>

                    {!gCokluSantiye ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye</label>
                          <select value={secilenSantiyeId} onChange={(e) => santiyeSecimiDegisti(e.target.value)} style={INPUT_STIL}>
                            <option value="genel">🏢 Genel Gider (Şantiyesiz)</option>
                            {santiyeler.map((s) => (
                              <option key={s.id} value={s.id}>
                                {isYasinCicenSantiyeAdi(s.ad) ? `💼 ${s.ad} (Danışmanlık)` : `🏗️ ${s.ad}`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Harcama Başlığı *</label>
                          <input type="text" placeholder="Örn: Demir alımı, nakliye..." value={gBaslik} onChange={(e) => setGBaslik(e.target.value)} style={INPUT_STIL} required />
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tutar (₺) *</label>
                          <input type="text" placeholder="0,00" value={gTutar} onChange={(e) => setGTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} style={{ ...INPUT_STIL, fontWeight: 700, color: '#BE123C' }} required />
                        </div>

                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                          <input type="date" value={gTarih} onChange={(e) => setGTarih(e.target.value)} style={INPUT_STIL} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                          <input type="text" placeholder="Harcama Başlığı *" value={gBaslik} onChange={(e) => setGBaslik(e.target.value)} style={INPUT_STIL} required />
                          <input type="text" placeholder="Toplam Tutar (₺) *" value={gTutar} onChange={(e) => setGTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} style={INPUT_STIL} required />
                          <input type="date" value={gTarih} onChange={(e) => setGTarih(e.target.value)} style={INPUT_STIL} />
                        </div>
                        {gSantiyeDagilimi.map((d, idx) => (
                          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 6 }}>
                            <select value={d.santiye_id} onChange={(e) => handleDagilimDegisimi(idx, 'santiye_id', e.target.value)} style={INPUT_STIL}>
                              <option value="">Şantiye seçin...</option>
                              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                            </select>
                            <input type="text" placeholder="Yüzde %" value={d.yuzde} onChange={(e) => handleDagilimDegisimi(idx, 'yuzde', e.target.value)} style={INPUT_STIL} />
                            <input type="text" placeholder="Tutar ₺" value={d.miktar_gosterim} onChange={(e) => handleDagilimDegisimi(idx, 'miktar', e.target.value)} style={INPUT_STIL} />
                            {gSantiyeDagilimi.length > 1 && (
                              <button type="button" onClick={() => setGSantiyeDagilimi((p) => p.filter((_, i) => i !== idx))} style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0 10px', cursor: 'pointer' }}>✕</button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setGSantiyeDagilimi((p) => [...p, { santiye_id: '', yuzde: '', miktar_gosterim: '' }])} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer' }}>
                          + Şantiye Satırı Ekle
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ödenen Kişi / Firma (Cari) *</label>
                        <CariAramaSecici
                          deger={gOdenenKisi}
                          onDegisti={(isim, cariId) => { setGOdenenKisi(isim); setGCariId(cariId || null) }}
                          placeholder="Firma veya kişi ara (kayıtlı carilerden önerir)..."
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ödeme Yöntemi</label>
                        <select value={gOdemeYontemiId} onChange={(e) => setGOdemeYontemiId(e.target.value)} style={INPUT_STIL}>
                          {odemeYontemleri.map((o) => <option key={o.id} value={o.id}>{o.ad}</option>)}
                        </select>
                      </div>

                      {isKrediKarti && (
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Taksit Sayısı</label>
                          <select value={gTaksitSayisi} onChange={(e) => setGTaksitSayisi(Number(e.target.value))} style={INPUT_STIL}>
                            {[1, 2, 3, 4, 5, 6, 9, 12].map((t) => <option key={t} value={t}>{t === 1 ? 'Tek Çekim' : `${t} Taksit`}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Açıklama / Not (İsteğe Bağlı)</label>
                      <textarea
                        rows={2}
                        placeholder="Harcama detayı, açıklama veya not yazın..."
                        value={gAciklama}
                        onChange={(e) => setGAciklama(e.target.value)}
                        style={{ ...INPUT_STIL, height: 'auto', padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <label style={{ padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid #CBD5E1', background: gFotograf ? '#DCFCE7' : '#F8FAFC', color: gFotograf ? '#166534' : '#334155', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📎 {gFotograf ? 'Belge Hazır ✓' : 'Belge / Fiş Ekle'}
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setGFotograf(e.target.files?.[0] || null)} />
                        </label>
                        <button type="button" onClick={() => panodanGorselYapistir(setGFotograf)} title="Panodan Görsel Yapıştır (Ctrl+V)" style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: 13 }}>
                          📋 Yapıştır
                        </button>
                      </div>

                      <button type="submit" disabled={yukleniyor} style={{ flex: '1 1 170px', maxWidth: 260, height: 42, padding: '0 22px', borderRadius: 10, border: 'none', background: '#E11D48', color: '#FFF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {yukleniyor ? 'Kaydediliyor...' : '💸 Gideri Kaydet'}
                      </button>
                    </div>
                  </form>
                )}

                {/* ==================== 2. GELİR FORMU ==================== */}
                {girisModu === 'gelir' && !isSantiyeSefi && (
                  <form onSubmit={gelirKaydet}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye *</label>
                        <select value={secilenSantiyeId} onChange={(e) => santiyeSecimiDegisti(e.target.value)} style={INPUT_STIL} required>
                          <option value="">Şantiye seçin...</option>
                          {santiyeler.map((s) => (
                            <option key={s.id} value={s.id}>
                              {isYasinCicenSantiyeAdi(s.ad) ? `💼 ${s.ad} (Danışmanlık)` : `🏗️ ${s.ad}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>Malik (İsteğe Bağlı)</label>
                          <button type="button" onClick={() => setYeniMalikAcik((p) => !p)} style={{ border: 'none', background: 'none', color: '#059669', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                            {yeniMalikAcik ? 'Kapat' : '+ Yeni Malik'}
                          </button>
                        </div>
                        <select
                          value={glMalikId}
                          onChange={(e) => {
                            setGlMalikId(e.target.value)
                            const m = malikler.find((x) => x.id === e.target.value)
                            if (m) setGlOdemeYapan(m.ad_soyad)
                          }}
                          style={INPUT_STIL}
                        >
                          <option value="">Malik seçin...</option>
                          {aktifSantiyeMalikleri.map((m) => <option key={m.id} value={m.id}>{m.ad_soyad}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ödeme Yapan / Cari *</label>
                        <CariAramaSecici
                          deger={glOdemeYapan}
                          onDegisti={(isim, cariId) => { setGlOdemeYapan(isim); setGlCariId(cariId || null) }}
                          placeholder="Ödeme yapan kişi/kurum ara..."
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tutar (₺) *</label>
                        <input type="text" placeholder="0,00" value={glTutar} onChange={(e) => setGlTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} style={{ ...INPUT_STIL, fontWeight: 700, color: '#047857' }} required />
                      </div>
                    </div>

                    {yeniMalikAcik && (
                      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 10, marginBottom: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                        <input type="text" placeholder="Malik Ad Soyad *" value={yeniMalikAd} onChange={(e) => setYeniMalikAd(e.target.value)} style={INPUT_STIL} />
                        <input type="text" placeholder="Telefon" value={yeniMalikTel} onChange={(e) => setYeniMalikTel(e.target.value)} style={INPUT_STIL} />
                        <input type="text" placeholder="Mesken Türü" value={yeniMalikMesken} onChange={(e) => setYeniMalikMesken(e.target.value)} style={INPUT_STIL} />
                        <input type="text" placeholder="Daire No" value={yeniMalikDaire} onChange={(e) => setYeniMalikDaire(e.target.value)} style={INPUT_STIL} />
                        <button type="button" onClick={malikEkleHizli} style={{ height: 40, borderRadius: 10, border: 'none', background: '#059669', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}>Malik Kaydet</button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                        <input type="date" value={glTarih} onChange={(e) => setGlTarih(e.target.value)} style={INPUT_STIL} />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tahsilat Noktası</label>
                        <select value={glTahsilatNoktasi} onChange={(e) => setGlTahsilatNoktasi(e.target.value)} disabled={glGecmisDonem} style={INPUT_STIL}>
                          {TAHSILAT_NOKTALARI.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingTop: 18 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                          <input type="checkbox" checked={glGecmisDonem} onChange={(e) => setGlGecmisDonem(e.target.checked)} />
                          Geçmiş Dönem
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#B45309', cursor: 'pointer' }}>
                          <input type="checkbox" checked={glVergiHarc} onChange={(e) => setGlVergiHarc(e.target.checked)} />
                          Vergi / Harç
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#0369A1', cursor: 'pointer' }}>
                          <input type="checkbox" checked={glDevletDestegi} onChange={(e) => setGlDevletDestegi(e.target.checked)} />
                          Yarısı Bizden
                        </label>
                        {yonetici && (
                          <button
                            type="button"
                            onClick={() => { setCekYonu('alinan'); setGirisModu('cek'); setPanelAcik(true) }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: '1px solid #A7F3D0',
                              background: '#ECFDF5',
                              color: '#047857',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🧾 Çek / Senet ile Ödedi →
                          </button>
                        )}
                      </div>
                    </div>

                    {(glVergiHarc || glDevletDestegi) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
                        {glVergiHarc && (
                          <select value={glHarcTuru} onChange={(e) => setGlHarcTuru(e.target.value)} style={INPUT_STIL}>
                            <option value="genel">Genel Vergi / Harç</option>
                            <option value="otopark">Otopark Harcı</option>
                          </select>
                        )}
                        {glDevletDestegi && (
                          <select value={glDevletAsama} onChange={(e) => setGlDevletAsama(e.target.value)} style={INPUT_STIL}>
                            <option value="">Aşama otomatik eşleşsin...</option>
                            {ASAMALAR_YARISI_BIZDEN.map((a) => <option key={a.anahtar} value={a.anahtar}>{a.etiket} — {a.aciklama}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Açıklama / Tahsilat Notu (İsteğe Bağlı)</label>
                      <textarea
                        rows={2}
                        placeholder="Tahsilat detayı, açıklama veya not yazın..."
                        value={glNot}
                        onChange={(e) => setGlNot(e.target.value)}
                        style={{ ...INPUT_STIL, height: 'auto', padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <label style={{ padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid #CBD5E1', background: glBelge ? '#DCFCE7' : '#F8FAFC', color: glBelge ? '#166534' : '#334155', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📎 {glBelge ? 'Dekont Hazır ✓' : 'Dekont / Belge Ekle'}
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setGlBelge(e.target.files?.[0] || null)} />
                        </label>
                        <button type="button" onClick={() => panodanGorselYapistir(setGlBelge)} title="Panodan Görsel Yapıştır" style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: 13 }}>
                          📋 Yapıştır
                        </button>
                      </div>

                      <button type="submit" disabled={yukleniyor} style={{ flex: '1 1 170px', maxWidth: 260, height: 42, padding: '0 22px', borderRadius: 10, border: 'none', background: '#059669', color: '#FFF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {yukleniyor ? 'Kaydediliyor...' : '💰 Geliri Kaydet'}
                      </button>
                    </div>
                  </form>
                )}

                {/* ==================== 2.5. ÇEKLER (GELİR İLE VİRMAN ARASINDA) ==================== */}
                {girisModu === 'cek' && yonetici && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setCekYonu('verilen')}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13.5,
                          cursor: 'pointer',
                          border: cekYonu === 'verilen' ? '2px solid #E11D48' : '1px solid #CBD5E1',
                          background: cekYonu === 'verilen' ? '#FFF1F2' : '#FFFFFF',
                          color: cekYonu === 'verilen' ? '#BE123C' : '#475569'
                        }}
                      >
                        📤 Verilen / Ciro Edilen Çekler
                      </button>
                      <button
                        type="button"
                        onClick={() => setCekYonu('alinan')}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontWeight: 700,
                          fontSize: 13.5,
                          cursor: 'pointer',
                          border: cekYonu === 'alinan' ? '2px solid #059669' : '1px solid #CBD5E1',
                          background: cekYonu === 'alinan' ? '#ECFDF5' : '#FFFFFF',
                          color: cekYonu === 'alinan' ? '#047857' : '#475569'
                        }}
                      >
                        📥 Alınan Çek / Senet (Malik Ödemesi)
                      </button>
                    </div>
                    <Cekler key={cekYonu} yon={cekYonu} sadeceForm onKaydedildi={tumVerileriYukle} />
                  </div>
                )}

                {/* ==================== 3. VİRMAN / KASA FORMU ==================== */}
                {girisModu === 'virman' && !isSantiyeSefi && (
                  <form onSubmit={virmanKaydet}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button
                        type="button"
                        onClick={() => setVTip('virman')}
                        style={{
                          flex: 1, padding: 9, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          background: vTip === 'virman' ? '#EFF6FF' : '#F8FAFC',
                          color: vTip === 'virman' ? '#1D4ED8' : '#64748B',
                          border: vTip === 'virman' ? '1.5px solid #3B82F6' : '1px solid #CBD5E1'
                        }}
                      >
                        🔄 Virman (Kasalar Arası Transfer)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVTip('mutabakat')}
                        style={{
                          flex: 1, padding: 9, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          background: vTip === 'mutabakat' ? '#F5F3FF' : '#F8FAFC',
                          color: vTip === 'mutabakat' ? '#6D28D9' : '#64748B',
                          border: vTip === 'mutabakat' ? '1.5px solid #8B5CF6' : '1px solid #CBD5E1'
                        }}
                      >
                        ⚖️ Kasa Mutabakatı (+/-)
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                          {vTip === 'virman' ? 'Çıkış Yapılacak Kasa' : 'İlgili Kasa'}
                        </label>
                        <select value={vCikisKasasi} onChange={(e) => setVCikisKasasi(e.target.value)} style={INPUT_STIL}>
                          {VIRMAN_KASALAR.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>

                      {vTip === 'virman' ? (
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Giriş Yapılacak Kasa</label>
                          <select value={vGirisKasasi} onChange={(e) => setVGirisKasasi(e.target.value)} style={INPUT_STIL}>
                            {VIRMAN_KASALAR.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Mutabakat Yönü</label>
                          <select value={vMutabakatYonu} onChange={(e) => setVMutabakatYonu(e.target.value)} style={INPUT_STIL}>
                            <option value="arti">🟢 Bakiye Ekle (+)</option>
                            <option value="eksi">🔴 Bakiye Çıkar (-)</option>
                          </select>
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tutar (₺) *</label>
                        <input type="text" placeholder="0,00" value={vTutar} onChange={(e) => setVTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} style={{ ...INPUT_STIL, fontWeight: 700, color: '#1D4ED8' }} required />
                      </div>

                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                        <input type="date" value={vTarih} onChange={(e) => setVTarih(e.target.value)} style={INPUT_STIL} />
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Açıklama / Not (İsteğe Bağlı)</label>
                      <textarea
                        rows={2}
                        placeholder="Transfer veya mutabakat açıklaması yazın..."
                        value={vNot}
                        onChange={(e) => setVNot(e.target.value)}
                        style={{ ...INPUT_STIL, height: 'auto', padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" disabled={yukleniyor} style={{ width: '100%', maxWidth: 260, height: 42, padding: '0 22px', borderRadius: 10, border: 'none', background: '#2563EB', color: '#FFF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {yukleniyor ? 'Kaydediliyor...' : '🔄 İşlemi Kaydet'}
                      </button>
                    </div>
                  </form>
                )}

                {/* ==================== 4. DANIŞMANLIK ÖZEL FORMU ==================== */}
                {girisModu === 'yasin_cicen' && !isSantiyeSefi && (
                  <form onSubmit={yasinCicenKaydet}>
                    {/* Danışmanlık Projesi Seçici + Yeni Ekle + Mutabakat Kısayolu */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
                      border: '1px solid #C7D2FE',
                      marginBottom: 12
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 240 }}>
                        <span style={{ fontSize: 18 }}>💼</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                          <select
                            value={aktifYcProje.id}
                            onChange={(e) => setSeciliDanismanlikProjeId(e.target.value)}
                            style={{ ...INPUT_STIL, width: 'auto', minWidth: 210, height: 36, fontWeight: 700, color: '#3730A3', borderColor: '#A5B4FC' }}
                          >
                            {danismanlikProjeleri.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.ad} (%{p.kar_payi_orani ?? 15} Kâr Payı)
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setYeniDanismanlikAcik((p) => !p)}
                            style={{
                              padding: '7px 11px',
                              borderRadius: 8,
                              border: '1px dashed #6366F1',
                              background: yeniDanismanlikAcik ? '#4F46E5' : '#FFFFFF',
                              color: yeniDanismanlikAcik ? '#FFFFFF' : '#4338CA',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {yeniDanismanlikAcik ? '✕ Kapat' : '+ Yeni Danışmanlık Ekle'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setYcKategori('mutabakat')}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: ycKategori === 'mutabakat' ? '2px solid #D97706' : '1px solid #FDE68A',
                            background: ycKategori === 'mutabakat' ? '#FEF3C7' : '#FFFBEB',
                            color: '#B45309',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🤝 Mutabakat Satırı
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/danismanliklar')}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: '1px solid #A5B4FC',
                            background: '#FFFFFF',
                            color: '#3730A3',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Mutabakat Tablosuna Git →
                        </button>
                      </div>
                    </div>

                    {/* Yeni Danışmanlık Projesi Ekleme Kutusu */}
                    {yeniDanismanlikAcik && (
                      <div style={{
                        background: '#F5F3FF',
                        border: '1px solid #C4B5FD',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 12,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 8,
                        alignItems: 'end'
                      }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', display: 'block', marginBottom: 3 }}>Proje / Şantiye Adı *</label>
                          <input type="text" placeholder="Örn: Ahmet Yılmaz Villa" value={yeniDanProjeAd} onChange={(e) => setYeniDanProjeAd(e.target.value)} style={INPUT_STIL} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', display: 'block', marginBottom: 3 }}>Danışan / Müşteri Adı *</label>
                          <input type="text" placeholder="Örn: Ahmet Yılmaz" value={yeniDanMusteriAd} onChange={(e) => setYeniDanMusteriAd(e.target.value)} style={INPUT_STIL} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', display: 'block', marginBottom: 3 }}>Kâr Payı (%)</label>
                          <input type="number" placeholder="15" value={yeniDanKarOrani} onChange={(e) => setYeniDanKarOrani(e.target.value)} style={INPUT_STIL} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#4338CA', display: 'block', marginBottom: 3 }}>Açıklama</label>
                          <input type="text" placeholder="Kısa not..." value={yeniDanAciklama} onChange={(e) => setYeniDanAciklama(e.target.value)} style={INPUT_STIL} />
                        </div>
                        <button
                          type="button"
                          onClick={yeniDanismanlikProjesiEkle}
                          style={{ height: 40, borderRadius: 10, border: 'none', background: '#4F46E5', color: '#FFFFFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                        >
                          ✓ Projeyi Oluştur
                        </button>
                      </div>
                    )}

                    {/* 4 SÜTUNA BİREBİR KARŞILIK GELEN 2x2 SEÇİM KARTLARI (Danismanliklar.jsx İLE BİREBİR AYNI) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10, marginBottom: 12 }}>
                      <div
                        onClick={() => setYcKategori('resmi_harcama')}
                        style={{
                          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                          border: ycKategori === 'resmi_harcama' ? '2px solid #E11D48' : '1px solid #E2E8F0',
                          background: ycKategori === 'resmi_harcama' ? '#FFF1F2' : '#F8FAFC'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: '#BE123C', marginBottom: 2 }}>1. Resmi Harcamalar (Ruha)</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Ruha tarafından yapılan resmi harcamalar.</div>
                      </div>

                      <div
                        onClick={() => setYcKategori('gayriresmi_harcama')}
                        style={{
                          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                          border: ycKategori === 'gayriresmi_harcama' ? '2px solid #EA580C' : '1px solid #E2E8F0',
                          background: ycKategori === 'gayriresmi_harcama' ? '#FFF7ED' : '#F8FAFC'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: '#C2410C', marginBottom: 2 }}>2. Gayri Resmi & {aktifYcProje.musteri_adi}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Ruha yaptı veya {aktifYcProje.musteri_adi} kendisi ödedi.</div>
                      </div>

                      <div
                        onClick={() => setYcKategori('tahsilat_resmi')}
                        style={{
                          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                          border: ycKategori === 'tahsilat_resmi' ? '2px solid #059669' : '1px solid #E2E8F0',
                          background: ycKategori === 'tahsilat_resmi' ? '#ECFDF5' : '#F8FAFC'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: '#047857', marginBottom: 2 }}>3. Tahsilat Resmi (Banka / Çek)</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Banka hesabına atılan EFT/Havale veya çek.</div>
                      </div>

                      <div
                        onClick={() => setYcKategori('tahsilat_gayriresmi')}
                        style={{
                          padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                          border: ycKategori === 'tahsilat_gayriresmi' ? '2px solid #0D9488' : '1px solid #E2E8F0',
                          background: ycKategori === 'tahsilat_gayriresmi' ? '#F0FDFA' : '#F8FAFC'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12.5, color: '#0F766E', marginBottom: 2 }}>4. Tahsilat & Gayri Resmi Ödeme</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>Elden nakit getirilen veya kendisinin direkt ödemesi.</div>
                      </div>
                    </div>

                    {/* Alt İhtimal Seçicileri */}
                    {ycKategori === 'gayriresmi_harcama' && (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '10px 12px', marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#9A3412', cursor: 'pointer' }}>
                          <input type="radio" name="ycGiderAlt" checked={ycGayriGiderAlt === 'ruha_yapti'} onChange={() => setYcGayriGiderAlt('ruha_yapti')} />
                          Ruha yaptı ({aktifYcProje.musteri_adi} borçlandı)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#9A3412', cursor: 'pointer' }}>
                          <input type="radio" name="ycGiderAlt" checked={ycGayriGiderAlt === 'yasin_odedi'} onChange={() => setYcGayriGiderAlt('yasin_odedi')} />
                          {aktifYcProje.musteri_adi} ödedi (Aynı anda gayri resmi gelire de yazılır)
                        </label>
                      </div>
                    )}

                    {ycKategori === 'tahsilat_gayriresmi' && (
                      <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 12, padding: '10px 12px', marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#115E59', cursor: 'pointer' }}>
                          <input type="radio" name="ycTahsilatAlt" checked={ycGayriTahsilatAlt === 'nakit_getirdi'} onChange={() => setYcGayriTahsilatAlt('nakit_getirdi')} />
                          Bize nakit getirdi (Sadece tahsilata yazılır)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#115E59', cursor: 'pointer' }}>
                          <input type="radio" name="ycTahsilatAlt" checked={ycGayriTahsilatAlt === 'direkt_odedi'} onChange={() => setYcGayriTahsilatAlt('direkt_odedi')} />
                          Kendisi direkt ödeme yaptı (Harcamaya da yazılır)
                        </label>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                        <input type="date" value={ycTarih} onChange={(e) => setYcTarih(e.target.value)} style={INPUT_STIL} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Evrak / Fatura No</label>
                        <input type="text" placeholder="Örn: Fatura No..." value={ycEvrakNo} onChange={(e) => setYcEvrakNo(e.target.value)} style={INPUT_STIL} />
                      </div>
                      {ycKategori !== 'mutabakat' && (
                        <div>
                          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tutar (₺) *</label>
                          <input type="text" placeholder="0,00" value={ycTutar} onChange={(e) => setYcTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} style={{ ...INPUT_STIL, fontWeight: 700, color: '#4338CA' }} required />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>İşlem Açıklaması *</label>
                        <input type="text" placeholder={ycKategori === 'mutabakat' ? 'Mutabakat notu...' : 'Örn: Kalıp işçiliği, EFT tahsilatı...'} value={ycAciklama} onChange={(e) => setYcAciklama(e.target.value)} style={INPUT_STIL} required={ycKategori !== 'mutabakat'} />
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ek Açıklama / Not (İsteğe Bağlı)</label>
                      <textarea
                        rows={2}
                        placeholder="Ek açıklama veya mutabakat notu yazın..."
                        value={ycNot}
                        onChange={(e) => setYcNot(e.target.value)}
                        style={{ ...INPUT_STIL, height: 'auto', padding: '10px 12px', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <label style={{ padding: '0 12px', height: 40, borderRadius: 10, border: '1px solid #CBD5E1', background: ycBelge ? '#DCFCE7' : '#F8FAFC', color: ycBelge ? '#166534' : '#334155', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📎 {ycBelge ? 'Belge Hazır ✓' : 'Belge / Dekont Ekle'}
                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => setYcBelge(e.target.files?.[0] || null)} />
                        </label>
                        <button type="button" onClick={() => panodanGorselYapistir(setYcBelge)} title="Panodan Görsel Yapıştır" style={{ height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: 13 }}>
                          📋 Yapıştır
                        </button>
                      </div>

                      <button type="submit" disabled={yukleniyor} style={{ flex: '1 1 180px', maxWidth: 260, height: 42, padding: '0 22px', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#FFF', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {yukleniyor ? 'Kaydediliyor...' : '💼 Danışmanlığa Kaydet'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* TİMELİNE ARAMA VE FİLTRE ÇUBUĞU                           */}
          {/* ========================================================= */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            padding: '12px 14px',
            border: '1px solid #E2E8F0',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            {/* Tip Seçim Hapları */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'hepsi', ad: `Tümü (${birlesikTimeline.length})`, renk: '#0F172A' },
                  { id: 'gider', ad: `💸 Giderler (${masraflar.length})`, renk: '#E11D48' },
                  ...(!isSantiyeSefi ? [
                    { id: 'gelir', ad: `💰 Gelirler (${gelirler.length})`, renk: '#059669' },
                    { id: 'cek', ad: `🧾 Çekler (${cekler.length})`, renk: '#0F766E' },
                    { id: 'virman', ad: `🔄 Virmanlar (${kasaIslemleri.length})`, renk: '#2563EB' },
                    { id: 'danismanlik', ad: `💼 Danışmanlık (${birlesikTimeline.filter((x) => x.kaynak === 'danismanlik').length})`, renk: '#4F46E5' }
                  ] : [])
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setFiltreTip(t.id); setGorunenAdet(40) }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: filtreTip === t.id ? `1.5px solid ${t.renk}` : '1px solid #E2E8F0',
                      background: filtreTip === t.id ? t.renk : '#F8FAFC',
                      color: filtreTip === t.id ? '#FFFFFF' : '#475569'
                    }}
                  >
                    {t.ad}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setGelismisFiltreAcik((p) => !p)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: (filtreBaslangic || filtreBitis || filtreMuhasebe !== 'hepsi') ? '#FEF3C7' : '#F8FAFC',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚙️ {gelismisFiltreAcik ? 'Filtreleri Gizle' : 'Tarih & Filtre'}
              </button>
            </div>

            {/* Arama + Şantiye + Sıralama */}
            <div className="finans-filtre-satiri">
              <input
                type="text"
                placeholder="🔍 Zaman çizelgesinde ara (başlık, kişi, şantiye, kasa, tutar, not)..."
                value={filtreArama}
                onChange={(e) => setFiltreArama(e.target.value)}
                style={INPUT_STIL}
              />

              <select value={filtreSantiye} onChange={(e) => { setFiltreSantiye(e.target.value); setGorunenAdet(40) }} style={INPUT_STIL}>
                <option value="hepsi">Tüm Şantiyeler</option>
                <option value="genel">🏢 Genel Giderler</option>
                {!isSantiyeSefi && danismanlikProjeleri.map((p) => (
                  <option key={p.id} value={`danismanlik:${p.id}`}>💼 Danışmanlık: {p.ad}</option>
                ))}
                {santiyeler.map((s) => <option key={s.id} value={s.id}>🏗️ {s.ad}</option>)}
              </select>

              <select value={filtreSiralama} onChange={(e) => setFiltreSiralama(e.target.value)} style={INPUT_STIL}>
                <option value="kayit_yeni">⏱️ Kayıt Tarih & Saati (Yeni → Eski)</option>
                <option value="kayit_eski">⏱️ Kayıt Tarih & Saati (Eski → Yeni)</option>
                <option value="tarih_yeni">📅 İşlem Tarihi (Yeni → Eski)</option>
                <option value="tarih_eski">📅 İşlem Tarihi (Eski → Yeni)</option>
              </select>
            </div>

            {gelismisFiltreAcik && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, paddingTop: 8, borderTop: '1px dashed #E2E8F0' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Başlangıç Tarihi</label>
                  <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} style={INPUT_STIL} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Bitiş Tarihi</label>
                  <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} style={INPUT_STIL} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>Muhasebe Paylaşımı</label>
                  <select value={filtreMuhasebe} onChange={(e) => setFiltreMuhasebe(e.target.value)} style={INPUT_STIL}>
                    <option value="hepsi">Tümü</option>
                    <option value="paylasildi">✓ Paylaşıldı</option>
                    <option value="paylasilmadi">⏳ Paylaşılmadı</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltreTip('hepsi')
                      setFiltreSantiye('hepsi')
                      setFiltreArama('')
                      setFiltreMuhasebe('hepsi')
                      setFiltreBaslangic('')
                      setFiltreBitis('')
                    }}
                    style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                  >
                    ✕ Filtreleri Temizle
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* KRONOLOJİK TİMELİNE (GÜN BAZLI ZAMAN ÇİZELGESİ)           */}
          {/* ========================================================= */}
          {gunGruplari.length === 0 ? (
            <BosDurum
              ikon="📭"
              baslik="Kayıt Bulunamadı"
              aciklama="Seçili filtrelere uygun finans işlemi bulunmuyor. Yukarıdaki panelden yeni işlem ekleyebilirsiniz."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {gunGruplari.map((grup) => (
                <div key={grup.gunKey}>
                  {/* Gün Başlığı */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 10,
                    padding: '6px 12px',
                    background: '#F1F5F9',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>
                      📅 {grup.baslik}
                    </span>
                    <div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}>
                      {grup.gunGider > 0 && (
                        <span style={{ color: '#BE123C', background: '#FFE4E6', padding: '2px 8px', borderRadius: 8 }}>
                          - {paraFormatla(grup.gunGider)} ₺
                        </span>
                      )}
                      {grup.gunGelir > 0 && (
                        <span style={{ color: '#047857', background: '#DCFCE7', padding: '2px 8px', borderRadius: 8 }}>
                          + {paraFormatla(grup.gunGelir)} ₺
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dikey Timeline Rayı */}
                  <div className="finans-timeline-ray">
                    {grup.kayitlar.map((item) => {
                      const duzenleniyor = duzenlenenKey === item.key
                      return (
                        <div key={item.key} style={{ position: 'relative' }}>
                          {/* Timeline Noktası */}
                          <span
                            className="finans-timeline-nokta"
                            style={{
                              background: item.renk,
                              boxShadow: `0 0 0 2px ${item.renk}44`
                            }}
                          />

                          {/* Timeline Kartı */}
                          <div style={{
                            background: '#FFFFFF',
                            borderRadius: 14,
                            padding: '12px 14px',
                            border: `1px solid ${item.border}`,
                            borderLeft: `4px solid ${item.renk}`,
                            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
                          }}>
                            {duzenleniyor ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                                  {item.kaynak === 'gider' && (
                                    <input type="text" value={duzForm.baslik || ''} onChange={(e) => setDuzForm((p) => ({ ...p, baslik: e.target.value }))} placeholder="Başlık" style={INPUT_STIL} />
                                  )}
                                  <input type="text" value={duzForm.tutar || ''} onChange={(e) => setDuzForm((p) => ({ ...p, tutar: formatInputTutar(e.target.value) }))} onKeyDown={sadeceSayiTuslari} placeholder="Tutar" style={INPUT_STIL} />
                                  <input type="date" value={duzForm.tarih || ''} onChange={(e) => setDuzForm((p) => ({ ...p, tarih: e.target.value }))} style={INPUT_STIL} />
                                  {item.kaynak === 'gider' && (
                                    <CariAramaSecici
                                      deger={duzForm.odenen_kisi || ''}
                                      onDegisti={(isim, cid) => setDuzForm((p) => ({ ...p, odenen_kisi: isim, cari_id: cid || null }))}
                                      placeholder="Ödenen Kişi / Cari ara..."
                                    />
                                  )}
                                  {item.kaynak === 'gelir' && (
                                    <CariAramaSecici
                                      deger={duzForm.odeme_yapan_adi || ''}
                                      onDegisti={(isim, cid) => setDuzForm((p) => ({ ...p, odeme_yapan_adi: isim, cari_id: cid || null }))}
                                      placeholder="Ödeme Yapan / Cari ara..."
                                    />
                                  )}
                                </div>
                                <textarea
                                  rows={2}
                                  value={item.kaynak === 'gider' ? (duzForm.aciklama || '') : (duzForm.not_metni || '')}
                                  onChange={(e) => setDuzForm((p) => item.kaynak === 'gider' ? { ...p, aciklama: e.target.value } : { ...p, not_metni: e.target.value })}
                                  placeholder="Açıklama / Not"
                                  style={{ ...INPUT_STIL, height: 'auto', padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical' }}
                                />
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button type="button" onClick={() => setDuzenlenenKey(null)} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>İptal</button>
                                  <button type="button" onClick={() => duzenlemeKaydet(item)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#FFF', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>Kaydet</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* DENGELİ 2 SÜTUNLU KART: MASAÜSTÜNDE 2 SÜTUN, MOBİLDE KOMPAKT ÜST TUTAR + ALT META ŞERİDİ */}
                                <div className="finans-kart-govde">
                                  {/* SOL TARAF */}
                                  <div className="finans-kart-sol">
                                    {/* Tür + Şantiye* + Harcama Noktası* (+ Mobilde Sağ Üst Tutar) */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontSize: 10.5,
                                        fontWeight: 800,
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        background: item.bg,
                                        color: item.renk,
                                        border: `1px solid ${item.border}`
                                      }}>
                                        {item.etiket}
                                      </span>

                                      {item.santiyeAd && (
                                        <span style={{
                                          fontSize: 11.5,
                                          fontWeight: 800,
                                          padding: '3px 8px',
                                          borderRadius: 7,
                                          background: '#E6F9F0',
                                          color: '#0F6E56',
                                          border: '1px solid #A7F3D0',
                                          maxWidth: '100%',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          {item.kaynak === 'danismanlik' ? '💼' : item.kaynak === 'virman' ? '🏦' : '🏗️'} {item.santiyeAd}
                                        </span>
                                      )}

                                      <span className="finans-mobil-tutar" style={{ color: item.renk }}>
                                        {item.yon === 'cikis' ? '-' : item.yon === 'giris' ? '+' : ''}
                                        {paraFormatla(item.tutar)} ₺
                                      </span>

                                      {item.hesapBilgisi && (
                                        <span style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          padding: '3px 8px',
                                          borderRadius: 7,
                                          background: '#EFF6FF',
                                          color: '#1E40AF',
                                          border: '1px solid #BFDBFE'
                                        }}>
                                          💳 {item.hesapBilgisi}
                                        </span>
                                      )}
                                    </div>

                                    {/* Harcama Başlığı (Üstte) & Harcamanın Yapıldığı Kişi (Hemen Altında) */}
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4,
                                      padding: '7px 10px',
                                      borderRadius: 10,
                                      background: '#F8FAFC',
                                      border: '1px solid #E2E8F0'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, fontWeight: 800, color: '#0F172A', wordBreak: 'break-word' }}>
                                        {item.baslik && <span>📌 {item.baslik}</span>}
                                        {item.kategori && <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 500 }}>• 📁 {item.kategori}</span>}
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 5, wordBreak: 'break-word' }}>
                                          <span>👤</span>
                                          <span>
                                            {item.kisi
                                              ? `${item.kaynak === 'gider' ? 'Ödenen: ' : item.kaynak === 'gelir' ? 'Ödeme Yapan: ' : ''}${item.kisi}`
                                              : (item.kaynak === 'gider' || item.kaynak === 'gelir' ? 'Cari / Kişi Belirtilmemiş' : '')}
                                          </span>
                                        </div>
                                        {!item.kisi && (item.kaynak === 'gider' || item.kaynak === 'gelir') && (
                                          <button
                                            type="button"
                                            onClick={() => duzenlemeBaslat(item)}
                                            style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: '1px solid #FDE68A', background: '#FEF3C7', color: '#B45309', cursor: 'pointer' }}
                                          >
                                            + Cari Ata
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Açıklama */}
                                    {item.notMetni && (
                                      <div style={{ fontSize: 12.5, color: '#475569', background: '#FFFDF7', border: '1px solid #F1EFE8', padding: '6px 10px', borderRadius: 8, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                        📝 {item.notMetni}
                                      </div>
                                    )}
                                  </div>

                                  {/* SAĞ TARAF: TUTAR (MASAÜSTÜ) + TARİHLER* + KAYDEDEN */}
                                  <div className="finans-kart-sag">
                                    <div className="finans-sag-tutar" style={{ color: item.renk }}>
                                      {item.yon === 'cikis' ? '-' : item.yon === 'giris' ? '+' : ''}
                                      {paraFormatla(item.tutar)} ₺
                                    </div>

                                    {item.tarih && (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', background: '#F1F5F9', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                        📅 İşlem: {new Date(`${item.tarih.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR')}
                                      </span>
                                    )}

                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                                      🕒 Kayıt: {kayitZamaniFormatla(item.kayitTarihi || item.tarih)}
                                    </span>

                                    {item.ekleyen && (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>
                                        ✍️ {item.ekleyen}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Kart Alt Aksiyon Çubuğu */}
                                <div className="finans-aksiyon-bar" style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                  marginTop: 10,
                                  paddingTop: 8,
                                  borderTop: '1px solid #F1F5F9'
                                }}>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {item.belgeUrl ? (
                                      <button
                                        type="button"
                                        onClick={() => setOnizlemeBelge({ url: item.belgeUrl, baslik: item.baslik })}
                                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BAE6FD', background: '#E0F2FE', color: '#0369A1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        📎 Belgeyi Gör
                                      </button>
                                    ) : item.kaynak !== 'virman' && (
                                      <>
                                        <label style={{ padding: '4px 10px', borderRadius: 8, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#64748B', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                                          + Belge Ekle
                                          <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => sonradanBelgeYukle(item, e.target.files?.[0])} />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => panodanGorselYapistir((file) => sonradanBelgeYukle(item, file))}
                                          title="Kopyalanmış panodaki görseli bu kayda ekle"
                                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px dashed #93C5FD', background: '#EFF6FF', color: '#1D4ED8', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          📋 Panodan Ekle
                                        </button>
                                      </>
                                    )}

                                    {item.kaynak !== 'danismanlik' && (
                                      <button
                                        type="button"
                                        onClick={() => muhasebeToggle(item)}
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: 8,
                                          border: item.muhasebePaylasim ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                                          background: item.muhasebePaylasim ? '#ECFDF5' : '#F8FAFC',
                                          color: item.muhasebePaylasim ? '#047857' : '#64748B',
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {item.muhasebePaylasim ? '✓ Muhasebe' : '⏳ Muhasebe'}
                                      </button>
                                    )}

                                    {item.kaynak === 'danismanlik' && (
                                      <button
                                        type="button"
                                        onClick={() => navigate('/danismanliklar')}
                                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        💼 Mutabakat Sayfası
                                      </button>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
                                    <button
                                      type="button"
                                      onClick={() => universalPaylasTetikle(item)}
                                      title="Paylaş (WhatsApp, Telegram, E-posta, Kopyala, Sistem Paylaşımı)"
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 8,
                                        border: paylasMenuKey === item.key ? '1px solid #0284C7' : '1px solid #E2E8F0',
                                        background: paylasMenuKey === item.key ? '#E0F2FE' : '#F8FAFC',
                                        color: '#0F172A',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                      }}
                                    >
                                      📤 Paylaş
                                    </button>

                                    {paylasMenuKey === item.key && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 'calc(100% + 6px)',
                                          right: 0,
                                          zIndex: 60,
                                          minWidth: 195,
                                          background: '#FFFFFF',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: 12,
                                          padding: 6,
                                          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 4
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            window.open('https://wa.me/?text=' + encodeURIComponent(paylasMetniOlustur(item, true)), '_blank')
                                            setPaylasMenuKey(null)
                                          }}
                                          style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', background: '#F0FDF4', color: '#166534', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          📱 WhatsApp
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            window.open('https://t.me/share/url?url=' + encodeURIComponent(item.belgeUrl || window.location.origin) + '&text=' + encodeURIComponent(paylasMetniOlustur(item, true)), '_blank')
                                            setPaylasMenuKey(null)
                                          }}
                                          style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          ✈️ Telegram
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const konu = `${item.etiket} — ${item.santiyeAd || ''} — ${paraFormatla(item.tutar)} TL`
                                            window.location.href = `mailto:?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(paylasMetniOlustur(item, true))}`
                                            setPaylasMenuKey(null)
                                          }}
                                          style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', background: '#F8FAFC', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          ✉️ E-posta
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => metinPanoyaKopyala(item)}
                                          style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', background: kopyalandiKey === item.key ? '#DCFCE7' : '#F8FAFC', color: kopyalandiKey === item.key ? '#166534' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                          {kopyalandiKey === item.key ? '✓ Panoya Kopyalandı' : '📋 Metni Kopyala'}
                                        </button>
                                        {typeof navigator !== 'undefined' && navigator.share && (
                                          <button
                                            type="button"
                                            onClick={() => sistemPaylas(item)}
                                            style={{ textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', background: '#EEF2FF', color: '#4338CA', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                          >
                                            🌐 Diğer Uygulamalar
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {item.kaynak !== 'danismanlik' && (
                                      <button type="button" onClick={() => duzenlemeBaslat(item)} title="Düzenle" style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}>
                                        ✏️
                                      </button>
                                    )}
                                    <button type="button" onClick={() => timelineKayitSil(item)} title="Sil" style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#E11D48', fontSize: 12, cursor: 'pointer' }}>
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Daha Fazla Yükle */}
              {filtrelenmisTimeline.length > gorunenAdet && (
                <button
                  type="button"
                  onClick={() => setGorunenAdet((p) => p + 40)}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: 'pointer'
                  }}
                >
                  Daha Fazla Göster ({filtrelenmisTimeline.length - gorunenAdet} kayıt kaldı)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* BELGE ÖNİZLEME MODALI */}
      {onizlemeBelge && (
        <div
          onClick={() => setOnizlemeBelge(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14
          }}
        >
          <div style={{ color: '#FFF', fontWeight: 700, fontSize: 15 }}>{onizlemeBelge.baslik}</div>
          <img
            src={getGoogleDriveInlineImageUrl(onizlemeBelge.url)}
            alt={onizlemeBelge.baslik}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '72vh', borderRadius: 12, objectFit: 'contain', background: '#FFF' }}
          />
          <div style={{ display: 'flex', gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <a
              href={getGoogleDriveViewUrl(onizlemeBelge.url)}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 16px', borderRadius: 10, background: '#1D9596', color: '#FFF', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}
            >
              🔗 Google Drive'da Aç
            </a>
            <button
              type="button"
              onClick={() => setOnizlemeBelge(null)}
              style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#FFF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

