import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import CariAramaSecici from '../components/CariAramaSecici'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihFormatlaTR = (tarihStr) => {
  if (!tarihStr) return ''
  const parts = tarihStr.split('-')
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' })
  }
  return tarihStr
}

export const LOCAL_STORAGE_SEVKIYAT_PLAN = 'santiye_sevkiyat_planlari_v1'
export const LOCAL_STORAGE_SEVKIYAT = 'santiye_sevkiyat_kayitlari_v1'

const HAZIR_MALZEME_SABLONLARI = [
  '🔩 26 Ton Nervürlü Demir (Ø16 - Ø20)',
  '🧱 14 Palet 13.5\'luk Yatay Delikli Tuğla',
  '🧪 C30/37 Hazır Beton Dökümü',
  '🪵 Kalıp Kerestesi & 21mm Plywood',
  '⚡ Elektrik Kablo & Boru Tesisatı',
  '🚿 Sıhhi Tesisat Boru & Ek Parçaları',
  '🎨 Alçı Sıva & Kalekim Yapıştırma Harcı',
  '🪟 PVC Doğrama & Cam Üniteleri'
]

const HAZIR_TALIMATLAR = [
  '🏗️ Kule vinç hazır beklesin, tabliyeye alınacak',
  '🚜 Forklift / Kepçe sahada hazır bulunsun',
  '🚧 Giriş güzergahı ve tır yanaşma yeri açık tutulsun',
  '📦 Kapalı malzeme deposuna indirilecek',
  '⚠️ Kantar fişi ve fabrika analiz raporu kontrol edilsin'
]

