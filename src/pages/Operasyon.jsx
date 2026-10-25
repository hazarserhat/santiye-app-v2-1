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

  // 3. HARİTADA GÖSTER / KONUMU AÇ (Google Maps Web / App)
  const haritadaGoster = (santiye) => {
    if (!santiye) return
    if (santiye.google_maps_linki) {
      window.open(santiye.google_maps_linki, '_blank', 'noopener,noreferrer')
      return
    }
    const sorgu = haritaSorgusuOlustur(santiye)
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sorgu)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Şantiyeye tıklandığında hem seç hem de konumu açma desteği
  const handleSantiyeTikla = (santiye) => {
    if (seciliSantiyeId === santiye.id) {
      // Eğer zaten seçiliyse tekrar tıklandığında doğrudan haritada konumunu açar
      haritadaGoster(santiye)
    } else {
      // İlk tıklamada haritayı bu konuma odaklar
      setSeciliSantiyeId(santiye.id)
    }
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
    <div className="sayfa" style={{ maxWidth: 900, paddingBottom: 60 }}>
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
          Şantiyelerin canlı Google Harita konumları, yol tarifleri ve tek tıkla konum açma paneli.
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

            {/* Google Haritalar'da Konumu Aç Butonu */}
            {seciliSantiye && (
              <button
                type="button"
                onClick={() => haritadaGoster(seciliSantiye)}
                title="Bu konumu Google Haritalar uygulamasında / tam ekranda aç"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #24B8B9, #1D9596)',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)'
                }}
              >
                <span>↗ Konumu Aç</span>
              </button>
            )}
          </div>
        </div>

        {/* ŞANTİYELER SEÇİM VE KONTROL IZGARASI (TEK SEFERDE HEPSİ GÖRÜNÜR & SİMETRİK NİZAMİ) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
            padding: '12px 14px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0'
          }}
        >
          {/* Genel Bakış Butonu */}
          <button
            type="button"
            onClick={() => setSeciliSantiyeId('hepsi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 42,
              padding: '8px 12px',
              borderRadius: 10,
              border: seciliSantiyeId === 'hepsi' ? '2px solid #1D9596' : '1px solid #CBD5E1',
              background: seciliSantiyeId === 'hepsi' ? '#F0FDFA' : '#FFFFFF',
              color: seciliSantiyeId === 'hepsi' ? '#0F766E' : '#475569',
              fontSize: 12.5,
              fontWeight: seciliSantiyeId === 'hepsi' ? 800 : 600,
              cursor: 'pointer',
              boxShadow: seciliSantiyeId === 'hepsi' ? '0 2px 6px rgba(29, 149, 150, 0.2)' : '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🌐 Genel Bakış</span>
          </button>

          {/* Tüm Şantiyeler Symmetrical Grid */}
          {santiyeler.map((s) => {
            const secili = seciliSantiyeId === s.id
            const aktifSantiyeMi = s.id === aktifSantiye?.id

            return (
              <div
                key={s.id}
                onClick={() => handleSantiyeTikla(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  height: 42,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: secili ? '2px solid #1D9596' : '1px solid #CBD5E1',
                  background: secili ? '#F0FDFA' : '#FFFFFF',
                  color: secili ? '#0F766E' : '#334155',
                  cursor: 'pointer',
                  boxShadow: secili ? '0 2px 8px rgba(29, 149, 150, 0.2)' : '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                title={secili ? 'Tekrar tıklandığında Google Haritalar konumunu açar' : 'Haritada bu konuma odaklan'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>📍</span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: secili ? 800 : 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {s.ad}
                  </span>
                  {aktifSantiyeMi && (
                    <span
                      style={{
                        fontSize: 9,
                        background: '#1D9596',
                        color: '#fff',
                        padding: '1px 5px',
                        borderRadius: 8,
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      Aktif
                    </span>
                  )}
                </div>

                {/* Konumu Aç İkon Butonu */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    haritadaGoster(s)
                  }}
                  title={`${s.ad} konumunu Google Haritalar'da aç`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: 'none',
                    background: secili ? '#1D9596' : '#F1F5F9',
                    color: secili ? '#FFFFFF' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    transition: 'all 0.15s ease'
                  }}
                >
                  ↗
                </button>
              </div>
            )
          })}
        </div>

        {/* GOOGLE HARİTA IFRAME KESİTİ + HARİTA ÜSTÜ CANLI KONUM ROZETİ */}
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

          {/* HARİTA ÜZERİNDEKİ TIKLANABİLİR KONUM ROZETİ / AÇ BUTONU */}
          {seciliSantiye && (
            <div
              onClick={() => haritadaGoster(seciliSantiye)}
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                maxWidth: 420,
                margin: '0 auto',
                background: 'rgba(255, 255, 255, 0.94)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: 14,
                padding: '10px 14px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.18)',
                border: '2px solid #1D9596',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                zIndex: 10
              }}
              title="Google Haritalar'da bu konumu açmak için tıklayın"
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#0F172A',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {seciliSantiye.ad}
                  </span>
                  <span style={{ fontSize: 10, background: '#CCFBF1', color: '#0F766E', padding: '1px 6px', borderRadius: 6, fontWeight: 800 }}>
                    Aç
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    color: '#64748B',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 2
                  }}
                >
                  {seciliSantiye.adres || 'Konumu tam ekranda açmak için dokunun'}
                </span>
              </div>

              <div
                style={{
                  background: 'linear-gradient(135deg, #24B8B9, #1D9596)',
                  color: '#FFFFFF',
                  padding: '7px 13px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(29, 149, 150, 0.35)'
                }}
              >
                <span>Konumu Aç</span>
                <span>↗</span>
              </div>
            </div>
          )}
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
                onClick={() => haritadaGoster(seciliSantiye)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #24B8B9, #1D9596)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: '0 2px 6px rgba(29, 149, 150, 0.25)'
                }}
              >
                <span>📍 Konumu Aç</span>
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
            </div>
          </div>
        )}
      </div>

      {/* ŞANTİYELER LİSTESİ VE SİMETRİK NİZAMİ AKSİYON KARTLARI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
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
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontSize: 12.5,
              outline: 'none',
              width: 220
            }}
          />
        </div>

        {/* SİMETRİK NİZAMİ KARTLAR IZGARASI (GRID) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
            gap: 14
          }}
        >
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
                  boxShadow: seciliHaritada ? '0 6px 20px rgba(29, 149, 150, 0.15)' : '0 2px 8px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {/* Kart Başlığı ve Durum Rozetleri */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.ad}
                        </span>
                        {aktifSantiyeMi && (
                          <span style={{ fontSize: 10, fontWeight: 800, background: '#1D9596', color: '#fff', padding: '1px 6px', borderRadius: 6 }}>
                            ✓ Seçili
                          </span>
                        )}
                      </div>

                      {s.google_maps_linki ? (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: 6 }}>
                          📍 Konum Bağlantısı Hazır
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 600, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 6 }}>
                          ⚠️ Adres ile
                        </span>
                      )}
                    </div>

                    {/* Aktif Yap Butonu */}
                    {!aktifSantiyeMi && (
                      <button
                        type="button"
                        onClick={() => {
                          santiyeSec(s)
                          setToastMesaj(`✓ Aktif şantiye "${s.ad}" olarak seçildi`)
                        }}
                        title="Bu şantiyeyi aktif çalışma şantiyesi yap"
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                          color: '#475569',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        Aktif Yap
                      </button>
                    )}
                  </div>

                  {/* SİMETRİK ADRES METNİ KUTUSU */}
                  <div
                    style={{
                      height: 38,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      fontSize: 12.5,
                      color: s.adres ? '#475569' : '#94A3B8',
                      fontStyle: s.adres ? 'normal' : 'italic',
                      lineHeight: 1.4,
                      marginBottom: 12
                    }}
                  >
                    {s.adres ? `🏢 ${s.adres}` : 'Adres bilgisi girilmemiş'}
                  </div>
                </div>

                {/* İNLINE DÜZENLEME FORMU */}
                {duzenlemede && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      padding: 10,
                      borderRadius: 10,
                      border: '1px dashed #CBD5E1',
                      marginBottom: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Açık adres..."
                      value={duzAdres}
                      onChange={(e) => setDuzAdres(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Google Maps Linki (https://...)"
                      value={duzMapsLink}
                      onChange={(e) => setDuzMapsLink(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        fontSize: 12,
                        outline: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setDuzenlenenId(null)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#64748B',
                          fontSize: 11,
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
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#1D9596',
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {kaydediliyor ? '...' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                )}

                {/* SİMETRİK 3 ANA BUTON GRUBU */}
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      marginTop: 6
                    }}
                  >
                    {/* 1. KONUMU AÇ (DOĞRUDAN O KONUMUN OLDUĞU YERİ AÇAR) */}
                    <button
                      type="button"
                      onClick={() => haritadaGoster(s)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #24B8B9, #1D9596)',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 2px 6px rgba(29, 149, 150, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Bu konumu Google Haritalar'da aç"
                    >
                      <span>📍 Konumu Aç</span>
                    </button>

                    {/* 2. YOL TARİFİ AL */}
                    <button
                      type="button"
                      onClick={() => yolTarifiAl(s)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Google Haritalar navigasyon / rota başlat"
                    >
                      <span>🚗 Yol Tarifi</span>
                    </button>

                    {/* 3. LİNK PAYLAŞ */}
                    <button
                      type="button"
                      onClick={() => linkPaylas(s)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#0F766E',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease'
                      }}
                      title="WhatsApp veya paylaşım menüsüyle link paylaş"
                    >
                      <span>📤 Paylaş</span>
                    </button>
                  </div>

                  {/* KART ALTI: HARİTADA ODAKLA & DÜZENLE */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                    <button
                      type="button"
                      onClick={() => haritadaOdakla(s)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: seciliHaritada ? '#1D9596' : '#64748B',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: 0
                      }}
                    >
                      <span>🎯 Haritada Odakla</span>
                    </button>

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
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      {duzenlemede ? 'Kapat' : '✎ Düzenle'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {filtrelenmisSantiyeler.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, background: '#FFFFFF', borderRadius: 12, border: '1px dashed #CBD5E1', gridColumn: '1 / -1' }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🔍</span>
              <p style={{ margin: 0, fontSize: 14, color: '#64748B', fontWeight: 600 }}>Aramanızla eşleşen şantiye bulunamadı.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
