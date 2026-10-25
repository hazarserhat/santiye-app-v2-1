import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'
import { generateAndSharePDF } from '../../lib/pdfGenerator'
import {
  getGoogleDriveInlineImageUrl,
  getGoogleDriveViewUrl,
  uploadToGoogleDrive
} from '../../lib/googleDrive'

const ayFormatla = (yilAy) => {
  if (!yilAy || typeof yilAy !== 'string') return ''
  const parcalar = yilAy.split('-')
  if (parcalar.length !== 2) return yilAy
  const [yil, ay] = parcalar
  const aylarTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const idx = parseInt(ay, 10) - 1
  if (idx >= 0 && idx < 12) {
    return `${aylarTr[idx]} - ${yil}`
  }
  return yilAy
}

// Mükerrer çek seri numaraları için Soft Pastel Renk Paleti
const SOFT_PASTEL_RENKLER = [
  { bg: '#FFF7ED', border: '#FDBA74', badgeBg: '#FFEDD5', text: '#9A3412', ad: 'Soft Kehribar' },
  { bg: '#FEF2F2', border: '#FCA5A5', badgeBg: '#FEE2E2', text: '#991B1B', ad: 'Soft Gül' },
  { bg: '#FAF5FF', border: '#D8B4FE', badgeBg: '#F3E8FF', text: '#6B21A8', ad: 'Soft Mor' },
  { bg: '#F0F9FF', border: '#7DD3FC', badgeBg: '#E0F2FE', text: '#0369A1', ad: 'Soft Gök Mavisi' },
  { bg: '#ECFDF5', border: '#6EE7B7', badgeBg: '#D1FAE5', text: '#065F46', ad: 'Soft Zümrüt' },
  { bg: '#FDF4FF', border: '#F0ABFC', badgeBg: '#FAE8FF', text: '#86198F', ad: 'Soft Fuşya' },
  { bg: '#FEFCE8', border: '#FDE047', badgeBg: '#FEF9C3', text: '#854D0E', ad: 'Soft Sarı' },
  { bg: '#F0FDFA', border: '#5EEAD4', badgeBg: '#CCFBF1', text: '#115E59', ad: 'Soft Turkuaz' },
  { bg: '#F5F3FF', border: '#C4B5FD', badgeBg: '#EDE9FE', text: '#5B21B6', ad: 'Soft Leylak' },
  { bg: '#FFFBEB', border: '#FCD34D', badgeBg: '#FEF3C7', text: '#78350F', ad: 'Soft Bal' }
]

const getMukerrerRenk = (seriNo) => {
  if (!seriNo) return null
  let hash = 0
  const s = String(seriNo).trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 37 + s.charCodeAt(i)) >>> 0
  }
  return SOFT_PASTEL_RENKLER[hash % SOFT_PASTEL_RENKLER.length]
}

