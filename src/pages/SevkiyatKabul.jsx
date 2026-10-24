import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { LOCAL_STORAGE_SEVKIYAT_PLAN } from './SevkiyatPlanlama'

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

export const LOCAL_STORAGE_SEVKIYAT = 'santiye_sevkiyat_kayitlari_v1'

export default function SevkiyatKabul() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Serhat Hazar (Yönetici) kontrolü
  const isYoneticiSerhat = Boolean(
    profile?.sistem_yoneticisi ||
    profile?.ad_soyad?.toLowerCase().includes('serhat') ||
    profile?.email?.toLowerCase().includes('serhat') ||
    profile?.rol === 'yonetici' ||
    profile?.rol === 'koordinator'
  )

  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [aktifSekme, setAktifSekme] = useState('planlananlar') // 'planlananlar' | 'kabul_edilenler'
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtreAcik, setFiltreAcik] = useState(false)
  const [sevkiyatListesi, setSevkiyatListesi] = useState([])
  const [bekleyenPlanlar, setBekleyenPlanlar] = useState([])
  const [buyukFotoUrl, setBuyukFotoUrl] = useState(null)

  // Form State'leri
  const [formAcik, setFormAcik] = useState(false)
  const [formTarih, setFormTarih] = useState(bugun())
  const [formSantiyeId, setFormSantiyeId] = useState('')
  const [formMalzemeAdi, setFormMalzemeAdi] = useState('')
  const [formTedarikci, setFormTedarikci] = useState('')
  const [formDurum, setFormDurum] = useState('tam') // 'tam' | 'eksik' | 'hasarli'
  const [formNotlar, setFormNotlar] = useState('')
  const [formFotoUrl, setFormFotoUrl] = useState('')
  const [formFaturaUrl, setFormFaturaUrl] = useState('')
  const [bagliPlanId, setBagliPlanId] = useState(null)

  useEffect(() => {
    if (aktifSantiye?.id) {
      setSeciliSantiyeId(aktifSantiye.id)
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  // Bekleyen sevkiyat planlarını oku
  const bekleyenPlanlariYukle = () => {
    try {
      const kayitliPlanlar = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT_PLAN)
      if (kayitliPlanlar) {
        const planlar = JSON.parse(kayitliPlanlar)
        setBekleyenPlanlar(planlar.filter(p => p.durum === 'bekliyor'))
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    bekleyenPlanlariYukle()
  }, [])

  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT)
      if (kayitli) {
        setSevkiyatListesi(JSON.parse(kayitli))
      } else {
        const ornek = [
          {
            id: 's-1',
            tarih: bugun(),
            saat: '09:15',
            santiyeId: aktifSantiye?.id || (santiyeler[0]?.id || 'santiye-1'),
            santiyeAdi: aktifSantiye?.ad || (santiyeler[0]?.ad || 'Merkez Şantiye'),
            malzemeAdi: 'Ø16 ve Ø20 B420C Nervürlü İnşaat Demiri (1 Tır)',
            tedarikci: 'Kardemir / Özçelik Demir Çelik',
            teslimAlan: profile?.ad_soyad || 'Şantiye Şefi',
            durum: 'tam',
            notlar: 'Kantar fişi ve fabrika analiz belgesi mevcut, sahaya indirildi.',
            fotoUrl: '',
            faturaUrl: '',
            olusturulduAt: new Date().toISOString()
          },
          {
            id: 's-2',
            tarih: bugun(),
            saat: '11:40',
            santiyeId: aktifSantiye?.id || (santiyeler[0]?.id || 'santiye-1'),
            santiyeAdi: aktifSantiye?.ad || (santiyeler[0]?.ad || 'Merkez Şantiye'),
            malzemeAdi: "13.5'luk Yatay Delikli İzolasyon Tuğlası (14 Palet)",
            tedarikci: 'Işıklar Tuğla A.Ş.',
            teslimAlan: profile?.ad_soyad || 'Şantiye Şefi',
            durum: 'tam',
            notlar: 'Paletler vinçle 2. kata alındı.',
            fotoUrl: '',
            faturaUrl: '',
            olusturulduAt: new Date().toISOString()
          }
        ]
        setSevkiyatListesi(ornek)
        localStorage.setItem(LOCAL_STORAGE_SEVKIYAT, JSON.stringify(ornek))
      }
    } catch (e) {
      console.error(e)
    }
  }, [aktifSantiye, santiyeler, profile])

  const sevkiyatlariKaydet = (yeniListe) => {
    setSevkiyatListesi(yeniListe)
    try {
      localStorage.setItem(LOCAL_STORAGE_SEVKIYAT, JSON.stringify(yeniListe))
    } catch (e) {
      console.error(e)
    }
  }

  // Fotoğraf Yükleme / Base64 Önizleme
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

  // Yeni Sevkiyat Kaydet
  const handleSevkiyatKaydet = (e) => {
    e.preventDefault()
    if (!formMalzemeAdi.trim()) {
      alert('Lütfen gelen malzemenin adını veya cinsini belirtin.')
      return
    }

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const hedefSantiyeId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id || ''
    const santiyeObj = santiyeler.find(s => s.id === hedefSantiyeId) || aktifSantiye

    const yeniSevkiyat = {
      id: 'sevkiyat-' + Date.now(),
      tarih: formTarih || bugun(),
      saat: saatFormat,
      santiyeId: hedefSantiyeId,
      santiyeAdi: santiyeObj?.ad || 'Şantiye',
      malzemeAdi: formMalzemeAdi.trim(),
      tedarikci: (isYoneticiSerhat || formTedarikci) ? (formTedarikci.trim() || 'Tedarikçi Belirtilmedi') : '',
      teslimAlan: profile?.ad_soyad || 'Şantiye Yetkilisi',
      durum: formDurum,
      notlar: formNotlar.trim(),
      fotoUrl: formFotoUrl,
      faturaUrl: formFaturaUrl,
      olusturulduAt: new Date().toISOString(),
      bagliPlanId: bagliPlanId || null
    }

    sevkiyatlariKaydet([yeniSevkiyat, ...sevkiyatListesi])

    // Eğer bir plandan teslim alındıysa, o planın durumunu "teslim_alindi" yap
    if (bagliPlanId) {
      try {
        const kayitliPlanlar = localStorage.getItem(LOCAL_STORAGE_SEVKIYAT_PLAN)
        if (kayitliPlanlar) {
          const planlar = JSON.parse(kayitliPlanlar)
          const guncelPlanlar = planlar.map(p => {
            if (p.id === bagliPlanId) {
              return {
                ...p,
                durum: 'teslim_alindi',
                teslimAlan: profile?.ad_soyad || 'Şantiye Yetkilisi',
                teslimTarihi: bugun() + ' ' + saatFormat
              }
            }
            return p
          })
          localStorage.setItem(LOCAL_STORAGE_SEVKIYAT_PLAN, JSON.stringify(guncelPlanlar))
          bekleyenPlanlariYukle()
        }
      } catch (err) {
        console.error(err)
      }
    }

    setFormAcik(false)
    setFormMalzemeAdi('')
    setFormTedarikci('')
    setFormNotlar('')
    setFormFotoUrl('')
    setFormFaturaUrl('')
    setBagliPlanId(null)
    setAktifSekme('kabul_edilenler')
  }

  // Plandan Hızlı Kabul Aç
  const handlePlandanHizliKabulAc = (plan) => {
    setBagliPlanId(plan.id)
    setFormSantiyeId(plan.santiyeId)
    setFormTarih(bugun())
    setFormMalzemeAdi(plan.malzeme)
    setFormTedarikci(plan.tedarikci || '')
    setFormDurum('tam')
    setFormNotlar(plan.sahaNotu ? `[Plan Notu]: ${plan.sahaNotu}` : '')
    setFormFotoUrl('')
    setFormFaturaUrl('')
    setFormAcik(true)
  }

  const handleSevkiyatSil = (id) => {
    if (window.confirm('Bu teslimat kaydını silmek istediğinize emin misiniz?')) {
      sevkiyatlariKaydet(sevkiyatListesi.filter(s => s.id !== id))
    }
  }

  // WhatsApp Rapor Metnini Kopyalama
  const handleWhatsAppKopyala = () => {
    if (filtrelenmisSevkiyatlar.length === 0) {
      alert('Kopyalanacak sevkiyat kaydı bulunmuyor.')
      return
    }

    let metin = `📦 *GÜNLÜK SEVKİYAT VE İRSALİYE KABUL RAPORU*\n`
    metin += `🏗️ Şantiye: ${santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Tüm Şantiyeler'}\n`
    metin += `------------------------------------\n`

    filtrelenmisSevkiyatlar.forEach((s, i) => {
      metin += `${i + 1}) *${s.malzemeAdi}*\n`
      metin += `   📅 Tarih: ${tarihFormatlaTR(s.tarih)} - ${s.saat}\n`
      if (isYoneticiSerhat && s.tedarikci) {
        metin += `   🏢 Tedarikçi: ${s.tedarikci}\n`
      }
      metin += `   Durum: ${s.durum === 'tam' ? '✓ Eksiksiz Teslim' : (s.durum === 'eksik' ? '⚠️ Eksik Var' : '❌ Hasarlı')}\n`
      if (s.notlar) metin += `   📝 Not: ${s.notlar}\n`
      metin += `\n`
    })

    navigator.clipboard.writeText(metin)
    alert('📋 WhatsApp raporu panoya kopyalandı! Şirket grubuna yapıştırabilirsiniz.')
  }

  // Filtreleme
  const filtrelenmisSevkiyatlar = useMemo(() => {
    return sevkiyatListesi.filter(item => {
      if (seciliSantiyeId && item.santiyeId && item.santiyeId !== seciliSantiyeId) return false
      if (aramaMetni.trim()) {
        const aranan = aramaMetni.toLocaleLowerCase('tr-TR')
        return (
          item.malzemeAdi?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.tedarikci?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.notlar?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.teslimAlan?.toLocaleLowerCase('tr-TR').includes(aranan) ||
          item.santiyeAdi?.toLocaleLowerCase('tr-TR').includes(aranan)
        )
      }
      return true
    })
  }, [sevkiyatListesi, seciliSantiyeId, aramaMetni])

  // Şantiyeye göre filtrelenmiş bekleyen planlar
  const filtrelenmisBekleyenPlanlar = useMemo(() => {
    return bekleyenPlanlar.filter(p => {
      if (seciliSantiyeId && p.santiyeId && p.santiyeId !== seciliSantiyeId) return false
      return true
    })
  }, [bekleyenPlanlar, seciliSantiyeId])

  return (
    <div className="sayfa">
      {/* 1. BAŞLIK VE GEÇİŞ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>SEVKİYAT & İRSALİYE KABUL</h2>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            Sahaya gelen malzemelerin kabulü, irsaliye ve fatura fotoğrafları
          </span>
        </div>

        {isYoneticiSerhat && (
          <button 
            type="button" 
            onClick={() => navigate('/sevkiyat-planlama')}
            style={{
              background: '#FFFFFF',
              color: '#1D9596',
              border: '1.5px solid #1D9596',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            🚚 Sevkiyat Planlama'ya Geç →
          </button>
        )}
      </div>

      {/* ŞANTİYE ŞEFLERİ VE EKİP İÇİN SEKMELER */}
      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button 
          type="button"
          className={aktifSekme === 'planlananlar' ? 'secili-tab' : ''} 
          onClick={() => setAktifSekme('planlananlar')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}
        >
          🚚 Sevkiyatlar ({filtrelenmisBekleyenPlanlar.length})
        </button>
        <button 
          type="button"
          className={aktifSekme === 'kabul_edilenler' ? 'secili-tab' : ''} 
          onClick={() => {
            setFormAcik(false)
            setAktifSekme('kabul_edilenler')
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}
        >
          📦 Teslim Alınanlar ({filtrelenmisSevkiyatlar.length})
        </button>
      </div>

      {/* 2. SEVKİYATLAR SEKMESİ (ŞEFLER İÇİN) */}
      {aktifSekme === 'planlananlar' && (
        <div style={{ marginBottom: 16 }}>
          {/* HIZLI / HABERSİZ GELEN SEVKİYAT İÇİN ŞEF KABUL BUTONU & AÇIKLAMA */}
          <div style={{ marginBottom: 14 }}>
            {!formAcik ? (
              <div style={{ 
                background: '#F0FDFA', 
                border: '1.5px dashed #14B8A6', 
                padding: '12px 14px', 
                borderRadius: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>ℹ️</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#0F766E' }}>
                      Plansız / Doğrudan Sevkiyat Kabulü
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.45 }}>
                    💡 <em>Tarafımca unutma, habersiz vs. sebeplerden oluşturulmamış bir kaydı şantiye şefinin oluşturabilmesi için yapılmıştır.</em>
                  </p>
                </div>

                <button 
                  type="button" 
                  className="ekle-buton-genis" 
                  onClick={() => {
                    setBagliPlanId(null)
                    setFormTarih(bugun())
                    setFormSantiyeId(seciliSantiyeId || aktifSantiye?.id || '')
                    setFormMalzemeAdi('')
                    setFormTedarikci('')
                    setFormNotlar('')
                    setFormFotoUrl('')
                    setFormFaturaUrl('')
                    setFormAcik(true)
                  }}
                  style={{ flex: '0 0 auto', padding: '10px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
                >
                  📸 + Yeni Sevkiyat Kabul Et
                </button>
              </div>
            ) : (
              <div className="ekleme-kutusu" style={{ border: '2px solid #1D9596', marginTop: 0, marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#117575' }}>
                    📦 SEVKİYAT & İRSALİYE KABUL FORMU
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setFormAcik(false)}
                    style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748B' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Şantiye Seçici */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Kabul Edilen Şantiye:
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

                {/* Malzeme Adı */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Gelen Malzeme Cinsi & Miktarı:
                  </label>
                  <input 
                    type="text" 
                    placeholder="Örn: 26 Ton Nervürlü Demir, 14 Palet Tuğla..." 
                    value={formMalzemeAdi} 
                    onChange={(e) => setFormMalzemeAdi(e.target.value)} 
                  />
                </div>

                {/* Tedarikçi Firma (Yönetici Serhat ise) */}
                {isYoneticiSerhat && (
                  <div>
                    <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Tedarikçi / Taşeron Firma:
                    </label>
                    <input 
                      type="text" 
                      placeholder="Tedarikçi firma adı..." 
                      value={formTedarikci} 
                      onChange={(e) => setFormTedarikci(e.target.value)} 
                    />
                  </div>
                )}

                {/* Teslimat Durumu */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Teslimat Durumu:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFormDurum('tam')}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: `1.5px solid ${formDurum === 'tam' ? '#10B981' : '#E2E8F0'}`,
                        background: formDurum === 'tam' ? '#ECFDF5' : '#FFFFFF',
                        color: formDurum === 'tam' ? '#047857' : '#475569',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Eksiksiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDurum('eksik')}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: `1.5px solid ${formDurum === 'eksik' ? '#F59E0B' : '#E2E8F0'}`,
                        background: formDurum === 'eksik' ? '#FFFBEB' : '#FFFFFF',
                        color: formDurum === 'eksik' ? '#B45309' : '#475569',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ⚠️ Eksik Var
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormDurum('hasarli')}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: `1.5px solid ${formDurum === 'hasarli' ? '#EF4444' : '#E2E8F0'}`,
                        background: formDurum === 'hasarli' ? '#FEF2F2' : '#FFFFFF',
                        color: formDurum === 'hasarli' ? '#B91C1C' : '#475569',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Hasarlı
                    </button>
                  </div>
                </div>

                {/* İrsaliye Görseli */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    📸 İrsaliye Belgesi Fotoğrafı:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFotoYukle(setFormFotoUrl, e)}
                  />
                  {formFotoUrl && (
                    <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                      <img src={formFotoUrl} alt="İrsaliye" style={{ maxHeight: 90, borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button
                        type="button"
                        onClick={() => setFormFotoUrl('')}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Fatura Görseli */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    🧾 Fatura / Kantar Fişi Görseli (Opsiyonel):
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFotoYukle(setFormFaturaUrl, e)}
                  />
                  {formFaturaUrl && (
                    <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                      <img src={formFaturaUrl} alt="Fatura" style={{ maxHeight: 90, borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button
                        type="button"
                        onClick={() => setFormFaturaUrl('')}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11 }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Not */}
                <div>
                  <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Teslim Notu:
                  </label>
                  <textarea
                    placeholder="Malzemenin indirildiği kat, teslim alan notu..."
                    value={formNotlar}
                    onChange={(e) => setFormNotlar(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button 
                    type="button" 
                    onClick={() => setFormAcik(false)}
                    style={{ flex: 1, padding: 10, background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                  >
                    Vazgeç
                  </button>
                  <button 
                    type="button" 
                    className="ekle-buton-genis" 
                    onClick={handleSevkiyatKaydet}
                    style={{ flex: 2, margin: 0 }}
                  >
                    ✓ Kabulü Kaydet & Teslim Alınanlara Ekle
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Planlanan Sevkiyatlar Listesi */}
          {filtrelenmisBekleyenPlanlar.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>🚚</span>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', margin: '0 0 4px' }}>
                Şu anda sahaya gelecek planlanmış sevkiyat bulunmuyor
              </p>
              <p style={{ fontSize: 12.5, margin: 0 }}>
                Yönetici Serhat Hazar malzeme sevkiyatı planladığında burada listelenecektir.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrelenmisBekleyenPlanlar.map((plan) => (
                <div 
                  key={plan.id} 
                  className="kart"
                  style={{
                    borderLeft: '5px solid #EA580C',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div className="kart-ust">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="kart-baslik" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                        📦 {plan.malzeme}
                      </span>
                      {plan.tedarikci && (
                        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                          🏢 {plan.tedarikci}
                        </span>
                      )}
                    </div>
                    <span className="durum-rozet rozet-sari" style={{ fontWeight: 700 }}>
                      ⏳ Yolda / Bekleniyor
                    </span>
                  </div>

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

                  {plan.sahaNotu && (
                    <div style={{ background: '#FEFCE8', border: '1px dashed #FDE047', padding: '8px 10px', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#854D0E', display: 'block', marginBottom: 2 }}>
                        ⚠️ ŞEF SAHA HAZIRLIK NOTU:
                      </span>
                      <p style={{ margin: 0, fontSize: 12.5, color: '#713F12', lineHeight: 1.35 }}>
                        {plan.sahaNotu}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handlePlandanHizliKabulAc(plan)}
                    style={{
                      marginTop: 4,
                      padding: '10px 14px',
                      background: '#1D9596',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 6px rgba(29, 149, 150, 0.25)'
                    }}
                  >
                    📸 Sahaya Geldi: Teslim Al & İrsaliye/Fatura Yükle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. TESLİM ALINANLAR SEKMESİ */}
      {aktifSekme === 'kabul_edilenler' && (
        <>
          {/* FİLTRE & ARAMA ÇUBUĞU */}
      <div style={{ marginBottom: 14 }}>
        <button 
          className="ekle-buton-genis" 
          onClick={() => setFiltreAcik(!filtreAcik)}
          style={{ background: '#FFFFFF', color: '#1D9596', border: '1.5px solid #1D9596', boxShadow: 'none' }}
        >
          {filtreAcik ? '▲ Filtreleri Gizle' : (
            (seciliSantiyeId || aramaMetni)
              ? '▼ Filtre ve Arama (Aktif Filtre Var)'
              : '▼ Filtre ve Arama Seçenekleri'
          )}
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#FDFDFD', marginTop: 0 }}>
          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Seçimi</p>
          <select 
            value={seciliSantiyeId} 
            onChange={(e) => setSeciliSantiyeId(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}
          >
            <option value="">Tüm Şantiyeler</option>
            {santiyeler.map((s) => (
              <option key={s.id} value={s.id}>{s.ad}</option>
            ))}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Malzeme veya Açıklama Arama</p>
          <input 
            type="text" 
            placeholder="Arama yapın..." 
            value={aramaMetni} 
            onChange={(e) => setAramaMetni(e.target.value)}
            style={{ marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              type="button" 
              onClick={() => {
                setSeciliSantiyeId('')
                setAramaMetni('')
              }}
              style={{ flex: 1, padding: 8, background: '#F1F5F9', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            >
              Filtreleri Temizle
            </button>
            <button 
              type="button" 
              onClick={handleWhatsAppKopyala}
              style={{ flex: 1, padding: 8, background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >
              📱 WhatsApp Raporu
            </button>
          </div>
        </div>
      )}

      {/* 5. SEVKİYAT KABUL LİSTESİ */}
      <div className="liste">
        {filtrelenmisSevkiyatlar.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', color: '#64748B' }}>
            <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>📦</span>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1E293B', margin: '0 0 4px' }}>
              Kayıtlı malzeme kabulü bulunamadı
            </p>
            <p style={{ fontSize: 12.5, margin: 0 }}>
              Gelen malzemeleri yukarıdaki "+ Yeni Sevkiyat Kabul Et" butonuyla kaydedebilirsiniz.
            </p>
          </div>
        ) : (
          filtrelenmisSevkiyatlar.map((item) => (
            <div 
              key={item.id} 
              className="kart" 
              style={{
                borderLeft: '5px solid #10B981',
                marginBottom: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div className="kart-ust">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="kart-baslik" style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                    📦 {item.malzemeAdi}
                  </span>
                  {isYoneticiSerhat && item.tedarikci && (
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                      🏢 {item.tedarikci}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span 
                    className="durum-rozet" 
                    style={{
                      fontWeight: 700,
                      background: item.durum === 'tam' ? '#DCFCE7' : item.durum === 'eksik' ? '#FEF3C7' : '#FEE2E2',
                      color: item.durum === 'tam' ? '#15803D' : item.durum === 'eksik' ? '#92400E' : '#B91C1C'
                    }}
                  >
                    {item.durum === 'tam' ? '✓ Eksiksiz' : item.durum === 'eksik' ? '⚠️ Eksik' : '❌ Hasarlı'}
                  </span>

                  <button 
                    className="sil-buton" 
                    onClick={() => handleSevkiyatSil(item.id)}
                    title="Sil"
                    aria-label="Sil"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* ETİKETLER */}
              <div className="etiket-satiri" style={{ flexWrap: 'wrap', gap: 4 }}>
                <span className="etiket etiket-vurgu">
                  🏗️ {item.santiyeAdi}
                </span>
                <span className="etiket" style={{ background: '#F1F5F9', color: '#334155' }}>
                  📅 {tarihFormatlaTR(item.tarih)} - {item.saat}
                </span>
                <span className="etiket" style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                  👤 Teslim Alan: {item.teslimAlan}
                </span>
              </div>

              {/* NOTLAR */}
              {item.notlar && (
                <p className="not-icerik" style={{ margin: 0, fontSize: 12.5, color: '#334155' }}>
                  📝 {item.notlar}
                </p>
              )}

              {/* FOTOĞRAFLAR */}
              {(item.fotoUrl || item.faturaUrl) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {item.fotoUrl && (
                    <div 
                      onClick={() => setBuyukFotoUrl(item.fotoUrl)}
                      style={{ cursor: 'pointer', textAlign: 'center' }}
                    >
                      <img 
                        src={item.fotoUrl} 
                        alt="İrsaliye" 
                        style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #CBD5E1' }} 
                      />
                      <span style={{ fontSize: 10, display: 'block', color: '#1D9596', fontWeight: 700 }}>📄 İrsaliye</span>
                    </div>
                  )}

                  {item.faturaUrl && (
                    <div 
                      onClick={() => setBuyukFotoUrl(item.faturaUrl)}
                      style={{ cursor: 'pointer', textAlign: 'center' }}
                    >
                      <img 
                        src={item.faturaUrl} 
                        alt="Fatura" 
                        style={{ height: 64, width: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #CBD5E1' }} 
                      />
                      <span style={{ fontSize: 10, display: 'block', color: '#1D9596', fontWeight: 700 }}>🧾 Fatura/Fiş</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
        </>
      )}

      {/* BÜYÜK RESİM MODALI */}
      {buyukFotoUrl && (
        <div className="modal-arka-plan" onClick={() => setBuyukFotoUrl(null)}>
          <div style={{ maxWidth: '90%', maxHeight: '90%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <img 
              src={buyukFotoUrl} 
              alt="Büyük Belge Önizleme" 
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
            />
            <button
              type="button"
              onClick={() => setBuyukFotoUrl(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                background: '#FFFFFF',
                color: '#000000',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
