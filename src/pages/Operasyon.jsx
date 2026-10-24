import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Google Maps sorgusu çözümleyici
function haritaSorgusuOlustur(santiye) {
  if (!santiye) return 'İstanbul, Türkiye'

  const link = santiye.google_maps_linki || ''
  if (link) {
    // @lat,lng kontrolü: örn /@41.0123,28.9765
    const atMatch = link.match(/@([0-9.-]+),([0-9.-]+)/)
    if (atMatch) {
      return `${atMatch[1]},${atMatch[2]}`
    }
    // q=lat,lng veya q=adres kontrolü
    const qMatch = link.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      return decodeURIComponent(qMatch[1])
    }
    // ll=lat,lng kontrolü
    const llMatch = link.match(/[?&]ll=([0-9.-]+),([0-9.-]+)/)
    if (llMatch) {
      return `${llMatch[1]},${llMatch[2]}`
    }
  }

  if (santiye.adres && santiye.adres.trim()) {
    return `${santiye.ad ? santiye.ad + ', ' : ''}${santiye.adres.trim()}`
  }

  if (santiye.ad) {
    return `${santiye.ad}, İstanbul, Türkiye`
  }

  return 'İstanbul, Türkiye'
}

export default function Operasyon() {
  const { santiyeler, aktifSantiye, santiyeSec, setSantiyeler } = useSite()
  const { profile } = useAuth()

  // Haritada seçili şantiye (varsayılan: aktif şantiye veya ilk şantiye)
  const [seciliSantiyeId, setSeciliSantiyeId] = useState(null)
  const [haritaTipi, setHaritaTipi] = useState('roadmap') // 'roadmap' | 'satellite'
  const [aramaMetni, setAramaMetni] = useState('')
  const [toastMesaj, setToastMesaj] = useState('')

  // Düzenleme durumu
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzAdres, setDuzAdres] = useState('')
  const [duzMapsLink, setDuzMapsLink] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // İlk yüklemede aktif şantiyeyi seç
  useEffect(() => {
    if (!seciliSantiyeId && santiyeler.length > 0) {
      setSeciliSantiyeId(aktifSantiye?.id || santiyeler[0]?.id || null)
    }
  }, [santiyeler, aktifSantiye, seciliSantiyeId])

  // Toast mesajını 3 saniye sonra otomatik kapat
  useEffect(() => {
    if (toastMesaj) {
      const timer = setTimeout(() => setToastMesaj(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMesaj])

  const seciliSantiye = useMemo(() => {
    if (seciliSantiyeId === 'hepsi') return null
    return santiyeler.find((s) => s.id === seciliSantiyeId) || santiyeler[0] || null
  }, [seciliSantiyeId, santiyeler])

  // Filtrelenmiş şantiye listesi
  const filtrelenmisSantiyeler = useMemo(() => {
    const q = aramaMetni.trim().toLocaleLowerCase('tr-TR')
    if (!q) return santiyeler
    return santiyeler.filter((s) => {
      const ad = (s.ad || '').toLocaleLowerCase('tr-TR')
      const adres = (s.adres || '').toLocaleLowerCase('tr-TR')
      return ad.includes(q) || adres.includes(q)
    })
  }, [santiyeler, aramaMetni])

  // Google Maps Embed URL'i
  const embedUrl = useMemo(() => {
    const sorgu = seciliSantiye ? haritaSorgusuOlustur(seciliSantiye) : 'İstanbul, Türkiye'
    const tParam = haritaTipi === 'satellite' ? '&t=k' : ''
    const zoom = seciliSantiye ? 16 : 11
    return `https://maps.google.com/maps?q=${encodeURIComponent(sorgu)}${tParam}&z=${zoom}&ie=UTF8&iwloc=&output=embed`
  }, [seciliSantiye, haritaTipi])

  // 1. LİNK PAYLAŞ (Web Share API + Pano + WhatsApp)
  const linkPaylas = async (santiye) => {
    const sorgu = haritaSorgusuOlustur(santiye)
    const directLink = santiye.google_maps_linki || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sorgu)}`
    const metin = `📍 *${santiye.ad} Konumu*\n${santiye.adres ? `Adres: ${santiye.adres}\n` : ''}Google Haritalar: ${directLink}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${santiye.ad} Konumu`,
          text: metin,
          url: directLink
        })
        setToastMesaj(`✓ ${santiye.ad} konumu paylaşıldı`)
        return
      } catch {
        // Kullanıcı paylaşımı iptal ettiyse sessiz kal
      }
    }

    // Pano fallback
    try {
      await navigator.clipboard.writeText(metin)
      setToastMesaj(`✓ Konum bağlantısı panoya kopyalandı!`)
    } catch {
      // WhatsApp doğrudan aç
      window.open(`https://wa.me/?text=${encodeURIComponent(metin)}`, '_blank')
    }
  }

  // 2. YOL TARİFİ AL (Google Maps Directions)
  const yolTarifiAl = (santiye) => {
    const sorgu = haritaSorgusuOlustur(santiye)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sorgu)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 3. HARİTADA GÖSTER (Google Maps Web / App)
  const haritadaGoster = (santiye) => {
    if (santiye.google_maps_linki) {
      window.open(santiye.google_maps_linki, '_blank', 'noopener,noreferrer')
      return
    }
    const sorgu = haritaSorgusuOlustur(santiye)
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sorgu)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Haritada Odakla
  const haritadaOdakla = (santiye) => {
    setSeciliSantiyeId(santiye.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Konum / Adres Düzenlemeyi Kaydet
  const konumKaydet = async (id) => {
    setKaydediliyor(true)
    try {
      const { error } = await supabase
        .from('santiyeler')
        .update({
          adres: duzAdres.trim(),
          google_maps_linki: duzMapsLink.trim()
        })
        .eq('id', id)

      if (error) {
        alert('Kaydedilemedi: ' + error.message)
      } else {
        setSantiyeler((onceki) =>
          onceki.map((s) =>
            s.id === id ? { ...s, adres: duzAdres.trim(), google_maps_linki: duzMapsLink.trim() } : s
          )
        )
        setDuzenlenenId(null)
        setToastMesaj('✓ Şantiye konumu güncellendi')
      }
    } catch (err) {
      alert('Hata oluştu: ' + (err.message || err))
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="sayfa" style={{ maxWidth: 840, paddingBottom: 60 }}>
      {/* TOAST BİLDİRİMİ */}
      {toastMesaj && (
        <div
          style={{
            position: 'fixed',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'linear-gradient(135deg, #1D9596, #0F766E)',
            color: '#FFFFFF',
            padding: '10px 20px',
            borderRadius: 30,
            boxShadow: '0 8px 24px rgba(29, 149, 150, 0.4)',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <span>{toastMesaj}</span>
        </div>
      )}

      {/* SAYFA ÜST BAŞLIĞI */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡ Saha Operasyonları</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F766E', background: '#CCFBF1', padding: '2px 8px', borderRadius: 6 }}>
              Canlı Harita
            </span>
          </h2>
          {profile?.sistem_yoneticisi && (
            <Link
              to="/yonetim/santiye-adresleri"
              style={{ fontSize: 12, fontWeight: 700, color: '#1D9596', textDecoration: 'none' }}
            >
              ⚙️ Konumları Yönet →
            </Link>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
          Şantiyelerin canlı Google Haritalar konumu, yol tarifleri ve hızlı saha operasyon araçları.
        </p>
      </div>

      {/* HIZLI OPERASYON ARAÇLARI ÇUBUĞU */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 8,
          marginBottom: 16
        }}
      >
        <Link
          to="/beton-dokumu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: '#EFF6FF',
            borderRadius: 10,
            border: '1px solid #BFDBFE',
            textDecoration: 'none',
            color: '#1E40AF',
            fontSize: 12.5,
            fontWeight: 700
          }}
        >
          <span style={{ fontSize: 18 }}>🧪</span>
          <span>Beton & Mikser</span>
        </Link>
        <Link
          to="/sevkiyat-planlama"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: '#F0FDFA',
            borderRadius: 10,
            border: '1px solid #99F6E4',
            textDecoration: 'none',
            color: '#0F766E',
            fontSize: 12.5,
            fontWeight: 700
          }}
        >
          <span style={{ fontSize: 18 }}>🚚</span>
          <span>Sevkiyat Planı</span>
        </Link>
        <Link
          to="/sevkiyat-kabul"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: '#ECFDF5',
            borderRadius: 10,
            border: '1px solid #A7F3D0',
            textDecoration: 'none',
            color: '#065F46',
            fontSize: 12.5,
            fontWeight: 700
          }}
        >
          <span style={{ fontSize: 18 }}>📦</span>
          <span>Sevkiyat Kabul</span>
        </Link>
        <Link
          to="/saha-cep-cetveli"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: '#FFFBEB',
            borderRadius: 10,
            border: '1px solid #FDE68A',
            textDecoration: 'none',
            color: '#92400E',
            fontSize: 12.5,
            fontWeight: 700
          }}
        >
          <span style={{ fontSize: 18 }}>🧮</span>
          <span>Cep Cetveli</span>
        </Link>
      </div>

      {/* GOOGLE HARİTA KESİTİ KARTI */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          marginBottom: 24
        }}
      >
        {/* Harita Üst Kontrol Çubuğu */}
        <div
          style={{
            padding: '12px 16px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🗺️</span>
            <div>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'block' }}>
                {seciliSantiye ? seciliSantiye.ad : 'Tüm Şantiyeler Genel Bakış'}
              </span>
              <span style={{ fontSize: 11.5, color: '#64748B' }}>
                {seciliSantiye?.adres || 'İstanbul ve çevresi'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Standart / Uydu Görünümü Butonları */}
            <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: 8, padding: 2 }}>
              <button
                type="button"
                onClick={() => setHaritaTipi('roadmap')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: haritaTipi === 'roadmap' ? '#FFFFFF' : 'transparent',
                  color: haritaTipi === 'roadmap' ? '#1D9596' : '#64748B',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: haritaTipi === 'roadmap' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Harita
              </button>
              <button
                type="button"
                onClick={() => setHaritaTipi('satellite')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: haritaTipi === 'satellite' ? '#FFFFFF' : 'transparent',
                  color: haritaTipi === 'satellite' ? '#1D9596' : '#64748B',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: haritaTipi === 'satellite' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Uydu 🛰️
              </button>
            </div>

            {/* Google Haritalar'da Tam Ekran Aç */}
            {seciliSantiye && (
              <button
                type="button"
                onClick={() => haritadaGoster(seciliSantiye)}
                title="Google Haritalar uygulamasında aç"
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#334155',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>↗ Tam Ekran</span>
              </button>
            )}
          </div>
        </div>

        {/* Şantiye Seçim Hapları (Harita Üstü) */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 12px',
            background: '#FFFFFF',
            borderBottom: '1px solid #F1F5F9',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none'
          }}
        >
          <button
            type="button"
            onClick={() => setSeciliSantiyeId('hepsi')}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: seciliSantiyeId === 'hepsi' ? '1.5px solid #1D9596' : '1px solid #E2E8F0',
              background: seciliSantiyeId === 'hepsi' ? '#F0FDFA' : '#F8FAFC',
              color: seciliSantiyeId === 'hepsi' ? '#0F766E' : '#475569',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            🌐 Genel Bakış
          </button>

          {santiyeler.map((s) => {
            const aktifMi = seciliSantiyeId === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeciliSantiyeId(s.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: aktifMi ? '1.5px solid #1D9596' : '1px solid #E2E8F0',
                  background: aktifMi ? '#F0FDFA' : '#F8FAFC',
                  color: aktifMi ? '#0F766E' : '#475569',
                  fontSize: 12,
                  fontWeight: aktifMi ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>📍 {s.ad}</span>
                {s.id === aktifSantiye?.id && (
                  <span style={{ fontSize: 9, background: '#1D9596', color: '#fff', padding: '1px 5px', borderRadius: 10 }}>
                    Aktif
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* GOOGLE HARİTA IFRAME KESİTİ */}
        <div style={{ position: 'relative', width: '100%', height: 380, background: '#E2E8F0' }}>
          <iframe
            title="Google Haritalar Şantiye Kesiti"
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block' }}
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Harita Altı Hızlı Aksiyon Bandı */}
        {seciliSantiye && (
          <div
            style={{
              padding: '10px 16px',
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8
            }}
          >
            <span style={{ fontSize: 12, color: '#64748B' }}>
              📍 <strong>{seciliSantiye.ad}</strong> için hızlı işlem:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => linkPaylas(seciliSantiye)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#0F766E',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>📤 Link Paylaş</span>
              </button>
              <button
                type="button"
                onClick={() => yolTarifiAl(seciliSantiye)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                }}
              >
                <span>🚗 Yol Tarifi Al</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ŞANTİYELER LİSTESİ VE AKSİYON BUTONLARI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏗️ Şantiye Konum Listesi</span>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>({santiyeler.length} Şantiye)</span>
          </h3>

          {/* Hızlı Arama */}
          <input
            type="text"
            placeholder="Şantiye adı veya adres ara..."
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontSize: 12.5,
              outline: 'none',
              width: 220
            }}
          />
        </div>

        {/* KARTLAR LİSTESİ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtrelenmisSantiyeler.map((s) => {
            const seciliHaritada = seciliSantiyeId === s.id
            const aktifSantiyeMi = aktifSantiye?.id === s.id
            const duzenlemede = duzenlenenId === s.id

            return (
              <div
                key={s.id}
                style={{
                  background: seciliHaritada ? '#F0FDFA' : '#FFFFFF',
                  borderRadius: 14,
                  border: seciliHaritada ? '2px solid #1D9596' : '1px solid #E2E8F0',
                  padding: 16,
                  boxShadow: seciliHaritada ? '0 4px 16px rgba(29, 149, 150, 0.12)' : '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Kart Başlığı ve Durum Rozetleri */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{s.ad}</span>
                      {aktifSantiyeMi && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, background: '#1D9596', color: '#fff', padding: '1px 7px', borderRadius: 6 }}>
                          ✓ Seçili Şantiye
                        </span>
                      )}
                      {s.google_maps_linki ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: 6 }}>
                          📍 GPS Tanımlı
                        </span>
                      ) : (
                        <span style={{ fontSize: 10.5, fontWeight: 600, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 6 }}>
                          ⚠️ Adres ile
                        </span>
                      )}
                    </div>

                    {/* Adres Metni */}
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: s.adres ? '#475569' : '#94A3B8', fontStyle: s.adres ? 'normal' : 'italic' }}>
                      {s.adres ? `🏢 ${s.adres}` : 'Adres bilgisi girilmemiş'}
                    </p>
                  </div>

                  {/* Düzenleme Butonu (Yönetici veya Yetkili) */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {!aktifSantiyeMi && (
                      <button
                        type="button"
                        onClick={() => {
                          santiyeSec(s)
                          setToastMesaj(`✓ Aktif şantiye "${s.ad}" olarak seçildi`)
                        }}
                        title="Bu şantiyeyi aktif çalışma şantiyesi yap"
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          color: '#475569',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Aktif Yap
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (duzenlemede) {
                          setDuzenlenenId(null)
                        } else {
                          setDuzenlenenId(s.id)
                          setDuzAdres(s.adres || '')
                          setDuzMapsLink(s.google_maps_linki || '')
                        }
                      }}
                      title="Konum ve adres bilgilerini düzenle"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#1D9596',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {duzenlemede ? '✕ Kapat' : '✎ Düzenle'}
                    </button>
                  </div>
                </div>

                {/* İNLINE DÜZENLEME FORMU */}
                {duzenlemede && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: 12,
                      borderRadius: 10,
                      border: '1px dashed #CBD5E1',
                      marginTop: 10,
                      marginBottom: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                      ✏️ Şantiye Adresi ve Google Maps Bağlantısı:
                    </span>
                    <input
                      type="text"
                      placeholder="Açık adres (örn. Barbaros Mah. Ihlamur Sk. No:4 Kadıköy)"
                      value={duzAdres}
                      onChange={(e) => setDuzAdres(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: 12.5,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Google Maps Linki (örn. https://maps.app.goo.gl/...)"
                      value={duzMapsLink}
                      onChange={(e) => setDuzMapsLink(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: 12.5,
                        outline: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setDuzenlenenId(null)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#64748B',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={() => konumKaydet(s.id)}
                        disabled={kaydediliyor}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#1D9596',
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3 ANA BUTON + ODAKLA BUTONU */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: 8,
                    marginTop: 12
                  }}
                >
                  {/* 1. LİNK PAYLAŞ */}
                  <button
                    type="button"
                    onClick={() => linkPaylas(s)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #CCFBF1',
                      background: '#F0FDFA',
                      color: '#0F766E',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>📤 Link Paylaş</span>
                  </button>

                  {/* 2. YOL TARİFİ AL */}
                  <button
                    type="button"
                    onClick={() => yolTarifiAl(s)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                      color: '#FFFFFF',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 3px 8px rgba(37, 99, 235, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🚗 Yol Tarifi Al</span>
                  </button>

                  {/* 3. HARİTADA GÖSTER */}
                  <button
                    type="button"
                    onClick={() => haritadaGoster(s)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#334155',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🗺️ Haritada Göster</span>
                  </button>

                  {/* 4. HARİTADA KESİTİ GÖR (ODAKLA) */}
                  <button
                    type="button"
                    onClick={() => haritadaOdakla(s)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: seciliHaritada ? '1.5px solid #1D9596' : '1px solid #CBD5E1',
                      background: seciliHaritada ? '#1D9596' : '#F8FAFC',
                      color: seciliHaritada ? '#FFFFFF' : '#475569',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🎯 Haritada Odakla</span>
                  </button>
                </div>
              </div>
            )
          })}

          {filtrelenmisSantiyeler.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, background: '#FFFFFF', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🔍</span>
              <p style={{ margin: 0, fontSize: 14, color: '#64748B', fontWeight: 600 }}>Aramanızla eşleşen şantiye bulunamadı.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
