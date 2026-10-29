import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { RobotoBase64 } from '../lib/fonts/RobotoRegular'

const bugun = () => new Date().toISOString().slice(0, 10)
const gunEkle = (t, n) => {
  const d = new Date(t + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const tarihGoster = (t) => {
  if (!t) return ''
  const d = new Date(t + 'T12:00:00')
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}
const tarihTamFormatTR = (t) => {
  if (!t) return ''
  const d = new Date(t + 'T12:00:00')
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
}

export default function Puantaj() {
  const { profile } = useAuth()
  const [sayfa, setSayfa] = useState('kayit') // 'kayit' | 'takvim' | 'toplam' | 'calisan_rapor' | 'isci_yonetim'

  // Şantiye şefi kontrolü: Serhat Hazar (Yönetici) değilse ve rolü santiye_sefi ise
  const isSantiyeSefi = Boolean(
    profile?.rol === 'santiye_sefi' &&
    !profile?.sistem_yoneticisi &&
    !profile?.ad_soyad?.toLowerCase().includes('serhat') &&
    !profile?.email?.toLowerCase().includes('serhat')
  )
  const isYonetici = !isSantiyeSefi

  useEffect(() => {
    // Şantiye şeflerinde 2-takvim matrisi, 3-dönem raporu, 4-çalışan raporu ve 5-işçi yönetimi görünmez
    if (isSantiyeSefi && sayfa !== 'kayit') {
      setSayfa('kayit')
    }
  }, [isSantiyeSefi, sayfa])

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isYonetici ? 14 : 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1D9596', letterSpacing: '-0.5px' }}>
            {isSantiyeSefi ? 'Puantaj & Günlük Yoklama' : 'Puantaj Yönetimi'}
          </h2>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            {isSantiyeSefi 
              ? 'Şantiyede çalışan ekiplerin hızlı katılım ve personel yoklama takibi' 
              : 'Tüm şantiyelerin günlük yoklama, takvim matrisi ve dönem raporları'}
          </span>
        </div>
      </div>      

      {/* Sadece Yönetici Serhat Hazar için 3 Ana Sekme Görünür */}
      {isYonetici && (
        <>
          <div className="tema-segment-bar uclu" style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setSayfa('kayit')}
              className={`tema-segment-btn ${(sayfa === 'kayit' || sayfa === 'takvim') ? 'aktif' : ''}`}
            >
              📋 Yoklama & Takvim
            </button>
            <button
              type="button"
              onClick={() => setSayfa(sayfa === 'calisan_rapor' ? 'calisan_rapor' : 'toplam')}
              className={`tema-segment-btn ${(sayfa === 'toplam' || sayfa === 'calisan_rapor') ? 'aktif' : ''}`}
            >
              📊 Raporlar
            </button>
            <button
              type="button"
              onClick={() => setSayfa('isci_yonetim')}
              className={`tema-segment-btn ${sayfa === 'isci_yonetim' ? 'aktif' : ''}`}
            >
              👷 İşçi Yönetimi
            </button>
          </div>

          {/* Yoklama & Takvim Alt Geçiş Çubuğu */}
          {(sayfa === 'kayit' || sayfa === 'takvim') && (
            <div className="tema-segment-bar" style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setSayfa('kayit')}
                className={`tema-segment-btn ${sayfa === 'kayit' ? 'aktif' : ''}`}
              >
                ✓ Günlük Yoklama Girişi
              </button>
              <button
                type="button"
                onClick={() => setSayfa('takvim')}
                className={`tema-segment-btn ${sayfa === 'takvim' ? 'aktif' : ''}`}
              >
                📅 Aylık Takvim Matrisi
              </button>
            </div>
          )}

          {/* Raporlar Alt Geçiş Çubuğu */}
          {(sayfa === 'toplam' || sayfa === 'calisan_rapor') && (
            <div className="tema-segment-bar" style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setSayfa('toplam')}
                className={`tema-segment-btn ${sayfa === 'toplam' ? 'aktif' : ''}`}
              >
                🏢 Dönem & Taşeron Raporu
              </button>
              <button
                type="button"
                onClick={() => setSayfa('calisan_rapor')}
                className={`tema-segment-btn ${sayfa === 'calisan_rapor' ? 'aktif' : ''}`}
              >
                👷 Çalışan Yevmiye Raporu
              </button>
            </div>
          )}
        </>
      )}
      
      {sayfa === 'kayit' && <PuantajKayitEkleme isSantiyeSefi={isSantiyeSefi} isYonetici={isYonetici} />}
      {isYonetici && sayfa === 'takvim' && <PuantajTakvimGozlem />}
      {isYonetici && sayfa === 'toplam' && <PuantajToplam />}
      {isYonetici && sayfa === 'calisan_rapor' && <PuantajCalisanRapor />}
      {isYonetici && sayfa === 'isci_yonetim' && <PuantajCalisanKayit />}
    </div>
  )
}

// ============================================================
// 1- HIZLI YOKLAMA / KAYIT (ŞANTİYE SEÇ -> EKİP SEÇ -> PUANTAJ AL)
// ============================================================
const LOCAL_STORAGE_PASIF_ISCILER = 'santiye_pasif_isciler_v1'

