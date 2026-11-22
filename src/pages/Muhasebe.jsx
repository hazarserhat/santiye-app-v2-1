import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla } from '../lib/format'
import {
  uploadToGoogleDrive,
  moveToSilinenler,
  getGoogleDriveInlineImageUrl,
  getGoogleDriveViewUrl,
} from '../lib/googleDrive'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from '../lib/operasyonKayit'
import { LOCAL_STORAGE_SEVKIYAT_PLAN } from './SevkiyatPlanlama'

export const KEY_MUHASEBE_CALISANLAR = 'muhasebe_calisanlar_v1'
export const KEY_MUHASEBE_FATURALAR = 'muhasebe_fatura_islemleri_v1'
export const KEY_MUHASEBE_BELGELER = 'muhasebe_gelen_belgeler_v1'
export const KEY_MUHASEBE_BELGE_KONTROL = 'muhasebe_belge_kontrol_v1'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihTR = (str) => {
  if (!str) return '—'
  const parts = String(str).slice(0, 10).split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return str
}

const isPdfUrl = (url) => String(url || '').toLowerCase().includes('.pdf')

export default function Muhasebe() {
  const { santiyeler, aktifSantiye } = useSite()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const baslangicSekme = searchParams.get('sekme')
  const [aktifSekme, setAktifSekme] = useState(
    ['calisanlar', 'fatura', 'irsaliye'].includes(baslangicSekme) ? baslangicSekme : 'calisanlar'
  )

  const [taseronlar, setTaseronlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [belgeYukleniyor, setBelgeYukleniyor] = useState(false)
  const [onizlemeUrl, setOnizlemeUrl] = useState(null)

  // =========================================================
  // 1. ÇALIŞANLAR (SGK GİRİŞ / ÇIKIŞ) STATE
  // =========================================================
  const [calisanlar, setCalisanlar] = useState([])
  const [calisanFormAcik, setCalisanFormAcik] = useState(false)
  const [duzenlenenCalisanId, setDuzenlenenCalisanId] = useState(null)
  const [calisanFiltreDurum, setCalisanFiltreDurum] = useState('hepsi') // 'hepsi' | 'bekliyor' | 'tamamlandi'
  const [calisanFiltreSantiye, setCalisanFiltreSantiye] = useState('hepsi')
  const [calisanArama, setCalisanArama] = useState('')

  const [cForm, setCForm] = useState({
    adSoyad: '',
    tcNo: '',
    telefon: '',
    taseronAd: '',
    santiyeId: '',
    islemTuru: 'giris', // 'giris' | 'cikis' | 'aktif'
    girisTarihi: bugun(),
    cikisTarihi: '',
    gosterilecekGun: '30',
    notMetni: '',
    belgeler: [], // [{ url, ad }]
  })

  // =========================================================
  // 2. FATURA İŞLEMLERİ (KESİLECEK / İADE / TAMAMLANAN) STATE
  // =========================================================
  const [faturalar, setFaturalar] = useState([])
  const [faturaAltSekme, setFaturaAltSekme] = useState('kesilecek') // 'kesilecek' | 'iade' | 'tamamlanan'
  const [faturaFormAcik, setFaturaFormAcik] = useState(false)
  const [duzenlenenFaturaId, setDuzenlenenFaturaId] = useState(null)
  const [faturaArama, setFaturaArama] = useState('')

  const [fForm, setFForm] = useState({
    tip: 'kesilecek', // 'kesilecek' | 'iade'
    firmaAd: '',
    vergiNo: '',
    santiyeId: '',
    tutar: '',
    kdvOrani: '20',
    kdvDurum: 'haric', // 'haric' | 'dahil'
    tarih: bugun(),
    aciklama: '',
    belgeler: [],
  })

  // =========================================================
  // 3. FATURA / İRSALİYELER (SAHADAN GELEN BELGELER) STATE
  // =========================================================
  const [manuelBelgeler, setManuelBelgeler] = useState([])
  const [sevkiyatPlanlari, setSevkiyatPlanlari] = useState([])
  const [kontrolHaritasi, setKontrolHaritasi] = useState({}) // { [id]: { kontrolEdildi, tarih, eden } }
  const [belgeFormAcik, setBelgeFormAcik] = useState(false)
  const [belgeFiltreSantiye, setBelgeFiltreSantiye] = useState('hepsi')
  const [belgeFiltreDurum, setBelgeFiltreDurum] = useState('hepsi') // 'hepsi' | 'bekliyor' | 'kontrol_edildi'
  const [belgeArama, setBelgeArama] = useState('')

  const [bForm, setBForm] = useState({
    belgeTuru: 'İrsaliye', // 'İrsaliye' | 'Fatura' | 'Beton İrsaliyesi'
    santiyeId: '',
    tedarikci: '',
    malzeme: '',
    teslimAlan: '',
    tarih: bugun(),
    notMetni: '',
    belgeler: [],
  })

  useEffect(() => {
    const sekmeParam = searchParams.get('sekme')
    if (['calisanlar', 'fatura', 'irsaliye'].includes(sekmeParam)) {
      setAktifSekme(sekmeParam)
    }
  }, [searchParams])

  const sekmeDegistir = (yeni) => {
    setAktifSekme(yeni)
    setSearchParams({ sekme: yeni }, { replace: true })
  }

  useEffect(() => {
    if (aktifSantiye?.id) {
      setCForm((p) => (p.santiyeId ? p : { ...p, santiyeId: aktifSantiye.id }))
      setFForm((p) => (p.santiyeId ? p : { ...p, santiyeId: aktifSantiye.id }))
      setBForm((p) => (p.santiyeId ? p : { ...p, santiyeId: aktifSantiye.id }))
    }
  }, [aktifSantiye])

  useEffect(() => {
    if (profile?.ad_soyad) {
      setBForm((p) => (p.teslimAlan ? p : { ...p, teslimAlan: profile.ad_soyad }))
    }
  }, [profile])

  const tumVerileriYukle = async () => {
    setYukleniyor(true)
    try {
      const [cList, fList, bList, sList, tRes, kRes] = await Promise.all([
        operasyonVerisiYukle(KEY_MUHASEBE_CALISANLAR, []),
        operasyonVerisiYukle(KEY_MUHASEBE_FATURALAR, []),
        operasyonVerisiYukle(KEY_MUHASEBE_BELGELER, []),
        operasyonVerisiYukle(LOCAL_STORAGE_SEVKIYAT_PLAN, []),
        supabase.from('taseronlar').select('id, ad, firma').order('ad'),
        supabase.from('sistem_ayarlari').select('deger').eq('anahtar', KEY_MUHASEBE_BELGE_KONTROL).maybeSingle(),
      ])

      setCalisanlar(Array.isArray(cList) ? cList : [])
      setFaturalar(Array.isArray(fList) ? fList : [])
      setManuelBelgeler(Array.isArray(bList) ? bList : [])
      setSevkiyatPlanlari(Array.isArray(sList) ? sList : [])
      setTaseronlar(tRes.data || [])

      if (kRes.data?.deger) {
        try {
          setKontrolHaritasi(JSON.parse(kRes.data.deger) || {})
        } catch {
          setKontrolHaritasi({})
        }
      }
    } catch (err) {
      console.error('Muhasebe verileri yüklenemedi:', err)
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => {
    tumVerileriYukle()
  }, [])

  const santiyeAdiBul = (id) => santiyeler.find((s) => s.id === id)?.ad || 'Genel'

  // =========================================================
  // ORTAK GOOGLE DRIVE DOSYA YÜKLEME YARDIMCISI (AGENTS.md)
  // =========================================================
  const driveYukleCoklu = async (files, folderName, adSoyad) => {
    const liste = Array.from(files || [])
    if (liste.length === 0) return []
    setBelgeYukleniyor(true)
    const yuklenenler = []
    try {
      for (const file of liste) {
        const res = await uploadToGoogleDrive({
          file,
          folderName,
          adSoyad: adSoyad || profile?.ad_soyad || 'Muhasebe',
          date: bugun(),
        })
        if (res?.url) {
          yuklenenler.push({ url: res.url, ad: file.name || 'Belge' })
        }
      }
    } catch (err) {
      alert('Belge Google Drive\'a yüklenemedi: ' + (err.message || err))
    } finally {
      setBelgeYukleniyor(false)
    }
    return yuklenenler
  }

  // =========================================================
  // 1. ÇALIŞANLAR (SGK) İŞLEMLERİ
  // =========================================================
  const calisanFormSifirla = () => {
    setDuzenlenenCalisanId(null)
    setCForm({
      adSoyad: '',
      tcNo: '',
      telefon: '',
      taseronAd: '',
      santiyeId: aktifSantiye?.id || '',
      islemTuru: 'giris',
      girisTarihi: bugun(),
      cikisTarihi: '',
      gosterilecekGun: '30',
      notMetni: '',
      belgeler: [],
    })
  }

  const calisanKaydet = async (e) => {
    e.preventDefault()
    if (!cForm.adSoyad.trim()) {
      alert('Lütfen çalışan adını ve soyadını yazın.')
      return
    }
    const kayit = {
      id: duzenlenenCalisanId || `cal-${Date.now()}`,
      adSoyad: cForm.adSoyad.trim(),
      tcNo: cForm.tcNo.trim(),
      telefon: cForm.telefon.trim(),
      taseronAd: cForm.taseronAd.trim(),
      santiyeId: cForm.santiyeId || '',
      santiyeAd: cForm.santiyeId ? santiyeAdiBul(cForm.santiyeId) : 'Genel',
      islemTuru: cForm.islemTuru,
      girisTarihi: cForm.girisTarihi,
      cikisTarihi: cForm.cikisTarihi,
      gosterilecekGun: cForm.gosterilecekGun,
      notMetni: cForm.notMetni.trim(),
      belgeler: cForm.belgeler || [],
      durum: duzenlenenCalisanId
        ? (calisanlar.find((c) => c.id === duzenlenenCalisanId)?.durum || 'bekliyor')
        : 'bekliyor',
      ekleyen: profile?.ad_soyad || 'Yönetici',
      olusturmaTarihi: duzenlenenCalisanId
        ? (calisanlar.find((c) => c.id === duzenlenenCalisanId)?.olusturmaTarihi || new Date().toISOString())
        : new Date().toISOString(),
    }

    const guncel = duzenlenenCalisanId
      ? calisanlar.map((c) => (c.id === duzenlenenCalisanId ? kayit : c))
      : [kayit, ...calisanlar]

    setCalisanlar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_CALISANLAR, guncel)
    calisanFormSifirla()
    setCalisanFormAcik(false)
  }

  const calisanDurumToggle = async (id) => {
    const guncel = calisanlar.map((c) => {
      if (c.id !== id) return c
      const yeniDurum = c.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
      return {
        ...c,
        durum: yeniDurum,
        tamamlayan: yeniDurum === 'tamamlandi' ? (profile?.ad_soyad || 'Muhasebe') : '',
        tamamlanmaTarihi: yeniDurum === 'tamamlandi' ? new Date().toISOString() : '',
      }
    })
    setCalisanlar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_CALISANLAR, guncel)
  }

  const calisanSil = async (kayit) => {
    if (!window.confirm(`"${kayit.adSoyad}" çalışan kaydını silmek istiyor musunuz?`)) return
    for (const b of kayit.belgeler || []) {
      if (b?.url) {
        try {
          await moveToSilinenler(b.url, `Muhasebe/Calisanlar/${kayit.adSoyad || 'Genel'}`)
        } catch (err) {
          console.warn(err)
        }
      }
    }
    const guncel = calisanlar.filter((c) => c.id !== kayit.id)
    setCalisanlar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_CALISANLAR, guncel)
  }

  const calisanPaylas = (c) => {
    const turYazi = c.islemTuru === 'giris' ? 'SGK GİRİŞ' : c.islemTuru === 'cikis' ? 'SGK ÇIKIŞ' : 'AKTİF ÇALIŞAN'
    const satirlar = [
      `👷 *${turYazi} BİLDİRİMİ*`,
      `• Ad Soyad: ${c.adSoyad}`,
      c.tcNo ? `• T.C. No: ${c.tcNo}` : null,
      c.telefon ? `• Telefon: ${c.telefon}` : null,
      c.taseronAd ? `• Taşeron: ${c.taseronAd}` : null,
      `• Şantiye: ${c.santiyeAd || 'Genel'}`,
      c.girisTarihi ? `• Giriş Tarihi: ${tarihTR(c.girisTarihi)}` : null,
      c.cikisTarihi ? `• Çıkış Tarihi: ${tarihTR(c.cikisTarihi)}` : null,
      c.gosterilecekGun ? `• Gösterilecek Gün: ${c.gosterilecekGun} gün` : null,
      c.notMetni ? `• Not: ${c.notMetni}` : null,
      ...(c.belgeler || []).map((b, i) => `• Kimlik/Evrak ${i + 1}: ${b.url}`),
    ].filter(Boolean)
    window.open('https://wa.me/?text=' + encodeURIComponent(satirlar.join('\n')), '_blank')
  }

  const filtreliCalisanlar = useMemo(() => {
    return calisanlar.filter((c) => {
      if (calisanFiltreDurum !== 'hepsi' && c.durum !== calisanFiltreDurum) return false
      if (calisanFiltreSantiye !== 'hepsi' && c.santiyeId !== calisanFiltreSantiye) return false
      if (calisanArama.trim()) {
        const q = calisanArama.toLocaleLowerCase('tr-TR')
        const metin = `${c.adSoyad} ${c.taseronAd} ${c.santiyeAd} ${c.tcNo} ${c.notMetni}`.toLocaleLowerCase('tr-TR')
        if (!metin.includes(q)) return false
      }
      return true
    })
  }, [calisanlar, calisanFiltreDurum, calisanFiltreSantiye, calisanArama])

  // =========================================================
  // 2. FATURA İŞLEMLERİ (KESİLECEK / İADE / TAMAMLANAN)
  // =========================================================
  const faturaFormSifirla = (varsayilanTip = faturaAltSekme === 'iade' ? 'iade' : 'kesilecek') => {
    setDuzenlenenFaturaId(null)
    setFForm({
      tip: varsayilanTip,
      firmaAd: '',
      vergiNo: '',
      santiyeId: aktifSantiye?.id || '',
      tutar: '',
      kdvOrani: '20',
      kdvDurum: 'haric',
      tarih: bugun(),
      aciklama: '',
      belgeler: [],
    })
  }

  const faturaKaydet = async (e) => {
    e.preventDefault()
    if (!fForm.firmaAd.trim()) {
      alert('Lütfen fatura kesilecek firma / kişi adını yazın.')
      return
    }
    const mevcut = duzenlenenFaturaId ? faturalar.find((f) => f.id === duzenlenenFaturaId) : null
    const kayit = {
      id: duzenlenenFaturaId || `fat-${Date.now()}`,
      tip: fForm.tip, // 'kesilecek' | 'iade'
      firmaAd: fForm.firmaAd.trim(),
      vergiNo: fForm.vergiNo.trim(),
      santiyeId: fForm.santiyeId || '',
      santiyeAd: fForm.santiyeId ? santiyeAdiBul(fForm.santiyeId) : 'Genel',
      tutar: Number(String(fForm.tutar || '0').replace(',', '.')) || 0,
      kdvOrani: fForm.kdvOrani,
      kdvDurum: fForm.kdvDurum,
      tarih: fForm.tarih || bugun(),
      aciklama: fForm.aciklama.trim(),
      belgeler: fForm.belgeler || [],
      durum: mevcut?.durum || 'bekliyor',
      ekleyen: mevcut?.ekleyen || profile?.ad_soyad || 'Yönetici',
      olusturmaTarihi: mevcut?.olusturmaTarihi || new Date().toISOString(),
      tamamlayan: mevcut?.tamamlayan || '',
      tamamlanmaTarihi: mevcut?.tamamlanmaTarihi || '',
    }

    const guncel = duzenlenenFaturaId
      ? faturalar.map((f) => (f.id === duzenlenenFaturaId ? kayit : f))
      : [kayit, ...faturalar]

    setFaturalar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_FATURALAR, guncel)
    faturaFormSifirla()
    setFaturaFormAcik(false)
  }

  const faturaDurumDegistir = async (id, yeniDurum) => {
    const guncel = faturalar.map((f) => {
      if (f.id !== id) return f
      return {
        ...f,
        durum: yeniDurum,
        tamamlayan: yeniDurum === 'tamamlandi' ? (profile?.ad_soyad || 'Muhasebe') : '',
        tamamlanmaTarihi: yeniDurum === 'tamamlandi' ? new Date().toISOString() : '',
      }
    })
    setFaturalar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_FATURALAR, guncel)
  }

  const faturaSil = async (kayit) => {
    if (!window.confirm(`"${kayit.firmaAd}" fatura talimatını silmek istiyor musunuz?`)) return
    for (const b of kayit.belgeler || []) {
      if (b?.url) {
        try {
          await moveToSilinenler(b.url, `Muhasebe/FaturaIslemleri/${kayit.santiyeAd || 'Genel'}`)
        } catch (err) {
          console.warn(err)
        }
      }
    }
    const guncel = faturalar.filter((f) => f.id !== kayit.id)
    setFaturalar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_FATURALAR, guncel)
  }

  const faturayaSonradanBelgeEkle = async (kayit, files) => {
    const yuklenenler = await driveYukleCoklu(
      files,
      `Muhasebe/FaturaIslemleri/${kayit.santiyeAd || 'Genel'}`,
      kayit.firmaAd
    )
    if (yuklenenler.length === 0) return
    const guncel = faturalar.map((f) =>
      f.id === kayit.id ? { ...f, belgeler: [...(f.belgeler || []), ...yuklenenler] } : f
    )
    setFaturalar(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_FATURALAR, guncel)
  }

  const kesilecekSayisi = faturalar.filter((f) => f.tip === 'kesilecek' && f.durum !== 'tamamlandi').length
  const iadeSayisi = faturalar.filter((f) => f.tip === 'iade' && f.durum !== 'tamamlandi').length
  const tamamlananFaturaSayisi = faturalar.filter((f) => f.durum === 'tamamlandi').length

  const filtreliFaturalar = useMemo(() => {
    return faturalar.filter((f) => {
      if (faturaAltSekme === 'kesilecek' && !(f.tip === 'kesilecek' && f.durum !== 'tamamlandi')) return false
      if (faturaAltSekme === 'iade' && !(f.tip === 'iade' && f.durum !== 'tamamlandi')) return false
      if (faturaAltSekme === 'tamamlanan' && f.durum !== 'tamamlandi') return false
      if (faturaArama.trim()) {
        const q = faturaArama.toLocaleLowerCase('tr-TR')
        const metin = `${f.firmaAd} ${f.vergiNo} ${f.santiyeAd} ${f.aciklama}`.toLocaleLowerCase('tr-TR')
        if (!metin.includes(q)) return false
      }
      return true
    })
  }, [faturalar, faturaAltSekme, faturaArama])

  // =========================================================
  // 3. FATURA / İRSALİYELER (SAHADAN GELENLER + SEVKİYAT KÖPRÜSÜ)
  // =========================================================
  const birlesikGelenBelgeler = useMemo(() => {
    const sevkiyatBelgeleri = (sevkiyatPlanlari || [])
      .filter((p) => p.durum === 'teslim_alindi' || (p.fotograflar && p.fotograflar.length > 0) || p.irsaliyeFoto)
      .map((p) => {
        const fotoListesi = p.fotograflar?.length
          ? p.fotograflar
          : (p.irsaliyeFoto ? [p.irsaliyeFoto] : [])
        return {
          id: `sevk-${p.id}`,
          kaynak: 'sevkiyat',
          belgeTuru: (p.malzeme || '').toLocaleLowerCase('tr-TR').includes('beton') ? 'Beton İrsaliyesi' : 'İrsaliye',
          santiyeId: p.santiyeId || '',
          santiyeAd: p.santiyeAdi || santiyeAdiBul(p.santiyeId),
          tedarikci: p.tedarikci || 'Belirtilmemiş',
          malzeme: p.malzeme || 'Malzeme Teslimatı',
          teslimAlan: p.teslimAlan || p.ekleyen || 'Belirtilmemiş',
          tarih: (p.kabulTarihi || p.tarih || '').slice(0, 10),
          notMetni: p.kabulNotu || p.sahaNotu || '',
          belgeler: fotoListesi.map((url, idx) => ({ url, ad: `İrsaliye ${idx + 1}` })),
        }
      })

    const manuelList = (manuelBelgeler || []).map((b) => ({
      ...b,
      kaynak: 'manuel',
    }))

    return [...manuelList, ...sevkiyatBelgeleri].sort((a, b) =>
      String(b.tarih || '').localeCompare(String(a.tarih || ''))
    )
  }, [manuelBelgeler, sevkiyatPlanlari, santiyeler])

  const belgeKontrolToggle = async (belgeId) => {
    const mevcut = kontrolHaritasi[belgeId]?.kontrolEdildi
    const guncel = {
      ...kontrolHaritasi,
      [belgeId]: {
        kontrolEdildi: !mevcut,
        tarih: new Date().toISOString(),
        eden: profile?.ad_soyad || 'Muhasebe',
      },
    }
    setKontrolHaritasi(guncel)
    await supabase
      .from('sistem_ayarlari')
      .upsert({ anahtar: KEY_MUHASEBE_BELGE_KONTROL, deger: JSON.stringify(guncel) }, { onConflict: 'anahtar' })
  }

  const manuelBelgeKaydet = async (e) => {
    e.preventDefault()
    if (!bForm.tedarikci.trim() && !bForm.malzeme.trim()) {
      alert('Lütfen en azından tedarikçi veya ürün/malzeme bilgisini yazın.')
      return
    }
    const yeni = {
      id: `blg-${Date.now()}`,
      belgeTuru: bForm.belgeTuru,
      santiyeId: bForm.santiyeId || '',
      santiyeAd: bForm.santiyeId ? santiyeAdiBul(bForm.santiyeId) : 'Genel',
      tedarikci: bForm.tedarikci.trim() || 'Belirtilmemiş',
      malzeme: bForm.malzeme.trim() || 'Sahadan Gelen Belge',
      teslimAlan: bForm.teslimAlan.trim() || profile?.ad_soyad || 'Belirtilmemiş',
      tarih: bForm.tarih || bugun(),
      notMetni: bForm.notMetni.trim(),
      belgeler: bForm.belgeler || [],
      ekleyen: profile?.ad_soyad || 'Yönetici',
      olusturmaTarihi: new Date().toISOString(),
    }
    const guncel = [yeni, ...manuelBelgeler]
    setManuelBelgeler(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_BELGELER, guncel)
    setBForm({
      belgeTuru: 'İrsaliye',
      santiyeId: aktifSantiye?.id || '',
      tedarikci: '',
      malzeme: '',
      teslimAlan: profile?.ad_soyad || '',
      tarih: bugun(),
      notMetni: '',
      belgeler: [],
    })
    setBelgeFormAcik(false)
  }

  const manuelBelgeSil = async (kayit) => {
    if (!window.confirm('Bu belge kaydını silmek istiyor musunuz?')) return
    for (const b of kayit.belgeler || []) {
      if (b?.url) {
        try {
          await moveToSilinenler(b.url, `Muhasebe/GelenBelgeler/${kayit.santiyeAd || 'Genel'}`)
        } catch (err) {
          console.warn(err)
        }
      }
    }
    const guncel = manuelBelgeler.filter((x) => x.id !== kayit.id)
    setManuelBelgeler(guncel)
    await operasyonVerisiKaydet(KEY_MUHASEBE_BELGELER, guncel)
  }

  const filtreliGelenBelgeler = useMemo(() => {
    return birlesikGelenBelgeler.filter((b) => {
      if (belgeFiltreSantiye !== 'hepsi' && b.santiyeId !== belgeFiltreSantiye) return false
      const kontrol = Boolean(kontrolHaritasi[b.id]?.kontrolEdildi)
      if (belgeFiltreDurum === 'bekliyor' && kontrol) return false
      if (belgeFiltreDurum === 'kontrol_edildi' && !kontrol) return false
      if (belgeArama.trim()) {
        const q = belgeArama.toLocaleLowerCase('tr-TR')
        const metin = `${b.tedarikci} ${b.malzeme} ${b.teslimAlan} ${b.santiyeAd} ${b.belgeTuru} ${b.notMetni}`.toLocaleLowerCase('tr-TR')
        if (!metin.includes(q)) return false
      }
      return true
    })
  }, [birlesikGelenBelgeler, belgeFiltreSantiye, belgeFiltreDurum, belgeArama, kontrolHaritasi])

  const bekleyenCalisanSayisi = calisanlar.filter((c) => c.durum !== 'tamamlandi').length
  const bekleyenFaturaToplam = kesilecekSayisi + iadeSayisi

  return (
    <div className="sayfa" style={{ maxWidth: 1120, margin: '0 auto', paddingBottom: 96 }}>
      {/* ÜST BAŞLIK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
            🧾 Muhasebe Merkezi
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748B' }}>
            SGK çalışan bildirimleri, kesilecek/iade fatura talimatları ve sahadan gelen irsaliye/fatura takibi
          </p>
        </div>
      </div>

      {/* ANA 3 SEKME */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 8,
        marginBottom: 16,
      }}>
        <button
          type="button"
          onClick={() => sekmeDegistir('calisanlar')}
          style={{
            padding: '11px 10px',
            borderRadius: 12,
            border: aktifSekme === 'calisanlar' ? '1.5px solid #0F766E' : '1px solid #E2E8F0',
            background: aktifSekme === 'calisanlar' ? '#F0FDFA' : '#FFFFFF',
            color: aktifSekme === 'calisanlar' ? '#0F766E' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: aktifSekme === 'calisanlar' ? '0 2px 8px rgba(15,118,110,0.12)' : 'none',
          }}
        >
          <span>👷</span>
          <span>Çalışanlar</span>
          {bekleyenCalisanSayisi > 0 && (
            <span style={{ fontSize: 11, background: '#0F766E', color: '#fff', borderRadius: 999, padding: '1px 7px' }}>
              {bekleyenCalisanSayisi}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => sekmeDegistir('fatura')}
          style={{
            padding: '11px 10px',
            borderRadius: 12,
            border: aktifSekme === 'fatura' ? '1.5px solid #1D4ED8' : '1px solid #E2E8F0',
            background: aktifSekme === 'fatura' ? '#EFF6FF' : '#FFFFFF',
            color: aktifSekme === 'fatura' ? '#1D4ED8' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: aktifSekme === 'fatura' ? '0 2px 8px rgba(29,78,216,0.12)' : 'none',
          }}
        >
          <span>🧾</span>
          <span>Fatura İşlemleri</span>
          {bekleyenFaturaToplam > 0 && (
            <span style={{ fontSize: 11, background: '#1D4ED8', color: '#fff', borderRadius: 999, padding: '1px 7px' }}>
              {bekleyenFaturaToplam}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => sekmeDegistir('irsaliye')}
          style={{
            padding: '11px 10px',
            borderRadius: 12,
            border: aktifSekme === 'irsaliye' ? '1.5px solid #B45309' : '1px solid #E2E8F0',
            background: aktifSekme === 'irsaliye' ? '#FFFBEB' : '#FFFFFF',
            color: aktifSekme === 'irsaliye' ? '#B45309' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: aktifSekme === 'irsaliye' ? '0 2px 8px rgba(180,83,9,0.12)' : 'none',
          }}
        >
          <span>📄</span>
          <span>Fatura / İrsaliyeler</span>
          <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', borderRadius: 999, padding: '1px 7px' }}>
            {birlesikGelenBelgeler.length}
          </span>
        </button>
      </div>

      {yukleniyor ? (
        <p className="bos-mesaj">Muhasebe verileri yükleniyor...</p>
      ) : (
        <>
          {/* ========================================================= */}
          {/* SEKME 1: ÇALIŞANLAR (SGK GİRİŞ / ÇIKIŞ)                   */}
          {/* ========================================================= */}
          {aktifSekme === 'calisanlar' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { id: 'hepsi', ad: `Tümü (${calisanlar.length})` },
                    { id: 'bekliyor', ad: `⏳ Bekleyen (${bekleyenCalisanSayisi})` },
                    { id: 'tamamlandi', ad: `✅ Tamamlanan (${calisanlar.length - bekleyenCalisanSayisi})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCalisanFiltreDurum(f.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: calisanFiltreDurum === f.id ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
                        background: calisanFiltreDurum === f.id ? '#0F766E' : '#FFFFFF',
                        color: calisanFiltreDurum === f.id ? '#FFFFFF' : '#334155',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.ad}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (calisanFormAcik) {
                      setCalisanFormAcik(false)
                      calisanFormSifirla()
                    } else {
                      calisanFormSifirla()
                      setCalisanFormAcik(true)
                    }
                  }}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#0F766E',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {calisanFormAcik ? '✕ Formu Kapat' : '+ Çalışan / SGK Bildirimi Ekle'}
                </button>
              </div>

              {calisanFormAcik && (
                <form onSubmit={calisanKaydet} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 14, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    {duzenlenenCalisanId ? '✏️ Çalışan Kaydını Düzenle' : '👷 Yeni Çalışan / SGK Giriş-Çıkış Bildirimi'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>İşlem Türü</label>
                      <select value={cForm.islemTuru} onChange={(e) => setCForm({ ...cForm, islemTuru: e.target.value })} style={{ width: '100%' }}>
                        <option value="giris">🟢 SGK Giriş Başlat</option>
                        <option value="cikis">🔴 SGK Çıkış Yap</option>
                        <option value="aktif">📋 Aktif Çalışan / Gün Bildirimi</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Ad Soyad *</label>
                      <input type="text" placeholder="Örn: Ahmet Yılmaz" value={cForm.adSoyad} onChange={(e) => setCForm({ ...cForm, adSoyad: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} required />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>T.C. Kimlik No (Opsiyonel)</label>
                      <input type="text" placeholder="11 haneli T.C." value={cForm.tcNo} onChange={(e) => setCForm({ ...cForm, tcNo: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Telefon (Opsiyonel)</label>
                      <input type="tel" placeholder="05xx..." value={cForm.telefon} onChange={(e) => setCForm({ ...cForm, telefon: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bağlı Olduğu Taşeron</label>
                      <input
                        type="text"
                        list="muhasebe-taseron-listesi"
                        placeholder="Taşeron seçin veya yazın"
                        value={cForm.taseronAd}
                        onChange={(e) => setCForm({ ...cForm, taseronAd: e.target.value })}
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      />
                      <datalist id="muhasebe-taseron-listesi">
                        {taseronlar.map((t) => (
                          <option key={t.id} value={t.firma || t.ad} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye</label>
                      <select value={cForm.santiyeId} onChange={(e) => setCForm({ ...cForm, santiyeId: e.target.value })} style={{ width: '100%' }}>
                        <option value="">Genel / Tüm Şantiyeler</option>
                        {santiyeler.map((s) => (
                          <option key={s.id} value={s.id}>{s.ad}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>SGK Giriş Tarihi</label>
                      <input type="date" value={cForm.girisTarihi} onChange={(e) => setCForm({ ...cForm, girisTarihi: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>SGK Çıkış Tarihi</label>
                      <input type="date" value={cForm.cikisTarihi} onChange={(e) => setCForm({ ...cForm, cikisTarihi: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Gösterilecek Gün Sayısı</label>
                      <input type="number" min="0" max="31" placeholder="Örn: 15 veya 30" value={cForm.gosterilecekGun} onChange={(e) => setCForm({ ...cForm, gosterilecekGun: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Not / Açıklama</label>
                    <input type="text" placeholder="Örn: Kimlik ön-arka eklendi, ay sonu çıkışı yapılacak..." value={cForm.notMetni} onChange={(e) => setCForm({ ...cForm, notMetni: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ padding: '8px 13px', borderRadius: 9, border: '1px dashed #0F766E', background: '#F0FDFA', color: '#0F766E', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      {belgeYukleniyor ? '⏳ Drive\'a yükleniyor...' : '🪪 Kimlik / Evrak Fotoğrafı Ekle (Drive)'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const yuklenen = await driveYukleCoklu(
                            e.target.files,
                            `Muhasebe/Calisanlar/${cForm.adSoyad.trim() || 'Genel'}`,
                            cForm.adSoyad.trim() || 'Calisan'
                          )
                          if (yuklenen.length > 0) {
                            setCForm((p) => ({ ...p, belgeler: [...(p.belgeler || []), ...yuklenen] }))
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {(cForm.belgeler || []).length > 0 && (
                      <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>
                        ✅ {cForm.belgeler.length} belge Drive'a eklendi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={() => { setCalisanFormAcik(false); calisanFormSifirla() }} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                    <button type="submit" disabled={belgeYukleniyor} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#0F766E', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                      {duzenlenenCalisanId ? 'Güncelle' : 'Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Arama & Şantiye Filtresi */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Çalışan adı, taşeron veya T.C. ara..."
                  value={calisanArama}
                  onChange={(e) => setCalisanArama(e.target.value)}
                  style={{ flex: 2, minWidth: 200 }}
                />
                <select value={calisanFiltreSantiye} onChange={(e) => setCalisanFiltreSantiye(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                  <option value="hepsi">🏗️ Tüm Şantiyeler</option>
                  {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
              </div>

              {/* Çalışan Kart Listesi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtreliCalisanlar.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 36, background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    Henüz çalışan / SGK bildirimi bulunmuyor.
                  </div>
                ) : filtreliCalisanlar.map((c) => {
                  const turStil = c.islemTuru === 'giris'
                    ? { etiket: '🟢 SGK GİRİŞ', bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' }
                    : c.islemTuru === 'cikis'
                      ? { etiket: '🔴 SGK ÇIKIŞ', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' }
                      : { etiket: '📋 AKTİF / GÜN', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' }
                  return (
                    <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `4px solid ${turStil.color}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 7, background: turStil.bg, color: turStil.color, border: `1px solid ${turStil.border}` }}>
                            {turStil.etiket}
                          </span>
                          <strong style={{ fontSize: 15, color: '#0F172A' }}>{c.adSoyad}</strong>
                          {c.taseronAd && (
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: '#F1F5F9', color: '#334155' }}>
                              🏢 {c.taseronAd}
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: '#E6F9F0', color: '#0F6E56' }}>
                            🏗️ {c.santiyeAd || 'Genel'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => calisanDurumToggle(c.id)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 9,
                            border: c.durum === 'tamamlandi' ? '1.5px solid #047857' : '1.5px solid #F59E0B',
                            background: c.durum === 'tamamlandi' ? '#059669' : '#FFFBEB',
                            color: c.durum === 'tamamlandi' ? '#FFFFFF' : '#B45309',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {c.durum === 'tamamlandi' ? '✅ SGK İşlendi' : '⏳ Muhasebe Bekliyor'}
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: '#475569' }}>
                        {c.girisTarihi && <span>📅 Giriş: <strong>{tarihTR(c.girisTarihi)}</strong></span>}
                        {c.cikisTarihi && <span>📅 Çıkış: <strong>{tarihTR(c.cikisTarihi)}</strong></span>}
                        {c.gosterilecekGun && <span>🗓️ Gösterilecek Gün: <strong>{c.gosterilecekGun} gün</strong></span>}
                        {c.tcNo && <span>🪪 T.C.: <strong>{c.tcNo}</strong></span>}
                        {c.telefon && <span>📞 {c.telefon}</span>}
                      </div>

                      {c.notMetni && (
                        <div style={{ fontSize: 12.5, color: '#475569', background: '#FFFDF7', border: '1px solid #F1EFE8', padding: '6px 10px', borderRadius: 8 }}>
                          📝 {c.notMetni}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(c.belgeler || []).map((b, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setOnizlemeUrl(b.url)}
                              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BAE6FD', background: '#E0F2FE', color: '#0369A1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                            >
                              🪪 Kimlik / Evrak {idx + 1}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => calisanPaylas(c)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                            📤 Paylaş
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDuzenlenenCalisanId(c.id)
                              setCForm({
                                adSoyad: c.adSoyad || '',
                                tcNo: c.tcNo || '',
                                telefon: c.telefon || '',
                                taseronAd: c.taseronAd || '',
                                santiyeId: c.santiyeId || '',
                                islemTuru: c.islemTuru || 'giris',
                                girisTarihi: c.girisTarihi || '',
                                cikisTarihi: c.cikisTarihi || '',
                                gosterilecekGun: c.gosterilecekGun || '',
                                notMetni: c.notMetni || '',
                                belgeler: c.belgeler || [],
                              })
                              setCalisanFormAcik(true)
                            }}
                            style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}
                            title="Düzenle"
                          >
                            ✏️
                          </button>
                          <button type="button" onClick={() => calisanSil(c)} style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#E11D48', fontSize: 12, cursor: 'pointer' }} title="Sil">
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SEKME 2: FATURA İŞLEMLERİ (KESİLECEK / İADE / TAMAMLANAN) */}
          {/* ========================================================= */}
          {aktifSekme === 'fatura' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setFaturaAltSekme('kesilecek')}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 10,
                      border: faturaAltSekme === 'kesilecek' ? '1.5px solid #1D4ED8' : '1px solid #CBD5E1',
                      background: faturaAltSekme === 'kesilecek' ? '#1D4ED8' : '#FFFFFF',
                      color: faturaAltSekme === 'kesilecek' ? '#FFFFFF' : '#334155',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    📤 Kesilecek Faturalar ({kesilecekSayisi})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaturaAltSekme('iade')}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 10,
                      border: faturaAltSekme === 'iade' ? '1.5px solid #D97706' : '1px solid #CBD5E1',
                      background: faturaAltSekme === 'iade' ? '#D97706' : '#FFFFFF',
                      color: faturaAltSekme === 'iade' ? '#FFFFFF' : '#334155',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ↩️ İade Faturaları ({iadeSayisi})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFaturaAltSekme('tamamlanan')}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 10,
                      border: faturaAltSekme === 'tamamlanan' ? '1.5px solid #059669' : '1px solid #CBD5E1',
                      background: faturaAltSekme === 'tamamlanan' ? '#059669' : '#FFFFFF',
                      color: faturaAltSekme === 'tamamlanan' ? '#FFFFFF' : '#334155',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✅ Tamamlanan İşlemler ({tamamlananFaturaSayisi})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (faturaFormAcik) {
                      setFaturaFormAcik(false)
                      faturaFormSifirla()
                    } else {
                      faturaFormSifirla(faturaAltSekme === 'iade' ? 'iade' : 'kesilecek')
                      setFaturaFormAcik(true)
                    }
                  }}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#1D4ED8',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {faturaFormAcik ? '✕ Formu Kapat' : '+ Fatura Talimatı Ekle'}
                </button>
              </div>

              {faturaFormAcik && (
                <form onSubmit={faturaKaydet} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 14, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    {duzenlenenFaturaId ? '✏️ Fatura Talimatını Düzenle' : '🧾 Muhasebeye Yeni Fatura Talimatı'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Fatura Türü</label>
                      <select value={fForm.tip} onChange={(e) => setFForm({ ...fForm, tip: e.target.value })} style={{ width: '100%' }}>
                        <option value="kesilecek">📤 Kesilecek Fatura (Satış / Hakediş)</option>
                        <option value="iade">↩️ İade Faturası</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Alıcı Firma / Kişi *</label>
                      <input type="text" list="muhasebe-fatura-cari" placeholder="Firma veya kişi adı" value={fForm.firmaAd} onChange={(e) => setFForm({ ...fForm, firmaAd: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} required />
                      <datalist id="muhasebe-fatura-cari">
                        {taseronlar.map((t) => <option key={t.id} value={t.firma || t.ad} />)}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Vergi No / T.C. (Opsiyonel)</label>
                      <input type="text" placeholder="VKN veya T.C." value={fForm.vergiNo} onChange={(e) => setFForm({ ...fForm, vergiNo: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye</label>
                      <select value={fForm.santiyeId} onChange={(e) => setFForm({ ...fForm, santiyeId: e.target.value })} style={{ width: '100%' }}>
                        <option value="">Genel</option>
                        {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tutar (₺)</label>
                      <input type="number" step="0.01" placeholder="0,00" value={fForm.tutar} onChange={(e) => setFForm({ ...fForm, tutar: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>KDV</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={fForm.kdvOrani} onChange={(e) => setFForm({ ...fForm, kdvOrani: e.target.value })} style={{ flex: 1 }}>
                          <option value="20">%20</option>
                          <option value="10">%10</option>
                          <option value="1">%1</option>
                          <option value="0">%0</option>
                        </select>
                        <select value={fForm.kdvDurum} onChange={(e) => setFForm({ ...fForm, kdvDurum: e.target.value })} style={{ flex: 1 }}>
                          <option value="haric">+ KDV</option>
                          <option value="dahil">KDV Dahil</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                      <input type="date" value={fForm.tarih} onChange={(e) => setFForm({ ...fForm, tarih: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Fatura Kalemleri / Muhasebeye Not</label>
                    <textarea rows={2} placeholder="Faturaya yazılacak açıklama, kalemler, iade nedeni vb." value={fForm.aciklama} onChange={(e) => setFForm({ ...fForm, aciklama: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ padding: '8px 13px', borderRadius: 9, border: '1px dashed #1D4ED8', background: '#EFF6FF', color: '#1D4ED8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      {belgeYukleniyor ? '⏳ Drive\'a yükleniyor...' : '📎 Ek Belge / Fotoğraf Ekle (Drive)'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const yuklenen = await driveYukleCoklu(
                            e.target.files,
                            `Muhasebe/FaturaIslemleri/${fForm.santiyeId ? santiyeAdiBul(fForm.santiyeId) : 'Genel'}`,
                            fForm.firmaAd.trim() || 'Fatura'
                          )
                          if (yuklenen.length > 0) {
                            setFForm((p) => ({ ...p, belgeler: [...(p.belgeler || []), ...yuklenen] }))
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {(fForm.belgeler || []).length > 0 && (
                      <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>
                        ✅ {fForm.belgeler.length} belge eklendi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={() => { setFaturaFormAcik(false); faturaFormSifirla() }} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                    <button type="submit" disabled={belgeYukleniyor} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#1D4ED8', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                      {duzenlenenFaturaId ? 'Güncelle' : 'Muhasebeye Gönder'}
                    </button>
                  </div>
                </form>
              )}

              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Firma, vergi no, şantiye veya açıklama ara..."
                  value={faturaArama}
                  onChange={(e) => setFaturaArama(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtreliFaturalar.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 36, background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    Bu sekmede fatura kaydı bulunmuyor.
                  </div>
                ) : filtreliFaturalar.map((f) => (
                  <div key={f.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `4px solid ${f.durum === 'tamamlandi' ? '#059669' : f.tip === 'iade' ? '#D97706' : '#1D4ED8'}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 7,
                          background: f.tip === 'iade' ? '#FEF3C7' : '#EFF6FF',
                          color: f.tip === 'iade' ? '#B45309' : '#1D4ED8',
                        }}>
                          {f.tip === 'iade' ? '↩️ İADE FATURASI' : '📤 KESİLECEK FATURA'}
                        </span>
                        <strong style={{ fontSize: 15, color: '#0F172A' }}>{f.firmaAd}</strong>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: '#E6F9F0', color: '#0F6E56' }}>
                          🏗️ {f.santiyeAd || 'Genel'}
                        </span>
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                        {paraFormatla(f.tutar)} ₺ <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>({f.kdvDurum === 'dahil' ? `KDV %${f.kdvOrani} Dahil` : `+ %${f.kdvOrani} KDV`})</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#64748B' }}>
                      <span>📅 Tarih: <strong>{tarihTR(f.tarih)}</strong></span>
                      {f.vergiNo && <span>🏛️ VKN/TC: <strong>{f.vergiNo}</strong></span>}
                      <span>✍️ Talep Eden: {f.ekleyen}</span>
                      {f.durum === 'tamamlandi' && f.tamamlayan && (
                        <span style={{ color: '#047857', fontWeight: 700 }}>
                          ✅ Tamamlayan: {f.tamamlayan} ({tarihTR(f.tamamlanmaTarihi)})
                        </span>
                      )}
                    </div>

                    {f.aciklama && (
                      <div style={{ fontSize: 12.5, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '7px 10px', borderRadius: 8 }}>
                        📝 {f.aciklama}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {f.durum !== 'tamamlandi' ? (
                          <button
                            type="button"
                            onClick={() => faturaDurumDegistir(f.id, 'tamamlandi')}
                            style={{ padding: '6px 13px', borderRadius: 9, border: 'none', background: '#059669', color: '#FFFFFF', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          >
                            ✅ Tamamlanan İşlemlere Gönder
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => faturaDurumDegistir(f.id, 'bekliyor')}
                            style={{ padding: '5px 11px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                          >
                            ↩️ Bekleyene Geri Al
                          </button>
                        )}

                        {(f.belgeler || []).map((b, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setOnizlemeUrl(b.url)}
                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BAE6FD', background: '#E0F2FE', color: '#0369A1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                          >
                            📎 Belge {idx + 1}
                          </button>
                        ))}

                        <label style={{ padding: '4px 10px', borderRadius: 8, border: '1px dashed #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                          + Belge Ekle
                          <input type="file" accept="image/*,.pdf" multiple style={{ display: 'none' }} onChange={(e) => { faturayaSonradanBelgeEkle(f, e.target.files); e.target.value = '' }} />
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setDuzenlenenFaturaId(f.id)
                            setFForm({
                              tip: f.tip || 'kesilecek',
                              firmaAd: f.firmaAd || '',
                              vergiNo: f.vergiNo || '',
                              santiyeId: f.santiyeId || '',
                              tutar: String(f.tutar || ''),
                              kdvOrani: f.kdvOrani || '20',
                              kdvDurum: f.kdvDurum || 'haric',
                              tarih: f.tarih || bugun(),
                              aciklama: f.aciklama || '',
                              belgeler: f.belgeler || [],
                            })
                            setFaturaFormAcik(true)
                          }}
                          style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                        <button type="button" onClick={() => faturaSil(f)} style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#E11D48', fontSize: 12, cursor: 'pointer' }} title="Sil">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SEKME 3: FATURA / İRSALİYELER (SAHADAN GELEN BELGELER)    */}
          {/* ========================================================= */}
          {aktifSekme === 'irsaliye' && (
            <div>
              {/* ZORUNLU MUHASEBECİ BİLGİLENDİRME NOTU */}
              <div style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '1.5px solid #F59E0B',
                borderRadius: 14,
                padding: '13px 16px',
                marginBottom: 14,
                color: '#78350F',
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚠️</span>
                  <span>Muhasebe Bilgilendirme Notu</span>
                </div>
                Bu sayfa, sahaya gelen ürünlerin <strong>kim tarafından teslim alındığını</strong> ve <strong>hangi şantiyeye geldiğini</strong> daha kolay anlayabilmek amacıyla oluşturulmuştur. Eksiksiz ve resmi verileri görmek için <strong>e-Fatura sağlayıcımıza</strong> giriş yapılması gerekmektedir. Elimize ulaşan buradaki belgelerin e-Fatura sağlayıcısı üzerinden de mutlaka kontrol edilmesi rica olunur.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'hepsi', ad: `Tümü (${birlesikGelenBelgeler.length})` },
                    { id: 'bekliyor', ad: '⏳ e-Fatura Kontrol Bekliyor' },
                    { id: 'kontrol_edildi', ad: '✅ e-Faturadan Kontrol Edildi' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setBelgeFiltreDurum(f.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: belgeFiltreDurum === f.id ? '1.5px solid #B45309' : '1px solid #CBD5E1',
                        background: belgeFiltreDurum === f.id ? '#B45309' : '#FFFFFF',
                        color: belgeFiltreDurum === f.id ? '#FFFFFF' : '#334155',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {f.ad}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setBelgeFormAcik(!belgeFormAcik)}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#B45309',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {belgeFormAcik ? '✕ Formu Kapat' : '+ Fatura / İrsaliye Ekle'}
                </button>
              </div>

              {belgeFormAcik && (
                <form onSubmit={manuelBelgeKaydet} style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 14, padding: 16, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    📄 Sahadan Gelen Fatura / İrsaliye Kaydı
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Belge Türü</label>
                      <select value={bForm.belgeTuru} onChange={(e) => setBForm({ ...bForm, belgeTuru: e.target.value })} style={{ width: '100%' }}>
                        <option value="İrsaliye">📦 İrsaliye</option>
                        <option value="Fatura">🧾 Fatura</option>
                        <option value="Beton İrsaliyesi">🧪 Beton İrsaliyesi</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye</label>
                      <select value={bForm.santiyeId} onChange={(e) => setBForm({ ...bForm, santiyeId: e.target.value })} style={{ width: '100%' }}>
                        <option value="">Genel</option>
                        {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tedarikçi / Firma</label>
                      <input type="text" list="muhasebe-belge-tedarikci" placeholder="Örn: Gökkuşağı Yapı" value={bForm.tedarikci} onChange={(e) => setBForm({ ...bForm, tedarikci: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                      <datalist id="muhasebe-belge-tedarikci">
                        {taseronlar.map((t) => <option key={t.id} value={t.firma || t.ad} />)}
                      </datalist>
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Gelen Ürün / Malzeme</label>
                      <input type="text" placeholder="Örn: 40 m³ C30 Beton, 2 palet yapıştırıcı..." value={bForm.malzeme} onChange={(e) => setBForm({ ...bForm, malzeme: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Teslim Alan Kişi</label>
                      <input type="text" placeholder="Kim teslim aldı?" value={bForm.teslimAlan} onChange={(e) => setBForm({ ...bForm, teslimAlan: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>

                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarih</label>
                      <input type="date" value={bForm.tarih} onChange={(e) => setBForm({ ...bForm, tarih: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Not (Opsiyonel)</label>
                    <input type="text" placeholder="Varsa eksik/hasar veya açıklama notu..." value={bForm.notMetni} onChange={(e) => setBForm({ ...bForm, notMetni: e.target.value })} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <label style={{ padding: '8px 13px', borderRadius: 9, border: '1px dashed #B45309', background: '#FFFBEB', color: '#B45309', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                      {belgeYukleniyor ? '⏳ Drive\'a yükleniyor...' : '📷 Fatura / İrsaliye Fotoğrafı Ekle (Drive)'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const yuklenen = await driveYukleCoklu(
                            e.target.files,
                            `Muhasebe/GelenBelgeler/${bForm.santiyeId ? santiyeAdiBul(bForm.santiyeId) : 'Genel'}`,
                            bForm.tedarikci.trim() || 'Irsaliye'
                          )
                          if (yuklenen.length > 0) {
                            setBForm((p) => ({ ...p, belgeler: [...(p.belgeler || []), ...yuklenen] }))
                          }
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {(bForm.belgeler || []).length > 0 && (
                      <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>
                        ✅ {bForm.belgeler.length} belge eklendi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" onClick={() => setBelgeFormAcik(false)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                      Vazgeç
                    </button>
                    <button type="submit" disabled={belgeYukleniyor} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#B45309', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}>
                      Kaydet
                    </button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Tedarikçi, ürün, teslim alan veya şantiye ara..."
                  value={belgeArama}
                  onChange={(e) => setBelgeArama(e.target.value)}
                  style={{ flex: 2, minWidth: 200 }}
                />
                <select value={belgeFiltreSantiye} onChange={(e) => setBelgeFiltreSantiye(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                  <option value="hepsi">🏗️ Tüm Şantiyeler</option>
                  {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtreliGelenBelgeler.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 36, background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                    Henüz fatura veya irsaliye kaydı bulunmuyor. Sevkiyat Planlama &amp; Kabul sayfasından teslim alınan ürünler de otomatik olarak burada görünür.
                  </div>
                ) : filtreliGelenBelgeler.map((b) => {
                  const kontrol = kontrolHaritasi[b.id]?.kontrolEdildi
                  return (
                    <div key={b.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `4px solid ${kontrol ? '#059669' : '#D97706'}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 7, background: '#FEF3C7', color: '#92400E' }}>
                            📄 {b.belgeTuru}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 800, padding: '2px 8px', borderRadius: 7, background: '#E6F9F0', color: '#0F6E56' }}>
                            🏗️ {b.santiyeAd || 'Genel'}
                          </span>
                          {b.kaynak === 'sevkiyat' && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                              🚚 Sevkiyat Kabulden
                            </span>
                          )}
                          <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                            📅 {tarihTR(b.tarih)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => belgeKontrolToggle(b.id)}
                          style={{
                            padding: '5px 11px',
                            borderRadius: 9,
                            border: kontrol ? '1.5px solid #047857' : '1.5px solid #F59E0B',
                            background: kontrol ? '#059669' : '#FFFBEB',
                            color: kontrol ? '#FFFFFF' : '#B45309',
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {kontrol ? '✅ e-Fatura Kontrol Edildi' : '⏳ e-Fatura Kontrol Bekliyor'}
                        </button>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                          📦 {b.malzeme}
                        </div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#334155' }}>
                          <span>🏢 Tedarikçi: <strong>{b.tedarikci}</strong></span>
                          <span>👤 Teslim Alan: <strong>{b.teslimAlan}</strong></span>
                        </div>
                      </div>

                      {b.notMetni && (
                        <div style={{ fontSize: 12.5, color: '#475569' }}>📝 {b.notMetni}</div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(b.belgeler || []).length > 0 ? (
                            b.belgeler.map((doc, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setOnizlemeUrl(doc.url)}
                                style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BAE6FD', background: '#E0F2FE', color: '#0369A1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                              >
                                📎 {doc.ad || `Belge ${idx + 1}`}
                              </button>
                            ))
                          ) : (
                            <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Görsel eklenmemiş</span>
                          )}
                        </div>

                        {b.kaynak === 'manuel' && (
                          <button type="button" onClick={() => manuelBelgeSil(b)} style={{ padding: '4px 9px', borderRadius: 8, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#E11D48', fontSize: 12, cursor: 'pointer' }} title="Sil">
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* BELGE ÖNİZLEME MODALI */}
      {onizlemeUrl && (
        <div
          onClick={() => setOnizlemeUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.78)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh', background: '#FFFFFF', borderRadius: 14, padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isPdfUrl(onizlemeUrl) ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontWeight: 700 }}>PDF Belgesi</p>
                <a href={getGoogleDriveViewUrl(onizlemeUrl)} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: '#0F766E', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
                  Google Drive&apos;da Aç
                </a>
              </div>
            ) : (
              <img
                src={getGoogleDriveInlineImageUrl(onizlemeUrl)}
                alt="Belge Önizleme"
                style={{ maxWidth: '88vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <a href={getGoogleDriveViewUrl(onizlemeUrl)} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', borderRadius: 8, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>
                ☁️ Drive&apos;da Aç
              </a>
              <button type="button" onClick={() => setOnizlemeUrl(null)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0F172A', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
