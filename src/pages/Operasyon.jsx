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
    const atMatch = link.match(/@([0-9.-]+),([0-9.-]+)/)
    if (atMatch) return `${atMatch[1]},${atMatch[2]}`
    const qMatch = link.match(/[?&]q=([^&]+)/)
    if (qMatch) return decodeURIComponent(qMatch[1])
    const llMatch = link.match(/[?&]ll=([0-9.-]+),([0-9.-]+)/)
    if (llMatch) return `${llMatch[1]},${llMatch[2]}`
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
  const { santiyeler, aktifSantiye, setSantiyeler } = useSite()
  const { profile } = useAuth()

  const [aramaMetni, setAramaMetni] = useState('')
  const [toastMesaj, setToastMesaj] = useState('')

  // Düzenleme durumu
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzAdres, setDuzAdres] = useState('')
  const [duzMapsLink, setDuzMapsLink] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // Toast mesajını 3 saniye sonra otomatik kapat
  useEffect(() => {
    if (toastMesaj) {
      const timer = setTimeout(() => setToastMesaj(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMesaj])

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

  // 1. HARİTADA GÖSTER / KONUMU AÇ (Google Maps Web / App)
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

  // 2. YOL TARİFİ AL (Google Maps Directions)
  const yolTarifiAl = (santiye) => {
    const sorgu = haritaSorgusuOlustur(santiye)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(sorgu)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 3. LİNK PAYLAŞ (Web Share API + Pano + WhatsApp)
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

    try {
      await navigator.clipboard.writeText(metin)
      setToastMesaj(`✓ Konum bağlantısı panoya kopyalandı!`)
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(metin)}`, '_blank')
    }
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
    <div className="sayfa" style={{ maxWidth: 960, paddingBottom: 60 }}>
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1D9596', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📍 Şantiye Konumları</span>
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
          Tüm şantiyelerin güncel Google Harita konumları, yol tarifleri ve adres bilgileri.
        </p>
      </div>

      {/* ŞANTİYELER LİSTESİ VE SİMETRİK NİZAMİ AKSİYON KARTLARI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏗️ Tüm Şantiyeler & Konumları</span>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14
          }}
        >
          {filtrelenmisSantiyeler.map((s) => {
            const aktifSantiyeMi = aktifSantiye?.id === s.id
            const duzenlemede = duzenlenenId === s.id

            return (
              <div
                key={s.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 14,
                  border: aktifSantiyeMi ? '2px solid #1D9596' : '1px solid #E2E8F0',
                  padding: 16,
                  boxShadow: aktifSantiyeMi ? '0 6px 20px rgba(29, 149, 150, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
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
                        <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.ad}
                        </span>
                        {aktifSantiyeMi && (
                          <span style={{ fontSize: 10, fontWeight: 800, background: '#1D9596', color: '#fff', padding: '1px 6px', borderRadius: 6 }}>
                            ✓ Aktif Şantiye
                          </span>
                        )}
                      </div>

                      {s.google_maps_linki ? (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '1px 6px', borderRadius: 6 }}>
                          📍 Konum Bağlantısı Tanımlı
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 600, background: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: 6 }}>
                          ⚠️ Adres ile
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SİMETRİK ADRES METNİ KUTUSU */}
                  <div
                    style={{
                      minHeight: 40,
                      maxHeight: 40,
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
                    {/* 1. KONUMU AÇ (DOĞRUDAN GOOGLE HARİTALAR'DA AÇAR) */}
                    <button
                      type="button"
                      onClick={() => haritadaGoster(s)}
                      style={{
                        padding: '9px 4px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #24B8B9, #1D9596)',
                        color: '#FFFFFF',
                        fontSize: 12,
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
                      <span>📍 Haritada Aç</span>
                    </button>

                    {/* 2. YOL TARİFİ AL */}
                    <button
                      type="button"
                      onClick={() => yolTarifiAl(s)}
                      style={{
                        padding: '9px 4px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                        color: '#FFFFFF',
                        fontSize: 12,
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
                        padding: '9px 4px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#0F766E',
                        fontSize: 12,
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

                  {/* KART ALTI: DÜZENLEME BAĞLANTISI */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
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
                      {duzenlemede ? '✕ Kapat' : '✎ Adres / Link Düzenle'}
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