function PuantajKayitEkleme({ isSantiyeSefi, isYonetici }) {
  const { aktifSantiye, santiyeler } = useSite()
  
  // Varsayılan olarak her zaman bugünün tarihi gösterilir
  const [tarih, setTarih] = useState(bugun())
  
  // 1. ADIM: Şantiye seçimi (Tıklanabilir hap/kart butonlar ile kolay seçim)
  const [seciliSantiyeId, setSeciliSantiyeId] = useState(aktifSantiye?.id || (santiyeler[0]?.id || ''))
  
  // 2. ADIM: Şantiyedeki seçili ekip / taşeron (null ise ekipler döşemesi, seçilirse o ekibin puantaj paneli açılır)
  const [seciliTaseronId, setSeciliTaseronId] = useState(null)
  
  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeleri, setTaseronSantiyeleri] = useState([])
  const [calisanlar, setCalisanlar] = useState([])
  const [kayitlar, setKayitlar] = useState([])
  const [calisanKayitlari, setCalisanKayitlari] = useState([])
  const [calisanToplamPuantaj, setCalisanToplamPuantaj] = useState({})

  // Pasif işçi listesi (Geçmiş kayıtları ASLA silmez, sadece gelecekteki yoklamada gizler)
  const [pasifIsciIds, setPasifIsciIds] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PASIF_ISCILER)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [pasifGoster, setPasifGoster] = useState(false)

  // Yeni ekip / taşeron dahil etme modalı
  const [ekipEkleModalAcik, setEkipEkleModalAcik] = useState(false)
  const [secilenRehberTaseronId, setSecilenRehberTaseronId] = useState('')
  const [yeniManuelEkipAdi, setYeniManuelEkipAdi] = useState('')
  const [yeniManuelEkipSifat, setYeniManuelEkipSifat] = useState('')

  // Yönetici Ekip Düzenleme Modalı
  const [ekipDuzenleModalAcik, setEkipDuzenleModalAcik] = useState(false)
  const [duzenlenenEkip, setDuzenlenenEkip] = useState(null)
  const [duzenleEkipAdi, setDuzenleEkipAdi] = useState('')
  const [duzenleEkipSifat, setDuzenleEkipSifat] = useState('')

  // Yönetici Ekip Silme / Şantiyeden Çıkarma Modalı
  const [ekipSilModalAcik, setEkipSilModalAcik] = useState(false)
  const [silinecekEkip, setSilinecekEkip] = useState(null)
  const [silmeYukleniyor, setSilmeYukleniyor] = useState(false)

  // Hızlı çalışan ekleme form state
  const [yeniCalisanAdi, setYeniCalisanAdi] = useState('')
  const [yeniCalisanSifat, setYeniCalisanSifat] = useState('')

  // Aktif şantiye yüklendiğinde otomatik seç
  useEffect(() => {
    if (aktifSantiye && !seciliSantiyeId) {
      setSeciliSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  useEffect(() => {
    // 1. Taşeronları yükle
    supabase
      .from('taseronlar')
      .select('*')
      .neq('puantajda_goster', false)
      .order('ad')
      .then(({ data }) => setTaseronlar(data || []))

    // 2. Taşeron - Şantiye ilişkilerini yükle
    supabase
      .from('taseron_santiyeler')
      .select('taseron_id, santiye_id')
      .then(({ data }) => setTaseronSantiyeleri(data || []))

    // 3. Çalışanları yükle
    supabase
      .from('taseron_calisanlari')
      .select('*')
      .order('ad_soyad')
      .then(({ data }) => setCalisanlar(data || []))

    // 4. Çalışanların tüm zamanlardaki puantaj sıklığını hesapla (En çok gelen çalışan en üstte çıksın!)
    supabase
      .from('puantaj_calisan_kayitlari')
      .select('calisan_id')
      .then(({ data }) => {
        const sayac = {}
        ;(data || []).forEach(row => {
          if (row.calisan_id) {
            sayac[row.calisan_id] = (sayac[row.calisan_id] || 0) + 1
          }
        })
        setCalisanToplamPuantaj(sayac)
      })

    // 5. Pasife alınan işçiler listesini Supabase sistem_ayarlari tablosundan senkronize et
    supabase
      .from('sistem_ayarlari')
      .select('deger')
      .eq('anahtar', LOCAL_STORAGE_PASIF_ISCILER)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.deger) {
          try {
            const bulutPasifler = JSON.parse(data.deger)
            if (Array.isArray(bulutPasifler)) {
              setPasifIsciIds(bulutPasifler)
              localStorage.setItem(LOCAL_STORAGE_PASIF_ISCILER, JSON.stringify(bulutPasifler))
            }
          } catch (e) {
            console.error(e)
          }
        } else {
          // Bulutta henüz yoksa ve yerelde varsa buluta aktar
          try {
            const yerelStr = localStorage.getItem(LOCAL_STORAGE_PASIF_ISCILER)
            const yerelArr = yerelStr ? JSON.parse(yerelStr) : []
            if (Array.isArray(yerelArr) && yerelArr.length > 0) {
              supabase.from('sistem_ayarlari').upsert(
                { anahtar: LOCAL_STORAGE_PASIF_ISCILER, deger: JSON.stringify(yerelArr) },
                { onConflict: 'anahtar' }
              ).then(() => {})
            }
          } catch (e) {
            console.error(e)
          }
        }
      })
  }, [])

  useEffect(() => {
    kayitlariYukle()
  }, [tarih, seciliSantiyeId])

  const kayitlariYukle = async () => {
    if (!seciliSantiyeId) return

    let sorgu = supabase
      .from('puantaj_kayitlari')
      .select('*, taseronlar(ad, sifat), santiyeler(ad)')
      .eq('tarih', tarih)
      .eq('santiye_id', seciliSantiyeId)

    const { data, error } = await sorgu
    if (error) { 
      console.error('Puantaj yüklenemedi:', error)
      return 
    }
    setKayitlar(data || [])

    let ck = supabase
      .from('puantaj_calisan_kayitlari')
      .select('*')
      .eq('tarih', tarih)
      .eq('santiye_id', seciliSantiyeId)

    const { data: ckData } = await ck
    setCalisanKayitlari(ckData || [])
  }

  // İmalat kalemleri / Ekipler için dinamik simge
  const getEkipSimgesi = (ad = '', sifat = '') => {
    const metin = (ad + ' ' + sifat).toLocaleLowerCase('tr-TR')
    if (metin.includes('kalıp') || metin.includes('kalip')) return '🔨'
    if (metin.includes('demir')) return '🔩'
    if (metin.includes('duvar') || metin.includes('sıva') || metin.includes('siva') || metin.includes('boya')) return '🧱'
    if (metin.includes('elektrik')) return '⚡'
    if (metin.includes('tesisat') || metin.includes('su') || metin.includes('mekanik')) return '💧'
    if (metin.includes('hafriyat') || metin.includes('kepçe') || metin.includes('kamyon')) return '🚜'
    if (metin.includes('çatı') || metin.includes('izolasyon')) return '🏠'
    if (metin.includes('diğer') || metin.includes('diger') || metin.includes('gündelik')) return '📦'
    return '👷'
  }

  // SADECE rehberde bu şantiyeye atanmış olan gerçek imalat ekipleri / taşeronlar (DİĞER ekibi kart olarak eklenmez)
  const santiyeEkipleri = useMemo(() => {
    if (!seciliSantiyeId) return []

    // Şirket rehberinde (taseron_santiyeler) bu şantiyeye atanmış taşeron ID'leri
    const tanimliTaseronIds = new Set(
      taseronSantiyeleri.filter(ts => ts.santiye_id === seciliSantiyeId).map(ts => ts.taseron_id)
    )

    return taseronlar
      .filter(t => tanimliTaseronIds.has(t.id))
      .filter(t => {
        const ad = t.ad?.trim().toLocaleUpperCase('tr-TR')
        return ad !== 'DİĞER' && ad !== 'DIGER'
      })
  }, [seciliSantiyeId, taseronlar, taseronSantiyeleri])

  // Şantiye geneli gündelikçi / diğer personeller için görünmez taseron kaydı
  const getDigerTaseron = async () => {
    let digerT = taseronlar.find(t => 
      t.ad?.trim().toLocaleUpperCase('tr-TR') === 'DİĞER' || 
      t.ad?.trim().toLocaleUpperCase('tr-TR') === 'DIGER'
    )
    if (!digerT) {
      const { data: yeniDiger } = await supabase.from('taseronlar').insert({
        ad: 'DİĞER',
        sifat: 'Genel Gündelikçi',
        puantajda_goster: false,
        sef_gorunur: false
      }).select().single()
      if (yeniDiger) {
        digerT = yeniDiger
        setTaseronlar(prev => [...prev, digerT])
      }
    }
    return digerT
  }

  // Şantiye geneli diğer / gündelikçi sayısı
  const genelDigerSayisi = useMemo(() => {
    const digerT = taseronlar.find(t => 
      t.ad?.trim().toLocaleUpperCase('tr-TR') === 'DİĞER' || 
      t.ad?.trim().toLocaleUpperCase('tr-TR') === 'DIGER'
    )
    if (!digerT) return 0
    const kayit = kayitlar.find(k => k.santiye_id === seciliSantiyeId && k.taseron_id === digerT.id)
    return kayit?.diger_sayisi || 0
  }, [kayitlar, seciliSantiyeId, taseronlar])

  // Şantiye geneli diğer / gündelikçi (+ / -) tıklama
  const handleGenelDigerDegistir = async (delta) => {
    const digerT = await getDigerTaseron()
    if (!digerT) return
    const kayit = await getOrCreateKayit(digerT.id)
    if (!kayit) return
    const yeniSayi = Math.max(0, (kayit.diger_sayisi || 0) + delta)
    setKayitlar(prev => prev.map(k => k.id === kayit.id ? { ...k, diger_sayisi: yeniSayi } : k))
    await supabase.from('puantaj_kayitlari').update({ diger_sayisi: yeniSayi }).eq('id', kayit.id)
  }

  // Rehberde bu şantiyeye tanımlanmış tüm taşeronlar
  const santiyeRehberTaseronlari = useMemo(() => {
    if (!seciliSantiyeId) return []
    const tanimliIds = new Set(taseronSantiyeleri.filter(ts => ts.santiye_id === seciliSantiyeId).map(ts => ts.taseron_id))
    return taseronlar.filter(t => tanimliIds.has(t.id))
  }, [seciliSantiyeId, taseronlar, taseronSantiyeleri])

  // Henüz ekranda gösterilmeyen (eklenebilecek) rehber taşeronları
  const eklenebilirRehberTaseronlari = useMemo(() => {
    return santiyeRehberTaseronlari.filter(t => !santiyeEkipleri.some(se => se.id === t.id))
  }, [santiyeRehberTaseronlari, santiyeEkipleri])

  // Şantiyede bugün çalışan toplam kişi sayısı
  const toplamSantiyeKisi = useMemo(() => {
    const isimliler = calisanKayitlari.filter(c => c.santiye_id === seciliSantiyeId).length
    const digerler = kayitlar
      .filter(k => k.santiye_id === seciliSantiyeId)
      .reduce((toplam, k) => toplam + (k.diger_sayisi || 0), 0)
    return isimliler + digerler
  }, [calisanKayitlari, kayitlar, seciliSantiyeId])

  // Gerekli durumda puantaj_kayitlari satırını otomatik al veya oluştur
  const getOrCreateKayit = async (taseronId) => {
    let tId = taseronId
    let mevcut = kayitlar.find(k => k.santiye_id === seciliSantiyeId && k.taseron_id === tId)
    if (mevcut) return mevcut

    // Yoksa arka planda sessizce oluştur
    const { data: yeniKayit, error } = await supabase.from('puantaj_kayitlari').insert({
      santiye_id: seciliSantiyeId,
      taseron_id: tId,
      tarih,
      kisi_sayisi: 0,
      diger_sayisi: 0
    }).select('*, taseronlar(ad, sifat), santiyeler(ad)').single()

    if (!error && yeniKayit) {
      setKayitlar(prev => [...prev, yeniKayit])
      return yeniKayit
    }
    return null
  }

  // ÇALIŞAN TIKLAMA (Tek dokunuşla Geldi / Gelmedi)
  const handleCalisanTikle = async (taseronId, calisanId) => {
    const kayit = await getOrCreateKayit(taseronId)
    if (!kayit) return

    const tId = kayit.taseron_id
    const mevcutCk = calisanKayitlari.find(
      c => c.santiye_id === seciliSantiyeId && c.taseron_id === tId && c.calisan_id === calisanId
    )

    if (mevcutCk) {
      // Kaldır
      setCalisanKayitlari(prev => prev.filter(c => c.id !== mevcutCk.id))
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('id', mevcutCk.id)
    } else {
      // Ekle
      const gecici = { id: `gecici-${calisanId}`, santiye_id: seciliSantiyeId, taseron_id: tId, calisan_id: calisanId, tarih }
      setCalisanKayitlari(prev => [...prev, gecici])
      const { data, error } = await supabase.from('puantaj_calisan_kayitlari').insert({
        santiye_id: seciliSantiyeId,
        taseron_id: tId,
        calisan_id: calisanId,
        tarih
      }).select().single()

      if (error) {
        alert('İşaretlenemedi: ' + error.message)
        kayitlariYukle()
        return
      }
      setCalisanKayitlari(prev => prev.map(c => c.id === gecici.id ? data : c))
    }
  }

  // TÜM EKİP GELDİ (1 Dokunuşla Ekibin Tamamını İşaretle / Kaldır)
  const handleTumEkipGeldi = async (taseronId, aktifCalisanlar) => {
    if (aktifCalisanlar.length === 0) return
    const kayit = await getOrCreateKayit(taseronId)
    if (!kayit) return

    const tId = kayit.taseron_id
    const seciliCalisanIds = calisanKayitlari
      .filter(c => c.santiye_id === seciliSantiyeId && c.taseron_id === tId)
      .map(c => c.calisan_id)

    const hepsiGeldiMi = aktifCalisanlar.every(c => seciliCalisanIds.includes(c.id))

    if (hepsiGeldiMi) {
      // Hepsini kaldır
      const kaldirilacaklar = calisanKayitlari.filter(
        c => c.santiye_id === seciliSantiyeId && c.taseron_id === tId
      )
      const ids = kaldirilacaklar.map(c => c.id)
      setCalisanKayitlari(prev => prev.filter(c => !ids.includes(c.id)))
      await supabase.from('puantaj_calisan_kayitlari').delete().in('id', ids)
    } else {
      // Eksik olanları ekle
      const eksikler = aktifCalisanlar.filter(c => !seciliCalisanIds.includes(c.id))
      const yeniRows = eksikler.map(c => ({
        santiye_id: seciliSantiyeId,
        taseron_id: tId,
        calisan_id: c.id,
        tarih
      }))
      const { data } = await supabase.from('puantaj_calisan_kayitlari').insert(yeniRows).select()
      if (data) {
        setCalisanKayitlari(prev => [...prev, ...data])
      }
    }
  }

  // HIZLI İŞÇİ EKLEME (Doğrudan Ekip İçinde Ekle & Hemen Geldi Yap)
  const handleYeniIsciEkle = async (taseronId) => {
    const ad = yeniCalisanAdi.trim().toLocaleUpperCase('tr-TR')
    const sifat = yeniCalisanSifat.trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const tamAd = sifat ? `${ad} (${sifat})` : ad

    const kayit = await getOrCreateKayit(taseronId)
    const tId = kayit?.taseron_id || taseronId

    const { data: yeniIsci, error } = await supabase.from('taseron_calisanlari').insert({
      taseron_id: tId,
      santiye_id: seciliSantiyeId,
      ad_soyad: tamAd
    }).select().single()

    if (error) {
      alert('İşçi eklenemedi: ' + error.message)
      return
    }

    setCalisanlar(prev => [...prev, yeniIsci])
    setYeniCalisanAdi('')
    setYeniCalisanSifat('')

    // Eklenen işçiyi bugünkü yoklamada hemen "Geldi" yap
    const { data: ck } = await supabase.from('puantaj_calisan_kayitlari').insert({
      santiye_id: seciliSantiyeId,
      taseron_id: tId,
      calisan_id: yeniIsci.id,
      tarih
    }).select().single()

    if (ck) {
      setCalisanKayitlari(prev => [...prev, ck])
    }
  }

  // PASİFE ALMA / AKTİFE ALMA (GEÇMİŞ KAYITLARI ASLA SİLMEZ, GELECEKTE GİZLER — SUPABASE SENKRONİZE)
  const handlePasifeAlToggle = (calisanId, adSoyad) => {
    const pasifMi = pasifIsciIds.includes(calisanId)
    let yeni = pasifIsciIds
    if (!pasifMi) {
      const onay = window.confirm(
        `"${adSoyad}" isimli personeli pasife almak istiyor musunuz?\n\n` +
        `💡 GEÇMİŞ KORUMASI: Geçmiş günlerdeki puantaj kayıtları ve raporları eksiksiz korunur. Sadece bugünden sonraki yoklama listesinde yer kaplamaz.`
      )
      if (!onay) return

      yeni = [...pasifIsciIds, calisanId]
    } else {
      yeni = pasifIsciIds.filter(id => id !== calisanId)
    }

    setPasifIsciIds(yeni)
    const jsonStr = JSON.stringify(yeni)
    try {
      localStorage.setItem(LOCAL_STORAGE_PASIF_ISCILER, jsonStr)
    } catch (e) {
      console.error(e)
    }
    supabase
      .from('sistem_ayarlari')
      .upsert({ anahtar: LOCAL_STORAGE_PASIF_ISCILER, deger: jsonStr }, { onConflict: 'anahtar' })
      .then(() => {})
  }

  // İSİMSİZ / GÜNDELİKÇİ SAYISI STEPPER
  const handleDigerSayisiDegistir = async (taseronId, delta) => {
    const kayit = await getOrCreateKayit(taseronId)
    if (!kayit) return
    const yeniSayi = Math.max(0, (kayit.diger_sayisi || 0) + delta)
    setKayitlar(prev => prev.map(k => k.id === kayit.id ? { ...k, diger_sayisi: yeniSayi } : k))
    await supabase.from('puantaj_kayitlari').update({ diger_sayisi: yeniSayi }).eq('id', kayit.id)
  }

  // ŞANTİYEYE YENİ EKİP / TAŞERON DAHİL ET
  const handleSantiyeEkipEkle = async () => {
    if (!seciliSantiyeId) return

    let eklenecekId = secilenRehberTaseronId

    // Eğer yeni manuel bir ekip yazıldıysa önce taşeronlar tablosuna ekle
    if (!eklenecekId && yeniManuelEkipAdi.trim()) {
      const { data: yeniT, error: tHata } = await supabase.from('taseronlar').insert({
        ad: yeniManuelEkipAdi.trim(),
        sifat: yeniManuelEkipSifat.trim() || 'İmalat Ekibi',
        sef_gorunur: true,
        puantajda_goster: true
      }).select().single()

      if (tHata) {
        alert('Ekip oluşturulamadı: ' + tHata.message)
        return
      }
      setTaseronlar(prev => [...prev, yeniT])
      eklenecekId = yeniT.id
    }

    if (!eklenecekId) {
      alert('Lütfen rehberden bir taşeron seçin veya yeni bir ekip adı girin.')
      return
    }

    // Şantiye ilişkisini veritabanına ekle
    const varMi = taseronSantiyeleri.some(ts => ts.taseron_id === eklenecekId && ts.santiye_id === seciliSantiyeId)
    if (!varMi) {
      await supabase.from('taseron_santiyeler').insert({ taseron_id: eklenecekId, santiye_id: seciliSantiyeId })
      setTaseronSantiyeleri(prev => [...prev, { taseron_id: eklenecekId, santiye_id: seciliSantiyeId }])
    }

    setSecilenRehberTaseronId('')
    setYeniManuelEkipAdi('')
    setYeniManuelEkipSifat('')
    setEkipEkleModalAcik(false)
    setSeciliTaseronId(eklenecekId) // Doğrudan o ekibin puantajını aç
  }

  // --- YÖNETİCİ EKİP VE ÇALIŞAN YÖNETİM AKSİYONLARI ---
  const handleEkipDuzenleBaslat = (ekip) => {
    setDuzenlenenEkip(ekip)
    setDuzenleEkipAdi(ekip.ad || '')
    setDuzenleEkipSifat(ekip.sifat || '')
    setEkipDuzenleModalAcik(true)
  }

  const handleEkipDuzenleKaydet = async () => {
    if (!duzenlenenEkip || !duzenleEkipAdi.trim()) {
      alert('Lütfen ekip adını giriniz.')
      return
    }
    const yeniAd = duzenleEkipAdi.trim()
    const yeniSifat = duzenleEkipSifat.trim() || 'İmalat Ekibi'

    const { error } = await supabase
      .from('taseronlar')
      .update({ ad: yeniAd, sifat: yeniSifat })
      .eq('id', duzenlenenEkip.id)

    if (error) {
      alert('Ekip güncellenemedi: ' + error.message)
      return
    }

    setTaseronlar(prev => prev.map(t => t.id === duzenlenenEkip.id ? { ...t, ad: yeniAd, sifat: yeniSifat } : t))
    setKayitlar(prev => prev.map(k => k.taseron_id === duzenlenenEkip.id ? {
      ...k,
      taseronlar: { ...k.taseronlar, ad: yeniAd, sifat: yeniSifat }
    } : k))

    setEkipDuzenleModalAcik(false)
    setDuzenlenenEkip(null)
  }

  const handleEkipSilBaslat = (ekip) => {
    setSilinecekEkip(ekip)
    setEkipSilModalAcik(true)
  }

  const handleEkipSantiyedenCikar = async () => {
    if (!silinecekEkip || !seciliSantiyeId) return
    setSilmeYukleniyor(true)
    try {
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('santiye_id', seciliSantiyeId).eq('taseron_id', silinecekEkip.id)
      await supabase.from('puantaj_kayitlari').delete().eq('santiye_id', seciliSantiyeId).eq('taseron_id', silinecekEkip.id)
      await supabase.from('taseron_santiyeler').delete().eq('santiye_id', seciliSantiyeId).eq('taseron_id', silinecekEkip.id)

      setTaseronSantiyeleri(prev => prev.filter(ts => !(ts.santiye_id === seciliSantiyeId && ts.taseron_id === silinecekEkip.id)))
      setKayitlar(prev => prev.filter(k => !(k.santiye_id === seciliSantiyeId && k.taseron_id === silinecekEkip.id)))
      setCalisanKayitlari(prev => prev.filter(c => !(c.santiye_id === seciliSantiyeId && c.taseron_id === silinecekEkip.id)))

      if (seciliTaseronId === silinecekEkip.id) {
        setSeciliTaseronId(null)
      }
      setEkipSilModalAcik(false)
      setSilinecekEkip(null)
    } catch (err) {
      alert('Şantiyeden çıkarılırken hata oluştu: ' + (err.message || err))
    } finally {
      setSilmeYukleniyor(false)
    }
  }

  const handleEkipTamamenSil = async () => {
    if (!silinecekEkip) return
    const onay = window.confirm(`DİKKAT: "${silinecekEkip.ad}" ekibi ve bu ekibe ait tüm kayıtlar (tüm şantiyelerdeki puantajlar, çalışanlar, şantiye atamaları ve şirket rehberi kartı) kalıcı olarak silinecektir.\n\nOnaylıyor musunuz?`)
    if (!onay) return

    setSilmeYukleniyor(true)
    try {
      const eId = silinecekEkip.id

      await supabase.from('puantaj_calisan_kayitlari').delete().eq('taseron_id', eId)
      await supabase.from('puantaj_kayitlari').delete().eq('taseron_id', eId)
      await supabase.from('taseron_calisanlari').delete().eq('taseron_id', eId)
      await supabase.from('taseron_santiyeler').delete().eq('taseron_id', eId)
      await supabase.from('taseron_notlari').delete().eq('taseron_id', eId)

      const { error } = await supabase.from('taseronlar').delete().eq('id', eId)
      if (error) {
        throw error
      }

      setTaseronlar(prev => prev.filter(t => t.id !== eId))
      setTaseronSantiyeleri(prev => prev.filter(ts => ts.taseron_id !== eId))
      setCalisanlar(prev => prev.filter(c => c.taseron_id !== eId))
      setKayitlar(prev => prev.filter(k => k.taseron_id !== eId))
      setCalisanKayitlari(prev => prev.filter(c => c.taseron_id !== eId))

      if (seciliTaseronId === eId) {
        setSeciliTaseronId(null)
      }
      setEkipSilModalAcik(false)
      setSilinecekEkip(null)
    } catch (err) {
      alert('Ekip tamamen silinirken hata oluştu: ' + (err.message || err))
    } finally {
      setSilmeYukleniyor(false)
    }
  }

  const handleCalisanDuzenle = async (calisanId, mevcutAd) => {
    const yeniAd = window.prompt('Çalışanın yeni Adını ve Görevini giriniz:', mevcutAd)
    if (!yeniAd || !yeniAd.trim() || yeniAd.trim() === mevcutAd) return

    const formatliAd = yeniAd.trim().toLocaleUpperCase('tr-TR')
    const { error } = await supabase
      .from('taseron_calisanlari')
      .update({ ad_soyad: formatliAd })
      .eq('id', calisanId)

    if (error) {
      alert('Çalışan güncellenemedi: ' + error.message)
      return
    }

    setCalisanlar(prev => prev.map(c => c.id === calisanId ? { ...c, ad_soyad: formatliAd } : c))
  }

  const handleCalisanSil = async (calisanId, adSoyad) => {
    if (!window.confirm(`"${adSoyad}" isimli çalışanı silmek istediğinize emin misiniz? (Bu çalışanın bu şantiyedeki puantaj yoklamaları da silinir)`)) return

    try {
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('calisan_id', calisanId)
      const { error } = await supabase.from('taseron_calisanlari').delete().eq('id', calisanId)
      if (error) {
        alert('Çalışan silinemedi: ' + error.message)
        return
      }

      setCalisanlar(prev => prev.filter(c => c.id !== calisanId))
      setCalisanKayitlari(prev => prev.filter(c => c.calisan_id !== calisanId))
    } catch (err) {
      alert('Hata oluştu: ' + (err.message || err))
    }
  }

  // Şu an seçili olan ekip nesnesi
  const seciliEkip = santiyeEkipleri.find(e => e.id === seciliTaseronId)

  // Seçili ekibin çalışanları (Aktifler ve Pasifler ayrılmış; En çok puantajı alınanlar en üstte!)
  const { aktifCalisanlar, pasifCalisanlar } = useMemo(() => {
    if (!seciliTaseronId || !seciliSantiyeId) return { aktifCalisanlar: [], pasifCalisanlar: [] }

    const tId = seciliTaseronId
    const ekipCalisanlari = calisanlar.filter(c => c.taseron_id === tId && c.santiye_id === seciliSantiyeId)

    const aktifler = []
    const pasifler = []

    ekipCalisanlari.forEach(c => {
      if (pasifIsciIds.includes(c.id)) {
        pasifler.push(c)
      } else {
        aktifler.push(c)
      }
    })

    // EN ÇOK PUANTAJI ALINANLARA GÖRE DİZ (Kullanıcının talep ettiği sıralama)
    const frekansaGoreSirala = (a, b) => {
      const aSayi = calisanToplamPuantaj[a.id] || 0
      const bSayi = calisanToplamPuantaj[b.id] || 0
      if (bSayi !== aSayi) return bSayi - aSayi // Çok gelen en üstte
      return (a.ad_soyad || '').localeCompare(b.ad_soyad || '', 'tr')
    }

    aktifler.sort(frekansaGoreSirala)
    pasifler.sort(frekansaGoreSirala)

    return { aktifCalisanlar: aktifler, pasifCalisanlar: pasifler }
  }, [seciliTaseronId, seciliSantiyeId, seciliEkip, taseronlar, calisanlar, pasifIsciIds, calisanToplamPuantaj])

  // Seçili ekibin bugünkü puantaj kaydı ve gelen sayısı
  const seciliEkipKaydi = kayitlar.find(k => k.santiye_id === seciliSantiyeId && k.taseron_id === seciliTaseronId)
  const seciliEkipGelenIsciSayisi = calisanKayitlari.filter(c => c.santiye_id === seciliSantiyeId && c.taseron_id === seciliEkipKaydi?.taseron_id).length
  const seciliEkipDigerSayisi = seciliEkipKaydi?.diger_sayisi || 0
  const seciliEkipToplamKisi = seciliEkipGelenIsciSayisi + seciliEkipDigerSayisi

  return (
    <div>
      {/* 1. ÜST PANEL: TARİH KONTROLÜ (VARSAYILAN: BUGÜN) */}
      <div style={{
        background: '#FFFFFF',
        border: '1.5px solid #1D9596',
        borderRadius: 14,
        padding: '12px 16px',
        marginBottom: 14,
        boxShadow: '0 2px 8px rgba(29, 149, 150, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#117575', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              YOKLAMA TARİHİ:
            </span>
            {tarih === bugun() ? (
              <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                ✓ Bugün
              </span>
            ) : (
              <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                ⏳ Farklı Gün
              </span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>
            {tarihTamFormatTR(tarih)}
          </div>
        </div>

        {/* Hızlı Gün Değiştirme Butonları (Sabit & Zıplamayan Grup) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#F1F5F9',
            padding: '3px',
            borderRadius: 10,
            gap: 3,
            border: '1px solid #E2E8F0'
          }}>
            <button
              type="button"
              onClick={() => setTarih(gunEkle(tarih, -1))}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155',
                minWidth: 64,
                textAlign: 'center',
                transition: 'all 0.15s'
              }}
              title="Önceki Gün (Geri)"
            >
              ◀ Geri
            </button>
            <button
              type="button"
              onClick={() => setTarih(bugun())}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: tarih === bugun() ? '1.5px solid #1D9596' : '1px solid #CBD5E1',
                background: tarih === bugun() ? 'linear-gradient(135deg, #1D9596, #147B7C)' : '#FFFFFF',
                color: tarih === bugun() ? '#FFFFFF' : '#0F766E',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                minWidth: 70,
                textAlign: 'center',
                boxShadow: tarih === bugun() ? '0 2px 6px rgba(29, 149, 150, 0.25)' : 'none',
                transition: 'all 0.15s'
              }}
              title="Bugünün Tarihine Git"
            >
              {tarih === bugun() ? '✓ Bugün' : 'Bugün'}
            </button>
            <button
              type="button"
              onClick={() => setTarih(gunEkle(tarih, 1))}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155',
                minWidth: 64,
                textAlign: 'center',
                transition: 'all 0.15s'
              }}
              title="Sonraki Gün (İleri)"
            >
              İleri ▶
            </button>
          </div>

          <input
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 12,
              fontWeight: 600,
              background: '#FFF',
              color: '#1E293B',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>

      {/* 2. ADIM: ŞANTİYE SEÇİMİ (TEK SEFERDE HEPSİ GÖRÜNÜR) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            1. ŞANTİYE SEÇİN ({santiyeler.length}):
          </span>
          {seciliSantiyeId && (
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1D9596' }}>
              👥 Bugün Sahada: {toplamSantiyeKisi} Kişi
            </span>
          )}
        </div>

        {/* Tıklanabilir Şantiye Izgarası (Yana kayma yok, tek seferde hepsi görünür) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8
        }}>
          {santiyeler.map(s => {
            const secili = s.id === seciliSantiyeId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSeciliSantiyeId(s.id)
                  setSeciliTaseronId(null) // Farklı şantiye seçilince ekip ekranını ana grid'e getir
                }}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: secili ? '2px solid #1D9596' : '1.5px solid #E2E8F0',
                  background: secili ? 'linear-gradient(135deg, #1D9596, #147B7C)' : '#FFFFFF',
                  color: secili ? '#FFFFFF' : '#334155',
                  fontWeight: secili ? 800 : 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  boxShadow: secili ? '0 4px 12px rgba(29, 149, 150, 0.25)' : '0 1px 3px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 16 }}>🏗️</span>
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: secili ? 800 : 700
                  }}>
                    {s.ad}
                  </span>
                </div>
                {secili && (
                  <span style={{
                    fontSize: 10,
                    background: 'rgba(255,255,255,0.25)',
                    padding: '2px 6px',
                    borderRadius: 6,
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    ✓ Seçili
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. ADIM: ŞANTİYEDEKİ EKİPLER / İMALAT KALEMLERİ VE PUANTAJ ALMA */}
      {seciliSantiyeId && (
        <div>
          {/* A) EKİP SEÇİLMEMİŞSE: EKİPLER DÖŞEMESİNİ GÖSTER */}
          {!seciliTaseronId ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    2. ŞANTİYEDEKİ EKİPLER / İMALAT KALEMLERİ:
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                    Puantaj almak istediğiniz ekibe tıklayın:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEkipEkleModalAcik(true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1.5px dashed #1D9596',
                    background: '#F0FDFA',
                    color: '#0F766E',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  ➕ Başka Ekip / Taşeron Ekle
                </button>
              </div>

              {/* GÜNDELİKÇİ / DİĞER ÇALIŞANLAR STEPPERI (+ / -) */}
              <div style={{
                background: genelDigerSayisi > 0 ? '#F0FDF4' : '#FFFFFF',
                border: genelDigerSayisi > 0 ? '1.5px solid #86EFAC' : '1px solid #E2E8F0',
                borderRadius: 12,
                padding: '10px 16px',
                marginBottom: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: genelDigerSayisi > 0 ? '#DCFCE7' : '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18
                  }}>
                    👷
                  </div>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: '#1E293B', display: 'block' }}>
                      Gündelikçi / Diğer Çalışanlar (+ / -)
                    </span>
                    <span style={{ fontSize: 11.5, color: '#64748B' }}>
                      Herhangi bir ekibe bağlı olmayan günübirlik personeller
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleGenelDigerDegistir(-1)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      background: '#FFF',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: 18,
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="1 Azalt"
                  >
                    -
                  </button>
                  <span style={{
                    fontSize: 17,
                    fontWeight: 900,
                    minWidth: 32,
                    textAlign: 'center',
                    color: genelDigerSayisi > 0 ? '#15803D' : '#64748B'
                  }}>
                    {genelDigerSayisi}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGenelDigerDegistir(1)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: '1.5px solid #1D9596',
                      background: '#F0FDFA',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: 18,
                      color: '#117575',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="1 Arttır"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Ekip Kartları Izgarası */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 16 }}>
                {santiyeEkipleri.map((ekip) => {
                  const simge = getEkipSimgesi(ekip.ad, ekip.sifat)
                  
                  // Bu ekibin bugünkü yoklama durumu
                  const eKayit = kayitlar.find(k => k.santiye_id === seciliSantiyeId && k.taseron_id === ekip.id)
                  const gelenSayisi = calisanKayitlari.filter(c => c.santiye_id === seciliSantiyeId && c.taseron_id === eKayit?.taseron_id).length
                  const dSayisi = eKayit?.diger_sayisi || 0
                  const toplamGeldi = gelenSayisi + dSayisi
                  
                  const kayitliIsciSayisi = calisanlar.filter(c => c.taseron_id === ekip.id && c.santiye_id === seciliSantiyeId && !pasifIsciIds.includes(c.id)).length

                  return (
                    <div
                      key={ekip.id}
                      onClick={() => setSeciliTaseronId(ekip.id)}
                      style={{
                        background: '#FFFFFF',
                        border: toplamGeldi > 0 ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                        borderRadius: 14,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 110
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: toplamGeldi > 0 ? '#DCFCE7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {simge}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#1E293B', display: 'block', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ekip.ad}
                          </span>
                          <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                            {ekip.sifat || 'İmalat Ekibi'}
                          </span>
                        </div>
                        {isYonetici && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEkipDuzenleBaslat(ekip)
                              }}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #CBD5E1',
                                borderRadius: 6,
                                padding: '3px 6px',
                                fontSize: 11,
                                cursor: 'pointer',
                                color: '#475569'
                              }}
                              title="Ekip Bilgilerini Düzenle"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEkipSilBaslat(ekip)
                              }}
                              style={{
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: 6,
                                padding: '3px 6px',
                                fontSize: 11,
                                cursor: 'pointer',
                                color: '#DC2626'
                              }}
                              title="Ekibi Sil veya Şantiyeden Kaldır"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                        <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                          {kayitliIsciSayisi > 0 ? `${kayitliIsciSayisi} Kayıtlı Usta/İşçi` : 'Ekip henüz boş'}
                        </span>

                        {toplamGeldi > 0 ? (
                          <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: 11.5, fontWeight: 800, padding: '3px 8px', borderRadius: 8 }}>
                            ✓ {toplamGeldi} Kişi Geldi
                          </span>
                        ) : (
                          <span style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8 }}>
                            Yoklama Al →
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {santiyeEkipleri.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 16px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1E293B', margin: '0 0 6px' }}>
                    Bu şantiyede henüz ekip tanımlanmamış
                  </p>
                  <p style={{ fontSize: 12, margin: '0 0 12px' }}>
                    Aşağıdaki butona basarak şirketin mevcut taşeronlarından ekleyebilir veya yeni bir ekip oluşturabilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEkipEkleModalAcik(true)}
                    style={{ padding: '8px 16px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    + Şantiyeye Ekip / Taşeron Ekle
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* B) EKİP SEÇİLMİŞSE: O EKİBİN PUANTAJ ALMA PANELİ (ODAKLANMIŞ HIZLI YOKLAMA) */
            <div style={{ background: '#FFFFFF', borderRadius: 16, border: '2px solid #1D9596', padding: '16px 18px', boxShadow: '0 4px 16px rgba(29, 149, 150, 0.1)' }}>
              {/* Ekip Başlığı ve Geri Dön Butonu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSeciliTaseronId(null)}
                    style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer' }}
                  >
                    ⬅ Ekiplere Dön
                  </button>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18 }}>{getEkipSimgesi(seciliEkip?.ad, seciliEkip?.sifat)}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>
                        {seciliEkip?.ad}
                      </span>
                      {isYonetici && (
                        <div style={{ display: 'inline-flex', gap: 4, marginLeft: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleEkipDuzenleBaslat(seciliEkip)}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#475569',
                              cursor: 'pointer'
                            }}
                            title="Ekip Bilgilerini Düzenle"
                          >
                            ✏️ Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEkipSilBaslat(seciliEkip)}
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#DC2626',
                              cursor: 'pointer'
                            }}
                            title="Ekibi Sil veya Şantiyeden Kaldır"
                          >
                            🗑️ Sil / Kaldır
                          </button>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                      {seciliEkip?.sifat || 'İmalat Ekibi'} · 📅 {tarihGoster(tarih)}
                    </span>
                  </div>
                </div>

                {/* Hızlı Toplu İşaretleme & Sayı Rozeti */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: seciliEkipToplamKisi > 0 ? '#15803D' : '#64748B', background: seciliEkipToplamKisi > 0 ? '#DCFCE7' : '#F1F5F9', padding: '4px 10px', borderRadius: 8 }}>
                    👥 Toplam {seciliEkipToplamKisi} Kişi Sahada
                  </span>

                  {aktifCalisanlar.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleTumEkipGeldi(seciliEkip.id, aktifCalisanlar)}
                      style={{ padding: '7px 12px', background: '#1D9596', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, color: '#FFFFFF', cursor: 'pointer' }}
                    >
                      ✓ Tüm Ekip Geldi
                    </button>
                  )}
                </div>
              </div>

              {/* ÇALIŞAN LİSTESİ: En Çok Puantajı Alınanlara Göre Sıralı & Tek Dokunuşla Yoklama */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    ÇALIŞANLAR (EN ÇOK GELENLER EN ÜSTTE):
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    {aktifCalisanlar.length} Aktif Personel
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                  {aktifCalisanlar.map((c) => {
                    const tId = seciliEkipKaydi?.taseron_id || seciliTaseronId
                    const tikli = !!calisanKayitlari.find(
                      ck => ck.santiye_id === seciliSantiyeId && ck.taseron_id === tId && ck.calisan_id === c.id
                    )
                    const puantajSayisi = calisanToplamPuantaj[c.id] || 0

                    return (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: tikli ? '#ECFDF5' : '#F8FAFC',
                          border: tikli ? '2px solid #10B981' : '1px solid #E2E8F0',
                          boxShadow: tikli ? '0 2px 8px rgba(16, 185, 129, 0.15)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        {/* Tıklanabilir Alan */}
                        <div
                          onClick={() => handleCalisanTikle(seciliEkip.id, c.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                        >
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: tikli ? 'none' : '2px solid #CBD5E1',
                            background: tikli ? '#10B981' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFFFFF',
                            fontWeight: 900,
                            fontSize: 13
                          }}>
                            {tikli ? '✓' : ''}
                          </div>

                          <div>
                            <span style={{ fontSize: 13.5, fontWeight: tikli ? 800 : 600, color: tikli ? '#065F46' : '#1E293B', display: 'block', lineHeight: 1.25 }}>
                              {c.ad_soyad}
                            </span>
                            <span style={{ fontSize: 10.5, color: '#64748B' }}>
                              ⭐ {puantajSayisi > 0 ? `${puantajSayisi} gün katıldı` : 'Yeni işçi'}
                            </span>
                          </div>
                        </div>

                        {/* Yönetici İşlemleri (Düzenle / Sil) ve Pasife Al Butonu */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isYonetici && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCalisanDuzenle(c.id, c.ad_soyad)
                                }}
                                style={{
                                  background: '#F8FAFC',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: 6,
                                  padding: '4px 6px',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  color: '#475569'
                                }}
                                title="İşçi Adını Düzenle"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCalisanSil(c.id, c.ad_soyad)
                                }}
                                style={{
                                  background: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  borderRadius: 6,
                                  padding: '4px 6px',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  color: '#DC2626'
                                }}
                                title="İşçiyi Kalıcı Sil"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePasifeAlToggle(c.id, c.ad_soyad)
                            }}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              borderRadius: 6,
                              padding: '4px 7px',
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: '#64748B',
                              cursor: 'pointer'
                            }}
                            title="İşten ayrıldıysa pasife al (Geçmiş puantajı ASLA silinmez)"
                          >
                            ⏸️ Pasife Al
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {aktifCalisanlar.length === 0 && (
                  <p style={{ margin: '8px 0', fontSize: 12.5, color: '#64748B', fontStyle: 'italic' }}>
                    Bu ekip için kayıtlı aktif işçi bulunmuyor. Aşağıdaki kutudan hemen işçi ekleyebilirsiniz.
                  </p>
                )}
              </div>

              {/* İSİMSİZ / GÜNDELİKÇİ SAYISI */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block' }}>
                    ➕ İsimsiz / Ek Gündelikçi Sayısı:
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    İsmi listeye kaydedilmeyen günübirlik personeller
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDigerSayisiDegistir(seciliEkip.id, -1)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: 16, fontWeight: 900, minWidth: 24, textAlign: 'center', color: '#1E293B' }}>
                    {seciliEkipDigerSayisi}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDigerSayisiDegistir(seciliEkip.id, 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* HIZLI İŞÇİ EKLEME (Doğrudan Ekip Altına Ekle & Anında Geldi Yap) */}
              <div style={{ background: '#F0FDFA', border: '1px dashed #14B8A6', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0F766E', display: 'block', marginBottom: 6 }}>
                  + EKİBE YENİ İŞÇİ DAHİL ET:
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="İsim Soyisim (Örn: Ali Sunal)..."
                    value={yeniCalisanAdi}
                    onChange={(e) => setYeniCalisanAdi(e.target.value.toLocaleUpperCase('tr-TR'))}
                    onKeyDown={(e) => e.key === 'Enter' && handleYeniIsciEkle(seciliEkip.id)}
                    style={{ flex: '2 1 180px', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', fontSize: 13, outline: 'none' }}
                  />
                  <input
                    type="text"
                    placeholder="Görevi (Kalıpçı, Çırak vs.)..."
                    value={yeniCalisanSifat}
                    onChange={(e) => setYeniCalisanSifat(e.target.value.toLocaleUpperCase('tr-TR'))}
                    onKeyDown={(e) => e.key === 'Enter' && handleYeniIsciEkle(seciliEkip.id)}
                    style={{ flex: '1 1 140px', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', fontSize: 13, outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleYeniIsciEkle(seciliEkip.id)}
                    style={{ padding: '8px 16px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    + Ekle & Geldi Yap
                  </button>
                </div>
              </div>

              {/* PASİFE ALINANLAR ALANI (GEREKİRSE TEKRAR AKTİFE ALINABİLİR) */}
              {pasifCalisanlar.length > 0 && (
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setPasifGoster(!pasifGoster)}
                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    {pasifGoster ? '▲ Pasife Alınan Personelleri Gizle' : `▼ Pasife Alınan / İşten Ayrılan Personeller (${pasifCalisanlar.length})`}
                  </button>

                  {pasifGoster && (
                    <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                      {pasifCalisanlar.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', opacity: 0.85 }}>
                          <div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', display: 'block' }}>
                              {c.ad_soyad}
                            </span>
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>
                              Geçmiş puantaj: {calisanToplamPuantaj[c.id] || 0} gün
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePasifeAlToggle(c.id, c.ad_soyad)}
                            style={{ padding: '4px 8px', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer' }}
                          >
                            ▶ Aktife Al
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tamamla ve Ekiplere Dön Butonu */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSeciliTaseronId(null)}
                  style={{ padding: '10px 18px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29, 149, 150, 0.25)' }}
                >
                  ✓ Bu Ekip Tamamlandı → Diğer Ekiplere Geç
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ŞANTİYEYE BAŞKA EKİP / TAŞERON DAHİL ET */}
      {ekipEkleModalAcik && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 440, padding: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>
                ➕ Şantiyeye Ekip / Taşeron Dahil Et
              </span>
              <button
                type="button"
                onClick={() => setEkipEkleModalAcik(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            {/* Seçenek 1: Şirket Rehberindeki Mevcut Taşeronlar (Zorunlu Şantiye Ataması Şartı) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                1. Şirket Rehberinden Seçin (Bu Şantiyeye Tanımlı Olanlar):
              </label>
              {eklenebilirRehberTaseronlari.length > 0 ? (
                <select
                  value={secilenRehberTaseronId}
                  onChange={(e) => {
                    setSecilenRehberTaseronId(e.target.value)
                    setYeniManuelEkipAdi('')
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                >
                  <option value="">Rehberde bu şantiyeye tanımlı taşeron seçiniz...</option>
                  {eklenebilirRehberTaseronlari.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.ad} {t.sifat ? `(${t.sifat})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✓</span> {santiyeRehberTaseronlari.length > 0 ? `Rehberde bu şantiyeye tanımlı tüm taşeronlar (${santiyeRehberTaseronlari.length} ekip) ekranda mevcuttur.` : 'Rehberde bu şantiyeye tanımlanmış taşeron bulunmuyor.'}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Rehberdeki başka bir taşeronu bu şantiyeye dahil etmek için <strong>Cari Kartlar / Şirket Rehberi</strong> sayfasından ilgili taşeron kartına bu şantiyeyi ekleyiniz veya aşağıdaki alandan yeni ekip adı giriniz.
                  </div>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', margin: '10px 0', fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>
              — VEYA YENİ EKİP ADI YAZIN —
            </div>

            {/* Seçenek 2: Yeni Manuel Ekip Adı */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                2. Yeni Ekip / Usta Adı:
              </label>
              <input
                type="text"
                placeholder="Örn: Hasan Usta (Kalıpçı Ekibi)..."
                value={yeniManuelEkipAdi}
                onChange={(e) => {
                  setYeniManuelEkipAdi(e.target.value)
                  setSecilenRehberTaseronId('')
                }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', marginBottom: 8 }}
              />
              <input
                type="text"
                placeholder="İmalat Kalemi (Örn: Kalıp & İskele)..."
                value={yeniManuelEkipSifat}
                onChange={(e) => setYeniManuelEkipSifat(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setEkipEkleModalAcik(false)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: 'none', borderRadius: 10, fontWeight: 700, color: '#475569', cursor: 'pointer' }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSantiyeEkipEkle}
                style={{ flex: 2, padding: '10px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                ✓ Şantiyeye Ekle & Aç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: YÖNETİCİ EKİP BİLGİLERİNİ DÜZENLE */}
      {ekipDuzenleModalAcik && duzenlenenEkip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 420, padding: 22, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>
                ✏️ Ekip / Taşeron Bilgilerini Düzenle
              </span>
              <button
                type="button"
                onClick={() => setEkipDuzenleModalAcik(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                Ekip / Taşeron Adı:
              </label>
              <input
                type="text"
                value={duzenleEkipAdi}
                onChange={(e) => setDuzenleEkipAdi(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                placeholder="Örn: Kalıpçı Ahmet Usta"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>
                İmalat Dalı / Görevi:
              </label>
              <input
                type="text"
                value={duzenleEkipSifat}
                onChange={(e) => setDuzenleEkipSifat(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                placeholder="Örn: Kalıp Ustası, Demirci, Sıvacı..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setEkipDuzenleModalAcik(false)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleEkipDuzenleKaydet}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1D9596', color: '#FFF', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                ✓ Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: YÖNETİCİ EKİBİ SİL VEYA ŞANTİYEDEN KALDIR */}
      {ekipSilModalAcik && silinecekEkip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 440, padding: 22, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                🗑️ Ekip Silme / Şantiyeden Çıkarma
              </span>
              <button
                type="button"
                onClick={() => setEkipSilModalAcik(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: '#991B1B', display: 'block' }}>
                {silinecekEkip.ad} {silinecekEkip.sifat ? `(${silinecekEkip.sifat})` : ''}
              </span>
              <span style={{ fontSize: 12, color: '#7F1D1D', marginTop: 3, display: 'block' }}>
                Bu ekiple ilgili yapmak istediğiniz işlemi seçiniz:
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {/* Seçenek 1: Sadece Bu Şantiyeden Kaldır */}
              <button
                type="button"
                disabled={silmeYukleniyor}
                onClick={handleEkipSantiyedenCikar}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  background: '#F8FAFC',
                  cursor: silmeYukleniyor ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>🏢</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>
                    1. Yalnızca Bu Şantiyeden Kaldır
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: '#64748B', display: 'block', lineHeight: 1.35 }}>
                  Ekip şirket rehberinde kalır. Yalnızca bu şantiyenin puantaj listesinden ve bu şantiyedeki puantaj kayıtlarından kaldırılır.
                </span>
              </button>

              {/* Seçenek 2: Hatalı Ekibi Tamamen Sil */}
              <button
                type="button"
                disabled={silmeYukleniyor}
                onClick={handleEkipTamamenSil}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #FCA5A5',
                  background: '#FFF5F5',
                  cursor: silmeYukleniyor ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#DC2626' }}>
                    2. Hatalı Açılmış Ekibi Tamamen Sil
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: '#991B1B', display: 'block', lineHeight: 1.35 }}>
                  Ekip veritabanından, rehberden ve tüm şantiyelerdeki puantaj kayıtlarından kalıcı olarak silinir.
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={silmeYukleniyor}
                onClick={() => setEkipSilModalAcik(false)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#FFF', color: '#475569', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 2- TAKVİM (Hızlı Gözlem Matrisi)
// ============================================================
function PuantajTakvimGozlem() {
  const { santiyeler } = useSite()
  const [tarih, setTarih] = useState(bugun())
  
  const [ayKayitlari, setAyKayitlari] = useState([])
  const [ayCalisanKayitlari, setAyCalisanKayitlari] = useState([])

  // Hiyerarşi state'leri
  const [seciliGun, setSeciliGun] = useState(null) // YYYY-MM-DD
  const [seciliSantiye, setSeciliSantiye] = useState(null) // ID
  const [seciliTaseron, setSeciliTaseron] = useState(null) // ID

  const [taseronIsimleri, setTaseronIsimleri] = useState({})
  const [calisanIsimleri, setCalisanIsimleri] = useState({})

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad').then(({ data }) => {
      const harita = {}; (data||[]).forEach(d => harita[d.id] = d.ad); setTaseronIsimleri(harita)
    })
    supabase.from('taseron_calisanlari').select('id, ad_soyad').then(({ data }) => {
      const harita = {}; (data||[]).forEach(d => harita[d.id] = d.ad_soyad); setCalisanIsimleri(harita)
    })
  }, [])

  useEffect(() => {
    ayKayitlariniYukle()
  }, [tarih])

  const ayKayitlariniYukle = async () => {
    const ilkGun = tarih.slice(0, 8) + '01'
    const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
    
    const { data: gk } = await supabase.from('puantaj_kayitlari').select('santiye_id, taseron_id, tarih').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    setAyKayitlari(gk || [])

    const { data: ck } = await supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih, calisan_id').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    setAyCalisanKayitlari(ck || [])
  }

  const ilkGunTarih = new Date(tarih.slice(0, 8) + '01')
  const ayAdi = ilkGunTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const ayinGunSayisi = new Date(ilkGunTarih.getFullYear(), ilkGunTarih.getMonth() + 1, 0).getDate()
  const ilkGunHaftaIndeksi = (ilkGunTarih.getDay() + 6) % 7

  const gunTikla = (gunTarihi) => {
    if (seciliGun === gunTarihi) setSeciliGun(null)
    else { setSeciliGun(gunTarihi); setSeciliSantiye(null); setSeciliTaseron(null) }
  }

  // Aktif güne ait tüm şantiyeleri bul (distinct)
  const gununSantiyeleri = seciliGun ? [...new Set(ayKayitlari.filter(k => k.tarih === seciliGun).map(k => k.santiye_id))] : []
  // Aktif şantiyeye ait taşeronları bul
  const gununTaseronlari = seciliSantiye ? [...new Set(ayKayitlari.filter(k => k.tarih === seciliGun && k.santiye_id === seciliSantiye).map(k => k.taseron_id))] : []
  // Aktif taşerona ait çalışanları bul
  const gununCalisanlari = seciliTaseron ? ayCalisanKayitlari.filter(c => c.tarih === seciliGun && c.santiye_id === seciliSantiye && c.taseron_id === seciliTaseron).map(c => c.calisan_id) : []

  return (
    <div>
      <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
        <button onClick={() => { setTarih((t) => gunEkle(t, -30)); setSeciliGun(null) }} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
        <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>{ayAdi}</span>
        <button onClick={() => { setTarih((t) => gunEkle(t, 30)); setSeciliGun(null) }} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
      </div>

      <div className="takvim-baslik-satiri" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8, textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#888780', textTransform: 'uppercase' }}>
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => <span key={g}>{g}</span>)}
      </div>
      <div className="takvim-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {Array.from({ length: ilkGunHaftaIndeksi }).map((_, i) => <div key={`bos-${i}`} />)}
        {Array.from({ length: ayinGunSayisi }).map((_, i) => {
          const gunTarihi = `${tarih.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
          
          // O gün kaç kişi çalışmış?
          const kisiSayisi = ayCalisanKayitlari.filter(c => c.tarih === gunTarihi).length
          const isSelected = seciliGun === gunTarihi

          return (
            <button
              key={gunTarihi}
              className={`takvim-gun ${gunTarihi === bugun() ? 'bugun' : ''}`}
              style={{
                background: isSelected ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff',
                color: isSelected ? '#fff' : '#333',
                transform: isSelected ? 'scale(1.02)' : 'none',
                border: isSelected ? 'none' : (gunTarihi === bugun() ? '2px solid #1D9596' : '1px solid rgba(0,0,0,0.05)'),
                borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 60, cursor: 'pointer', boxShadow: isSelected ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s'
              }}
              onClick={() => gunTikla(gunTarihi)}
            >
              <span className="takvim-gun-no" style={{ fontSize: 14, fontWeight: 700, opacity: isSelected ? 1 : 0.8 }}>{i + 1}</span>
              {kisiSayisi > 0 && <span className="takvim-gun-toplam" style={{ marginTop: 4, background: isSelected ? 'rgba(255,255,255,0.2)' : '#f0fdf4', color: isSelected ? '#fff' : '#16a34a', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{kisiSayisi} kişi</span>}
            </button>
          )
        })}
      </div>

      {/* HİYERARŞİ ALANI */}
      {seciliGun && (
        <div style={{ marginTop: 24, padding: 20, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#1D9596', fontWeight: 700, borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 12 }}>{tarihGoster(seciliGun)} Detayları</h3>
          
          <div style={{ display: 'flex', gap: 20, flexDirection: 'column', paddingBottom: 10 }}>
            {/* Şantiyeler */}
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Şantiye Seçin</p>
              {gununSantiyeleri.map(sId => {
                const sAd = santiyeler.find(s => s.id === sId)?.ad || 'Bilinmeyen Şantiye'
                const secili = seciliSantiye === sId
                return (
                  <button key={sId} onClick={() => { setSeciliSantiye(sId); setSeciliTaseron(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, background: secili ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: secili ? '#fff' : '#333', border: secili ? 'none' : '1px solid rgba(0,0,0,0.05)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 700 : 500, boxShadow: secili ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                    {sAd}
                  </button>
                )
              })}
              {gununSantiyeleri.length === 0 && <p className="bos-mesaj">Kayıt yok</p>}
            </div>

            {/* Taşeronlar */}
            {seciliSantiye && (
              <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Taşeron Seçin</p>
                {gununTaseronlari.map(tId => {
                  const tAd = taseronIsimleri[tId] || 'Bilinmeyen Taşeron'
                  const secili = seciliTaseron === tId
                  return (
                    <button key={tId} onClick={() => setSeciliTaseron(tId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, background: secili ? '#1e293b' : '#fff', color: secili ? '#fff' : '#333', border: secili ? 'none' : '1px solid rgba(0,0,0,0.05)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 700 : 500, boxShadow: secili ? '0 4px 12px rgba(30, 41, 59, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                      {tAd}
                    </button>
                  )
                })}
              </div>
            )}

            {/* İşçiler */}
            {seciliTaseron && (
              <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. İşe Gelenler</p>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  {gununCalisanlari.map((cId, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, border: '1px solid #bbf7d0' }}>✓</div> 
                      {calisanIsimleri[cId] || 'Bilinmeyen'}
                    </div>
                  ))}
                  {gununCalisanlari.length === 0 && <div style={{ padding: '14px', fontSize: 13, color: '#888780', fontStyle: 'italic' }}>Kimse işaretlenmemiş.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 3- DÖNEM RAPORU (Genel Toplamlar)
// ============================================================
function PuantajToplam() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeleri, setTaseronSantiyeleri] = useState([])
  const [donem, setDonem] = useState('gunluk') // 'gunluk' | 'aylik' | 'aralik' | 'tum'
  const [tarih, setTarih] = useState(bugun())
  const [basTarih, setBasTarih] = useState(bugun())
  const [bitTarih, setBitTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreTaseron, setFiltreTaseron] = useState('hepsi')
  const [filtreAcik, setFiltreAcik] = useState(false)

  const [kayitlar, setKayitlar] = useState([])
  const [calisanSayilari, setCalisanSayilari] = useState({})
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
    supabase.from('taseron_santiyeler').select('taseron_id, santiye_id').then(({ data }) => setTaseronSantiyeleri(data || []))
  }, [])

  const gorunenTaseronlar = useMemo(() => {
    if (filtreSantiye === 'hepsi') return taseronlar
    const tanimliIds = new Set(taseronSantiyeleri.filter(ts => ts.santiye_id === filtreSantiye).map(ts => ts.taseron_id))
    return taseronlar.filter(t => tanimliIds.has(t.id))
  }, [filtreSantiye, taseronlar, taseronSantiyeleri])

  useEffect(() => {
    raporuYukle()
  }, [donem, tarih, basTarih, bitTarih, filtreSantiye, filtreTaseron])

  const raporuYukle = async () => {
    setYukleniyor(true)
    let sorgu = supabase.from('puantaj_kayitlari').select('santiye_id, taseron_id, tarih, diger_sayisi, santiyeler(ad), taseronlar(ad)')
    let ckSorgu = supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih')

    if (donem === 'gunluk') {
      sorgu = sorgu.eq('tarih', tarih); ckSorgu = ckSorgu.eq('tarih', tarih)
    } else if (donem === 'aylik') {
      const ilkGun = tarih.slice(0, 8) + '01'
      const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
      sorgu = sorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
      ckSorgu = ckSorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    } else if (donem === 'aralik') {
      sorgu = sorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
      ckSorgu = ckSorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
    }
    
    if (filtreSantiye !== 'hepsi') { sorgu = sorgu.eq('santiye_id', filtreSantiye); ckSorgu = ckSorgu.eq('santiye_id', filtreSantiye) }
    if (filtreTaseron !== 'hepsi') { sorgu = sorgu.eq('taseron_id', filtreTaseron); ckSorgu = ckSorgu.eq('taseron_id', filtreTaseron) }

    const { data, error } = await sorgu
    if (error) { alert('Rapor yüklenemedi: ' + error.message); setYukleniyor(false); return }
    setKayitlar(data || [])

    const { data: ckData } = await ckSorgu
    const sayac = {}
    ;(ckData || []).forEach((c) => {
      const anahtar = `${c.santiye_id}_${c.taseron_id}_${c.tarih}`
      sayac[anahtar] = (sayac[anahtar] || 0) + 1
    })
    setCalisanSayilari(sayac)
    setYukleniyor(false)
  }

  const kayitToplami = (k) => {
    const anahtar = `${k.santiye_id}_${k.taseron_id}_${k.tarih}`
    return (calisanSayilari[anahtar] || 0) + (k.diger_sayisi || 0)
  }

  const genelToplam = kayitlar.reduce((t, k) => t + kayitToplami(k), 0)

  const santiyeBazinda = {}
  const taseronBazinda = {}
  kayitlar.forEach((k) => {
    const t = kayitToplami(k)
    const sAdi = k.santiyeler?.ad || '—'
    const tAdi = k.taseronlar?.ad || '—'
    santiyeBazinda[sAdi] = (santiyeBazinda[sAdi] || 0) + t
    taseronBazinda[tAdi] = (taseronBazinda[tAdi] || 0) + t
  })

  const pdfIndir = () => {
    const doc = new jsPDF()
    doc.addFileToVFS('Roboto-Regular.ttf', RobotoBase64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
    doc.setFont('Roboto')

    doc.setFontSize(16)
    doc.text('Şantiye Dönem Raporu (Genel Puantaj)', 14, 15)
    
    let tarihBilgisi = ''
    if (donem === 'gunluk') tarihBilgisi = tarihGoster(tarih)
    else if (donem === 'aylik') tarihBilgisi = new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    else if (donem === 'aralik') tarihBilgisi = `${tarihGoster(basTarih)} - ${tarihGoster(bitTarih)}`
    
    doc.setFontSize(11)
    doc.text(`Dönem: ${tarihBilgisi || 'Tümü'}`, 14, 23)
    doc.text(`Genel Toplam Yevmiye: ${genelToplam}`, 14, 29)

    let yPos = 35

    if (filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Şantiye Adı', 'Toplam Yevmiye']],
        body: Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]),
        theme: 'grid',
        headStyles: { fillColor: [29, 149, 150] },
        styles: { font: 'Roboto' }
      })
      yPos = doc.lastAutoTable.finalY + 10
    }

    if (filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Taşeron Adı', 'Toplam Yevmiye']],
        body: Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]),
        theme: 'grid',
        headStyles: { fillColor: [29, 149, 150] },
        styles: { font: 'Roboto' }
      })
    }

    doc.save(`Donem_Raporu_${bugun()}.pdf`)
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)} style={{ flex: 1, padding: '12px', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, fontWeight: 700, color: '#555', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          {filtreAcik ? 'Filtreleri Gizle ⌃' : 'Filtreleri Göster ⌄'}
        </button>
        <button onClick={pdfIndir} style={{ padding: '12px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          📄 PDF İndir
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 16, background: '#fdfdfd', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şantiye Filtresi</p>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taşeron Filtresi</p>
          <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 6, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
            <option value="hepsi">Tüm Taşeronlar</option>
            {gorunenTaseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
        </div>
      )}

      <div className="gorunum-secici" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setDonem('gunluk')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'gunluk' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'gunluk' ? '#fff' : '#fcfcf9', color: donem === 'gunluk' ? '#1D9596' : '#555', boxShadow: donem === 'gunluk' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Günlük</button>
        <button onClick={() => setDonem('aylik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aylik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aylik' ? '#fff' : '#fcfcf9', color: donem === 'aylik' ? '#1D9596' : '#555', boxShadow: donem === 'aylik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Aylık</button>
        <button onClick={() => setDonem('aralik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aralik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aralik' ? '#fff' : '#fcfcf9', color: donem === 'aralik' ? '#1D9596' : '#555', boxShadow: donem === 'aralik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tarih Aralığı</button>
        <button onClick={() => setDonem('tum')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'tum' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'tum' ? '#fff' : '#fcfcf9', color: donem === 'tum' ? '#1D9596' : '#555', boxShadow: donem === 'tum' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
          <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 12, marginBottom: 16, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Başlangıç Tarihi:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bitiş Tarihi:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
      )}

      <div className="ozet-kart" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #1D9596, #117575)', padding: 24, borderRadius: 16, color: '#fff', boxShadow: '0 4px 16px rgba(29, 149, 150, 0.3)' }}>
        <p className="ozet-etiket" style={{ fontSize: 13, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600, color: '#fff' }}>Genel toplam (İşçi yevmiyesi)</p>
        <p className="ozet-tutar" style={{ fontSize: 36, fontWeight: 800, margin: 0, color: '#fff' }}>{yukleniyor ? '...' : genelToplam}</p>
      </div>

      {filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0 && (
        <>
          <p className="alt-baslik" style={{ fontSize: 14, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Şantiye bazında</p>
          <div className="liste" style={{ marginBottom: 24 }}>
            {Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1D9596' }}>{sayi} yevmiye</span>
              </div>
            ))}
          </div>
        </>
      )}

      {filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0 && (
        <>
          <p className="alt-baslik" style={{ fontSize: 14, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Taşeron bazında</p>
          <div className="liste" style={{ marginBottom: 24 }}>
            {Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1D9596' }}>{sayi} yevmiye</span>
              </div>
            ))}
          </div>
        </>
      )}

      {kayitlar.length === 0 && !yukleniyor && <p className="bos-mesaj">Bu filtrede kayıt yok.</p>}
    </>
  )
}

// ============================================================
// 4- ÇALIŞAN BAZLI RAPOR
// ============================================================
function PuantajCalisanRapor() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeleri, setTaseronSantiyeleri] = useState([])
  const [donem, setDonem] = useState('aylik') // 'gunluk' | 'aylik' | 'aralik' | 'tum'
  const [tarih, setTarih] = useState(bugun())
  const [basTarih, setBasTarih] = useState(bugun())
  const [bitTarih, setBitTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreTaseron, setFiltreTaseron] = useState('hepsi')
  
  const [aramaIsim, setAramaIsim] = useState('')
  const [calisanRaporu, setCalisanRaporu] = useState([]) // [{ ad, santiye, taseron, sayi }]
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
    supabase.from('taseron_santiyeler').select('taseron_id, santiye_id').then(({ data }) => setTaseronSantiyeleri(data || []))
  }, [])

  const gorunenTaseronlar = useMemo(() => {
    if (filtreSantiye === 'hepsi') return taseronlar
    const tanimliIds = new Set(taseronSantiyeleri.filter(ts => ts.santiye_id === filtreSantiye).map(ts => ts.taseron_id))
    return taseronlar.filter(t => tanimliIds.has(t.id))
  }, [filtreSantiye, taseronlar, taseronSantiyeleri])

  useEffect(() => {
    raporuYukle()
  }, [donem, tarih, basTarih, bitTarih, filtreSantiye, filtreTaseron])

  const raporuYukle = async () => {
    setYukleniyor(true)
    let ckSorgu = supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih, calisan_id')

    if (donem === 'gunluk') {
      ckSorgu = ckSorgu.eq('tarih', tarih)
    } else if (donem === 'aylik') {
      const ilkGun = tarih.slice(0, 8) + '01'
      const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
      ckSorgu = ckSorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    } else if (donem === 'aralik') {
      ckSorgu = ckSorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
    }
    
    if (filtreSantiye !== 'hepsi') { ckSorgu = ckSorgu.eq('santiye_id', filtreSantiye) }
    if (filtreTaseron !== 'hepsi') { ckSorgu = ckSorgu.eq('taseron_id', filtreTaseron) }

    const { data: ckData, error } = await ckSorgu
    if (error) { alert('Rapor yüklenemedi'); setYukleniyor(false); return }

    const { data: isciler } = await supabase.from('taseron_calisanlari').select('id, ad_soyad')
    const isciHaritasi = {}
    ;(isciler || []).forEach(i => isciHaritasi[i.id] = i.ad_soyad)

    // Gruplama: Anahtar = "CalisanId_SantiyeId_TaseronId"
    const gruplar = {}
    ;(ckData || []).forEach((c) => {
      if (c.calisan_id) {
        const anahtar = `${c.calisan_id}_${c.santiye_id}_${c.taseron_id}`
        if (!gruplar[anahtar]) {
          gruplar[anahtar] = {
            ad: isciHaritasi[c.calisan_id] || 'Bilinmeyen',
            santiye_id: c.santiye_id,
            taseron_id: c.taseron_id,
            sayi: 0
          }
        }
        gruplar[anahtar].sayi += 1
      }
    })

    setCalisanRaporu(Object.values(gruplar))
    setYukleniyor(false)
  }

  const filtrelenmis = calisanRaporu
    .filter(c => c.ad.toLocaleLowerCase('tr-TR').includes(aramaIsim.trim().toLocaleLowerCase('tr-TR')))
    .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad))

  const raporuPaylas = () => {
    if (filtrelenmis.length === 0) return alert('Paylaşılacak kayıt yok.')
    
    let metin = `📋 *ÇALIŞAN BAZLI PUANTAJ RAPORU*\n`
    if (donem !== 'tum') {
       metin += `🗓 *Tarih:* ${donem === 'gunluk' ? tarihGoster(tarih) : (donem === 'aylik' ? new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : `${basTarih} - ${bitTarih}`)}\n`
    }
    metin += `\n`

    filtrelenmis.forEach(c => {
      const sAd = santiyeler.find(s => s.id === c.santiye_id)?.ad || '—'
      const tAd = taseronlar.find(t => t.id === c.taseron_id)?.ad || '—'
      metin += `👤 *${c.ad}*\n`
      metin += `📍 ${sAd} (${tAd})\n`
      metin += `✅ Toplam: ${c.sayi} Gün (Yevmiye)\n\n`
    })

    if (navigator.share) {
      navigator.share({ text: metin }).catch(() => {})
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  return (
    <div>
      <div className="ekleme-kutusu" style={{ marginBottom: 16, background: '#fdfdfd', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taşeron Filtresi</p>
        <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="hepsi">Tüm Taşeronlar</option>
          {gorunenTaseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şantiye Filtresi</p>
        <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="hepsi">Tüm Şantiyeler</option>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setDonem('gunluk')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'gunluk' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'gunluk' ? '#fff' : '#fcfcf9', color: donem === 'gunluk' ? '#1D9596' : '#555', boxShadow: donem === 'gunluk' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Günlük</button>
        <button onClick={() => setDonem('aylik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aylik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aylik' ? '#fff' : '#fcfcf9', color: donem === 'aylik' ? '#1D9596' : '#555', boxShadow: donem === 'aylik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Aylık</button>
        <button onClick={() => setDonem('aralik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aralik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aralik' ? '#fff' : '#fcfcf9', color: donem === 'aralik' ? '#1D9596' : '#555', boxShadow: donem === 'aralik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tarih Aralığı</button>
        <button onClick={() => setDonem('tum')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'tum' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'tum' ? '#fff' : '#fcfcf9', color: donem === 'tum' ? '#1D9596' : '#555', boxShadow: donem === 'tum' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
          <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 12, marginBottom: 16, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Başlangıç:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bitiş:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <p className="alt-baslik" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rapor Çıktısı</p>
        <div style={{ display: 'flex', gap: 10, flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="İsim ara..." 
            value={aramaIsim} 
            onChange={(e) => setAramaIsim(e.target.value)} 
            style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, minWidth: '150px', flex: '1 1 150px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', outline: 'none' }}
          />
          <button onClick={() => {
            const doc = new jsPDF()
            doc.addFileToVFS('Roboto-Regular.ttf', RobotoBase64)
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
            doc.setFont('Roboto')

            doc.setFontSize(16)
            doc.text('Çalışan Puantaj Detay Raporu', 14, 15)
            
            let tarihBilgisi = ''
            if (donem === 'gunluk') tarihBilgisi = tarihGoster(tarih)
            else if (donem === 'aylik') tarihBilgisi = new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
            else if (donem === 'aralik') tarihBilgisi = `${tarihGoster(basTarih)} - ${tarihGoster(bitTarih)}`
            
            doc.setFontSize(11)
            doc.text(`Dönem: ${tarihBilgisi || 'Tümü'}`, 14, 23)

            const tabloVerisi = filtrelenmis.map(c => [
              c.ad,
              santiyeler.find(s => s.id === c.santiye_id)?.ad || '—',
              taseronlar.find(t => t.id === c.taseron_id)?.ad || '—',
              c.sayi
            ])

            autoTable(doc, {
              startY: 30,
              head: [['İsim Soyisim', 'Şantiye', 'Taşeron', 'Toplam Yevmiye']],
              body: tabloVerisi,
              theme: 'grid',
              headStyles: { fillColor: [29, 149, 150] },
              styles: { font: 'Roboto' }
            })

            doc.save(`Calisan_Raporu_${bugun()}.pdf`)
          }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
            📄 PDF İndir
          </button>
          <button onClick={raporuPaylas} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            Paylaş
          </button>
        </div>
      </div>

      <div className="liste">
        {yukleniyor ? (
          <p className="bos-mesaj">Yükleniyor...</p>
        ) : calisanRaporu.length === 0 ? (
          <p className="bos-mesaj" style={{ marginTop: 0 }}>Bu kriterlere uygun işlenmiş yevmiye kaydı bulunmuyor.</p>
        ) : filtrelenmis.length === 0 ? (
          <p className="bos-mesaj">Aranan isimde kayıt bulunamadı.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', background: '#1D9596', padding: '14px 16px', fontSize: 11, fontWeight: 800, color: '#fff', borderBottom: '2px solid rgba(0,0,0,0.05)', letterSpacing: '0.5px', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <span>İSİM SOYİSİM</span>
              <span>ŞANTİYE & TAŞERON</span>
              <span style={{ textAlign: 'right' }}>GÜN</span>
            </div>
            {filtrelenmis.map((c, idx) => {
              const sAd = santiyeler.find(s => s.id === c.santiye_id)?.ad || '—'
              const tAd = taseronlar.find(t => t.id === c.taseron_id)?.ad || '—'
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', padding: '16px', fontSize: 13, borderBottom: idx === filtrelenmis.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.03)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#333' }}>{c.ad}</span>
                  <span style={{ color: '#888780', fontSize: 12 }}>{sAd} <br/><span style={{ opacity: 0.7, fontWeight: 500 }}>({tAd})</span></span>
                  <span style={{ textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: 16 }}>{c.sayi}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 5- İŞÇİ YÖNETİMİ
// ============================================================
function PuantajCalisanKayit() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeleri, setTaseronSantiyeleri] = useState([])
  const [santiyeId, setSantiyeId] = useState('')
  const [taseronId, setTaseronId] = useState('')
  const [calisanlar, setCalisanlar] = useState([])
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSifat, setYeniSifat] = useState('')

  useEffect(() => {
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
    supabase.from('taseron_santiyeler').select('taseron_id, santiye_id').then(({ data }) => setTaseronSantiyeleri(data || []))
  }, [])

  useEffect(() => {
    if (santiyeler.length && !santiyeId) setSantiyeId(santiyeler[0].id)
  }, [santiyeler])

  useEffect(() => {
    setTaseronId('')
  }, [santiyeId])

  useEffect(() => {
    if (taseronId && santiyeId) calisanlariYukle()
    else setCalisanlar([])
  }, [santiyeId, taseronId])

  const santiyeTaseronlari = useMemo(() => {
    if (!santiyeId) return []
    const tanimliIds = new Set(taseronSantiyeleri.filter(ts => ts.santiye_id === santiyeId).map(ts => ts.taseron_id))
    return taseronlar.filter(t => tanimliIds.has(t.id))
  }, [santiyeId, taseronlar, taseronSantiyeleri])

  const calisanlariYukle = async () => {
    const { data, error } = await supabase.from('taseron_calisanlari').select('*').eq('taseron_id', taseronId).eq('santiye_id', santiyeId).order('ad_soyad')
    if (error) { alert('Çalışanlar yüklenemedi: ' + error.message); return }
    setCalisanlar(data || [])
  }

  const calisanEkle = async () => {
    const ad = yeniAd.trim().toLocaleUpperCase('tr-TR')
    const sifat = yeniSifat.trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const tamAd = sifat ? `${ad} (${sifat})` : ad
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, santiye_id: santiyeId, ad_soyad: tamAd }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniAd('')
    setYeniSifat('')
    calisanlariYukle()
  }

  const calisanSil = async (id) => {
    if (!window.confirm('Bu çalışanı kayıtlardan çıkarmak istediğinize emin misiniz? (geçmiş puantaj kayıtları etkilenmez)')) return
    await supabase.from('taseron_calisanlari').delete().eq('id', id)
    calisanlariYukle()
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#166534', marginTop: 0, marginBottom: 20, background: '#f0fdf4', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(22, 163, 74, 0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <div>
          <span style={{ fontWeight: 700, display: 'block', marginBottom: 4, fontSize: 14 }}>Bilgilendirme</span>
          Buradan sisteme tanımlayacağınız işçiler <strong>Kayıt Ekleme</strong> bölümünde karşınıza çıkacaktır. İsimler zorunlu olarak <strong>BÜYÜK HARFLE</strong> kaydedilir.
        </div>
      </div>

      <div className="ekleme-kutusu" style={{ marginBottom: 24, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Şantiye Seçin</p>
        <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Taşeron Seçin (Bu Şantiyeye Tanımlı Olanlar)</p>
        <select value={taseronId} onChange={(e) => setTaseronId(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="">{santiyeTaseronlari.length > 0 ? 'Seçiniz...' : 'Bu şantiyeye rehberde atanmış taşeron yok'}</option>
          {santiyeTaseronlari.map((t) => <option key={t.id} value={t.id}>{t.ad} {t.sifat ? `(${t.sifat})` : ''}</option>)}
        </select>
        {santiyeId && santiyeTaseronlari.length === 0 && (
          <div style={{ fontSize: 12, color: '#B45309', background: '#FEF3C7', padding: '10px 14px', borderRadius: 10, marginBottom: 16, border: '1px solid #FDE68A' }}>
            ⚠️ Bu şantiyeye Şirket Rehberi'nden (Cari Kartlar) henüz taşeron atanmamıştır. Taşeron atamak için <strong>Cari Kartlar</strong> sayfasından ilgili taşeron kartına girip <em>"Tanımlı Şantiyeler"</em> kısmından bu şantiyeyi ekleyiniz.
          </div>
        )}

        {taseronId && (
          <>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. İsim ve Meslek Ekleyin</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="text" placeholder="Ad Soyad..." value={yeniAd} onChange={(e) => setYeniAd(e.target.value.toLocaleUpperCase('tr-TR'))} onKeyDown={(e) => e.key === 'Enter' && calisanEkle()} style={{ flex: 2, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, textTransform: 'uppercase', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
              <input type="text" placeholder="Sıfat/Görev..." value={yeniSifat} onChange={(e) => setYeniSifat(e.target.value.toLocaleUpperCase('tr-TR'))} onKeyDown={(e) => e.key === 'Enter' && calisanEkle()} style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, textTransform: 'uppercase', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
              <button onClick={calisanEkle} style={{ width: 'auto', padding: '12px 24px', background: 'linear-gradient(135deg, #1D9596, #117575)', color: '#fff', borderRadius: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', whiteSpace: 'nowrap' }}>Listeye Ekle</button>
            </div>
          </>
        )}
      </div>

      {taseronId && (
        <div className="liste">
          <p className="alt-baslik" style={{ fontSize: 15, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Kayıtlı Çalışanlar ({calisanlar.length})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {calisanlar.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{c.ad_soyad}</span>
                <button onClick={() => calisanSil(c.id)} style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title="Sil">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))}
          </div>
          {calisanlar.length === 0 && <p className="bos-mesaj">Bu şantiye ve taşerona ait işçi kaydı yok.</p>}
        </div>
      )}
    </div>
  )
}
