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

const tarihSaatFormatlaTR = (isoStr, yedekTarih, yedekSaat) => {
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
    const trTarih = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : yedekTarih
    return yedekSaat ? `${trTarih} ${yedekSaat}` : trTarih
  }
  return '—'
}

const gunEkle = (tarihStr, n) => {
  if (!tarihStr) return ''
  const d = new Date(tarihStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const AY_ISIMLERI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
]

const SANTIYE_RENKLERI = [
  '#0284c7', // Mavi
  '#e11d48', // Kırmızı / Gül
  '#16a34a', // Yeşil
  '#d97706', // Turuncu
  '#7c3aed', // Mor
  '#0d9488', // Teal
  '#db2777', // Pembe
  '#2563eb', // Koyu Mavi
  '#ca8a04', // Altın Sarısı
  '#4f46e5', // İndigo
]

const BETON_SINIFLARI = ['C25/30', 'C30/37', 'C35/45', 'Grobeton', 'Diğer']

const DOKUM_SEKILLERI = [
  'Mobil Pompa',
  'Yer Pompası',
  'Direkt Mikser',
  'Vinç Kovası'
]

const LOCAL_STORAGE_BETON = 'santiye_beton_dokumleri_v1'
const LOCAL_STORAGE_SON_HACIM = 'santiye_son_mikser_hacmi'

export default function BetonDokumu() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()

  const [seciliTarih, setSeciliTarih] = useState('')
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [dokumListesi, setDokumListesi] = useState([])

  // Takvim Matrisi & Şantiye Seçim Kartı State'leri (Default kapalı)
  const [matrisAcik, setMatrisAcik] = useState(false)
  const [santiyeKartAcik, setSantiyeKartAcik] = useState(false)
  const [matrisYil, setMatrisYil] = useState(() => new Date().getFullYear())
  const [matrisAy, setMatrisAy] = useState(() => new Date().getMonth())

  // Kartların Açılır/Kapanır Detay & Mikser State'i
  const [acikDetayKartlari, setAcikDetayKartlari] = useState({})

  // Modal / Form States
  const [yeniDokumModalAcik, setYeniDokumModalAcik] = useState(false)
  const [seciliDokumId, setSeciliDokumId] = useState(null)
  const [buyukFotoUrl, setBuyukFotoUrl] = useState(null)

  // Yeni Beton Dökümü Form Alanları (Basitleştirilmiş)
  const [formSantiyeId, setFormSantiyeId] = useState('')
  const [formDokumAlani, setFormDokumAlani] = useState('')
  const [formHedefM3, setFormHedefM3] = useState(120)
  const [formSinif, setFormSinif] = useState('C30/37')
  const [formManuelSinif, setFormManuelSinif] = useState('')
  const [formDokumSekli, setFormDokumSekli] = useState('Mobil Pompa')

  // Hızlı Mikser Ekleme Modalı / Girişi
  const [mikserModalAcik, setMikserModalAcik] = useState(false)
  const [mikserHacim, setMikserHacim] = useState(9)
  const [mikserKupAlindi, setMikserKupAlindi] = useState(false)

  // Sayfa açıldığında son kullanılan mikser hacmini oku
  useEffect(() => {
    try {
      const sonHacim = localStorage.getItem(LOCAL_STORAGE_SON_HACIM)
      if (sonHacim) {
        setMikserHacim(parseFloat(sonHacim) || 9)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (aktifSantiye?.id) {
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  // Supabase + LocalStorage senkronizasyonu ile kayıtları çek
  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      const veri = await operasyonVerisiYukle(LOCAL_STORAGE_BETON, [])
      if (!iptal) {
        setDokumListesi(veri)
      }
    }
    yukle()
    return () => { iptal = true }
  }, [])

  const dokumleriKaydet = (yeniListe) => {
    setDokumListesi(yeniListe)
    operasyonVerisiKaydet(LOCAL_STORAGE_BETON, yeniListe)
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

    dokumListesi.forEach((d) => {
      const key = d.santiyeId || d.santiyeAdi || 'varsayilan'
      if (!renkHaritasi[key]) {
        const renk = SANTIYE_RENKLERI[santiyeListesi.length % SANTIYE_RENKLERI.length]
        renkHaritasi[key] = renk
        santiyeListesi.push({ id: key, ad: d.santiyeAdi || 'Şantiye', renk })
      }
    })

    return { renkHaritasi, santiyeListesi }
  }, [santiyeler, dokumListesi])

  // Takvim Matrisi Gün Hesaplamaları
  const matrisGunleri = useMemo(() => {
    const gunler = []
    const ayinIlkGunu = new Date(matrisYil, matrisAy, 1)
    const ayinSonGunu = new Date(matrisYil, matrisAy + 1, 0)
    const toplamGun = ayinSonGunu.getDate()

    // Pazartesi başlangıçlı gün indeksi (0: Pzt, 6: Paz)
    let ilkGunHaftaIndeksi = ayinIlkGunu.getDay() - 1
    if (ilkGunHaftaIndeksi === -1) ilkGunHaftaIndeksi = 6

    for (let i = 0; i < ilkGunHaftaIndeksi; i++) {
      gunler.push({ bosluk: true, id: `bos-${i}` })
    }

    for (let g = 1; g <= toplamGun; g++) {
      const gStr = g < 10 ? `0${g}` : `${g}`
      const aStr = (matrisAy + 1) < 10 ? `0${matrisAy + 1}` : `${matrisAy + 1}`
      const tarihKey = `${matrisYil}-${aStr}-${gStr}`

      // O güne ait dökümler (şantiye filtresi varsa ona göre veya tüm şantiyeler)
      const gununDokumleri = dokumListesi.filter(d => {
        if (d.tarih !== tarihKey) return false
        if (seciliSantiyeId && d.santiyeId && d.santiyeId !== seciliSantiyeId) return false
        return true
      })

      // O gün dökümü olan benzersiz şantiyeler ve renkleri
      const gununSantiyeleriMap = new Map()
      gununDokumleri.forEach(d => {
        const sKey = d.santiyeId || d.santiyeAdi || 'varsayilan'
        if (!gununSantiyeleriMap.has(sKey)) {
          gununSantiyeleriMap.set(sKey, {
            id: sKey,
            ad: d.santiyeAdi || 'Şantiye',
            renk: santiyeRenkBilgisi.renkHaritasi[sKey] || '#0284c7'
          })
        }
      })

      gunler.push({
        bosluk: false,
        gunNo: g,
        tarihKey,
        dokumSayisi: gununDokumleri.length,
        santiyeler: Array.from(gununSantiyeleriMap.values())
      })
    }

    return gunler
  }, [matrisYil, matrisAy, dokumListesi, seciliSantiyeId, santiyeRenkBilgisi])

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

  // Kart detaylarını aç/kapat
  const toggleDetayKart = (dokumId) => {
    setAcikDetayKartlari(prev => ({
      ...prev,
      [dokumId]: !prev[dokumId]
    }))
  }

  // Yeni Döküm Kartı Başlat
  const handleYeniDokumKaydet = (e) => {
    e.preventDefault()
    const hedefSantiyeId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id || ''
    const santiyeObj = santiyeler.find(s => s.id === hedefSantiyeId) || aktifSantiye
    const dokumAlaniMetni = formDokumAlani.trim() || 'Beton Dökümü'
    const sonSinif = formSinif === 'Diğer' ? (formManuelSinif.trim() || 'Diğer') : formSinif
    const simdiIso = new Date().toISOString()

    const yeniDokum = {
      id: 'b-' + Date.now(),
      tarih: seciliTarih || bugun(),
      santiyeId: hedefSantiyeId,
      santiyeAdi: santiyeObj?.ad || 'Şantiye',
      neresi: dokumAlaniMetni,
      sinif: sonSinif,
      hedefM3: parseFloat(formHedefM3) || 100,
      dokumSekli: formDokumSekli,
      tamamlandi: false,
      olusturanId: profile?.id || null,
      olusturanAd: profile?.ad_soyad || 'Kullanıcı',
      olusturulduAt: simdiIso,
      irsaliyeFotolari: [],
      mikserler: []
    }

    dokumleriKaydet([yeniDokum, ...dokumListesi])
    setYeniDokumModalAcik(false)
    setFormDokumAlani('')
    setFormManuelSinif('')
  }

  // Hızlı Mikser Ekle
  const handleHizliMikserKaydet = (e) => {
    e.preventDefault()
    if (!seciliDokumId) return

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const girilenHacim = parseFloat(mikserHacim) || 9

    try {
      localStorage.setItem(LOCAL_STORAGE_SON_HACIM, girilenHacim.toString())
    } catch (err) {
      console.error(err)
    }

    const yeniMikser = {
      id: 'mikser-' + Date.now(),
      hacim: girilenHacim,
      saat: saatFormat,
      kupAlindi: Boolean(mikserKupAlindi),
      ekleyenId: profile?.id || null,
      ekleyenAd: profile?.ad_soyad || 'Kullanıcı',
      eklenmeTarihi: suAn.toISOString()
    }

    const guncel = dokumListesi.map(d => {
      if (d.id === seciliDokumId) {
        return {
          ...d,
          mikserler: [...d.mikserler, yeniMikser]
        }
      }
      return d
    })

    dokumleriKaydet(guncel)
    // Mikser eklendiğinde ilgili kartın detayını otomatik açık tutalım
    setAcikDetayKartlari(prev => ({ ...prev, [seciliDokumId]: true }))
    setMikserModalAcik(false)
    setMikserKupAlindi(false)
  }

  // Mikser Ekleme Modalı Açılırken Son Hacmi Yükle
  const handleMikserModalAc = (dokumId) => {
    setSeciliDokumId(dokumId)
    setMikserKupAlindi(false)
    try {
      const sonHacim = localStorage.getItem(LOCAL_STORAGE_SON_HACIM)
      if (sonHacim) {
        setMikserHacim(parseFloat(sonHacim) || 9)
      }
    } catch (e) {
      console.error(e)
    }
    setMikserModalAcik(true)
  }

  const [fotoYukleniyorId, setFotoYukleniyorId] = useState(null)

  // Toplu İrsaliye Fotoğrafı Yükle (Google Drive Entegrasyonlu)
  const handleTopluIrsaliyeYukle = async (dokumId, e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const hedefDokum = dokumListesi.find(d => d.id === dokumId)
    const santiyeAdi = hedefDokum?.santiyeAdi || aktifSantiye?.ad || 'Genel'
    const folderName = `BetonDokumu/${santiyeAdi}`
    const kisaAlan = (hedefDokum?.dokumAlani || 'Beton').substring(0, 25).trim()
    const adSoyad = `Beton-${kisaAlan}`

    setFotoYukleniyorId(dokumId)
    const yeniFotoUrls = []

    try {
      for (const file of files) {
        const driveSonuc = await uploadToGoogleDrive({
          file,
          folderName,
          adSoyad,
          date: hedefDokum?.tarih || bugun()
        })
        if (driveSonuc?.url) {
          yeniFotoUrls.push(driveSonuc.url)
        }
      }

      if (yeniFotoUrls.length > 0) {
        const guncel = dokumListesi.map(d => {
          if (d.id === dokumId) {
            return {
              ...d,
              irsaliyeFotolari: [...(d.irsaliyeFotolari || []), ...yeniFotoUrls]
            }
          }
          return d
        })
        dokumleriKaydet(guncel)
      }
    } catch (err) {
      alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
    } finally {
      setFotoYukleniyorId(null)
      if (e.target) e.target.value = ''
    }
  }

  // Tekil İrsaliye Fotoğrafını Sil (Google Drive Silinenler Klasörüne Taşır)
  const handleIrsaliyeFotoSil = async (dokumId, fotoIndex) => {
    if (!window.confirm('Bu irsaliye fotoğrafını silmek istediğinize emin misiniz?')) return

    const hedefDokum = dokumListesi.find(d => d.id === dokumId)
    const silinecekUrl = hedefDokum?.irsaliyeFotolari?.[fotoIndex]
    const santiyeAdi = hedefDokum?.santiyeAdi || aktifSantiye?.ad || 'Genel'

    const guncel = dokumListesi.map(d => {
      if (d.id === dokumId) {
        return {
          ...d,
          irsaliyeFotolari: (d.irsaliyeFotolari || []).filter((_, i) => i !== fotoIndex)
        }
      }
      return d
    })
    dokumleriKaydet(guncel)

    if (silinecekUrl) {
      try {
        await moveToSilinenler(silinecekUrl, `BetonDokumu/${santiyeAdi}`)
      } catch (err) {
        console.warn('Silinenlere taşıma hatası:', err)
      }
    }
  }

  // Mikseri Sil
  const handleSonMikseriSil = (dokumId, mikserId) => {
    if (window.confirm('Bu mikser kaydını silmek istediğinize emin misiniz?')) {
      const guncel = dokumListesi.map(d => {
        if (d.id === dokumId) {
          return {
            ...d,
            mikserler: d.mikserler.filter(m => m.id !== mikserId)
          }
        }
        return d
      })
      dokumleriKaydet(guncel)
    }
  }

  // Dökümü Tamamlandı / Açık Yap
  const handleDokumDurumDegistir = (dokumId) => {
    const guncel = dokumListesi.map(d => {
      if (d.id === dokumId) {
        return { ...d, tamamlandi: !d.tamamlandi }
      }
      return d
    })
    dokumleriKaydet(guncel)
  }

  // Döküm Kartını Sil (Varsa Fotoğrafları Google Drive Silinenler Klasörüne Taşır)
  const handleDokumSil = async (dokumId) => {
    if (!window.confirm('Bu beton döküm kartını ve bağlı tüm mikser kayıtlarını silmek istediğinize emin misiniz?')) return

    const silinecek = dokumListesi.find(d => d.id === dokumId)
    const guncel = dokumListesi.filter(d => d.id !== dokumId)
    dokumleriKaydet(guncel)

    if (silinecek?.irsaliyeFotolari?.length > 0) {
      const santiyeAdi = silinecek.santiyeAdi || aktifSantiye?.ad || 'Genel'
      for (const url of silinecek.irsaliyeFotolari) {
        try {
          await moveToSilinenler(url, `BetonDokumu/${santiyeAdi}`)
        } catch (err) {
          console.warn('Silinenlere taşıma hatası:', err)
        }
      }
    }
  }

  // Filtrelenmiş Döküm Listesi
  const filtrelenmisDokumler = useMemo(() => {
    return dokumListesi.filter(d => {
      if (seciliSantiyeId && d.santiyeId && d.santiyeId !== seciliSantiyeId) return false
      if (seciliTarih && d.tarih !== seciliTarih) return false
      return true
    })
  }, [dokumListesi, seciliSantiyeId, seciliTarih])

  return (
    <div className="sayfa beton-dokum-sayfasi">
      {/* 1. ÜST BAŞLIK */}
      <div className="makine-ust-baslik-alani">
        <div className="makine-baslik-satiri">
          <div className="makine-baslik-metin">
            <h1>🧪 Beton Dökümü & Mikser Çetelesi</h1>
            <p className="makine-alt-bilgi">Saha hazır beton mikser akışı, hacim takibi ve şantiye döküm takvimi</p>
          </div>
          <button
            type="button"
            className="yeni-dokum-baslat-btn"
            onClick={() => {
              if (seciliSantiyeId) {
                setFormSantiyeId(seciliSantiyeId)
              } else if (aktifSantiye?.id) {
                setFormSantiyeId(aktifSantiye.id)
              }
              setYeniDokumModalAcik(true)
            }}
          >
            ➕ Yeni Beton Dökümü Başlat
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
              {seciliTarih ? tarihFormatlaTR(seciliTarih) : 'Günlük döküm takvimi'}
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
                    style={{ backgroundColor: santiyeRenkBilgisi.renkHaritasi[seciliSantiyeId] || '#0284c7', marginRight: 5 }}
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
              {matrisGunleri.map((item) => {
                if (item.bosluk) {
                  return <div key={item.id} className="matris-hucre bosluk" />
                }

                const seciliMi = item.tarihKey === seciliTarih
                const bugunMu = item.tarihKey === bugun()
                const dokumVarMi = item.santiyeler.length > 0

                return (
                  <div
                    key={item.tarihKey}
                    className={`matris-hucre durum-yok ${dokumVarMi ? 'beton-dokum-gunu' : ''} ${seciliMi ? 'aktif-gun' : ''} ${bugunMu ? 'bugun-cerceve' : ''}`}
                    onClick={() => setSeciliTarih(prev => prev === item.tarihKey ? '' : item.tarihKey)}
                    title={
                      dokumVarMi
                        ? `${item.tarihKey}: ${item.santiyeler.map(s => s.ad).join(', ')} (${item.dokumSayisi} döküm)`
                        : `${item.tarihKey}`
                    }
                  >
                    <span className="matris-gun-no">{item.gunNo}</span>
                    {dokumVarMi && (
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

            {/* Şantiye Renk Lejantı */}
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
                  <span className="santiye-renk-noktasi buyuk" style={{ background: 'linear-gradient(135deg, #0284c7, #16a34a)' }} />
                  <span>Tüm Şantiyeler</span>
                </span>
                <span className="santiye-dokum-sayac">{dokumListesi.length} Döküm</span>
              </button>

              {santiyeler.map((s) => {
                const renk = santiyeRenkBilgisi.renkHaritasi[s.id] || '#0284c7'
                const santiyeDokumSayisi = dokumListesi.filter(d => d.santiyeId === s.id).length
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
                    <span className="santiye-dokum-sayac">{santiyeDokumSayisi} Döküm</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. DÖKÜM KARTLARI LİSTESİ */}
      <div className="beton-dokum-listesi">
        {filtrelenmisDokumler.length === 0 ? (
          <div className="bos-kayit-paneli">
            <span className="bos-ikon">🧪</span>
            <h4>Henüz kayıtlı beton dökümü bulunmuyor</h4>
            <p>"Yeni Beton Dökümü Başlat" butonuna dokunarak kolayca yeni bir döküm kaydı açabilirsiniz.</p>
          </div>
        ) : (
          filtrelenmisDokumler.map(dokum => {
            const dokulenM3 = dokum.mikserler.reduce((toplam, m) => toplam + (Number(m.hacim) || 0), 0)
            const oran = Math.min(100, Math.round((dokulenM3 / (dokum.hedefM3 || 1)) * 100))
            const kalanM3 = Math.max(0, Math.round((dokum.hedefM3 - dokulenM3) * 10) / 10)
            const sonHacimBirim = dokum.mikserler.length > 0 ? dokum.mikserler[dokum.mikserler.length - 1].hacim : 9
            const kalanMikserTahmin = Math.ceil(kalanM3 / (sonHacimBirim || 9))

            // Küp Kırım Tarihleri (7 ve 28 gün - Sadece detaylı bilgilerde gösterilir)
            const kirim7 = gunEkle(dokum.tarih, 7)
            const kirim28 = gunEkle(dokum.tarih, 28)

            const detayAcikMi = !!acikDetayKartlari[dokum.id]
            const sKey = dokum.santiyeId || dokum.santiyeAdi || 'varsayilan'
            const santiyeRengi = santiyeRenkBilgisi.renkHaritasi[sKey] || '#0284c7'

            const neresiBaslik = dokum.neresi || (dokum.kat ? `${dokum.kat} — ${dokum.eleman || ''}` : (dokum.eleman || dokum.bolge || 'Beton Dökümü'))

            return (
              <div key={dokum.id} className={`beton-dokum-karti ${dokum.tamamlandi ? 'tamamlandi' : ''}`}>
                {/* KART BAŞLIĞI */}
                <div className="dokum-kart-ust">
                  <div>
                    <div className="dokum-rozet-grubu">
                      <span className="dokum-sinif-rozet">{dokum.sinif}</span>
                      <span className="dokum-santiye-renk-rozet" style={{ borderColor: santiyeRengi }}>
                        <span className="santiye-renk-noktasi" style={{ backgroundColor: santiyeRengi }} />
                        {dokum.santiyeAdi}
                      </span>
                      <span className="dokum-tarih-rozet">📅 {tarihFormatlaTR(dokum.tarih)}</span>
                      {dokum.tamamlandi ? (
                        <span className="dokum-durum-rozet kapali">✓ Döküm Tamamlandı</span>
                      ) : (
                        <span className="dokum-durum-rozet acik">⚡ Döküm Devam Ediyor</span>
                      )}
                    </div>

                    <h3 className="dokum-bolge-baslik">{neresiBaslik}</h3>

                    <div className="dokum-santral-bilgi">
                      <span>🚜 {dokum.dokumSekli || dokum.pompaTipi || 'Mobil Pompa'}</span>
                      <span>•</span>
                      <span>
                        👤 Kaydı Açan: <strong>{dokum.olusturanAd || 'Belirtilmedi'}</strong> ({tarihSaatFormatlaTR(dokum.olusturulduAt, dokum.tarih)})
                      </span>
                    </div>
                  </div>

                  <div className="dokum-kart-eylemler">
                    <button
                      type="button"
                      className={`dokum-durum-toggle-btn ${dokum.tamamlandi ? 'kapali' : 'acik'}`}
                      onClick={() => handleDokumDurumDegistir(dokum.id)}
                    >
                      {dokum.tamamlandi ? '↩ Dökümü Geri Aç' : '✓ Dökümü Tamamla'}
                    </button>
                    <button
                      type="button"
                      className="kart-icon-buton sil"
                      onClick={() => handleDokumSil(dokum.id)}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* İLERLEME ÇUBUĞU (PROGRESS BAR) */}
                <div className="dokum-ilerleme-alani">
                  <div className="dokum-ilerleme-metinler">
                    <span>
                      Dökülen: <strong>{dokulenM3} m³</strong> / Planlanan: <strong>{dokum.hedefM3} m³</strong>
                    </span>
                    <span className="yuzde-vurgu">%{oran}</span>
                  </div>
                  <div className="dokum-bar-dis">
                    <div
                      className={`dokum-bar-ic ${oran >= 100 ? 'tam' : ''}`}
                      style={{ width: `${oran}%` }}
                    />
                  </div>
                  <div className="dokum-kalan-bilgi">
                    {kalanM3 > 0 ? (
                      <span>Kalan Hacim: <strong>~{kalanM3} m³</strong> (Tahmini ~{kalanMikserTahmin} mikser daha gerekli)</span>
                    ) : (
                      <span className="hedef-tamamlandi">🎉 Planlanan beton hacmine ulaşıldı!</span>
                    )}
                  </div>
                </div>

                {/* MİKSER EKLEME & AŞAĞIYA DOĞRU GENİŞLETME BUTON SATIRI */}
                <div className="dokum-alt-aksiyon-satiri">
                  <button
                    type="button"
                    className={`mikser-detay-genislet-btn ${detayAcikMi ? 'acik' : ''}`}
                    onClick={() => toggleDetayKart(dokum.id)}
                  >
                    <span>{detayAcikMi ? '▲' : '▼'}</span>
                    <span>
                      {detayAcikMi
                        ? 'Mikser ve Detaylı Bilgileri Gizle'
                        : `Mikserler & Detaylı Bilgiler (${dokum.mikserler.length} Mikser - ${dokulenM3} m³)`}
                    </span>
                  </button>

                  {!dokum.tamamlandi && (
                    <button
                      type="button"
                      className="mikser-ekle-hizli-btn"
                      onClick={() => handleMikserModalAc(dokum.id)}
                    >
                      🚚 +1 Mikser Ekle
                    </button>
                  )}
                </div>

                {/* AŞAĞIYA DOĞRU GENİŞLEYEN DETAYLI BİLGİLER VE MİKSERLER ALANI */}
                {detayAcikMi && (
                  <div className="dokum-genisleyen-detay-alani animasyonlu-acilis">
                    {/* 7 VE 28 GÜNLÜK KÜP KIRIM BİLGİLERİ (SADECE DETAYDA) */}
                    <div className="kup-kirim-seridi">
                      <div className="kirim-tarih-kutu">
                        <span className="kirim-etiket">🧪 7 Günlük Küp Kırımı:</span>
                        <strong className="kirim-tarih">{tarihFormatlaTR(kirim7)}</strong>
                      </div>
                      <div className="kirim-tarih-kutu vurgulu">
                        <span className="kirim-etiket">🧪 28 Günlük Nihai Kırım:</span>
                        <strong className="kirim-tarih">{tarihFormatlaTR(kirim28)}</strong>
                      </div>
                    </div>

                    {/* MİKSERLER ÇETELE LİSTESİ */}
                    <div className="mikser-cetele-bolumu">
                      <div className="cetele-baslik-satiri">
                        <h4>🚚 Gelen Mikserler ({dokum.mikserler.length} Adet - {dokulenM3} m³)</h4>
                      </div>

                      {dokum.mikserler.length === 0 ? (
                        <p className="mikser-yok-metin">Henüz gelen mikser kaydedilmedi. "+1 Mikser Ekle" butonuna dokunarak ilk mikseri girin.</p>
                      ) : (
                        <div className="mikser-kart-grid">
                          {dokum.mikserler.map((m, idx) => (
                            <div key={m.id || idx} className="mikser-kayit-karti">
                              <div className="mikser-no-sira">#{idx + 1}</div>
                              <div className="mikser-bilgiler">
                                <div className="mikser-detay-etiketler">
                                  <span className="detay-hacim" style={{ fontSize: 14 }}>{m.hacim} m³</span>
                                  {m.kupAlindi && <span className="detay-kup">🧪 Numune Alındı</span>}
                                </div>
                                <div className="mikser-ekleyen-bilgi">
                                  👤 Ekleyen: <strong>{m.ekleyenAd || dokum.olusturanAd || 'Belirtilmedi'}</strong> • 🕒 {tarihSaatFormatlaTR(m.eklenmeTarihi, dokum.tarih, m.saat)}
                                </div>
                              </div>
                              {!dokum.tamamlandi && (
                                <button
                                  type="button"
                                  className="mikser-sil-btn"
                                  onClick={() => handleSonMikseriSil(dokum.id, m.id)}
                                  title="Sil"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* TOPLU İRSALİYE FOTOĞRAFLARI ARŞİVİ */}
                    <div className="dokum-irsaliye-galeri-alani">
                      <div className="galeri-baslik-satiri">
                        <h4>📸 İrsaliye Fotoğrafları ({dokum.irsaliyeFotolari?.length || 0})</h4>
                        <label className="toplu-foto-yukle-label" style={{ opacity: fotoYukleniyorId === dokum.id ? 0.6 : 1 }}>
                          {fotoYukleniyorId === dokum.id ? '⏳ Drive\'a Yükleniyor...' : '➕ Toplu İrsaliye Fotoğrafı Ekle'}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            disabled={fotoYukleniyorId === dokum.id}
                            style={{ display: 'none' }}
                            onChange={(e) => handleTopluIrsaliyeYukle(dokum.id, e)}
                          />
                        </label>
                      </div>

                      {dokum.irsaliyeFotolari && dokum.irsaliyeFotolari.length > 0 ? (
                        <div className="irsaliye-foto-grid">
                          {dokum.irsaliyeFotolari.map((url, fIdx) => (
                            <div key={fIdx} className="irsaliye-foto-kapsayici">
                              <img
                                src={getGoogleDriveInlineImageUrl(url)}
                                alt={`İrsaliye ${fIdx + 1}`}
                                onClick={() => setBuyukFotoUrl(getGoogleDriveInlineImageUrl(url))}
                              />
                              <button
                                type="button"
                                className="foto-sil-mini-btn"
                                onClick={() => handleIrsaliyeFotoSil(dokum.id, fIdx)}
                                title="Fotoğrafı sil"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="galeri-bos-metin">Bu döküme ait irsaliyelerin fotoğraflarını buraya yükleyebilirsiniz (Google Drive'a kaydedilir).</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* BÜYÜK FOTOĞRAF MODALI                                        */}
      {/* ============================================================ */}
      {buyukFotoUrl && (
        <div className="modal-arka-plan" onClick={() => setBuyukFotoUrl(null)}>
          <div className="modal-kutu buyuk-foto-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-kapat-btn ust-sag" onClick={() => setBuyukFotoUrl(null)}>✕</button>
            <img src={buyukFotoUrl} alt="İrsaliye Belgesi Büyütülmüş" className="buyuk-resim-icerik" />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: YENİ BETON DÖKÜMÜ BAŞLATMA (ÇOK BASİT FORM)           */}
      {/* ============================================================ */}
      {yeniDokumModalAcik && (
        <div className="modal-arka-plan" onClick={() => setYeniDokumModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>🧪 Yeni Beton Dökümü Başlat</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setYeniDokumModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleYeniDokumKaydet} className="beton-kompakt-form">
              {/* 1. Şantiye Adı (Tek Satır) */}
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

              {/* 2. Döküm Alanı (Tek Satır) */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Döküm Alanı:</label>
                <input
                  type="text"
                  placeholder="Örn: Tabliye, Kolon, Temel, Kazık..."
                  value={formDokumAlani}
                  onChange={(e) => setFormDokumAlani(e.target.value)}
                  className="makine-input"
                  required
                  autoFocus
                />
              </div>

              {/* 3. Planlanan Beton (m³) (Tek Satır) */}
              <div className="form-tek-satir">
                <label className="alan-baslik">Planlanan Beton (m³):</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formHedefM3}
                  onChange={(e) => setFormHedefM3(e.target.value)}
                  className="makine-input"
                  required
                />
              </div>

              {/* 4. Beton Sınıfı (Seçenekler Tek Satırda) */}
              <div className="form-satir" style={{ marginBottom: 10 }}>
                <label className="alan-baslik" style={{ marginBottom: 4 }}>Beton Sınıfı:</label>
                <div className="tek-satir-hap-grid besli">
                  {BETON_SINIFLARI.map(sinif => (
                    <button
                      key={sinif}
                      type="button"
                      className={`makine-chip tek-satir-chip ${formSinif === sinif ? 'aktif' : ''}`}
                      onClick={() => setFormSinif(sinif)}
                    >
                      {sinif}
                    </button>
                  ))}
                </div>
                {formSinif === 'Diğer' && (
                  <input
                    type="text"
                    placeholder="Beton sınıfını yazın (Örn: C40/50, C50/60, Şap...)"
                    value={formManuelSinif}
                    onChange={(e) => setFormManuelSinif(e.target.value)}
                    className="makine-input"
                    style={{ marginTop: 6 }}
                    required
                    autoFocus
                  />
                )}
              </div>

              {/* 5. Döküm Şekli (Seçenekler Tek Satırda) */}
              <div className="form-satir" style={{ marginBottom: 10 }}>
                <label className="alan-baslik" style={{ marginBottom: 4 }}>Döküm Şekli:</label>
                <div className="tek-satir-hap-grid dortlu">
                  {DOKUM_SEKILLERI.map(sekil => (
                    <button
                      key={sekil}
                      type="button"
                      className={`makine-chip tek-satir-chip ${formDokumSekli === sekil ? 'aktif' : ''}`}
                      onClick={() => setFormDokumSekli(sekil)}
                    >
                      {sekil}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setYeniDokumModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  Dökümü Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: HIZLI MİKSER EKLEME                                   */}
      {/* ============================================================ */}
      {mikserModalAcik && (
        <div className="modal-arka-plan" onClick={() => setMikserModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>🚚 Gelen Mikseri Kaydet</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setMikserModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleHizliMikserKaydet}>
              {/* Beton Hacmi (Gelen son araç default) */}
              <div className="form-satir">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="alan-baslik">Beton Hacmi (m³):</label>
                  <span className="cetvel-ipucu" style={{ margin: 0 }}>
                    💡 Son gelen araç default seçildi ({mikserHacim} m³)
                  </span>
                </div>

                <div className="makine-turu-haplari" style={{ marginBottom: 8 }}>
                  {[7, 8, 9, 10, 12].map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`makine-chip ${Number(mikserHacim) === h ? 'aktif' : ''}`}
                      onClick={() => setMikserHacim(h)}
                    >
                      {h} m³
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Veya serbest yazın:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="20"
                    value={mikserHacim}
                    onChange={(e) => setMikserHacim(parseFloat(e.target.value) || 0)}
                    className="makine-input"
                    style={{ maxWidth: 120, height: 38 }}
                    required
                  />
                  <span style={{ fontWeight: 600 }}>m³</span>
                </div>
              </div>

              {/* Numune Alındı Kutucuğu (İsteğe Bağlı) */}
              <div className="form-satir">
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: mikserKupAlindi ? '#f0fdf4' : '#f8fafc',
                    border: `1.5px solid ${mikserKupAlindi ? '#86efac' : '#cbd5e1'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    color: mikserKupAlindi ? '#15803d' : '#334155',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mikserKupAlindi}
                    onChange={(e) => setMikserKupAlindi(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  <span>🧪 Numune Alındı <small style={{ fontWeight: 500, color: '#64748b' }}>(İsteğe bağlı)</small></span>
                </label>
              </div>

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setMikserModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  Mikseri Çeteye Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