export default function CekTakip() {
  const { santiyeler } = useSite()
  const [cekler, setCekler] = useState([])
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtreTur, setFiltreTur] = useState('hepsi') // 'hepsi' | 'kendi_cekimiz' | 'ciro' | 'portfoy' | 'emanet'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtreAy, setFiltreAy] = useState('hepsi')
  const [siralamaAlani, setSiralamaAlani] = useState('cek_vadesi')
  const [siralamaYonu, setSiralamaYonu] = useState('asc')
  const [seciliCekler, setSeciliCekler] = useState([])

  // Aşağı doğru genişleyen filtre açılır menü kontrolü ('tur' | 'santiye' | 'banka' | 'ay' | null)
  const [genisleyenFiltre, setGenisleyenFiltre] = useState(null)

  // Görsel İnceleme Modalı & Yükleme State'i
  const [seciliGorsel, setSeciliGorsel] = useState(null)
  const [yukleniyorGorselId, setYukleniyorGorselId] = useState(null)

  // Manuel tür geçersiz kılmaları (Kullanıcı dilerse rozete tıklayarak türü Kendi / Ciro olarak anında değiştirebilir)
  const [turOverrides, setTurOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cek_turu_overrides') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    Promise.all([
      supabase.from('cekler').select('*, santiyeler(ad)'),
      supabase.from('malikler').select('id, ad_soyad')
    ]).then(([{ data: cekData, error: cekError }, { data: malikData }]) => {
      if (cekError) { alert('Çekler yüklenemedi: ' + cekError.message); return }

      const tumCekler = cekData || []
      const maliklerListesi = malikData || []
      const malikIsimleri = new Set(maliklerListesi.map(m => m.ad_soyad?.trim().toLowerCase()).filter(Boolean))

      // 1. Alınan ve Verilen Çekleri Grupla
      const alinanlar = tumCekler.filter(c => c.yon === 'alinan')
      const verilenler = tumCekler.filter(c => c.yon === 'verilen' || !c.yon)

      const eslesenAlinanIdleri = new Set()
      const eslesenVerilenIdleri = new Set()
      const ciroBirlestirilmis = []

      // 2. Eşleşen Alınan & Verilen Çekleri TEK SATIRDA Birleştir
      verilenler.forEach(ver => {
        const verSeri = ver.cek_seri_no ? String(ver.cek_seri_no).trim().toLowerCase() : ''

        let eslesenAlinan = null
        if (verSeri) {
          eslesenAlinan = alinanlar.find(al => {
            if (eslesenAlinanIdleri.has(al.id)) return false
            const alSeri = al.cek_seri_no ? String(al.cek_seri_no).trim().toLowerCase() : ''
            return alSeri && alSeri === verSeri
          })
        }

        if (eslesenAlinan) {
          eslesenVerilenIdleri.add(ver.id)
          eslesenAlinanIdleri.add(eslesenAlinan.id)

          const alinanOdeyen = eslesenAlinan.odeyen ? eslesenAlinan.odeyen.trim() : ''
          const alinanOdeyenLower = alinanOdeyen.toLowerCase()

          const isFirmaVeyaOrtak = alinanOdeyenLower.includes('ortak') ||
                                   alinanOdeyenLower.includes('firma') ||
                                   alinanOdeyenLower.includes('şirket') ||
                                   alinanOdeyenLower.includes('biz') ||
                                   alinanOdeyenLower.includes('kendi')

          const isGercekMalik = malikIsimleri.has(alinanOdeyenLower) || (!isFirmaVeyaOrtak && Boolean(alinanOdeyen))

          let varsayilanTur = isGercekMalik && !isFirmaVeyaOrtak ? 'ciro' : 'kendi_cekimiz'
          const overrideTur = turOverrides[ver.id] || turOverrides[eslesenAlinan.id]
          const nihaiTur = overrideTur || varsayilanTur

          const kesideci = alinanOdeyen || ver.odeyen || (nihaiTur === 'ciro' ? 'Malik / Keşideci' : 'Biz (Firma)')
          const odenen = ver.odenen || eslesenAlinan.odenen || '—'

          // Emanet Kontrolü (Veritabanı veya Açıklama Alanında 'EMANET' ibaresi)
          const isEmanet = Boolean(
            ver.is_emanet ||
            eslesenAlinan.is_emanet ||
            (ver.aciklama && ver.aciklama.toUpperCase().includes('EMANET')) ||
            (eslesenAlinan.aciklama && eslesenAlinan.aciklama.toUpperCase().includes('EMANET'))
          )

          ciroBirlestirilmis.push({
            id: ver.id,
            verilen_id: ver.id,
            alinan_id: eslesenAlinan.id,
            tum_idler: [ver.id, eslesenAlinan.id],
            cek_turu: nihaiTur,
            isCiroEdildi: nihaiTur === 'ciro',
            is_emanet: isEmanet,
            banka: ver.banka || eslesenAlinan.banka || '',
            cek_seri_no: ver.cek_seri_no || eslesenAlinan.cek_seri_no || '',
            verilis_tarihi: ver.verilis_tarihi || eslesenAlinan.verilis_tarihi || null,
            alinma_tarihi: eslesenAlinan.verilis_tarihi || null,
            cek_vadesi: ver.cek_vadesi || eslesenAlinan.cek_vadesi || null,
            tutar: Number(ver.tutar || eslesenAlinan.tutar || 0),
            odeyen: kesideci,
            kesideci: kesideci,
            odenen: odenen,
            aciklama: ver.aciklama || eslesenAlinan.aciklama || '',
            santiye_id: ver.santiye_id || eslesenAlinan.santiye_id || null,
            santiyeler: ver.santiyeler || eslesenAlinan.santiyeler || null,
            belge_url: ver.belge_url || eslesenAlinan.belge_url || null,
            created_at: ver.created_at || eslesenAlinan.created_at
          })
        }
      })

      // 3. Eşleşmeyen Verilenler -> Firmanın Kendi Keşide Ettiği Çekler
      const kendiCeklerimiz = verilenler
        .filter(ver => !eslesenVerilenIdleri.has(ver.id))
        .map(ver => {
          const overrideTur = turOverrides[ver.id]
          const nihaiTur = overrideTur || 'kendi_cekimiz'

          const isEmanet = Boolean(
            ver.is_emanet ||
            (ver.aciklama && ver.aciklama.toUpperCase().includes('EMANET'))
          )

          return {
            ...ver,
            verilen_id: ver.id,
            alinan_id: null,
            tum_idler: [ver.id],
            cek_turu: nihaiTur,
            isCiroEdildi: nihaiTur === 'ciro',
            is_emanet: isEmanet,
            kesideci: ver.odeyen || 'Biz (Firma / Ortak)',
            odeyen: ver.odeyen || 'Firma',
            odenen: ver.odenen || '—',
            tutar: Number(ver.tutar || 0)
          }
        })

      // 4. Eşleşmeyen Alınanlar -> Henüz Cirolanmamış / Kasadaki Portföy Çekleri
      const portfoydekiCekler = alinanlar
        .filter(al => !eslesenAlinanIdleri.has(al.id))
        .map(al => {
          const overrideTur = turOverrides[al.id]
          const nihaiTur = overrideTur || 'portfoy'

          const isEmanet = Boolean(
            al.is_emanet ||
            (al.aciklama && al.aciklama.toUpperCase().includes('EMANET'))
          )

          return {
            ...al,
            alinan_id: al.id,
            verilen_id: null,
            tum_idler: [al.id],
            cek_turu: nihaiTur,
            isCiroEdildi: false,
            is_emanet: isEmanet,
            kesideci: al.odeyen || 'Malik / Keşideci',
            odeyen: al.odeyen || 'Malik / Keşideci',
            odenen: '— (Portföyde / Kasada)',
            tutar: Number(al.tutar || 0)
          }
        })

      // Tekilleştirilmiş Fiziksel Çek Listesi
      const nihaiListe = [...ciroBirlestirilmis, ...kendiCeklerimiz, ...portfoydekiCekler]
      setCekler(nihaiListe)
    })
  }, [turOverrides])

  // Tekil Fiziksel Çekler Arasında Seri Numarası Tekrar Edenleri Say
  const seriNoSayilari = useMemo(() => {
    const sayilar = {}
    cekler.forEach(c => {
      const s = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
      if (s) {
        sayilar[s] = (sayilar[s] || 0) + 1
      }
    })
    return sayilar
  }, [cekler])

  // Çek Türünü Anında Değiştir (Kendi Çekimiz ⇄ Cirolu Çek)
  const turDegistir = (c) => {
    const yeniTur = c.cek_turu === 'ciro' ? 'kendi_cekimiz' : 'ciro'
    const yeniOverrides = { ...turOverrides, [c.id]: yeniTur }
    if (c.alinan_id) yeniOverrides[c.alinan_id] = yeniTur
    if (c.verilen_id) yeniOverrides[c.verilen_id] = yeniTur

    setTurOverrides(yeniOverrides)
    try {
      localStorage.setItem('cek_turu_overrides', JSON.stringify(yeniOverrides))
    } catch (e) {
      console.error('Tür kaydedilemedi', e)
    }

    setCekler(prev => prev.map(item => {
      if (item.id === c.id || (item.verilen_id && item.verilen_id === c.verilen_id)) {
        return {
          ...item,
          cek_turu: yeniTur,
          isCiroEdildi: yeniTur === 'ciro',
          kesideci: yeniTur === 'ciro' ? (item.kesideci === 'Biz (Firma)' ? 'Malik / Keşideci' : item.kesideci) : 'Biz (Firma / Ortak)'
        }
      }
      return item
    }))
  }

  // Emanet Verilen Çek Durumunu Değiştir (Açıklama ve Veritabanı Güncellemesi)
  const emanetToggle = async (c) => {
    const simdikiDurum = Boolean(c.is_emanet)
    const yeniDurum = !simdikiDurum
    const idler = c.tum_idler && c.tum_idler.length > 0 ? c.tum_idler : [c.id]

    let yeniAciklama = c.aciklama || ''
    if (yeniDurum) {
      if (!yeniAciklama.toUpperCase().includes('EMANET')) {
        yeniAciklama = `[EMANET] ${yeniAciklama}`.trim()
      }
    } else {
      yeniAciklama = yeniAciklama.replace(/\[EMANET\]\s*/gi, '').replace(/\(Emanet Verildi\)\s*/gi, '').trim()
    }

    // State'i derhal güncelle
    setCekler(prev => prev.map(item => {
      if (item.id === c.id || idler.includes(item.id)) {
        return {
          ...item,
          is_emanet: yeniDurum,
          aciklama: yeniAciklama
        }
      }
      return item
    }))

    // Veritabanına kaydet
    try {
      const { error: err1 } = await supabase.from('cekler').update({ is_emanet: yeniDurum, aciklama: yeniAciklama }).in('id', idler)
      if (err1) {
        await supabase.from('cekler').update({ aciklama: yeniAciklama }).in('id', idler)
      }
    } catch (err) {
      console.error('Emanet durumu kaydedilemedi:', err)
    }
  }

  // Çeke Doğrudan Fotoğraf / Belge Yükleme
  const cekGorselYukle = async (e, c) => {
    const file = e.target.files?.[0]
    if (!file) return
    setYukleniyorGorselId(c.id)

    try {
      const adSoyad = c.odenen || c.odeyen || 'Cek'
      const driveSonuc = await uploadToGoogleDrive(file, 'Cekler', adSoyad, c.verilis_tarihi)
      if (!driveSonuc.success || !driveSonuc.url) {
        alert('Görsel yüklenemedi: ' + (driveSonuc.error || 'Bilinmeyen hata'))
        return
      }

      const idler = c.tum_idler && c.tum_idler.length > 0 ? c.tum_idler : [c.id]
      await supabase.from('cekler').update({ belge_url: driveSonuc.url }).in('id', idler)

      setCekler(prev => prev.map(item => {
        if (item.id === c.id || idler.includes(item.id)) {
          return { ...item, belge_url: driveSonuc.url }
        }
        return item
      }))
    } catch (err) {
      alert('Yükleme hatası: ' + err.message)
    } finally {
      setYukleniyorGorselId(null)
      e.target.value = ''
    }
  }

  // Çek Silme
  const cekSil = async (c) => {
    const kisi = c.odenen || c.odeyen || 'İsimsiz'
    const seriNo = c.cek_seri_no ? `(Seri No: ${c.cek_seri_no})` : ''
    const ciroEk = c.cek_turu === 'ciro'
      ? '\n\nℹ️ Bu işlem malikten alınan ve taşerona cirolanan ilgili çek kayıtlarını birlikte temizleyecektir.'
      : ''
    const onayMetni = `"${kisi}" adına kayıtlı ${seriNo} çek kaydını silmek istediğinize emin misiniz?${ciroEk}`
    if (!window.confirm(onayMetni)) return

    const idler = c.tum_idler && c.tum_idler.length > 0 ? c.tum_idler : [c.id]
    const { error } = await supabase.from('cekler').delete().in('id', idler)
    if (error) {
      alert('Çek silinemedi: ' + error.message)
      return
    }
    setCekler(prev => prev.filter(item => item.id !== c.id && !idler.includes(item.id)))
    setSeciliCekler(prev => prev.filter(x => !idler.includes(x)))
  }

  const siralamaTikla = (alan) => {
    if (siralamaAlani === alan) setSiralamaYonu((y) => (y === 'asc' ? 'desc' : 'asc'))
    else { setSiralamaAlani(alan); setSiralamaYonu('asc') }
  }

  const ok = (alan) => (siralamaAlani === alan ? (siralamaYonu === 'asc' ? ' ▲' : ' ▼') : '')

  const bankalar = [...new Set(cekler.map((c) => c.banka).filter(Boolean))].sort()
  const aylar = [...new Set(cekler.map((c) => c.cek_vadesi?.slice(0, 7)).filter(Boolean))].sort()

  let liste = cekler
    .filter((c) => {
      if (filtreTur === 'hepsi') return true
      if (filtreTur === 'emanet') return Boolean(c.is_emanet)
      return c.cek_turu === filtreTur
    })
    .filter((c) => filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye)
    .filter((c) => filtreBanka === 'hepsi' || c.banka === filtreBanka)
    .filter((c) => filtreAy === 'hepsi' || c.cek_vadesi?.slice(0, 7) === filtreAy)
    .filter((c) => {
      if (!aramaMetni.trim()) return true
      const aranan = aramaMetni.toLowerCase().trim()
      const odenen = (c.odenen || '').toLowerCase()
      const odeyen = (c.odeyen || '').toLowerCase()
      const kesideci = (c.kesideci || '').toLowerCase()
      const banka = (c.banka || '').toLowerCase()
      const seriNo = (c.cek_seri_no || '').toLowerCase()
      const aciklama = (c.aciklama || '').toLowerCase()
      const santiye = (c.santiyeler?.ad || '').toLowerCase()
      const tutarStr = String(c.tutar || '')
      const emanetStr = c.is_emanet ? 'emanet emaneten' : ''
      const turStr = c.cek_turu === 'ciro' ? 'ciro cirolu cirolanan malik' : (c.cek_turu === 'portfoy' ? 'portföy kasada alinan' : 'kendi verilen firma ortak')
      return odenen.includes(aranan) || odeyen.includes(aranan) || kesideci.includes(aranan) ||
             banka.includes(aranan) || seriNo.includes(aranan) || aciklama.includes(aranan) ||
             santiye.includes(aranan) || tutarStr.includes(aranan) || turStr.includes(aranan) ||
             emanetStr.includes(aranan)
    })

  liste = [...liste].sort((a, b) => {
    let av = a[siralamaAlani], bv = b[siralamaAlani]
    if (siralamaAlani === 'santiyeler') { av = a.santiyeler?.ad || ''; bv = b.santiyeler?.ad || '' }
    if (siralamaAlani === 'kisi') { av = a.odenen || a.odeyen || ''; bv = b.odenen || b.odeyen || '' }
    if (av == null) av = ''
    if (bv == null) bv = ''
    if (siralamaAlani === 'tutar') { av = Number(av); bv = Number(bv) }
    if (av < bv) return siralamaYonu === 'asc' ? -1 : 1
    if (av > bv) return siralamaYonu === 'asc' ? 1 : -1
    return 0
  })

  const filtreliToplam = liste.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const tumunuSecToggle = () => {
    if (seciliCekler.length === liste.length) {
      setSeciliCekler([])
    } else {
      setSeciliCekler(liste.map(c => c.id))
    }
  }

  const cekSecToggle = (id) => {
    setSeciliCekler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const bugun = new Date().toISOString().slice(0, 10)

  // Tür Dağılım İstatistikleri
  const ciroCekler = cekler.filter(c => c.cek_turu === 'ciro')
  const kendiCekler = cekler.filter(c => c.cek_turu === 'kendi_cekimiz')
  const portfoyCekler = cekler.filter(c => c.cek_turu === 'portfoy')
  const emanetCekler = cekler.filter(c => Boolean(c.is_emanet))
  const emanetToplam = emanetCekler.reduce((t, c) => t + Number(c.tutar || 0), 0)

  // Finansal Özet İstatistikleri
  const vadesiGelmemis = cekler.filter((c) => c.cek_vadesi && c.cek_vadesi >= bugun)
  const vadesiGelmemisTutar = vadesiGelmemis.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const odenenCekler = cekler.filter((c) => c.cek_vadesi && c.cek_vadesi < bugun)
  const odenenTutar = odenenCekler.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const tumZamanlarToplam = cekler.reduce((t, c) => t + Number(c.tutar || 0), 0)

  // Açılır Filtre Başlık Yardımcıları
  const getTurEtiketi = () => {
    if (filtreTur === 'kendi_cekimiz') return `🏢 Kendi Çeklerimiz (${kendiCekler.length})`
    if (filtreTur === 'ciro') return `🔄 Cirolu Malik (${ciroCekler.length})`
    if (filtreTur === 'portfoy') return `💼 Portföy (${portfoyCekler.length})`
    if (filtreTur === 'emanet') return `🤝 Emanet Çekler (${emanetCekler.length})`
    return `Tüm Çekler (${cekler.length})`
  }

  const getSantiyeEtiketi = () => {
    if (filtreSantiye === 'hepsi') return 'Tüm şantiyeler'
    const s = santiyeler.find(x => x.id === filtreSantiye)
    return s ? s.ad : 'Seçili Şantiye'
  }

  const getBankaEtiketi = () => {
    if (filtreBanka === 'hepsi') return 'Tüm bankalar'
    return filtreBanka
  }

  const getAyEtiketi = () => {
    if (filtreAy === 'hepsi') return 'Tüm aylar'
    return ayFormatla(filtreAy)
  }

  const aktifFiltreSayisi = [
    filtreTur !== 'hepsi',
    filtreSantiye !== 'hepsi',
    filtreBanka !== 'hepsi',
    filtreAy !== 'hepsi',
    Boolean(aramaMetni)
  ].filter(Boolean).length

  const pdfPaylas = async (sadeceSecilenler = false) => {
    const dataListesi = sadeceSecilenler ? liste.filter(c => seciliCekler.includes(c.id)) : liste
    if (dataListesi.length === 0) return alert('PDF için seçili veya filtrelenmiş kayıt bulunamadı.')

    const basliklar = ['Banka', 'Çek No', 'Tür', 'Veriliş', 'Vade', 'İlgili Kişi / Taşeron (Keşideci)', 'Tutar', 'Açıklama', 'Şantiye', 'Durum']
    const satirVerileri = dataListesi.map(c => {
      let turEtiketi = c.cek_turu === 'ciro' ? 'Cirolu (Malik)' : (c.cek_turu === 'portfoy' ? 'Portföy (Alınan)' : 'Kendi Çekimiz')
      if (c.is_emanet) turEtiketi += ' [EMANET]'

      const kisiMetni = c.cek_turu === 'ciro'
        ? `${c.odenen || '-'} (Keşideci: ${c.kesideci || '-'})`
        : (c.cek_turu === 'portfoy' ? `${c.odeyen || '-'} (Keşideci)` : `${c.odenen || '-'} (Kendi Çekimiz)`)
      
      let durumMetni = c.cek_turu === 'ciro'
        ? (c.cek_vadesi && c.cek_vadesi < bugun ? 'Cirolandı (Vadesi Geçti)' : 'Cirolandı (Vade Bekliyor)')
        : (c.cek_vadesi && c.cek_vadesi < bugun ? 'Ödendi' : 'Bekliyor')

      if (c.is_emanet) durumMetni += ' - Emanet'

      return [
        c.banka || '-',
        c.cek_seri_no || '-',
        turEtiketi,
        c.verilis_tarihi ? new Date(c.verilis_tarihi).toLocaleDateString('tr-TR') : '-',
        c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '-',
        kisiMetni,
        `${paraFormatla(c.tutar)} TL`,
        c.aciklama || '-',
        c.santiyeler?.ad || '-',
        durumMetni
      ]
    })

    satirVerileri.push(['', '', '', '', '', 'TOPLAM:', `${paraFormatla(filtreliToplam)} TL`, '', '', ''])

    await generateAndSharePDF({
      title: sadeceSecilenler ? 'Seçilen Çeklerin Ekstresi' : 'Çek Takip Ekstresi',
      filename: 'cek-ekstresi.pdf',
      columns: basliklar,
      data: satirVerileri
    })
  }

  const baslikStil = { cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#5F5E5A', borderBottom: '1px solid #D3D1C7' }
  const hucreStil = { padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
          <h2>Çek Takip Sayfası</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seciliCekler.length > 0 && (
            <button
              onClick={() => pdfPaylas(true)}
              style={{ background: '#F57F17', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📄 Seçilenleri Paylaş ({seciliCekler.length})
            </button>
          )}
          <button
            onClick={() => pdfPaylas(false)}
            style={{ background: '#2C3E50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Tüm Tabloyu Paylaş (PDF)
          </button>
        </div>
      </div>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş çek sayısı</p>
          <p className="ozet-tutar">{vadesiGelmemis.length}</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş toplam</p>
          <p className="ozet-tutar">{paraFormatla(vadesiGelmemisTutar)} ₺</p>
        </div>
      </div>
      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Ödenen / Vadesi dolan toplamı</p>
          <p className="ozet-tutar">{paraFormatla(odenenTutar)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Toplam Çek Hacmi (Tekil)</p>
          <p className="ozet-tutar">{paraFormatla(tumZamanlarToplam)} ₺</p>
        </div>
      </div>

      {/* EMANET ÇEK BİLGİLENDİRME VE DURUM PANELİ */}
      <div style={{
        background: '#FFFBEB',
        border: '1.5px solid #F59E0B',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 12,
        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#92400E', fontWeight: 700, fontSize: 13.5 }}>
            <span style={{ fontSize: 18 }}>🤝</span>
            <span>Emanet Verilen Çekler Sistemi</span>
            {emanetCekler.length > 0 && (
              <span style={{ background: '#FDE68A', color: '#78350F', fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                {emanetCekler.length} Adet Aktif ({paraFormatla(emanetToplam)} ₺)
              </span>
            )}
          </div>
          {emanetCekler.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setFiltreTur(filtreTur === 'emanet' ? 'hepsi' : 'emanet')
                setGenisleyenFiltre(null)
              }}
              style={{
                background: filtreTur === 'emanet' ? '#B45309' : '#FFFFFF',
                color: filtreTur === 'emanet' ? '#FFFFFF' : '#92400E',
                border: '1px solid #B45309',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {filtreTur === 'emanet' ? '✕ Tüm Çeklere Dön' : '⚡ Sadece Emanetleri Göster'}
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>
            💡 Sistem bir çekin "Emanet" olduğunu 2 farklı şekilde belirler:
          </div>
          <div style={{ paddingLeft: 8 }}>
            <div>
              • <strong>Açıklama Kontrolü:</strong> Çek kaydedilirken veya düzenlenirken açıklama (not) kısmında <em>"Emanet"</em> kelimesi veya <em>"[EMANET]"</em> ibaresi geçiyorsa, sistem bunu otomatik olarak algılar ve emanet listesine dahil eder.
            </div>
            <div style={{ marginTop: 2 }}>
              • <strong>Manuel İşaretleme:</strong> Aşağıdaki tabloda her çekin yanında yer alan <strong>"+ Emanet"</strong> butonuna tıklayarak herhangi bir çeki emanet yapabilir; emanet olan çekin üzerindeki <strong>"🤝 Emanet"</strong> rozetine tıklayarak bu işareti dilediğiniz an kaldırabilirsiniz.
            </div>
          </div>
        </div>
      </div>

      {/* ARAMA ÇUBUĞU */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1.5px solid #CBD5E1',
        padding: '2px 14px',
        marginBottom: 10,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <span style={{ fontSize: 15, marginRight: 8, color: '#64748B' }}>🔍</span>
        <input
          type="text"
          placeholder="Çek takipte ara (Kişi, malik, banka, çek no, emanet, açıklama, şantiye, tutar)..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '9px 0',
            fontSize: 13.5,
            background: 'transparent',
            color: '#1E293B'
          }}
        />
        {aramaMetni && (
          <button
            type="button"
            onClick={() => setAramaMetni('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 6px',
              fontWeight: 'bold'
            }}
            title="Aramayı Temizle"
          >
            ✕
          </button>
        )}
      </div>

      {/* AÇILIR/GENİŞLEYEN KOMPAKT FİLTRE ÇUBUĞU */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 10
      }}>
        {/* ÇEK TÜRÜ MASTER BUTONU */}
        <button
          type="button"
          className={`filtre-chip ${filtreTur !== 'hepsi' || genisleyenFiltre === 'tur' ? 'secili' : ''}`}
          onClick={() => setGenisleyenFiltre(genisleyenFiltre === 'tur' ? null : 'tur')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>{getTurEtiketi()}</span>
          <span style={{ fontSize: 10, opacity: 0.85 }}>{genisleyenFiltre === 'tur' ? '▲' : '▼'}</span>
        </button>

        {/* ŞANTİYE MASTER BUTONU */}
        <button
          type="button"
          className={`filtre-chip ${filtreSantiye !== 'hepsi' || genisleyenFiltre === 'santiye' ? 'secili' : ''}`}
          onClick={() => setGenisleyenFiltre(genisleyenFiltre === 'santiye' ? null : 'santiye')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>🏗️ {getSantiyeEtiketi()}</span>
          <span style={{ fontSize: 10, opacity: 0.85 }}>{genisleyenFiltre === 'santiye' ? '▲' : '▼'}</span>
        </button>

        {/* BANKA MASTER BUTONU */}
        {bankalar.length > 0 && (
          <button
            type="button"
            className={`filtre-chip ${filtreBanka !== 'hepsi' || genisleyenFiltre === 'banka' ? 'secili' : ''}`}
            onClick={() => setGenisleyenFiltre(genisleyenFiltre === 'banka' ? null : 'banka')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>🏦 {getBankaEtiketi()}</span>
            <span style={{ fontSize: 10, opacity: 0.85 }}>{genisleyenFiltre === 'banka' ? '▲' : '▼'}</span>
          </button>
        )}

        {/* AY MASTER BUTONU */}
        {aylar.length > 0 && (
          <button
            type="button"
            className={`filtre-chip ${filtreAy !== 'hepsi' || genisleyenFiltre === 'ay' ? 'secili' : ''}`}
            onClick={() => setGenisleyenFiltre(genisleyenFiltre === 'ay' ? null : 'ay')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>📅 {getAyEtiketi()}</span>
            <span style={{ fontSize: 10, opacity: 0.85 }}>{genisleyenFiltre === 'ay' ? '▲' : '▼'}</span>
          </button>
        )}

        {/* FİLTRELERİ TEMİZLE BUTONU (AKTİF FİLTRE VARSA GÖSTERİLİR) */}
        {aktifFiltreSayisi > 0 && (
          <button
            type="button"
            onClick={() => {
              setFiltreTur('hepsi')
              setFiltreSantiye('hepsi')
              setFiltreBanka('hepsi')
              setFiltreAy('hepsi')
              setAramaMetni('')
              setGenisleyenFiltre(null)
            }}
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              borderRadius: 999,
              padding: '6px 12px',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            ✕ Filtreleri Sıfırla ({aktifFiltreSayisi})
          </button>
        )}
      </div>

      {/* AŞAĞI DOĞRU GENİŞLEYEN SEÇİM ALANI */}
      {genisleyenFiltre && (
        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #CBD5E1',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 12,
          boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {genisleyenFiltre === 'tur' && '🎯 Çek Türü veya Emanet Seçin'}
              {genisleyenFiltre === 'santiye' && '🏗️ Şantiye Seçin'}
              {genisleyenFiltre === 'banka' && '🏦 Banka Seçin'}
              {genisleyenFiltre === 'ay' && '📅 Vade Ayı Seçin'}
            </span>
            <button
              type="button"
              onClick={() => setGenisleyenFiltre(null)}
              style={{
                background: '#F1F5F9',
                border: 'none',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                color: '#64748B',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Kapat ✕
            </button>
          </div>

          {/* 1. TÜR SEÇENEKLERİ */}
          {genisleyenFiltre === 'tur' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filtre-chip ${filtreTur === 'hepsi' ? 'secili' : ''}`}
                onClick={() => { setFiltreTur('hepsi'); setGenisleyenFiltre(null) }}
              >
                Tüm Çekler ({cekler.length})
              </button>
              <button
                type="button"
                className={`filtre-chip ${filtreTur === 'kendi_cekimiz' ? 'secili' : ''}`}
                onClick={() => { setFiltreTur('kendi_cekimiz'); setGenisleyenFiltre(null) }}
              >
                🏢 Kendi Çeklerimiz ({kendiCekler.length})
              </button>
              <button
                type="button"
                className={`filtre-chip ${filtreTur === 'ciro' ? 'secili' : ''}`}
                onClick={() => { setFiltreTur('ciro'); setGenisleyenFiltre(null) }}
              >
                🔄 Cirolu Malik Çekleri ({ciroCekler.length})
              </button>
              <button
                type="button"
                className={`filtre-chip ${filtreTur === 'portfoy' ? 'secili' : ''}`}
                onClick={() => { setFiltreTur('portfoy'); setGenisleyenFiltre(null) }}
              >
                💼 Portföy (Alınan/Kasada) ({portfoyCekler.length})
              </button>
              <button
                type="button"
                className={`filtre-chip ${filtreTur === 'emanet' ? 'secili' : ''}`}
                onClick={() => { setFiltreTur('emanet'); setGenisleyenFiltre(null) }}
                style={{
                  borderColor: filtreTur === 'emanet' ? '#D97706' : '#F59E0B',
                  background: filtreTur === 'emanet' ? '#FEF3C7' : '#FFFBEB',
                  color: '#B45309',
                  fontWeight: 700
                }}
              >
                🤝 Emanet Çekler ({emanetCekler.length})
              </button>
            </div>
          )}

          {/* 2. ŞANTİYE SEÇENEKLERİ */}
          {genisleyenFiltre === 'santiye' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`}
                onClick={() => { setFiltreSantiye('hepsi'); setGenisleyenFiltre(null) }}
              >
                Tüm şantiyeler
              </button>
              {santiyeler.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`}
                  onClick={() => { setFiltreSantiye(s.id); setGenisleyenFiltre(null) }}
                >
                  {s.ad}
                </button>
              ))}
            </div>
          )}

          {/* 3. BANKA SEÇENEKLERİ */}
          {genisleyenFiltre === 'banka' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filtre-chip ${filtreBanka === 'hepsi' ? 'secili' : ''}`}
                onClick={() => { setFiltreBanka('hepsi'); setGenisleyenFiltre(null) }}
              >
                Tüm bankalar
              </button>
              {bankalar.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`filtre-chip ${filtreBanka === b ? 'secili' : ''}`}
                  onClick={() => { setFiltreBanka(b); setGenisleyenFiltre(null) }}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* 4. VADE AYI SEÇENEKLERİ */}
          {genisleyenFiltre === 'ay' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                type="button"
                className={`filtre-chip ${filtreAy === 'hepsi' ? 'secili' : ''}`}
                onClick={() => { setFiltreAy('hepsi'); setGenisleyenFiltre(null) }}
              >
                Tüm aylar
              </button>
              {aylar.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`filtre-chip ${filtreAy === a ? 'secili' : ''}`}
                  onClick={() => { setFiltreAy(a); setGenisleyenFiltre(null) }}
                >
                  {ayFormatla(a)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GERÇEK MÜKERRER ÇEK UYARISI */}
      {Object.values(seriNoSayilari).some(sayi => sayi > 1) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          marginTop: 8,
          marginBottom: 10,
          borderRadius: 10,
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          color: '#92400E',
          fontSize: 12.5,
          fontWeight: 600
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            Tabloda aynı seri numarasına sahip <strong>mükerrer çek kayıtları</strong> tespit edildi (Eşleşen kayıtlar tekilleştirilmiştir). Ayırt edilebilmeleri için eşleşen <strong>soft pastel renklerle</strong> vurgulanmıştır. Fazla kayıtları sağdaki 🗑️ butonuyla silebilirsiniz.
          </span>
        </div>
      )}

      {/* ÇEK TABLOSU */}
      <div style={{ overflowX: 'auto', marginTop: 8, background: 'white', borderRadius: 12, border: '1px solid #D3D1C7' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, width: 40, textAlign: 'center' }}>
                <input type="checkbox" checked={liste.length > 0 && seciliCekler.length === liste.length} onChange={tumunuSecToggle} />
              </th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_turu')}>Tür{ok('cek_turu')}</th>
              <th style={{ ...baslikStil, textAlign: 'center', width: 70 }}>Belge</th>
              <th style={baslikStil} onClick={() => siralamaTikla('banka')}>Banka{ok('banka')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_seri_no')}>Çek No{ok('cek_seri_no')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('verilis_tarihi')}>Veriliş T.{ok('verilis_tarihi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_vadesi')}>Vade T.{ok('cek_vadesi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('kisi')}>Verilen / İlgili Kişi{ok('kisi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('tutar')}>Tutar{ok('tutar')}</th>
              <th style={{ ...baslikStil, maxWidth: 150 }}>Açıklama</th>
              <th style={baslikStil} onClick={() => siralamaTikla('santiyeler')}>Şantiye{ok('santiyeler')}</th>
              <th style={baslikStil}>Durum / Emanet</th>
              <th style={{ ...baslikStil, width: 48, textAlign: 'center' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => {
              const seriNoTemiz = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
              const mukerrerSayisi = seriNoTemiz ? (seriNoSayilari[seriNoTemiz] || 0) : 0
              const isMukerrer = mukerrerSayisi > 1
              const softRenk = isMukerrer ? getMukerrerRenk(seriNoTemiz) : null

              return (
                <tr
                  key={c.id}
                  style={{
                    backgroundColor: seciliCekler.includes(c.id)
                      ? '#E0F2FE'
                      : (c.is_emanet ? '#FFFDF5' : (isMukerrer ? softRenk.bg : 'transparent')),
                    borderLeft: c.is_emanet
                      ? '5px solid #F59E0B'
                      : (isMukerrer ? `5px solid ${softRenk.border}` : '5px solid transparent'),
                    transition: 'all 0.15s ease'
                  }}
                >
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <input type="checkbox" checked={seciliCekler.includes(c.id)} onChange={() => cekSecToggle(c.id)} />
                  </td>

                  {/* TÜR ROZETİ (TIKLANARAK ANINDA KENDİ ÇEKİMİZ ⇄ CİRO DEĞİŞTİRİLEBİLİR) */}
                  <td style={hucreStil}>
                    {c.cek_turu === 'ciro' && (
                      <button
                        type="button"
                        onClick={() => turDegistir(c)}
                        title="Tıklayarak türü 'Kendi Çekimiz' olarak değiştir"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Cirolu (Malik) <span style={{ fontSize: 9, opacity: 0.6 }}>⇄</span>
                      </button>
                    )}
                    {c.cek_turu === 'kendi_cekimiz' && (
                      <button
                        type="button"
                        onClick={() => turDegistir(c)}
                        title="Tıklayarak türü 'Cirolu Malik Çeki' olarak değiştir"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#ECFDF5',
                          color: '#065F46',
                          border: '1px solid #A7F3D0',
                          cursor: 'pointer'
                        }}
                      >
                        🏢 Kendi Çekimiz <span style={{ fontSize: 9, opacity: 0.6 }}>⇄</span>
                      </button>
                    )}
                    {c.cek_turu === 'portfoy' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#FFFBEB',
                        color: '#92400E',
                        border: '1px solid #FDE68A'
                      }}>
                        💼 Portföy
                      </span>
                    )}
                  </td>

                  {/* BELGE / GÖRSEL SÜTUNU */}
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    {c.belge_url ? (
                      <button
                        type="button"
                        onClick={() => setSeciliGorsel(c)}
                        title="Çek görselini görüntüle / büyüt"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: '#F0FDF4',
                          border: '1px solid #86EFAC',
                          color: '#15803D',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}
                      >
                        🖼️ Görsel
                      </button>
                    ) : (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '3px 6px',
                          borderRadius: 6,
                          background: '#F8FAFC',
                          border: '1px dashed #CBD5E1',
                          color: '#64748B',
                          fontSize: 10.5,
                          cursor: yukleniyorGorselId === c.id ? 'wait' : 'pointer'
                        }}
                        title="Bu çeke ait fotoğraf veya makbuz ekle"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={yukleniyorGorselId === c.id}
                          onChange={(e) => cekGorselYukle(e, c)}
                        />
                        {yukleniyorGorselId === c.id ? '⏳...' : '📷 Ekle'}
                      </label>
                    )}
                  </td>

                  <td style={hucreStil}>{c.banka || '—'}</td>

                  <td style={hucreStil}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: isMukerrer ? 700 : 500 }}>{c.cek_seri_no || '—'}</span>
                      {isMukerrer && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            background: softRenk.badgeBg,
                            color: softRenk.text,
                            border: `1px solid ${softRenk.border}`,
                            whiteSpace: 'nowrap'
                          }}
                          title={`Bu seri numarası (${c.cek_seri_no}) sistemde ${mukerrerSayisi} kez kayıtlı!`}
                        >
                          ⚠️ Tekrar ({mukerrerSayisi})
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={hucreStil}>
                    {c.verilis_tarihi ? (
                      <div>
                        <div>{new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>{ayFormatla(c.verilis_tarihi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>

                  <td style={hucreStil}>
                    {c.cek_vadesi ? (
                      <div>
                        <div>{new Date(c.cek_vadesi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#1D9596', fontWeight: 600 }}>{ayFormatla(c.cek_vadesi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>

                  {/* VERİLEN / İLGİLİ KİŞİ (KENDİ ÇEKİMİZ / MALİK CİROSU AYRINTISI) */}
                  <td style={hucreStil}>
                    {c.cek_turu === 'ciro' ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          {c.odenen || '—'}
                        </div>
                        {c.kesideci && c.kesideci !== '—' && (
                          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <span>↩️ Malik / Keşideci:</span>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{c.kesideci}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      c.cek_turu === 'portfoy' ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.odeyen || '—'}</div>
                          <div style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>💼 Malik / Keşideci</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.odenen || '—'}</div>
                          <div style={{ fontSize: 10, color: '#059669', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🏢 Firma / Ortak Keşidesi</span>
                            {c.odeyen && c.odeyen !== 'Firma' && c.odeyen !== 'Biz' && c.odeyen !== 'Biz (Firma / Ortak)' && (
                              <span style={{ color: '#64748B' }}>({c.odeyen})</span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </td>

                  <td style={{ ...hucreStil, fontWeight: 700 }}>{paraFormatla(c.tutar)} ₺</td>
                  <td style={{ ...hucreStil, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.aciklama}>{c.aciklama || '—'}</td>
                  <td style={hucreStil}>{c.santiyeler?.ad || '—'}</td>

                  {/* DURUM / EMANET SÜTUNU */}
                  <td style={hucreStil}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {c.cek_turu === 'ciro' ? (
                          <span className="durum-rozet" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                            Ciro Edildi
                          </span>
                        ) : (
                          c.cek_turu === 'portfoy' ? (
                            c.cek_vadesi && c.cek_vadesi < bugun
                              ? <span className="durum-rozet rozet-yesil">Tahsil Edildi</span>
                              : <span className="durum-rozet rozet-mavi" style={{ background: '#FEF3C7', color: '#B45309' }}>Kasada (Bekliyor)</span>
                          ) : (
                            c.cek_vadesi && c.cek_vadesi < bugun
                              ? <span className="durum-rozet rozet-yesil">Ödendi</span>
                              : <span className="durum-rozet rozet-sari">Bekliyor</span>
                          )
                        )}

                        {/* EMANET BUTONU / ROZETİ */}
                        {c.is_emanet ? (
                          <button
                            type="button"
                            onClick={() => emanetToggle(c)}
                            title="Emanet işaretini kaldırmak için tıklayın"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              padding: '2px 7px',
                              borderRadius: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #F59E0B',
                              cursor: 'pointer'
                            }}
                          >
                            🤝 Emanet
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => emanetToggle(c)}
                            title="Bu çeki 'Emanet Verilen' olarak işaretle"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              padding: '2px 6px',
                              borderRadius: 5,
                              fontSize: 9.5,
                              color: '#94A3B8',
                              background: 'transparent',
                              border: '1px dashed #CBD5E1',
                              cursor: 'pointer'
                            }}
                          >
                            + Emanet
                          </button>
                        )}
                      </div>

                      {c.cek_vadesi && (
                        <span style={{ fontSize: 10, color: c.cek_vadesi < bugun ? '#059669' : '#D97706', fontWeight: 600 }}>
                          {c.cek_vadesi < bugun ? '✓ Vadesi Geçti' : '⏳ Vade Bekliyor'}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* İŞLEM (SİL) */}
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => cekSil(c)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      title="Bu çek kaydını sil"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {liste.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="8" style={{ ...hucreStil, fontWeight: 'bold', textAlign: 'right' }}>Filtrelenen Toplam:</td>
                <td style={{ ...hucreStil, fontWeight: 'bold' }}>{paraFormatla(filtreliToplam)} ₺</td>
                <td colSpan="4" style={hucreStil}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {liste.length === 0 && <p className="bos-mesaj">Bu filtrede çek yok.</p>}
      </div>
      <p style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
        💡 <strong>Tür Rozetine (🏢/🔄)</strong> tıklayarak dilediğiniz çekin türünü 'Kendi Çekimiz' veya 'Cirolu' olarak değiştirebilirsiniz. <strong>🖼️ Görsel</strong> butonuna tıklayarak çek fotoğrafını büyük ekranda inceleyebilir, <strong>🤝 Emanet</strong> butonuyla teminat/emanet çeklerini tek dokunuşla işaretleyebilirsiniz.
      </p>

      {/* LIGHTBOX GÖRSEL ÖNİZLEME MODALI */}
      {seciliGorsel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
          onClick={() => setSeciliGorsel(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Başlık */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🖼️ Çek Belgesi</span>
                  <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: '#E0F2FE', color: '#0369A1', fontWeight: 600 }}>
                    {seciliGorsel.banka || 'Banka'} • No: {seciliGorsel.cek_seri_no || '—'}
                  </span>
                </h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  {seciliGorsel.odenen ? `Verilen: ${seciliGorsel.odenen}` : `Ödeyen: ${seciliGorsel.odeyen || '—'}`} • <strong>{paraFormatla(seciliGorsel.tutar)} ₺</strong> • Vade: {seciliGorsel.cek_vadesi ? new Date(seciliGorsel.cek_vadesi).toLocaleDateString('tr-TR') : '—'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeciliGorsel(null)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#64748B',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Görsel Alanı */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0F172A',
              padding: 16,
              minHeight: 280
            }}>
              <img
                src={getGoogleDriveInlineImageUrl(seciliGorsel.belge_url)}
                alt="Çek Görseli"
                style={{
                  maxWidth: '100%',
                  maxHeight: '62vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none'
                  if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block'
                }}
              />
              <div style={{ display: 'none', textAlign: 'center', color: '#F8FAFC', padding: 24 }}>
                <p style={{ fontSize: 14, marginBottom: 12 }}>⚠️ Görsel doğrudan yüklenemedi veya izin gerekiyor.</p>
                <a
                  href={getGoogleDriveViewUrl(seciliGorsel.belge_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#2563EB',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 13
                  }}
                >
                  Drive'da Aç / Görüntüle ↗
                </a>
              </div>
            </div>

            {/* Modal Alt Çubuk */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid #E2E8F0',
              background: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {seciliGorsel.is_emanet && (
                  <span style={{ padding: '3px 8px', borderRadius: 6, background: '#FEF3C7', color: '#B45309', fontWeight: 700, fontSize: 11 }}>
                    🤝 Emanet Verilen Çek
                  </span>
                )}
                {seciliGorsel.aciklama && (
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Not: {seciliGorsel.aciklama}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={getGoogleDriveViewUrl(seciliGorsel.belge_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#2563EB',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  ↗ Yeni Sekmede Aç
                </a>
                <button
                  type="button"
                  onClick={() => setSeciliGorsel(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