export default function SevkiyatPlanlama() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Serhat Hazar (Yönetici) Yetki Kontrolü - Sayfa Serhat Hazar'a aittir
  const isYoneticiSerhat = Boolean(
    !profile ||
    profile?.sistem_yoneticisi ||
    profile?.rol !== 'santiye_sefi' ||
    profile?.ad_soyad?.toLowerCase().includes('serhat') ||
    profile?.email?.toLowerCase().includes('serhat') ||
    profile?.rol === 'yonetici' ||
    profile?.rol === 'koordinator'
  )

  useEffect(() => {
    // Şantiye şefleri sevkiyatları Sevkiyat Kabul sayfasındaki ayrı sekmeden takip eder
    if (profile?.rol === 'santiye_sefi' && !profile?.ad_soyad?.toLowerCase().includes('serhat')) {
      navigate('/sevkiyat-kabul', { replace: true })
    }
  }, [profile, navigate])

  const [planListesi, setPlanListesi] = useState([])
  const [sekme, setSekme] = useState('tumu') // 'tumu' | 'bekliyor' | 'bugun' | 'teslim'
  const [eklemeFormuAcik, setEklemeFormuAcik] = useState(false)
  const [filtreAcik, setFiltreAcik] = useState(false)

  // Filtreler
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreZaman, setFiltreZaman] = useState('hepsi')
  const [aramaMetni, setAramaMetni] = useState('')

  // Ekleme Formu State'leri
  const [formSantiyeId, setFormSantiyeId] = useState('')
  const [formMalzeme, setFormMalzeme] = useState('')
  const [formTedarikci, setFormTedarikci] = useState('')
  const [formTarih, setFormTarih] = useState(bugun())
  const [formTahminiSaat, setFormTahminiSaat] = useState('10:00 - 12:00')
  const [formSoforIletisim, setFormSoforIletisim] = useState('')
  const [formSahaNotu, setFormSahaNotu] = useState('')

  // Kart İçi Düzenleme (In-place edit) State'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzSantiyeId, setDuzSantiyeId] = useState('')
  const [duzMalzeme, setDuzMalzeme] = useState('')
  const [duzTedarikci, setDuzTedarikci] = useState('')
  const [duzTarih, setDuzTarih] = useState('')
  const [duzTahminiSaat, setDuzTahminiSaat] = useState('')
  const [duzSoforIletisim, setDuzSoforIletisim] = useState('')
  const [duzSahaNotu, setDuzSahaNotu] = useState('')

  // Hızlı Kabul Modal State'leri
  const [kabulModalAcik, setKabulModalAcik] = useState(false)
  const [kabulHedefPlan, setKabulHedefPlan] = useState(null)
  const [kabulDurum, setKabulDurum] = useState('tam')
  const [kabulIrsaliyeFoto, setKabulIrsaliyeFoto] = useState('')
  const [kabulFaturaFoto, setKabulFaturaFoto] = useState('')
  const [kabulNotu, setKabulNotu] = useState('')

  useEffect(() => {
    if (aktifSantiye?.id) {
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  // LocalStorage'dan planları çek
  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT_PLAN)
      if (kayitli) {
        setPlanListesi(JSON.parse(kayitli))
      } else {
        const ornekPlanlar = [
          {
            id: 'plan-1',
            tarih: bugun(),
            tahminiSaat: '11:00 - 12:30',
            santiyeId: aktifSantiye?.id || (santiyeler[0]?.id || 'santiye-1'),
            santiyeAdi: aktifSantiye?.ad || (santiyeler[0]?.ad || 'Merkez Şantiye'),
            malzeme: 'Ø16 ve Ø20 B420C Nervürlü İnşaat Demiri (26 Ton 1 Tır)',
            tedarikci: 'Kardemir / Özçelik Demir Çelik',
            soforIletisim: '34 DM 8812 - Şoför Mehmet Bey (0532 555 44 33)',
            sahaNotu: 'Kule vinç hazır bekletilsin, malzeme doğrudan 2. kat tabliyesine alınacak.',
            durum: 'bekliyor',
            planlayan: 'Serhat Hazar (Yönetici)',
            olusturulduAt: new Date().toISOString()
          },
          {
            id: 'plan-2',
            tarih: bugun(),
            tahminiSaat: '14:30',
            santiyeId: aktifSantiye?.id || (santiyeler[0]?.id || 'santiye-1'),
            santiyeAdi: aktifSantiye?.ad || (santiyeler[0]?.ad || 'Merkez Şantiye'),
            malzeme: "13.5'luk Yatay Delikli İzolasyon Tuğlası (14 Palet)",
            tedarikci: 'Işıklar Tuğla Fabrikası',
            soforIletisim: '41 AB 456 - Şoför Ali Usta (0542 111 22 33)',
            sahaNotu: 'Forklift veya kepçe ile yan bahçe sahasına istiflenecek.',
            durum: 'bekliyor',
            planlayan: 'Serhat Hazar (Yönetici)',
            olusturulduAt: new Date().toISOString()
          }
        ]
        setPlanListesi(ornekPlanlar)
        localStorage.setItem(LOCAL_STORAGE_SEVKIYAT_PLAN, JSON.stringify(ornekPlanlar))
      }
    } catch (err) {
      console.error('Plan yükleme hatası:', err)
    }
  }, [aktifSantiye, santiyeler])

  const planlariKaydet = (yeniListe) => {
    setPlanListesi(yeniListe)
    try {
      localStorage.setItem(LOCAL_STORAGE_SEVKIYAT_PLAN, JSON.stringify(yeniListe))
    } catch (err) {
      console.error('Plan kaydetme hatası:', err)
    }
  }

  // Yeni Plan Ekle
  const handlePlanEkle = (e) => {
    e.preventDefault()
    if (!formMalzeme.trim()) {
      alert('Lütfen gelecek malzemenin cinsini ve miktarını yazın.')
      return
    }

    const hedefSantiyeId = formSantiyeId || aktifSantiye?.id || (santiyeler[0]?.id || '')
    const seciliS = santiyeler.find(s => s.id === hedefSantiyeId) || aktifSantiye

    const yeniPlan = {
      id: 'plan-' + Date.now(),
      tarih: formTarih || bugun(),
      tahminiSaat: formTahminiSaat.trim() || 'Gün İçi',
      santiyeId: hedefSantiyeId,
      santiyeAdi: seciliS?.ad || 'Genel Şantiye',
      malzeme: formMalzeme.trim(),
      tedarikci: formTedarikci.trim() || 'Tedarikçi Belirtilmedi',
      soforIletisim: formSoforIletisim.trim(),
      sahaNotu: formSahaNotu.trim(),
      durum: 'bekliyor',
      planlayan: profile?.ad_soyad || 'Serhat Hazar (Yönetici)',
      olusturulduAt: new Date().toISOString()
    }

    planlariKaydet([yeniPlan, ...planListesi])

    setFormMalzeme('')
    setFormTedarikci('')
    setFormSoforIletisim('')
    setFormSahaNotu('')
    setEklemeFormuAcik(false)
  }

  // Kart İçi Düzenleme Kaydet
  const handleDuzenlemeKaydet = (id) => {
    if (!duzMalzeme.trim()) {
      alert('Malzeme adı boş bırakılamaz.')
      return
    }

    const seciliS = santiyeler.find(s => s.id === duzSantiyeId)

    const guncelListe = planListesi.map(p => {
      if (p.id === id) {
        return {
          ...p,
          santiyeId: duzSantiyeId || p.santiyeId,
          santiyeAdi: seciliS?.ad || p.santiyeAdi,
          malzeme: duzMalzeme.trim(),
          tedarikci: duzTedarikci.trim(),
          tarih: duzTarih,
          tahminiSaat: duzTahminiSaat.trim(),
          soforIletisim: duzSoforIletisim.trim(),
          sahaNotu: duzSahaNotu.trim(),
        }
      }
      return p
    })

    planlariKaydet(guncelListe)
    setDuzenlenenId(null)
  }

  // Planı Sil
  const handlePlanSil = (id) => {
    if (window.confirm('Bu sevkiyat planını silmek istediğinize emin misiniz?')) {
      planlariKaydet(planListesi.filter(p => p.id !== id))
    }
  }

  // Hızlı Kabul Modalı Aç
  const handleKabulModaliAc = (plan) => {
    setKabulHedefPlan(plan)
    setKabulDurum('tam')
    setKabulIrsaliyeFoto('')
    setKabulFaturaFoto('')
    setKabulNotu(plan.sahaNotu ? `[Plan Hazırlık]: ${plan.sahaNotu}` : '')
    setKabulModalAcik(true)
  }

  // Fotoğraf Yükleme Yardımcısı
  const handleFotoYukle = (setter, e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setter(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Kabulü Tamamla ve Sevkiyat Kabul Sayfasına Aktar
  const handleKabulTamamla = (e) => {
    e.preventDefault()
    if (!kabulHedefPlan) return

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

    // 1. Sevkiyat Kabul Listesine Kaydet
    let mevcutKabuller = []
    try {
      const kayitli = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT)
      if (kayitli) mevcutKabuller = JSON.parse(kayitli)
    } catch (err) {
      console.error(err)
    }

    const yeniKabulKaydi = {
      id: 'sevkiyat-' + Date.now(),
      tarih: bugun(),
      saat: saatFormat,
      santiyeId: kabulHedefPlan.santiyeId,
      santiyeAdi: kabulHedefPlan.santiyeAdi,
      malzemeAdi: kabulHedefPlan.malzeme,
      tedarikci: kabulHedefPlan.tedarikci,
      teslimAlan: profile?.ad_soyad || 'Şantiye Yetkilisi',
      durum: kabulDurum,
      notlar: kabulNotu.trim(),
      fotoUrl: kabulIrsaliyeFoto || kabulFaturaFoto || '',
      faturaUrl: kabulFaturaFoto || '',
      olusturulduAt: new Date().toISOString(),
      bagliPlanId: kabulHedefPlan.id
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_SEVKIYAT, JSON.stringify([yeniKabulKaydi, ...mevcutKabuller]))
    } catch (err) {
      console.error(err)
    }

    // 2. Plan Durumunu 'teslim_alindi' yap
    const guncelPlanlar = planListesi.map(p => {
      if (p.id === kabulHedefPlan.id) {
        return {
          ...p,
          durum: 'teslim_alindi',
          teslimAlan: profile?.ad_soyad || 'Şantiye Yetkilisi',
          teslimTarihi: bugun() + ' ' + saatFormat
        }
      }
      return p
    })
    planlariKaydet(guncelPlanlar)

    setKabulModalAcik(false)
    setKabulHedefPlan(null)
  }

  // WhatsApp Paylaşımı
  const handleWhatsAppKopyala = () => {
    const bugunTarih = bugun()
    const hedefPlanlar = planListesi.filter(p => p.durum === 'bekliyor')

    if (hedefPlanlar.length === 0) {
      alert('Şu anda yolda bekleyen sevkiyat bulunmuyor.')
      return
    }

    let metin = `🚚 *ŞANTİYE SEVKİYAT PLANI* (${new Date().toLocaleDateString('tr-TR')})\n`
    metin += `Planlayan: ${profile?.ad_soyad || 'Serhat Hazar'}\n`
    metin += `------------------------------------\n\n`

    hedefPlanlar.forEach((p, i) => {
      metin += `${i + 1}) *${p.santiyeAdi}*\n`
      metin += `📦 *Malzeme:* ${p.malzeme}\n`
      metin += `📅 *Zaman:* ${p.tarih === bugunTarih ? 'BUGÜN' : p.tarih} (${p.tahminiSaat})\n`
      metin += `🏢 *Tedarikçi:* ${p.tedarikci}\n`
      if (p.soforIletisim) metin += `📞 *Nakliye/Şoför:* ${p.soforIletisim}\n`
      if (p.sahaNotu) metin += `⚠️ *Hazırlık Notu:* ${p.sahaNotu}\n`
      metin += `\n`
    })

    metin += `_Not: Malzeme sahaya ulaştığında Sevkiyat Kabul menüsünden irsaliye yükleyerek teslim alınız._`

    navigator.clipboard.writeText(metin)
    alert('📋 Sevkiyat planı panoya kopyalandı! WhatsApp grubuna yapıştırabilirsiniz.')
  }

  // İstatistikler
  const bugunTarih = bugun()
  const istatistikler = useMemo(() => {
    const bekleyen = planListesi.filter(p => p.durum === 'bekliyor').length
    const bugunGelecek = planListesi.filter(p => p.durum === 'bekliyor' && p.tarih === bugunTarih).length
    const teslimAlinan = planListesi.filter(p => p.durum === 'teslim_alindi').length
    const toplam = planListesi.length
    return { bekleyen, bugunGelecek, teslimAlinan, toplam }
  }, [planListesi, bugunTarih])

  // Filtreleme
  const gorunenPlanlar = useMemo(() => {
    return planListesi.filter(p => {
      // Sekme Filtresi
      if (sekme === 'bekliyor' && p.durum !== 'bekliyor') return false
      if (sekme === 'bugun' && (p.durum !== 'bekliyor' || p.tarih !== bugunTarih)) return false
      if (sekme === 'teslim' && p.durum !== 'teslim_alindi') return false

      // Şantiye Filtresi
      if (filtreSantiye !== 'hepsi' && p.santiyeId !== filtreSantiye) return false

      // Zaman Filtresi
      if (filtreZaman === 'bugun' && p.tarih !== bugunTarih) return false
      if (filtreZaman === 'gelecek' && p.tarih <= bugunTarih) return false
      if (filtreZaman === 'gecmis' && p.tarih >= bugunTarih) return false

      // Arama Metni
      if (aramaMetni.trim()) {
        const aranan = aramaMetni.toLocaleLowerCase('tr-TR')
        return (
          p.malzeme?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          p.tedarikci?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          p.santiyeAdi?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          p.soforIletisim?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          p.sahaNotu?.toLocaleLowerCase('tr-TR').includes(aranan)
        )
      }

      return true
    })
  }, [planListesi, sekme, filtreSantiye, filtreZaman, aramaMetni, bugunTarih])

  return (
    <div className="sayfa">
      {/* 1. SAYFA BAŞLIĞI */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>SEVKİYAT PLANLAMA</h2>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            Sahaya gelecek malzeme akışı, sevkiyat takvimi ve ekip hazırlığı
          </span>
        </div>

        <button 
          type="button" 
          onClick={() => navigate('/sevkiyat-kabul')}
          style={{
            background: '#FFFFFF',
            color: '#1D9596',
            border: '1.5px solid #1D9596',
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          📦 Sevkiyat Kabul & İrsaliye →
        </button>
      </div>

      {/* 2. DURUM FİLTRESİ MATRİSİ (Ekrana tam sığar, asla yana kaymaz) */}
      <div className="plan-durum-matrisi">
        <button 
          type="button"
          className={`plan-durum-kapsul ${sekme === 'tumu' ? 'aktif' : ''}`}
          onClick={() => setSekme('tumu')}
        >
          <span>Tümü</span>
          <strong>({istatistikler.toplam})</strong>
        </button>
        <button 
          type="button"
          className={`plan-durum-kapsul ${sekme === 'bekliyor' ? 'aktif' : ''}`}
          onClick={() => setSekme('bekliyor')}
        >
          <span>⏳ Yolda</span>
          <strong>({istatistikler.bekleyen})</strong>
        </button>
        <button 
          type="button"
          className={`plan-durum-kapsul ${sekme === 'bugun' ? 'aktif' : ''}`}
          onClick={() => setSekme('bugun')}
        >
          <span>🚨 Bugün</span>
          <strong>({istatistikler.bugunGelecek})</strong>
        </button>
        <button 
          type="button"
          className={`plan-durum-kapsul ${sekme === 'teslim' ? 'aktif' : ''}`}
          onClick={() => setSekme('teslim')}
        >
          <span>✅ Teslim</span>
          <strong>({istatistikler.teslimAlinan})</strong>
        </button>
      </div>

      {/* 3. ÖZET İSTATİSTİK KARTLARI (Tıklanabilir Hızlı Filtre) */}
      <div className="ozet-satiri" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div 
          className="ozet-kart" 
          onClick={() => setSekme('bekliyor')}
          style={{ 
            borderLeft: '4px solid #F59E0B', 
            cursor: 'pointer',
            background: sekme === 'bekliyor' ? '#FEF3C7' : '#FFFFFF',
            transition: 'all 0.15s ease'
          }}
          title="Yoldaki sevkiyatları listele"
        >
          <p className="ozet-etiket">⏳ Yoldaki / Bekleyen</p>
          <p className="ozet-tutar" style={{ color: '#D97706', fontSize: 20, fontWeight: 800 }}>
            {istatistikler.bekleyen} <small style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>Sevkiyat</small>
          </p>
        </div>

        <div 
          className="ozet-kart" 
          onClick={() => setSekme('bugun')}
          style={{ 
            borderLeft: '4px solid #EA580C', 
            cursor: 'pointer',
            background: sekme === 'bugun' ? '#FFEDD5' : (istatistikler.bugunGelecek > 0 ? '#FFF7ED' : '#FFFFFF'),
            transition: 'all 0.15s ease'
          }}
          title="Bugün sahaya gelecekleri listele"
        >
          <p className="ozet-etiket">🚨 Bugün Sahaya Gelecek</p>
          <p className="ozet-tutar" style={{ color: '#EA580C', fontSize: 20, fontWeight: 800 }}>
            {istatistikler.bugunGelecek} <small style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>Teslimat</small>
          </p>
        </div>

        <div 
          className="ozet-kart" 
          onClick={() => setSekme('teslim')}
          style={{ 
            borderLeft: '4px solid #10B981', 
            cursor: 'pointer',
            background: sekme === 'teslim' ? '#DCFCE7' : '#FFFFFF',
            transition: 'all 0.15s ease'
          }}
          title="Teslim alınanları listele"
        >
          <p className="ozet-etiket">✅ Kabul Edilen / Arşiv</p>
          <p className="ozet-tutar" style={{ color: '#059669', fontSize: 20, fontWeight: 800 }}>
            {istatistikler.teslimAlinan} <small style={{ fontSize: 12, fontWeight: 500, color: '#64748B' }}>Teslim</small>
          </p>
        </div>
      </div>

      {/* 4. YENİ SEVKİYAT PLANI EKLEME ALANI (EN ÜSTTE, UYGULAMANIN STANDART .ekleme-kutusu YAPISI) */}
      {isYoneticiSerhat && (
        <div style={{ marginBottom: 16 }}>
          {!eklemeFormuAcik ? (
            <button 
              className="ekle-buton-genis" 
              onClick={() => setEklemeFormuAcik(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              ➕ Yeni Sevkiyat Planla
            </button>
          ) : (
            <div className="ekleme-kutusu" style={{ border: '2px solid #1D9596', marginTop: 0, marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#117575', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🚚 YENİ SEVKİYAT PLANI OLUŞTUR
                </span>
                <button 
                  type="button" 
                  onClick={() => setEklemeFormuAcik(false)}
                  style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748B' }}
                >
                  ✕
                </button>
              </div>

              {/* Şantiye Seçici */}
              <div>
                <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Gideceği Şantiye:
                </label>
                <select 
                  value={formSantiyeId} 
                  onChange={(e) => setFormSantiyeId(e.target.value)} 
                  className="santiye-secici-form"
                >
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </div>

              {/* Malzeme Cinsi ve Miktarı */}
              <div>
                <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Malzeme Cinsi & Miktarı:
                </label>
                <input 
                  type="text" 
                  placeholder="Örn: Ø16 - Ø20 Demir 26 Ton (1 Tır), 14 Palet Tuğla..." 
                  value={formMalzeme} 
                  onChange={(e) => setFormMalzeme(e.target.value)} 
                />

                {/* Hızlı Şablon Hapları */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {HAZIR_MALZEME_SABLONLARI.map((sablon, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormMalzeme(sablon)}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 14,
                        border: '1px solid #E2E8F0',
                        background: formMalzeme === sablon ? '#E6F4F1' : '#FFFFFF',
                        color: formMalzeme === sablon ? '#117575' : '#475569',
                        fontWeight: formMalzeme === sablon ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {sablon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tedarikçi Firma Seçici (CariAramaSecici ile Entegre) */}
              <div>
                <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Tedarikçi / Satıcı Firma:
                </label>
                <CariAramaSecici
                  deger={formTedarikci}
                  onDegisti={(isim) => setFormTedarikci(isim)}
                  placeholder="Tedarikçi veya firma adı ara/yaz (Kardemir, Işıklar, Akçansa...)"
                />
              </div>

              {/* Tarih & Tahmini Saat Aralığı */}
              <div className="ekleme-satiri-2">
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Planlanan Varış Tarihi:
                  </label>
                  <input 
                    type="date" 
                    value={formTarih} 
                    onChange={(e) => setFormTarih(e.target.value)} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Tahmini Saat:
                  </label>
                  <input 
                    type="text" 
                    placeholder="Örn: 10:00 - 12:00" 
                    value={formTahminiSaat} 
                    onChange={(e) => setFormTahminiSaat(e.target.value)} 
                  />
                </div>
              </div>

              {/* Nakliye Araç Plakası & Şoför Telefonu */}
              <div>
                <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Nakliye Araç Plakası & Şoför İletişimi:
                </label>
                <input 
                  type="text" 
                  placeholder="Örn: 34 DM 8812 - Şoför Mehmet Bey (0532 555 44 33)" 
                  value={formSoforIletisim} 
                  onChange={(e) => setFormSoforIletisim(e.target.value)} 
                />
              </div>

              {/* Şantiye Şefine Saha Hazırlık Notu */}
              <div>
                <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Şantiye Şefine Talimat / Hazırlık Notu:
                </label>
                <textarea 
                  placeholder="Örn: Kule vinç 11:00'de hazır olsun, 2. kat tabliyesine doğrudan alınacak..." 
                  value={formSahaNotu} 
                  onChange={(e) => setFormSahaNotu(e.target.value)} 
                  rows={2}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />

                {/* Hızlı Talimat Şablonları */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {HAZIR_TALIMATLAR.map((talimat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormSahaNotu(prev => prev ? `${prev} • ${talimat}` : talimat)}
                      style={{
                        fontSize: 10.5,
                        padding: '3px 8px',
                        borderRadius: 14,
                        border: '1px dashed #CBD5E1',
                        background: '#F8FAFC',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      + {talimat}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button 
                  type="button" 
                  onClick={() => setEklemeFormuAcik(false)}
                  style={{ flex: 1, padding: 12, background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                >
                  Vazgeç
                </button>
                <button 
                  type="button" 
                  className="ekle-buton-genis" 
                  onClick={handlePlanEkle}
                  style={{ flex: 2, margin: 0 }}
                >
                  🚚 Planı Kaydet & Şeflere Yayınla
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. FİLTRE VE SIRALAMA ALANI (Masraflar ve Gelirler ile aynı formatta) */}
      <div style={{ marginBottom: 14 }}>
        <button 
          className="ekle-buton-genis" 
          onClick={() => setFiltreAcik(!filtreAcik)}
          style={{ background: '#FFFFFF', color: '#1D9596', border: '1.5px solid #1D9596', boxShadow: 'none' }}
        >
          {filtreAcik ? '▲ Filtre ve Arama Seçeneklerini Gizle' : (
            (filtreSantiye !== 'hepsi' || filtreZaman !== 'hepsi' || aramaMetni)
              ? '▼ Filtre ve Arama Seçenekleri (Aktif Filtre Var)'
              : '▼ Filtre ve Arama Seçeneklerini Göster'
          )}
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#FDFDFD', marginTop: 0 }}>
          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
          <select 
            value={filtreSantiye} 
            onChange={(e) => setFiltreSantiye(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}
          >
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map((s) => (
              <option key={s.id} value={s.id}>{s.ad}</option>
            ))}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Tarih / Zaman Filtresi</p>
          <select 
            value={filtreZaman} 
            onChange={(e) => setFiltreZaman(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}
          >
            <option value="hepsi">Tüm Tarihler</option>
            <option value="bugun">📅 Sadece Bugün Gelecekler</option>
            <option value="gelecek">🔮 İleri Tarihliler</option>
            <option value="gecmis">⏮️ Geçmiştekiler</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Metin Arama (Malzeme, Tedarikçi, Şoför)</p>
          <input 
            type="text" 
            placeholder="Arama yapın..." 
            value={aramaMetni} 
            onChange={(e) => setAramaMetni(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={() => {
                setFiltreSantiye('hepsi')
                setFiltreZaman('hepsi')
                setAramaMetni('')
              }}
              style={{ flex: 1, padding: '8px 12px', background: '#F1F5F9', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            >
              Filtreleri Temizle
            </button>
            <button 
              type="button" 
              onClick={handleWhatsAppKopyala}
              style={{ flex: 1, padding: '8px 12px', background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >
              📱 WhatsApp Raporunu Kopyala
            </button>
          </div>
        </div>
      )}

      {/* 6. SEVKİYAT PLANI KARTLARI LİSTESİ (Uygulamanın standart .liste ve .kart mimarisi) */}
      <div className="liste">
        {gorunenPlanlar.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
            <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>🚚</span>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', margin: '0 0 4px' }}>
              Seçilen kriterlere uygun sevkiyat planı bulunmuyor
            </p>
            <p style={{ fontSize: 12.5, margin: 0 }}>
              {isYoneticiSerhat 
                ? 'Yukarıdaki "+ Yeni Sevkiyat Planla" butonuyla yeni bir teslimat planı girebilirsiniz.' 
                : 'Şu anda şantiyeleriniz için planlanan aktif bir malzeme bulunmamaktadır.'}
            </p>
          </div>
        ) : (
          gorunenPlanlar.map((plan) => {
            const isBekliyor = plan.durum === 'bekliyor'
            const isBugun = plan.tarih === bugunTarih

            return (
              <div 
                key={plan.id} 
                className="kart" 
                style={{
                  borderLeft: isBugun && isBekliyor 
                    ? '5px solid #EA580C' 
                    : isBekliyor 
                      ? '5px solid #1D9596' 
                      : '5px solid #10B981',
                  background: !isBekliyor ? '#F8FAFC' : '#FFFFFF',
                  opacity: !isBekliyor ? 0.88 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 10
                }}
              >
                {/* DÜZENLEME MODU (IN-PLACE DÜZENLEME - UYGULAMA İLE BİREBİR AYNI) */}
                {duzenlenenId === plan.id && isYoneticiSerhat ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: '#117575' }}>
                      ✏️ SEVKİYAT PLANINI DÜZENLE
                    </p>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Şantiye:</label>
                      <select 
                        value={duzSantiyeId} 
                        onChange={(e) => setDuzSantiyeId(e.target.value)} 
                        className="santiye-secici-form"
                      >
                        {santiyeler.map((s) => (
                          <option key={s.id} value={s.id}>{s.ad}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Malzeme & Miktar:</label>
                      <input 
                        type="text" 
                        value={duzMalzeme} 
                        onChange={(e) => setDuzMalzeme(e.target.value)} 
                        placeholder="Malzeme adı ve miktarı..." 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Tedarikçi Firma:</label>
                      <CariAramaSecici
                        deger={duzTedarikci}
                        onDegisti={(isim) => setDuzTedarikci(isim)}
                        placeholder="Tedarikçi firma adı..."
                      />
                    </div>

                    <div className="ekleme-satiri-2">
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Tarih:</label>
                        <input 
                          type="date" 
                          value={duzTarih} 
                          onChange={(e) => setDuzTarih(e.target.value)} 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Saat:</label>
                        <input 
                          type="text" 
                          value={duzTahminiSaat} 
                          onChange={(e) => setDuzTahminiSaat(e.target.value)} 
                          placeholder="Tahmini saat..." 
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Nakliye Plakası & Şoför Tel:</label>
                      <input 
                        type="text" 
                        value={duzSoforIletisim} 
                        onChange={(e) => setDuzSoforIletisim(e.target.value)} 
                        placeholder="Şoför iletişim..." 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Saha Hazırlık Notu:</label>
                      <textarea 
                        value={duzSahaNotu} 
                        onChange={(e) => setDuzSahaNotu(e.target.value)} 
                        placeholder="Şeflere saha talimatı..." 
                        rows={2} 
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button 
                        type="button" 
                        onClick={() => setDuzenlenenId(null)} 
                        style={{ flex: 1, padding: 8, background: '#F1F5F9', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                      >
                        Vazgeç
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDuzenlemeKaydet(plan.id)} 
                        style={{ flex: 1, padding: 8, background: '#1D9596', color: '#FFFFFF', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  /* NORMAL KART GÖRÜNÜMÜ */
                  <>
                    <div className="kart-ust" style={{ alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                        <span className="kart-baslik" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                          📦 {plan.malzeme}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                          🏢 {plan.tedarikci}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isBugun && isBekliyor && (
                          <span className="durum-rozet" style={{ background: '#FFEDD5', color: '#C2410C', fontWeight: 800, border: '1px solid #FDBA74' }}>
                            🚨 BUGÜN
                          </span>
                        )}

                        {isBekliyor ? (
                          <span className="durum-rozet rozet-sari" style={{ fontWeight: 700 }}>
                            ⏳ Yolda
                          </span>
                        ) : (
                          <span className="durum-rozet rozet-yesil" style={{ fontWeight: 700 }}>
                            ✅ Teslim Alındı
                          </span>
                        )}

                        {isYoneticiSerhat && (
                          <>
                            <button 
                              className="sil-buton" 
                              onClick={() => {
                                setDuzenlenenId(plan.id)
                                setDuzSantiyeId(plan.santiyeId)
                                setDuzMalzeme(plan.malzeme)
                                setDuzTedarikci(plan.tedarikci || '')
                                setDuzTarih(plan.tarih)
                                setDuzTahminiSaat(plan.tahminiSaat || '')
                                setDuzSoforIletisim(plan.soforIletisim || '')
                                setDuzSahaNotu(plan.sahaNotu || '')
                              }}
                              title="Planı Düzenle"
                              aria-label="Düzenle"
                            >
                              ✎
                            </button>
                            <button 
                              className="sil-buton" 
                              onClick={() => handlePlanSil(plan.id)}
                              title="Planı Sil"
                              aria-label="Sil"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* ETİKET SATIRI */}
                    <div className="etiket-satiri" style={{ flexWrap: 'wrap', gap: 4 }}>
                      <span className="etiket etiket-vurgu">
                        🏗️ {plan.santiyeAdi}
                      </span>
                      <span className="etiket" style={{ background: '#F1F5F9', color: '#334155' }}>
                        📅 {tarihFormatlaTR(plan.tarih)} ({plan.tahminiSaat})
                      </span>
                      {plan.soforIletisim && (
                        <span className="etiket" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                          🚚 {plan.soforIletisim}
                        </span>
                      )}
                    </div>

                    {/* SAHA HAZIRLIK NOTU (KULE VİNÇ, EKİP, ALAN UYARISI) */}
                    {plan.sahaNotu && (
                      <div style={{ background: '#FEFCE8', border: '1px dashed #FDE047', padding: '8px 10px', borderRadius: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#854D0E', display: 'block', marginBottom: 2 }}>
                          ⚠️ ŞEF SAHA HAZIRLIK NOTU:
                        </span>
                        <p style={{ margin: 0, fontSize: 12.5, color: '#713F12', lineHeight: 1.35 }}>
                          {plan.sahaNotu}
                        </p>
                      </div>
                    )}

                    {/* EĞER TESLİM ALINDI İSE ŞEF BİLGİSİ */}
                    {!isBekliyor && plan.teslimAlan && (
                      <div style={{ fontSize: 11.5, color: '#166534', background: '#F0FDF4', padding: '6px 10px', borderRadius: 6, border: '1px solid #BBF7D0', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>✓ Teslim Alan: <strong>{plan.teslimAlan}</strong> ({plan.teslimTarihi || 'Kabul Edildi'})</span>
                        <button
                          type="button"
                          onClick={() => navigate('/sevkiyat-kabul')}
                          style={{ background: 'none', border: 'none', color: '#15803D', fontWeight: 700, fontSize: 11, cursor: 'pointer', padding: 0 }}
                        >
                          İrsaliye Görselini İncele →
                        </button>
                      </div>
                    )}

                    {/* ALT HIZLI AKSİYONLAR */}
                    {isBekliyor && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, paddingTop: 6, borderTop: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleKabulModaliAc(plan)}
                          style={{
                            flex: 2,
                            padding: '8px 12px',
                            background: '#1D9596',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 8,
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          📸 Sahaya Ulaştı: Teslim Al & Belgeleri Yükle
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const metin = `🚚 *Şantiye Sevkiyat Bildirimi*\nŞantiye: ${plan.santiyeAdi}\nMalzeme: ${plan.malzeme}\nTedarikçi: ${plan.tedarikci}\nVarış: ${plan.tarih} (${plan.tahminiSaat})\nNakliye: ${plan.soforIletisim || 'Belirtilmedi'}\nHazırlık: ${plan.sahaNotu || 'Hazır olunsun.'}`
                            navigator.clipboard.writeText(metin)
                            alert('📋 WhatsApp bildirim metni panoya kopyalandı!')
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            background: '#F0FDF4',
                            color: '#166534',
                            border: '1px solid #BBF7D0',
                            borderRadius: 8,
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          📱 WhatsApp
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: SEVKİYATI TESLİM AL & İRSALİYE/FATURA YÜKLE           */}
      {/* ============================================================ */}
      {kabulModalAcik && kabulHedefPlan && (
        <div className="modal-arka-plan" onClick={() => setKabulModalAcik(false)}>
          <div className="modal-kutu" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #E2E8F0', paddingBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                📸 Malzemeyi Teslim Al & İrsaliye Yükle
              </h3>
              <button 
                type="button" 
                onClick={() => setKabulModalAcik(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleKabulTamamla}>
              {/* Özet Kutusu */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#64748B' }}>🏗️ Şantiye:</span>
                  <strong>{kabulHedefPlan.santiyeAdi}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#64748B' }}>📦 Malzeme:</span>
                  <strong style={{ color: '#1D9596' }}>{kabulHedefPlan.malzeme}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>🏢 Tedarikçi:</span>
                  <span>{kabulHedefPlan.tedarikci}</span>
                </div>
              </div>

              {/* Teslimat Durumu */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  Teslimat Durumu:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setKabulDurum('tam')}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: `1.5px solid ${kabulDurum === 'tam' ? '#10B981' : '#E2E8F0'}`,
                      background: kabulDurum === 'tam' ? '#ECFDF5' : '#FFFFFF',
                      color: kabulDurum === 'tam' ? '#047857' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Eksiksiz
                  </button>
                  <button
                    type="button"
                    onClick={() => setKabulDurum('eksik')}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: `1.5px solid ${kabulDurum === 'eksik' ? '#F59E0B' : '#E2E8F0'}`,
                      background: kabulDurum === 'eksik' ? '#FFFBEB' : '#FFFFFF',
                      color: kabulDurum === 'eksik' ? '#B45309' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ Eksik Var
                  </button>
                  <button
                    type="button"
                    onClick={() => setKabulDurum('hasarli')}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      border: `1.5px solid ${kabulDurum === 'hasarli' ? '#EF4444' : '#E2E8F0'}`,
                      background: kabulDurum === 'hasarli' ? '#FEF2F2' : '#FFFFFF',
                      color: kabulDurum === 'hasarli' ? '#B91C1C' : '#475569',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ❌ Hasarlı / İade
                  </button>
                </div>
              </div>

              {/* İrsaliye Belgesi Fotoğrafı */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  📸 İrsaliye / Teslim Fişi Fotoğrafı:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFotoYukle(setKabulIrsaliyeFoto, e)}
                  style={{ width: '100%', fontSize: 12 }}
                />
                {kabulIrsaliyeFoto && (
                  <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={kabulIrsaliyeFoto} 
                      alt="İrsaliye Önizleme" 
                      style={{ maxHeight: 110, borderRadius: 8, border: '1px solid #CBD5E1' }} 
                    />
                    <button
                      type="button"
                      onClick={() => setKabulIrsaliyeFoto('')}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Fatura / Kantar Fişi Görseli */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  🧾 Fatura / Kantar Fişi / Ek Belge (Varsa):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFotoYukle(setKabulFaturaFoto, e)}
                  style={{ width: '100%', fontSize: 12 }}
                />
                {kabulFaturaFoto && (
                  <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                    <img 
                      src={kabulFaturaFoto} 
                      alt="Fatura Önizleme" 
                      style={{ maxHeight: 110, borderRadius: 8, border: '1px solid #CBD5E1' }} 
                    />
                    <button
                      type="button"
                      onClick={() => setKabulFaturaFoto('')}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Teslim Notu */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Teslim Notu / Açıklama:
                </label>
                <textarea
                  placeholder="İndirilen kat, eksik sayısı veya teslim detayları..."
                  value={kabulNotu}
                  onChange={(e) => setKabulNotu(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setKabulModalAcik(false)}
                  style={{ flex: 1, padding: 10, background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: 10,
                    background: '#1D9596',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13
                  }}
                >
                  ✓ Teslim Al & Arşive Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
