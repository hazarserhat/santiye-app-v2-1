import { useState, useEffect, useMemo } from 'react'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { uploadToGoogleDrive, moveToSilinenler, getGoogleDriveInlineImageUrl } from '../lib/googleDrive'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from '../lib/operasyonKayit'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihFormatlaTR = (tarihStr) => {
  if (!tarihStr) return ''
  const parts = tarihStr.split('-')
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  }
  return tarihStr
}

const tarihSaatFormatlaTR = (isoStr, yedekTarih) => {
  if (isoStr) {
    const d = new Date(isoStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
  if (yedekTarih) {
    const parts = yedekTarih.split('-')
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : yedekTarih
  }
  return '—'
}

const AY_ISIMLERI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

const SANTIYE_RENKLERI = [
  '#1D9596', // Kurumsal Teal
  '#0284c7', // Mavi
  '#e11d48', // Kırmızı / Gül
  '#16a34a', // Yeşil
  '#d97706', // Turuncu
  '#7c3aed', // Mor
  '#db2777', // Pembe
  '#2563eb', // Koyu Mavi
  '#ca8a04', // Altın Sarısı
  '#4f46e5', // İndigo
]

export const LOCAL_STORAGE_SEVKIYAT_PLAN = 'santiye_sevkiyat_planlari_v1'
export const LOCAL_STORAGE_SEVKIYAT = 'santiye_sevkiyat_kayitlari_v1'

export default function SevkiyatPlanlama() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()

  const [planListesi, setPlanListesi] = useState([])
  const [seciliTarih, setSeciliTarih] = useState('')
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [durumFiltresi, setDurumFiltresi] = useState('tumu') // 'tumu' | 'bekliyor' | 'teslim_alindi'

  // Takvim Matrisi & Şantiye Seçim Kartı State'leri (Default kapalı)
  const [matrisAcik, setMatrisAcik] = useState(false)
  const [santiyeKartAcik, setSantiyeKartAcik] = useState(false)
  const [matrisYil, setMatrisYil] = useState(() => new Date().getFullYear())
  const [matrisAy, setMatrisAy] = useState(() => new Date().getMonth())

  // Kartların Açılır/Kapanır Detay State'i
  const [acikDetayKartlari, setAcikDetayKartlari] = useState({})
  const [buyukFotoUrl, setBuyukFotoUrl] = useState(null)

  // Yeni Sevkiyat Planla / Doğrudan Kabul / Düzenle Modalı State'leri
  const [yeniPlanModalAcik, setYeniPlanModalAcik] = useState(false)
  const [duzenlenenPlanId, setDuzenlenenPlanId] = useState(null)
  const [modalIslemTipi, setModalIslemTipi] = useState('planla') // 'planla' | 'dogrudan_kabul'
  const [formSantiyeId, setFormSantiyeId] = useState('')
  const [formMalzeme, setFormMalzeme] = useState('')
  const [formTedarikci, setFormTedarikci] = useState('')
  const [formTarih, setFormTarih] = useState(bugun())
  const [formSahaNotu, setFormSahaNotu] = useState('')
  const [formKabulNotu, setFormKabulNotu] = useState('')
  const [formFotograflar, setFormFotograflar] = useState([])
  const [formEksikVar, setFormEksikVar] = useState(false)
  const [formEksikDetay, setFormEksikDetay] = useState('')

  // Planlanan Sevkiyatı Hızlı Teslim Alma Modalı State'leri
  const [kabulModalAcik, setKabulModalAcik] = useState(false)
  const [kabulHedefPlan, setKabulHedefPlan] = useState(null)
  const [kabulFotograflar, setKabulFotograflar] = useState([])
  const [kabulEksikVar, setKabulEksikVar] = useState(false)
  const [kabulEksikDetay, setKabulEksikDetay] = useState('')
  const [kabulNotu, setKabulNotu] = useState('')

  useEffect(() => {
    if (aktifSantiye?.id) {
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  // Supabase + LocalStorage'dan planları ve doğrudan kabulleri birleştirerek çek
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      try {
        let planlar = await operasyonVerisiYukle(LOCAL_STORAGE_SEVKIYAT_PLAN, [])
        const kayitliKabulStr = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT)

        if (kayitliKabulStr) {
          const kabuller = JSON.parse(kayitliKabulStr)
          const mevcutPlanIdleri = new Set(planlar.map(p => p.id))
          const bagimsizKabuller = kabuller
            .filter(k => !k.bagliPlanId || !mevcutPlanIdleri.has(k.bagliPlanId))
            .filter(k => !mevcutPlanIdleri.has(k.id))
            .map(k => ({
              id: k.id || ('sevkiyat-' + Date.now() + Math.random()),
              tarih: k.tarih || bugun(),
              santiyeId: k.santiyeId || aktifSantiye?.id || (santiyeler[0]?.id || 'santiye-1'),
              santiyeAdi: k.santiyeAdi || aktifSantiye?.ad || 'Şantiye',
              malzeme: k.miktar ? `${k.malzemeAdi} (${k.miktar} ${k.birim || ''})`.trim() : (k.malzemeAdi || 'Malzeme'),
              tedarikci: k.tedarikci || 'Belirtilmedi',
              sahaNotu: '',
              durum: 'teslim_alindi',
              dogrudanKabul: true,
              planlayan: k.teslimAlan || 'Saha Kabul',
              olusturulduAt: k.olusturulduAt || new Date().toISOString(),
              teslimAlan: k.teslimAlan || 'Kullanıcı',
              teslimTarihiIso: k.olusturulduAt || new Date().toISOString(),
              teslimTarihi: `${k.tarih || bugun()} ${k.saat || ''}`.trim(),
              teslimNotu: k.notlar || '',
              teslimEksikVar: k.durum === 'eksik',
              teslimEksikDetay: k.eksikDetay || '',
              fotograflar: k.fotograflar || (k.fotoUrl ? [k.fotoUrl] : [])
            }))

          if (bagimsizKabuller.length > 0) {
            planlar = [...bagimsizKabuller, ...planlar]
            await operasyonVerisiKaydet(LOCAL_STORAGE_SEVKIYAT_PLAN, planlar)
          }
        }

        if (!iptal) {
          setPlanListesi(planlar)
        }
      } catch (err) {
        console.error('Sevkiyat verisi yükleme hatası:', err)
      }
    }
    yukle()
    return () => { iptal = true }
  }, [aktifSantiye, santiyeler])

  const planlariKaydet = (yeniListe) => {
    setPlanListesi(yeniListe)
    operasyonVerisiKaydet(LOCAL_STORAGE_SEVKIYAT_PLAN, yeniListe)
  }

  // Şantiye Renk Haritası (Her şantiyeye farklı bir renk)
  const santiyeRenkBilgisi = useMemo(() => {
    const renkHaritasi = {}
    const santiyeListesi = []

    santiyeler.forEach((s, idx) => {
      const renk = SANTIYE_RENKLERI[idx % SANTIYE_RENKLERI.length]
      renkHaritasi[s.id] = renk
      santiyeListesi.push({ id: s.id, ad: s.ad, renk })
    })

    planListesi.forEach((p) => {
      const key = p.santiyeId || p.santiyeAdi || 'varsayilan'
      if (!renkHaritasi[key]) {
        const renk = SANTIYE_RENKLERI[santiyeListesi.length % SANTIYE_RENKLERI.length]
        renkHaritasi[key] = renk
        santiyeListesi.push({ id: key, ad: p.santiyeAdi || 'Şantiye', renk })
      }
    })

    return { renkHaritasi, santiyeListesi }
  }, [santiyeler, planListesi])

  // Takvim Matrisi Gün Hesaplamaları
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

      const gununPlanlari = planListesi.filter(p => {
        if (p.tarih !== tarihKey) return false
        if (seciliSantiyeId && p.santiyeId && p.santiyeId !== seciliSantiyeId) return false
        return true
      })

      const gununSantiyeleriMap = new Map()
      gununPlanlari.forEach(p => {
        const sKey = p.santiyeId || p.santiyeAdi || 'varsayilan'
        if (!gununSantiyeleriMap.has(sKey)) {
          gununSantiyeleriMap.set(sKey, {
            id: sKey,
            ad: p.santiyeAdi || 'Şantiye',
            renk: santiyeRenkBilgisi.renkHaritasi[sKey] || '#1D9596'
          })
        }
      })

      gunler.push({
        bosluk: false,
        gunNo: g,
        tarihKey,
        planSayisi: gununPlanlari.length,
        santiyeler: Array.from(gununSantiyeleriMap.values())
      })
    }

    return gunler
  }, [matrisYil, matrisAy, planListesi, seciliSantiyeId, santiyeRenkBilgisi])

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

  const toggleDetayKart = (planId) => {
    setAcikDetayKartlari(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }))
  }

  const [fotoYukleniyorId, setFotoYukleniyorId] = useState(null)
  const [modalFotoYukleniyor, setModalFotoYukleniyor] = useState(false)

  // Çoklu dosyayı Google Drive'a yükleme yardımcısı
  const dosyalariDriveaYukle = async (files, santiyeAdi = 'Genel', malzemeBilgi = 'Malzeme', tarihBilgi = null) => {
    const dosyaListesi = Array.from(files || [])
    if (dosyaListesi.length === 0) return []

    const folderName = `Sevkiyatlar/${santiyeAdi || 'Genel'}`
    const kisaMalzeme = (malzemeBilgi || 'Malzeme').substring(0, 25).trim()
    const adSoyad = `Sevkiyat-${kisaMalzeme}`
    const yuklenenUrls = []

    for (const file of dosyaListesi) {
      const driveSonuc = await uploadToGoogleDrive({
        file,
        folderName,
        adSoyad,
        date: tarihBilgi || bugun()
      })
      if (driveSonuc?.url) {
        yuklenenUrls.push(driveSonuc.url)
      }
    }

    return yuklenenUrls
  }

  // Kart içine doğrudan toplu görsel yükle (Google Drive Entegrasyonlu)
  const handleKartGorselYukle = async (planId, e) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const hedefPlan = planListesi.find(p => p.id === planId)
    const santiyeAdi = hedefPlan?.santiyeAdi || aktifSantiye?.ad || 'Genel'
    setFotoYukleniyorId(planId)

    try {
      const yeniUrls = await dosyalariDriveaYukle(
        files,
        santiyeAdi,
        hedefPlan?.malzeme || 'Sevkiyat',
        hedefPlan?.tarih || bugun()
      )
      if (yeniUrls.length > 0) {
        const guncel = planListesi.map(p => {
          if (p.id === planId) {
            const mevcutlar = p.fotograflar || (p.irsaliyeFoto ? [p.irsaliyeFoto] : [])
            return {
              ...p,
              fotograflar: [...mevcutlar, ...yeniUrls]
            }
          }
          return p
        })
        planlariKaydet(guncel)
      }
    } catch (err) {
      alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
    } finally {
      setFotoYukleniyorId(null)
      if (e.target) e.target.value = ''
    }
  }

  // Modal içinde görsel seçildiğinde doğrudan Google Drive'a yükle
  const handleModalGorselSec = async (e, hedefTip = 'plan') => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setModalFotoYukleniyor(true)
    try {
      if (hedefTip === 'kabul' && kabulHedefPlan) {
        const yeniUrls = await dosyalariDriveaYukle(
          files,
          kabulHedefPlan.santiyeAdi || aktifSantiye?.ad || 'Genel',
          kabulHedefPlan.malzeme || 'Kabul',
          bugun()
        )
        setKabulFotograflar(prev => [...prev, ...yeniUrls])
      } else {
        const seciliS = santiyeler.find(s => s.id === formSantiyeId) || aktifSantiye
        const yeniUrls = await dosyalariDriveaYukle(
          files,
          seciliS?.ad || 'Genel',
          formMalzeme || 'Sevkiyat',
          formTarih || bugun()
        )
        setFormFotograflar(prev => [...prev, ...yeniUrls])
      }
    } catch (err) {
      alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
    } finally {
      setModalFotoYukleniyor(false)
      if (e.target) e.target.value = ''
    }
  }

  // Kart içinden tekil görsel sil (Google Drive Silinenler Klasörüne Taşır)
  const handleKartGorselSil = async (planId, fotoIndex) => {
    if (!window.confirm('Bu görseli silmek istediğinize emin misiniz?')) return

    const hedefPlan = planListesi.find(p => p.id === planId)
    const mevcutlar = hedefPlan?.fotograflar || (hedefPlan?.irsaliyeFoto ? [hedefPlan.irsaliyeFoto] : [])
    const silinecekUrl = mevcutlar[fotoIndex]
    const santiyeAdi = hedefPlan?.santiyeAdi || aktifSantiye?.ad || 'Genel'

    const guncel = planListesi.map(p => {
      if (p.id === planId) {
        const m = p.fotograflar || (p.irsaliyeFoto ? [p.irsaliyeFoto] : [])
        return {
          ...p,
          irsaliyeFoto: '',
          fotograflar: m.filter((_, i) => i !== fotoIndex)
        }
      }
      return p
    })
    planlariKaydet(guncel)

    if (silinecekUrl) {
      try {
        await moveToSilinenler(silinecekUrl, `Sevkiyatlar/${santiyeAdi}`)
      } catch (err) {
        console.warn('Silinenlere taşıma hatası:', err)
      }
    }
  }

  // Yeni Kayıt Modalı Aç
  const modalAc = (tip) => {
    setDuzenlenenPlanId(null)
    if (seciliSantiyeId) {
      setFormSantiyeId(seciliSantiyeId)
    } else if (aktifSantiye?.id) {
      setFormSantiyeId(aktifSantiye.id)
    }
    setFormMalzeme('')
    setFormTedarikci('')
    setFormTarih(seciliTarih || bugun())
    setFormSahaNotu('')
    setFormKabulNotu('')
    setFormFotograflar([])
    setFormEksikVar(false)
    setFormEksikDetay('')
    setModalIslemTipi(tip)
    setYeniPlanModalAcik(true)
  }

  // Mevcut Kaydı Düzenleme Modalı Aç
  const handlePlanDuzenleAc = (plan) => {
    setDuzenlenenPlanId(plan.id)
    setModalIslemTipi(plan.durum === 'teslim_alindi' ? 'dogrudan_kabul' : 'planla')
    setFormSantiyeId(plan.santiyeId || aktifSantiye?.id || (santiyeler[0]?.id || ''))
    setFormMalzeme(plan.malzeme || '')
    setFormTedarikci(plan.tedarikci === 'Belirtilmedi' ? '' : (plan.tedarikci || ''))
    setFormTarih(plan.tarih || bugun())
    setFormSahaNotu(plan.sahaNotu || '')
    setFormKabulNotu(plan.teslimNotu || '')
    setFormFotograflar(plan.fotograflar || (plan.irsaliyeFoto ? [plan.irsaliyeFoto] : []))
    setFormEksikVar(!!plan.teslimEksikVar)
    setFormEksikDetay(plan.teslimEksikDetay || '')
    setYeniPlanModalAcik(true)
  }

  // Yeni Plan / Doğrudan Kabul / Düzenleme Kaydet
  const handlePlanVeyaKabulKaydet = (e) => {
    e.preventDefault()
    if (!formMalzeme.trim()) return

    const hedefSantiyeId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id || (santiyeler[0]?.id || '')
    const seciliS = santiyeler.find(s => s.id === hedefSantiyeId) || aktifSantiye
    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const simdiIso = suAn.toISOString()
    const kabulMu = modalIslemTipi === 'dogrudan_kabul'

    if (duzenlenenPlanId) {
      // DÜZENLEME MODU
      const guncelListe = planListesi.map(p => {
        if (p.id === duzenlenenPlanId) {
          return {
            ...p,
            tarih: formTarih || p.tarih || bugun(),
            santiyeId: hedefSantiyeId,
            santiyeAdi: seciliS?.ad || p.santiyeAdi || 'Şantiye',
            malzeme: formMalzeme.trim(),
            tedarikci: formTedarikci.trim() || 'Belirtilmedi',
            sahaNotu: formSahaNotu.trim(),
            fotograflar: formFotograflar,
            irsaliyeFoto: '',
            durum: kabulMu ? 'teslim_alindi' : 'bekliyor',
            ...(kabulMu ? {
              teslimAlan: p.teslimAlan || profile?.ad_soyad || 'Kullanıcı',
              teslimTarihiIso: p.teslimTarihiIso || simdiIso,
              teslimTarihi: p.teslimTarihi || `${formTarih || bugun()} ${saatFormat}`,
              teslimNotu: formKabulNotu.trim(),
              teslimEksikVar: formEksikVar,
              teslimEksikDetay: formEksikVar ? formEksikDetay.trim() : ''
            } : {
              teslimEksikVar: false,
              teslimEksikDetay: ''
            })
          }
        }
        return p
      })
      planlariKaydet(guncelListe)
    } else {
      // YENİ KAYIT MODU
      const yeniKayit = {
        id: (kabulMu ? 'kabul-' : 'plan-') + Date.now(),
        tarih: formTarih || seciliTarih || bugun(),
        santiyeId: hedefSantiyeId,
        santiyeAdi: seciliS?.ad || 'Şantiye',
        malzeme: formMalzeme.trim(),
        tedarikci: formTedarikci.trim() || 'Belirtilmedi',
        sahaNotu: formSahaNotu.trim(),
        fotograflar: formFotograflar,
        durum: kabulMu ? 'teslim_alindi' : 'bekliyor',
        dogrudanKabul: kabulMu,
        planlayanId: profile?.id || null,
        planlayan: profile?.ad_soyad || 'Kullanıcı',
        olusturulduAt: simdiIso,
        ...(kabulMu ? {
          teslimAlan: profile?.ad_soyad || 'Kullanıcı',
          teslimTarihiIso: simdiIso,
          teslimTarihi: `${formTarih || bugun()} ${saatFormat}`,
          teslimNotu: formKabulNotu.trim(),
          teslimEksikVar: formEksikVar,
          teslimEksikDetay: formEksikVar ? formEksikDetay.trim() : ''
        } : {})
      }
      planlariKaydet([yeniKayit, ...planListesi])
    }

    setDuzenlenenPlanId(null)
    setFormMalzeme('')
    setFormTedarikci('')
    setFormSahaNotu('')
    setFormKabulNotu('')
    setFormFotograflar([])
    setFormEksikVar(false)
    setFormEksikDetay('')
    setYeniPlanModalAcik(false)
  }

  // Kaydı Sil (Varsa Görselleri Google Drive Silinenler Klasörüne Taşır)
  const handlePlanSil = async (id) => {
    if (!window.confirm('Bu sevkiyat kaydını silmek istediğinize emin misiniz?')) return

    const silinecek = planListesi.find(p => p.id === id)
    planlariKaydet(planListesi.filter(p => p.id !== id))

    const fotolar = silinecek?.fotograflar || (silinecek?.irsaliyeFoto ? [silinecek.irsaliyeFoto] : [])
    if (fotolar.length > 0) {
      const santiyeAdi = silinecek?.santiyeAdi || aktifSantiye?.ad || 'Genel'
      for (const url of fotolar) {
        try {
          await moveToSilinenler(url, `Sevkiyatlar/${santiyeAdi}`)
        } catch (err) {
          console.warn('Silinenlere taşıma hatası:', err)
        }
      }
    }
  }

  // Hızlı Kabul Modalı Aç
  const handleKabulModaliAc = (plan) => {
    setKabulHedefPlan(plan)
    setKabulEksikVar(!!plan.teslimEksikVar)
    setKabulEksikDetay(plan.teslimEksikDetay || '')
    setKabulFotograflar([])
    setKabulNotu(plan.teslimNotu || '')
    setKabulModalAcik(true)
  }

  // Planlanan Sevkiyatın Kabulünü Tamamla
  const handleKabulTamamla = (e) => {
    e.preventDefault()
    if (!kabulHedefPlan) return

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const simdiIso = suAn.toISOString()

    const guncelPlanlar = planListesi.map(p => {
      if (p.id === kabulHedefPlan.id) {
        const mevcutFotolar = p.fotograflar || (p.irsaliyeFoto ? [p.irsaliyeFoto] : [])
        return {
          ...p,
          durum: 'teslim_alindi',
          teslimAlan: profile?.ad_soyad || 'Kullanıcı',
          teslimTarihiIso: simdiIso,
          teslimTarihi: `${bugun()} ${saatFormat}`,
          teslimNotu: kabulNotu.trim(),
          teslimEksikVar: kabulEksikVar,
          teslimEksikDetay: kabulEksikVar ? kabulEksikDetay.trim() : '',
          fotograflar: [...mevcutFotolar, ...kabulFotograflar]
        }
      }
      return p
    })

    planlariKaydet(guncelPlanlar)
    setAcikDetayKartlari(prev => ({ ...prev, [kabulHedefPlan.id]: true }))
    setKabulModalAcik(false)
    setKabulHedefPlan(null)
  }

  // Durumu Geri Aç (Bekliyor Yap)
  const handlePlanGeriAc = (planId) => {
    const guncel = planListesi.map(p => {
      if (p.id === planId) {
        return { ...p, durum: 'bekliyor' }
      }
      return p
    })
    planlariKaydet(guncel)
  }

  // Şantiye ve Tarih Bazlı Temel Liste
  const santiyeVeTarihFiltreli = useMemo(() => {
    return planListesi.filter(p => {
      if (seciliSantiyeId && p.santiyeId && p.santiyeId !== seciliSantiyeId) return false
      if (seciliTarih && p.tarih !== seciliTarih) return false
      return true
    })
  }, [planListesi, seciliSantiyeId, seciliTarih])

  const bekleyenSayisi = useMemo(
    () => santiyeVeTarihFiltreli.filter(p => p.durum !== 'teslim_alindi').length,
    [santiyeVeTarihFiltreli]
  )
  const teslimAlinanSayisi = useMemo(
    () => santiyeVeTarihFiltreli.filter(p => p.durum === 'teslim_alindi').length,
    [santiyeVeTarihFiltreli]
  )

  // Durum Sekmesine Göre Filtrelenmiş Liste
  const filtrelenmisPlanlar = useMemo(() => {
    if (durumFiltresi === 'bekliyor') {
      return santiyeVeTarihFiltreli.filter(p => p.durum !== 'teslim_alindi')
    }
    if (durumFiltresi === 'teslim_alindi') {
      return santiyeVeTarihFiltreli.filter(p => p.durum === 'teslim_alindi')
    }
    return santiyeVeTarihFiltreli
  }, [santiyeVeTarihFiltreli, durumFiltresi])

  return (
    <div className="sayfa beton-dokum-sayfasi">
      {/* 1. ÜST BAŞLIK */}
      <div className="makine-ust-baslik-alani" style={{ marginBottom: 10 }}>
        <div className="makine-baslik-satiri" style={{ marginBottom: 10 }}>
          <div className="makine-baslik-metin">
            <h1>🚚 Sevkiyat Planlama & Kabul</h1>
            <p className="makine-alt-bilgi">Planlanan sevkiyatlar ve sahaya gelen malzeme kabulleri</p>
          </div>
        </div>

        {/* TAM GENİŞLİK SİMETRİK AKSİYON BUTONLARI (Kenarlıkla hizalı, boşluksuz) */}
        <div className="sevkiyat-ust-aksiyon-ikili">
          <button
            type="button"
            className="tema-ana-aksiyon-btn"
            onClick={() => modalAc('planla')}
          >
            ➕ Sevkiyat Planla
          </button>
          <button
            type="button"
            className="tema-ana-aksiyon-btn"
            onClick={() => modalAc('dogrudan_kabul')}
          >
            ✓ Doğrudan Kabul
          </button>
        </div>
      </div>

      {/* 2. TAKVİM MATRİSİ VE ŞANTİYE SEÇİMİ YANYANA SİMETRİK KARTLAR */}
      <div className="beton-ust-ikili-bar">
        {/* KART 1: TAKVİM MATRİSİ BAŞLIK KARTI */}
        <div
          className={`simetrik-ust-kart ${matrisAcik ? 'aktif' : ''}`}
          onClick={() => {
            setMatrisAcik(prev => !prev)
            setSantiyeKartAcik(false)
          }}
        >
          <span className="simetrik-kart-ikon">📅</span>
          <div className="simetrik-kart-metin">
            <h3>Takvim Matrisi</h3>
            <p>
              {seciliTarih ? tarihFormatlaTR(seciliTarih) : 'Sevkiyat takvimi'}
            </p>
          </div>
          <div className="simetrik-kart-sag">
            {seciliTarih && (
              <button
                type="button"
                className="simetrik-temizle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setSeciliTarih('')
                }}
                title="Seçili günü temizle"
              >
                ✕
              </button>
            )}
            <span className="simetrik-ok-rozet">{matrisAcik ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* KART 2: ŞANTİYE SEÇİMİ BAŞLIK KARTI */}
        <div
          className={`simetrik-ust-kart ${santiyeKartAcik ? 'aktif' : ''}`}
          onClick={() => {
            setSantiyeKartAcik(prev => !prev)
            setMatrisAcik(false)
          }}
        >
          <span className="simetrik-kart-ikon">🏗️</span>
          <div className="simetrik-kart-metin">
            <h3>Şantiye Seçimi</h3>
            <p>
              {seciliSantiyeId ? (
                <>
                  <span
                    className="santiye-renk-noktasi"
                    style={{ backgroundColor: santiyeRenkBilgisi.renkHaritasi[seciliSantiyeId] || '#1D9596', marginRight: 5 }}
                  />
                  {santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Seçili Şantiye'}
                </>
              ) : (
                'Tüm Şantiyeler'
              )}
            </p>
          </div>
          <div className="simetrik-kart-sag">
            {seciliSantiyeId && (
              <button
                type="button"
                className="simetrik-temizle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setSeciliSantiyeId('')
                }}
                title="Şantiye filtresini temizle"
              >
                ✕
              </button>
            )}
            <span className="simetrik-ok-rozet">{santiyeKartAcik ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {/* AÇILIR PANEL 1: TAKVİM MATRİSİ GÖVDESİ */}
      {matrisAcik && (
        <div className="matris-kapsayici-kart animasyonlu-acilis">
          <div className="matris-govde">
            <div className="matris-ay-secici">
              <button type="button" className="matris-ay-ok" onClick={() => matrisAyDegistir(-1)}>‹ Önceki Ay</button>
              <span className="matris-secili-ay-metin">{AY_ISIMLERI[matrisAy]} {matrisYil}</span>
              <button type="button" className="matris-ay-ok" onClick={() => matrisAyDegistir(1)}>Sonraki Ay ›</button>
            </div>

            <div className="matris-haftanin-gunleri">
              <span>Pzt</span>
              <span>Sal</span>
              <span>Çar</span>
              <span>Per</span>
              <span>Cum</span>
              <span>Cmt</span>
              <span>Paz</span>
            </div>

            <div className="matris-izgara">
              {matrisGunleri.map((item) => {
                if (item.bosluk) {
                  return <div key={item.id} className="matris-hucre bosluk" />
                }

                const seciliMi = item.tarihKey === seciliTarih
                const bugunMu = item.tarihKey === bugun()
                const planVarMi = item.santiyeler.length > 0

                return (
                  <div
                    key={item.tarihKey}
                    className={`matris-hucre durum-yok ${planVarMi ? 'beton-dokum-gunu' : ''} ${seciliMi ? 'aktif-gun' : ''} ${bugunMu ? 'bugun-cerceve' : ''}`}
                    onClick={() => setSeciliTarih(prev => prev === item.tarihKey ? '' : item.tarihKey)}
                    title={
                      planVarMi
                        ? `${item.tarihKey}: ${item.santiyeler.map(s => s.ad).join(', ')} (${item.planSayisi} sevkiyat)`
                        : `${item.tarihKey}`
                    }
                  >
                    <span className="matris-gun-no">{item.gunNo}</span>
                    {planVarMi && (
                      <div className="matris-santiye-noktalari">
                        {item.santiyeler.map(s => (
                          <span
                            key={s.id}
                            className="santiye-renk-noktasi"
                            style={{ backgroundColor: s.renk }}
                            title={s.ad}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {santiyeRenkBilgisi.santiyeListesi.length > 0 && (
              <div className="matris-lejant">
                {santiyeRenkBilgisi.santiyeListesi.map(s => (
                  <div
                    key={s.id}
                    className={`lejant-oge santiye-lejant-oge ${seciliSantiyeId === s.id ? 'aktif-lejant' : ''}`}
                    onClick={() => setSeciliSantiyeId(prev => prev === s.id ? '' : s.id)}
                    title="Şantiyeye göre filtrelemek için tıklayın"
                  >
                    <span className="santiye-renk-noktasi buyuk" style={{ backgroundColor: s.renk }} />
                    <span>{s.ad}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AÇILIR PANEL 2: ŞANTİYE SEÇİMİ GÖVDESİ */}
      {santiyeKartAcik && (
        <div className="matris-kapsayici-kart animasyonlu-acilis">
          <div className="matris-govde">
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
                  <span className="santiye-renk-noktasi buyuk" style={{ background: 'linear-gradient(135deg, #1D9596, #16a34a)' }} />
                  <span>Tüm Şantiyeler</span>
                </span>
                <span className="santiye-dokum-sayac">{planListesi.length} Sevkiyat</span>
              </button>

              {santiyeler.map((s) => {
                const renk = santiyeRenkBilgisi.renkHaritasi[s.id] || '#1D9596'
                const santiyePlanSayisi = planListesi.filter(p => p.santiyeId === s.id).length
                const aktifMi = seciliSantiyeId === s.id

                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`santiye-secim-oge-btn ${aktifMi ? 'aktif' : ''}`}
                    onClick={() => {
                      setSeciliSantiyeId(prev => prev === s.id ? '' : s.id)
                      setSantiyeKartAcik(false)
                    }}
                  >
                    <span className="santiye-secim-sol">
                      <span className="santiye-renk-noktasi buyuk" style={{ backgroundColor: renk }} />
                      <span>{s.ad}</span>
                    </span>
                    <span className="santiye-dokum-sayac">{santiyePlanSayisi} Sevkiyat</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2.5. HIZLI DURUM SEKMELERİ (KENARLIKLA ARASINDA BOŞLUK OLMAYAN FLUSH SEGMENT BAR) */}
      <div className="tema-segment-bar uclu">
        <button
          type="button"
          className={`tema-segment-btn ${durumFiltresi === 'tumu' ? 'aktif' : ''}`}
          onClick={() => setDurumFiltresi('tumu')}
        >
          📋 Tümü ({santiyeVeTarihFiltreli.length})
        </button>
        <button
          type="button"
          className={`tema-segment-btn ${durumFiltresi === 'bekliyor' ? 'aktif' : ''}`}
          onClick={() => setDurumFiltresi('bekliyor')}
        >
          ⏳ Planlanan ({bekleyenSayisi})
        </button>
        <button
          type="button"
          className={`tema-segment-btn ${durumFiltresi === 'teslim_alindi' ? 'aktif' : ''}`}
          onClick={() => setDurumFiltresi('teslim_alindi')}
        >
          ✓ Kabul Edilen ({teslimAlinanSayisi})
        </button>
      </div>

      {/* 3. SEVKİYAT PLANLAMA & KABUL KARTLARI LİSTESİ */}
      <div className="beton-dokum-listesi">
        {filtrelenmisPlanlar.length === 0 ? (
          <div className="bos-kayit-paneli">
            <span className="bos-ikon">🚚</span>
            <h4>Bu görünümde sevkiyat kaydı bulunmuyor</h4>
            <p>"➕ Sevkiyat Planla" veya "✓ Doğrudan Kabul" butonlarıyla yeni kayıt oluşturabilirsiniz.</p>
          </div>
        ) : (
          filtrelenmisPlanlar.map((plan) => {
            const teslimAlindiMi = plan.durum === 'teslim_alindi'
            const detayAcikMi = !!acikDetayKartlari[plan.id]
            const sKey = plan.santiyeId || plan.santiyeAdi || 'varsayilan'
            const santiyeRengi = santiyeRenkBilgisi.renkHaritasi[sKey] || '#1D9596'

            return (
              <div key={plan.id} className={`beton-dokum-karti ${teslimAlindiMi ? 'tamamlandi' : ''}`}>
                {/* KART ÜST BİLGİLERİ */}
                <div className="dokum-kart-ust" style={{ marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dokum-rozet-grubu">
                      <span className="dokum-santiye-renk-rozet" style={{ borderColor: santiyeRengi }}>
                        <span className="santiye-renk-noktasi" style={{ backgroundColor: santiyeRengi }} />
                        {plan.santiyeAdi}
                      </span>
                      <span className="dokum-tarih-rozet">📅 {tarihFormatlaTR(plan.tarih)}</span>
                      {teslimAlindiMi ? (
                        <span
                          className="dokum-durum-rozet kapali"
                          style={plan.teslimEksikVar ? { background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' } : undefined}
                        >
                          {plan.teslimEksikVar ? '⚠️ Eksik / Hasarlı Kabul' : '✓ Teslim Alındı'}
                        </span>
                      ) : (
                        <span className="dokum-durum-rozet acik">⏳ Planlandı</span>
                      )}
                    </div>

                    <h3 className="dokum-bolge-baslik">📦 {plan.malzeme}</h3>

                    <div className="dokum-santral-bilgi" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                      {!plan.dogrudanKabul && (
                        <span>
                          👤 Planlayan: <strong>{plan.planlayan || 'Belirtilmedi'}</strong> ({tarihSaatFormatlaTR(plan.olusturulduAt, plan.tarih)})
                        </span>
                      )}
                      {teslimAlindiMi && (
                        <span style={{ color: plan.teslimEksikVar ? '#b45309' : '#117575' }}>
                          ✓ Kabul Eden: <strong>{plan.teslimAlan || 'Kullanıcı'}</strong> ({tarihSaatFormatlaTR(plan.teslimTarihiIso, plan.teslimTarihi)})
                        </span>
                      )}
                      {teslimAlindiMi && plan.teslimEksikVar && plan.teslimEksikDetay && (
                        <span style={{ color: '#b45309', fontWeight: 700 }}>
                          ⚠️ Eksik / Hasar: {plan.teslimEksikDetay}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="dokum-kart-eylemler">
                    <button
                      type="button"
                      className="tema-duzenle-btn"
                      onClick={() => handlePlanDuzenleAc(plan)}
                      title="Düzenle"
                    >
                      ✏️ Düzenle
                    </button>
                    {teslimAlindiMi && (
                      <button
                        type="button"
                        className="dokum-durum-toggle-btn kapali"
                        onClick={() => handlePlanGeriAc(plan.id)}
                        title="Planlanan durumuna geri al"
                      >
                        ↩ Geri Aç
                      </button>
                    )}
                    <button
                      type="button"
                      className="kart-icon-buton sil"
                      onClick={() => handlePlanSil(plan.id)}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* ALT AKSİYON VE AŞAĞIYA DOĞRU GENİŞLETME BUTONLARI */}
                <div className="dokum-alt-aksiyon-satiri">
                  <button
                    type="button"
                    className={`mikser-detay-genislet-btn ${detayAcikMi ? 'acik' : ''}`}
                    onClick={() => toggleDetayKart(plan.id)}
                  >
                    <span>{detayAcikMi ? '▲' : '▼'}</span>
                    <span>
                      {detayAcikMi ? 'Detaylı Bilgileri Gizle' : 'Detaylı Bilgiler'}
                    </span>
                  </button>

                  {!teslimAlindiMi && (
                    <button
                      type="button"
                      className="tema-teslim-al-btn"
                      onClick={() => handleKabulModaliAc(plan)}
                    >
                      ✓ Teslim Al
                    </button>
                  )}
                </div>

                {/* AŞAĞIYA DOĞRU GENİŞLEYEN DETAYLI BİLGİLER ALANI */}
                {detayAcikMi && (
                  <div className="dokum-genisleyen-detay-alani animasyonlu-acilis">
                    <div className="kup-kirim-seridi" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginBottom: 0 }}>
                      <div className="kirim-tarih-kutu">
                        <span className="kirim-etiket">🏢 Tedarikçi / Firma:</span>
                        <strong className="kirim-tarih">{plan.tedarikci || 'Belirtilmedi'}</strong>
                      </div>

                      {plan.sahaNotu && (
                        <div className="kirim-tarih-kutu">
                          <span className="kirim-etiket">📝 Saha Notu:</span>
                          <strong className="kirim-tarih">{plan.sahaNotu}</strong>
                        </div>
                      )}

                      {teslimAlindiMi && (
                        <div className="kirim-tarih-kutu vurgulu" style={{ marginTop: 2 }}>
                          <span className="kirim-etiket">✓ Teslim Durumu:</span>
                          <strong className="kirim-tarih" style={{ color: plan.teslimEksikVar ? '#b45309' : '#117575' }}>
                            {plan.teslimAlan || 'Kullanıcı'} ({tarihSaatFormatlaTR(plan.teslimTarihiIso, plan.teslimTarihi)})
                            {plan.teslimEksikVar ? ' — ⚠️ Eksik / Hasarlı Teslimat' : ' — ✓ Eksiksiz Teslim Alındı'}
                          </strong>
                        </div>
                      )}

                      {teslimAlindiMi && plan.teslimEksikVar && plan.teslimEksikDetay && (
                        <div
                          className="kirim-tarih-kutu"
                          style={{
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: 8,
                            padding: '6px 10px',
                            width: '100%'
                          }}
                        >
                          <span className="kirim-etiket" style={{ color: '#b45309', fontWeight: 700 }}>⚠️ Eksik / Hasar Detayı:</span>
                          <strong className="kirim-tarih" style={{ color: '#92400e' }}>{plan.teslimEksikDetay}</strong>
                        </div>
                      )}

                      {plan.teslimNotu && (
                        <div className="kirim-tarih-kutu">
                          <span className="kirim-etiket">📌 Kabul Notu:</span>
                          <strong className="kirim-tarih">{plan.teslimNotu}</strong>
                        </div>
                      )}
                    </div>

                    {/* GÖRSELLER & İRSALİYE FOTOĞRAFLARI GALERİSİ */}
                    {(() => {
                      const tumFotolar = plan.fotograflar || (plan.irsaliyeFoto ? [plan.irsaliyeFoto] : [])
                      return (
                        <div className="dokum-irsaliye-galeri-alani" style={{ marginTop: 10 }}>
                          <div className="galeri-baslik-satiri">
                            <h4>📸 Görseller ({tumFotolar.length})</h4>
                            <label className="tema-foto-yukle-label" style={{ opacity: fotoYukleniyorId === plan.id ? 0.6 : 1 }}>
                              {fotoYukleniyorId === plan.id ? '⏳ Drive\'a Yükleniyor...' : '➕ Görsel Ekle'}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                multiple
                                disabled={fotoYukleniyorId === plan.id}
                                style={{ display: 'none' }}
                                onChange={(e) => handleKartGorselYukle(plan.id, e)}
                              />
                            </label>
                          </div>

                          {tumFotolar.length > 0 ? (
                            <div className="irsaliye-foto-grid">
                              {tumFotolar.map((url, fIdx) => (
                                <div key={fIdx} className="irsaliye-foto-kapsayici">
                                  <img
                                    src={getGoogleDriveInlineImageUrl(url)}
                                    alt={`Görsel ${fIdx + 1}`}
                                    onClick={() => setBuyukFotoUrl(getGoogleDriveInlineImageUrl(url))}
                                  />
                                  <button
                                    type="button"
                                    className="foto-sil-mini-btn"
                                    onClick={() => handleKartGorselSil(plan.id, fIdx)}
                                    title="Görseli sil"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="galeri-bos-metin">Bu sevkiyata ait malzeme, araç veya irsaliye görsellerini buraya yükleyebilirsiniz (Google Drive'a kaydedilir).</p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* BÜYÜK FOTOĞRAF MODALI */}
      {buyukFotoUrl && (
        <div className="modal-arka-plan" onClick={() => setBuyukFotoUrl(null)}>
          <div className="modal-kutu buyuk-foto-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-kapat-btn ust-sag" onClick={() => setBuyukFotoUrl(null)}>✕</button>
            <img src={buyukFotoUrl} alt="Sevkiyat Görseli" className="buyuk-resim-icerik" />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SEVKİYAT PLANLA / DOĞRUDAN KABUL / DÜZENLE (TEK SATIRLIK FORM) */}
      {/* ===================================================================== */}
      {yeniPlanModalAcik && (
        <div className="modal-arka-plan" onClick={() => setYeniPlanModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>
                {duzenlenenPlanId
                  ? '✏️ Sevkiyat Kaydını Düzenle'
                  : modalIslemTipi === 'dogrudan_kabul'
                    ? '✓ Doğrudan Sevkiyat Kabulü'
                    : '🚚 Yeni Sevkiyat Planla'}
              </h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setYeniPlanModalAcik(false)}>✕</button>
            </div>

            {/* Kenarlıkla arasında boşluk olmayan tam yapışık (flush) mod seçici */}
            <div className="tema-segment-bar">
              <button
                type="button"
                className={`tema-segment-btn ${modalIslemTipi === 'planla' ? 'aktif' : ''}`}
                onClick={() => setModalIslemTipi('planla')}
              >
                📅 Sevkiyat Planla
              </button>
              <button
                type="button"
                className={`tema-segment-btn ${modalIslemTipi === 'dogrudan_kabul' ? 'aktif' : ''}`}
                onClick={() => setModalIslemTipi('dogrudan_kabul')}
              >
                ✓ Doğrudan Kabul
              </button>
            </div>

            <form onSubmit={handlePlanVeyaKabulKaydet} className="beton-kompakt-form">
              {/* 1. Şantiye Adı */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Şantiye Adı:</label>
                <select
                  value={formSantiyeId}
                  onChange={(e) => setFormSantiyeId(e.target.value)}
                  className="makine-select"
                  required
                >
                  {santiyeler.map(s => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </div>

              {/* 2. Malzeme & Miktar */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Malzeme & Miktar:</label>
                <input
                  type="text"
                  placeholder="Örn: 26 Ton Demir, 14 Palet Tuğla..."
                  value={formMalzeme}
                  onChange={(e) => setFormMalzeme(e.target.value)}
                  className="makine-input"
                  required
                  autoFocus
                />
              </div>

              {/* 3. Tedarikçi Firma */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Tedarikçi Firma:</label>
                <input
                  type="text"
                  placeholder="Örn: Özçelik Demir, Işıklar..."
                  value={formTedarikci}
                  onChange={(e) => setFormTedarikci(e.target.value)}
                  className="makine-input"
                />
              </div>

              {/* 4. Tarih */}
              <div className="form-tek-satir">
                <label className="alan-baslik">{modalIslemTipi === 'dogrudan_kabul' ? 'Kabul Tarihi:' : 'Planlanan Tarih:'}</label>
                <input
                  type="date"
                  value={formTarih}
                  onChange={(e) => setFormTarih(e.target.value)}
                  className="makine-input"
                  required
                />
              </div>

              {/* 5. Saha Notu */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Saha Notu:</label>
                <input
                  type="text"
                  placeholder="İsteğe bağlı hazırlık notu..."
                  value={formSahaNotu}
                  onChange={(e) => setFormSahaNotu(e.target.value)}
                  className="makine-input"
                />
              </div>

              {/* Kabul modundaysa Kabul Notu */}
              {modalIslemTipi === 'dogrudan_kabul' && (
                <div className="form-tek-satir">
                  <label className="alan-baslik">Kabul Notu:</label>
                  <input
                    type="text"
                    placeholder="İsteğe bağlı teslim alma notu..."
                    value={formKabulNotu}
                    onChange={(e) => setFormKabulNotu(e.target.value)}
                    className="makine-input"
                  />
                </div>
              )}

              {/* 6. Görseller */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Görseller:</label>
                <label className="tema-dosya-sec-kutu" style={{ opacity: modalFotoYukleniyor ? 0.6 : 1 }}>
                  <span>
                    {modalFotoYukleniyor
                      ? '⏳ Drive\'a Yükleniyor...'
                      : `📸 ${formFotograflar.length > 0 ? `${formFotograflar.length} Görsel Yüklendi` : 'Görsel Seç / Ekle'}`}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={modalFotoYukleniyor}
                    style={{ display: 'none' }}
                    onChange={(e) => handleModalGorselSec(e, 'plan')}
                  />
                </label>
              </div>

              {/* Seçili görsellerin küçük önizlemesi ve silme imkanı */}
              {formFotograflar.length > 0 && (
                <div className="irsaliye-foto-grid" style={{ marginBottom: 10 }}>
                  {formFotograflar.map((url, idx) => (
                    <div key={idx} className="irsaliye-foto-kapsayici">
                      <img src={getGoogleDriveInlineImageUrl(url)} alt={`Seçili ${idx + 1}`} />
                      <button
                        type="button"
                        className="foto-sil-mini-btn"
                        onClick={async () => {
                          const silinecekUrl = formFotograflar[idx]
                          setFormFotograflar(prev => prev.filter((_, i) => i !== idx))
                          if (silinecekUrl) {
                            const seciliS = santiyeler.find(s => s.id === formSantiyeId) || aktifSantiye
                            await moveToSilinenler(silinecekUrl, `Sevkiyatlar/${seciliS?.ad || 'Genel'}`)
                          }
                        }}
                        title="Görseli kaldır"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Doğrudan Kabul / Teslim Alındı ise Eksik/Hasarlı kutucuğu ve açılır açıklama alanı */}
              {modalIslemTipi === 'dogrudan_kabul' && (
                <>
                  <div className="form-satir" style={{ marginBottom: formEksikVar ? 8 : 6 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: formEksikVar ? '#fffbeb' : '#f8fafc',
                        border: `1.5px solid ${formEksikVar ? '#fde68a' : '#cbd5e1'}`,
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12,
                        color: formEksikVar ? '#b45309' : '#334155',
                        userSelect: 'none'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formEksikVar}
                        onChange={(e) => setFormEksikVar(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#d97706', cursor: 'pointer' }}
                      />
                      <span>⚠️ Eksik veya Hasarlı Teslimat <small style={{ fontWeight: 500, color: '#64748b' }}>(İsteğe bağlı)</small></span>
                    </label>
                  </div>

                  {formEksikVar && (
                    <div className="form-tek-satir animasyonlu-acilis">
                      <label className="alan-baslik" style={{ color: '#b45309' }}>Eksik / Hasar:</label>
                      <input
                        type="text"
                        placeholder="Eksik miktarı veya hasar durumunu yazınız..."
                        value={formEksikDetay}
                        onChange={(e) => setFormEksikDetay(e.target.value)}
                        className="makine-input"
                        style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
                        required
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setYeniPlanModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  {duzenlenenPlanId
                    ? 'Değişiklikleri Kaydet'
                    : modalIslemTipi === 'dogrudan_kabul'
                      ? '✓ Teslim Alındı Kaydet'
                      : 'Sevkiyatı Planla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: PLANLANAN SEVKİYATI HIZLI TESLİM AL                   */}
      {/* ============================================================ */}
      {kabulModalAcik && kabulHedefPlan && (
        <div className="modal-arka-plan" onClick={() => setKabulModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>✓ Sevkiyatı Teslim Al</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setKabulModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleKabulTamamla} className="beton-kompakt-form">
              <div style={{ background: '#f4f9f8', border: '1px solid #a7dbd8', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12.5 }}>
                <strong style={{ color: '#0f172a' }}>📦 {kabulHedefPlan.malzeme}</strong>
                <div style={{ color: '#475569', fontSize: 11.5, marginTop: 2 }}>
                  🏗️ {kabulHedefPlan.santiyeAdi} • 🏢 {kabulHedefPlan.tedarikci || 'Belirtilmedi'}
                </div>
              </div>

              <div className="form-tek-satir">
                <label className="alan-baslik">Görsel / İrsaliye:</label>
                <label className="tema-dosya-sec-kutu" style={{ opacity: modalFotoYukleniyor ? 0.6 : 1 }}>
                  <span>
                    {modalFotoYukleniyor
                      ? '⏳ Drive\'a Yükleniyor...'
                      : `📸 ${kabulFotograflar.length > 0 ? `${kabulFotograflar.length} Görsel Yüklendi` : 'Görsel Seç / Ekle'}`}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    disabled={modalFotoYukleniyor}
                    style={{ display: 'none' }}
                    onChange={(e) => handleModalGorselSec(e, 'kabul')}
                  />
                </label>
              </div>

              <div className="form-tek-satir">
                <label className="alan-baslik">Kabul Notu:</label>
                <input
                  type="text"
                  placeholder="İsteğe bağlı teslim notu..."
                  value={kabulNotu}
                  onChange={(e) => setKabulNotu(e.target.value)}
                  className="makine-input"
                />
              </div>

              <div className="form-satir" style={{ marginBottom: kabulEksikVar ? 8 : 10 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    background: kabulEksikVar ? '#fffbeb' : '#f8fafc',
                    border: `1.5px solid ${kabulEksikVar ? '#fde68a' : '#cbd5e1'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: kabulEksikVar ? '#b45309' : '#334155',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={kabulEksikVar}
                    onChange={(e) => setKabulEksikVar(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: '#d97706', cursor: 'pointer' }}
                  />
                  <span>⚠️ Eksik veya Hasarlı Teslimat <small style={{ fontWeight: 500, color: '#64748b' }}>(İsteğe bağlı)</small></span>
                </label>
              </div>

              {kabulEksikVar && (
                <div className="form-tek-satir animasyonlu-acilis">
                  <label className="alan-baslik" style={{ color: '#b45309' }}>Eksik / Hasar:</label>
                  <input
                    type="text"
                    placeholder="Eksik miktarı veya hasar durumunu yazınız..."
                    value={kabulEksikDetay}
                    onChange={(e) => setKabulEksikDetay(e.target.value)}
                    className="makine-input"
                    style={{ borderColor: '#f59e0b', background: '#fffbeb' }}
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setKabulModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  Teslim Alındı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
