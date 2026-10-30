import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { uploadToGoogleDrive, moveToSilinenler, compressImage, getGoogleDriveInlineImageUrl, getGoogleDriveViewUrl } from '../lib/googleDrive'

const DURUMLAR = [
  { deger: 'hepsi', etiket: 'Tümü' },
  { deger: 'bekliyor', etiket: 'Bekliyor' },
  { deger: 'devam_ediyor', etiket: 'Devam ediyor' },
  { deger: 'tamamlandi', etiket: 'Tamamlandı' },
  { deger: 'gecikti', etiket: 'Geciken' },
]

const ONCELIKLER = [
  { deger: 'kirmizi', etiket: 'Kritik', renk: '#D64545' },
  { deger: 'turuncu', etiket: 'Yüksek', renk: '#E08A2E' },
  { deger: 'sari', etiket: 'Orta', renk: '#D9B429' },
  { deger: 'yesil', etiket: 'Düşük', renk: '#3F9E5C' },
]

const HAZIR_SABLONLAR = [
  '🏗️ Kalıp & Demir Kontrolü',
  '🧱 Beton Dökümü',
  '⚡ Elektrik Tesisatı',
  '🚿 Sıhhi Tesisat',
  '🎨 Sıva & Boya',
  '🧹 Şantiye Temizliği',
  '📦 Malzeme Siparişi',
  '🦺 İSG Güvenlik Denetimi'
]

function oncelikBul(deger) {
  return ONCELIKLER.find((o) => o.deger === deger)
}

function guvenliTarih(tarihStr) {
  if (!tarihStr) return '—'
  const d = new Date(tarihStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

// Görsel URL'sini model veya açıklama/etiket alanından tespit eden güvenli yardımcı
function gorevGorseliBul(gorev) {
  if (!gorev) return null
  if (gorev.fotograf_url) return gorev.fotograf_url
  if (gorev.aciklama && gorev.aciklama.startsWith('IMAGE_URL:')) {
    return gorev.aciklama.replace('IMAGE_URL:', '')
  }
  const etiket = gorev.gorev_etiketleri?.find(e => e.etiket_turu === 'fotograf')
  if (etiket) return etiket.deger
  return null
}

function GorevKarti({ gorev, seviye, ctx }) {
  const [baslikAcik, setBaslikAcik] = useState(false)
  const {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler, kisiSeciciAcikId, setKisiSeciciAcikId,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir, kisiEtiketiDegistir,
    setSeciliGorsel, goreveSonradanFotografEkle
  } = ctx

  const oncelikEtiketi = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
  const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
  const kisiEtiketleri = gorev.gorev_etiketleri?.filter((e) => e.etiket_turu === 'kisi') || []
  const altlar = altGorevleriBul(gorev.id)
  const genisletildi = genisletilmis[gorev.id]
  const gosterilecekAltlar = genisletildi ? altlar : altlar.slice(0, 2)
  const gorselUrl = gorevGorseliBul(gorev)

  const durumRenkleri = {
    bekliyor: { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
    devam_ediyor: { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' },
    tamamlandi: { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' },
    gecikti: { bg: '#FEE2E2', color: '#B91C1C', border: '#FECACA' }
  }
  const stColor = durumRenkleri[gorev.durum] || durumRenkleri.bekliyor

  return (
    <div style={{ marginLeft: seviye > 0 ? 12 : 0, marginBottom: 8 }}>
      <div 
        className="kart gorev-kart-modern" 
        style={{ 
          padding: '12px 14px', 
          borderLeft: oncelik ? `5px solid ${oncelik.renk}` : '5px solid #CBD5E1', 
          borderRadius: 14,
          background: gorev.durum === 'tamamlandi' ? '#F8FAFC' : '#ffffff',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
          border: '1px solid rgba(0,0,0,0.05)',
          opacity: gorev.durum === 'tamamlandi' ? 0.78 : 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        {/* ÜST SATIR - BAŞLIK VE TAMAMLAMA (TAM GENİŞLİK) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
          {/* 1 Tıkla Tamamlama Kutusu */}
          <div 
            onClick={() => {
              const yeniDurum = gorev.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
              durumGuncelle(gorev.id, yeniDurum)
            }}
            className={`gorev-tamamla-kutusu ${gorev.durum === 'tamamlandi' ? 'tamamlandi' : ''}`}
            title={gorev.durum === 'tamamlandi' ? 'Görevi geri al' : 'Görevi tamamla (1 tıkla)'}
          >
            {gorev.durum === 'tamamlandi' ? '✓' : ''}
          </div>

          {/* Paylaşım / Çoklu Seçim Checkbox'ı */}
          <input
            type="checkbox"
            checked={seciliGorevler.includes(gorev.id)}
            onChange={() => setSeciliGorevler((onceki) =>
              onceki.includes(gorev.id) ? onceki.filter((x) => x !== gorev.id) : [...onceki, gorev.id]
            )}
            style={{ width: 15, height: 15, marginTop: 4, margin: 0, flexShrink: 0, cursor: 'pointer', opacity: 0.5 }}
            title="Paylaşmak için seç"
          />

          {numaraHaritasi[gorev.id] && (
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1D9596', marginTop: 1, flexShrink: 0, textShadow: '0 1px 1px rgba(29,149,150,0.2)' }}>
              {numaraHaritasi[gorev.id]}
            </span>
          )}
          
          {duzenlenenId === gorev.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={duzenlenenBaslik}
                onChange={(e) => setDuzenlenenBaslik(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') basligiKaydet(gorev.id)
                  if (e.key === 'Escape') setDuzenlenenId(null)
                }}
                autoFocus
                style={{ flex: 1, padding: '4px 8px', fontSize: 14, borderRadius: 6, border: '1.5px solid #1D9596', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)', background: '#faf9f5', outline: 'none', minWidth: 0 }}
              />
              <button className="sil-buton" onClick={() => basligiKaydet(gorev.id)} style={{ padding: '4px 8px', background: 'linear-gradient(to bottom, #24b8b9, #1D9596)', color: 'white', borderRadius: 4, boxShadow: '0 2px 4px rgba(29,149,150,0.3)', flexShrink: 0 }} title="Kaydet">✓</button>
              <button className="sil-buton" onClick={() => setDuzenlenenId(null)} style={{ padding: '4px 8px', background: '#e2e8f0', color: '#475569', borderRadius: 4, flexShrink: 0 }} title="Vazgeç">✕</button>
            </div>
          ) : (
            <div 
              title={gorev.baslik}
              style={{ 
                fontSize: 14.5, 
                fontWeight: 600, 
                flex: 1, 
                lineHeight: 1.45,
                wordBreak: 'break-word',
                color: gorev.durum === 'tamamlandi' ? '#94A3B8' : '#1E293B', 
                textDecoration: gorev.durum === 'tamamlandi' ? 'line-through' : 'none'
              }}
            >
              {gorev.baslik}
            </div>
          )}
        </div>

        {/* GÖRSEL GÖSTERİMİ */}
        {gorselUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1px 0' }}>
            <div 
              onClick={() => setSeciliGorsel({ url: gorselUrl, baslik: gorev.baslik, santiye: gorev.santiyeler?.ad })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #E6F9F0, #D1F2E2)',
                border: '1px solid #A3E5C8',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: '#0B6B41',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s'
              }}
              title="Fotoğrafı Büyüt"
            >
              <img 
                src={getGoogleDriveInlineImageUrl(gorselUrl)} 
                alt="Görev Görseli" 
                style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span>📷 Fotoğrafı Görüntüle</span>
            </div>
          </div>
        )}

        {/* ALT SATIR (BİLGİLER, İŞLEM BUTONLARI & DURUM) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          
          {/* Sol Kısım: Öncelik, Şantiye, Kişiler, Yazar ve Tarih */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
            <div 
              onClick={() => setOncelikSeciciAcikId(oncelikSeciciAcikId === gorev.id ? null : gorev.id)}
              style={{ width: 14, height: 14, borderRadius: '50%', background: oncelik ? oncelik.renk : '#e2e0d8', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)', boxShadow: oncelik ? `0 2px 6px ${oncelik.renk}66, inset 0 2px 4px rgba(255,255,255,0.4)` : 'inset 0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}
              title={oncelik ? `Öncelik: ${oncelik.etiket}` : 'Öncelik Ata'}
            />

            {seviye === 0 && filtreSantiye === 'hepsi' && gorev.santiyeler?.ad && (
              <span style={{ background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', padding: '2px 6px', fontSize: 10, borderRadius: 12, fontWeight: 700, boxShadow: '0 2px 4px rgba(29, 149, 150, 0.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {gorev.santiyeler.ad}
              </span>
            )}

            <div 
              onClick={() => setKisiSeciciAcikId(kisiSeciciAcikId === gorev.id ? null : gorev.id)}
              style={{ display: 'flex', cursor: 'pointer', padding: '2px', borderRadius: 12, background: '#f8f7f2', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)', flexShrink: 0 }}
              title="Kişi Ata/Kaldır"
            >
              {kisiEtiketleri.length > 0 ? kisiEtiketleri.slice(0, 3).map((e, idx) => {
                const kisi = kullanicilar.find((k) => k.id === e.deger)
                const basHarfler = kisi?.ad_soyad.split(' ').map(n => n[0]).join('').substring(0,2) || '?'
                return (
                  <div key={e.id} style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: idx > 0 ? -6 : 0, border: '2px solid white', fontWeight: 700, boxShadow: '0 2px 4px rgba(29, 149, 150, 0.3)', zIndex: 10 - idx }}>
                    {basHarfler}
                  </div>
                )
              }) : <span style={{ fontSize: 13, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))', opacity: 0.6, padding: '0 4px' }}>👤</span>}
              {kisiEtiketleri.length > 3 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #f0f0ed, #e2e0d8)', color: '#555', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 0 }}>
                  +{kisiEtiketleri.length - 3}
                </div>
              )}
            </div>

            <span style={{ fontSize: 10.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {gorev.profiles?.ad_soyad || 'Bilinmiyor'} • {guvenliTarih(gorev.created_at)}
            </span>
          </div>

          {/* Sağ Kısım: İşlem Butonları (Düzenle, Alt Görev, Fotoğraf, Sil) ve Durum Seçici */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f8f7f2', padding: '2px 4px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
              <button className="sil-buton" onClick={() => { setDuzenlenenId(gorev.id); setDuzenlenenBaslik(gorev.baslik) }} style={{ padding: '3px 5px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Düzenle">✎</button>
              {seviye < 2 && <button className="sil-buton" onClick={() => { setAltGorevAcikId(altGorevAcikId === gorev.id ? null : gorev.id); setAltGorevMetni('') }} style={{ padding: '3px 5px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Alt Görev Ekle">➕</button>}
              {!gorselUrl && (
                <label style={{ cursor: 'pointer', padding: '3px 5px', fontSize: 13, display: 'inline-flex', alignItems: 'center', margin: 0, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Fotoğraf Ekle">
                  📷
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    hidden 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        goreveSonradanFotografEkle(gorev, e.target.files[0])
                      }
                    }} 
                  />
                </label>
              )}
              <button className="sil-buton" onClick={() => gorevSil(gorev.id)} style={{ padding: '3px 5px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Sil">🗑</button>
            </div>

            <select 
              value={gorev.durum} 
              onChange={(ev) => durumGuncelle(gorev.id, ev.target.value)}
              className="durum-pill-select"
              style={{ 
                background: stColor.bg, 
                color: stColor.color, 
                borderColor: stColor.border 
              }}
            >
              {DURUMLAR.filter((d) => d.deger !== 'hepsi').map((d) => (
                <option key={d.deger} value={d.deger}>{d.etiket}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Seçici Paneller */}
        {kisiSeciciAcikId === gorev.id && (
          <div className="kisi-etiket-secici" style={{ marginTop: 6, padding: 10, background: '#f4f3ed', borderRadius: 8, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            {kullanicilar.map((k) => {
              const atanmis = kisiEtiketleri.some((e) => e.deger === k.id)
              return (
                <button key={k.id} className={`filtre-chip ${atanmis ? 'secili' : ''}`} onClick={() => kisiEtiketiDegistir(gorev, k.id)} style={{ padding: '6px 10px', fontSize: 11, boxShadow: atanmis ? '0 2px 4px rgba(29,149,150,0.3)' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {atanmis ? '✓ ' : ''}{k.ad_soyad}
                </button>
              )
            })}
          </div>
        )}

        {oncelikSeciciAcikId === gorev.id && (
          <div className="oncelik-secici-satiri" style={{ marginTop: 6, padding: 10, background: '#f4f3ed', borderRadius: 8, gap: 10, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            {ONCELIKLER.map((o) => (
              <button key={o.deger} className={`oncelik-nokta ${oncelik?.deger === o.deger ? 'secili' : ''}`} style={{ background: o.renk, width: 24, height: 24, boxShadow: oncelik?.deger === o.deger ? `0 2px 8px ${o.renk}88` : '0 2px 4px rgba(0,0,0,0.1)' }} onClick={() => oncelikDegistir(gorev, o.deger)} title={o.etiket} />
            ))}
          </div>
        )}

        {altGorevAcikId === gorev.id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6, padding: 10, background: '#f4f3ed', borderRadius: 8, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            <input type="text" placeholder="Alt görev yaz..." value={altGorevMetni} onChange={(e) => setAltGorevMetni(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && altGorevEkle(gorev.id, gorev.santiye_id)} autoFocus style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d3d1c7', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', outline: 'none' }} />
            <button onClick={() => altGorevEkle(gorev.id, gorev.santiye_id)} style={{ padding: '8px 16px', background: 'linear-gradient(to bottom, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 6px rgba(29,149,150,0.4)', cursor: 'pointer' }}>Ekle</button>
          </div>
        )}
      </div>

      {gosterilecekAltlar.map((alt) => <GorevKarti key={alt.id} gorev={alt} seviye={seviye + 1} ctx={ctx} />)}

      {altlar.length > 2 && (
        <button className="daha-fazla-buton" style={{ marginLeft: 16, fontSize: 11, padding: '4px 8px', fontWeight: 600, color: '#1D9596', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))' }} onClick={() => setGenisletilmis((onceki) => ({ ...onceki, [gorev.id]: !onceki[gorev.id] }))}>
          {genisletildi ? '▲ Daralt' : `▼ ${altlar.length - 2} tane daha göster`}
        </button>
      )}
    </div>
  )
}

export default function Gorevler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  
  const [gorevler, setGorevler] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [filtreDurum, setFiltreDurum] = useState('hepsi')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreKisi, setFiltreKisi] = useState('hepsi')
  const [filtreEkleyen, setFiltreEkleyen] = useState('hepsi')
  const [arama, setArama] = useState('')
  const [filtrelerAcik, setFiltrelerAcik] = useState(false)
  const [arsivAcik, setArsivAcik] = useState(false)
  
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'

  // Karusel ve Görünüm State'leri
  const [gorunumModu, setGorunumModu] = useState('karusel') // 'karusel' | 'liste'
  const [santiyeIndex, setSantiyeIndex] = useState(0)
  
  // Pop-up Görev Ekleme Modal State'leri
  const [modalAcik, setModalAcik] = useState(false)
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniOncelik, setYeniOncelik] = useState('sari')
  const [yeniEtiketliler, setYeniEtiketliler] = useState([])
  const [yeniFotograf, setYeniFotograf] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  // Hızlı Satır İçi Görev Ekleme State'leri
  const [hizliBaslik, setHizliBaslik] = useState('')
  const [hizliOncelik, setHizliOncelik] = useState('sari')
  const [hizliYukleniyor, setHizliYukleniyor] = useState(false)

  // Görsel Büyütme (Lightbox) Modal State'i
  const [seciliGorsel, setSeciliGorsel] = useState(null)

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzenlenenBaslik, setDuzenlenenBaslik] = useState('')

  const [genisletilmis, setGenisletilmis] = useState({})
  const [altGorevAcikId, setAltGorevAcikId] = useState(null)
  const [altGorevMetni, setAltGorevMetni] = useState('')
  const [seciliGorevler, setSeciliGorevler] = useState([])
  const [oncelikSeciciAcikId, setOncelikSeciciAcikId] = useState(null)
  const [kisiSeciciAcikId, setKisiSeciciAcikId] = useState(null)
  const [siralamaYonu, setSiralamaYonu] = useState('yeni') // 'yeni' | 'eski'
  const [gosterilenSayisi, setGosterilenSayisi] = useState(20)

  const [yazdirModaliAcik, setYazdirModaliAcik] = useState(false)
  const [yazdirmaTasarimi, setYazdirmaTasarimi] = useState('tablo') // 'tablo' | 'kart'

  // Touch Swipe State'leri
  const [touchStartX, setTouchStartX] = useState(null)
  const [touchEndX, setTouchEndX] = useState(null)

  useEffect(() => {
    if (aktifSantiye) setYeniSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    gorevleriYukle()
    supabase.from('profiles').select('*').order('ad_soyad').then(({ data }) => setKullanicilar(data || []))
  }, [])

  // Pano yapıştırma (Ctrl+V) ile görsel ekleme
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const yeniDosya = new File([file], `gorev_gorseli_${Date.now()}.png`, { type: file.type })
            setYeniFotograf(yeniDosya)
            if (!modalAcik) {
              setModalAcik(true)
            }
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [modalAcik])

  // Modal açıkken Esc ile kapatma ve Ctrl+Enter ile kaydetme
  useEffect(() => {
    if (!modalAcik) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !yukleniyor) {
        setModalAcik(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !yukleniyor) {
        gorevEkle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalAcik, yukleniyor, yeniBaslik, yeniSantiyeId, yeniOncelik, yeniEtiketliler, yeniFotograf])

  const gorevleriYukle = async () => {
    const { data, error } = await supabase
      .from('gorevler')
      .select('*, gorev_etiketleri(*), santiyeler(ad), profiles!olusturan(ad_soyad)')
      .order('created_at', { ascending: false })
    if (error) {
      alert('Görevler yüklenemedi: ' + error.message)
      return
    }
    
    let gecerliGorevler = data || []
    
    if (profile?.rol === 'santiye_sefi') {
      gecerliGorevler = gecerliGorevler.filter(g => 
        g.olusturan === profile.id || 
        (g.gorev_etiketleri && g.gorev_etiketleri.some(e => e.etiket_turu === 'kisi' && e.deger === profile.id))
      )
    }
    
    setGorevler(gecerliGorevler)
  }

  // Karusel Şantiye Listesi (Santiyeler + varsa şantiyesiz/genel)
  const santiyesizGorevVarMi = gorevler.some(g => !g.santiye_id)
  const karuselSantiyeler = [
    ...santiyeler,
    ...(santiyesizGorevVarMi ? [{ id: 'genel', ad: 'Genel Görevler' }] : [])
  ]
  const toplamSantiye = karuselSantiyeler.length || 1

  // Sonsuz döngü çevirme fonksiyonları
  const solaCevir = () => {
    if (toplamSantiye <= 1) return
    setSantiyeIndex((prev) => (prev - 1 + toplamSantiye) % toplamSantiye)
  }

  const sagaCevir = () => {
    if (toplamSantiye <= 1) return
    setSantiyeIndex((prev) => (prev + 1) % toplamSantiye)
  }

  // Klavye ok tuşları ile karuseli çevirme
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalAcik || arsivAcik || yazdirModaliAcik || seciliGorsel) return
      if (e.key === 'ArrowLeft') {
        solaCevir()
      } else if (e.key === 'ArrowRight') {
        sagaCevir()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [santiyeIndex, modalAcik, arsivAcik, yazdirModaliAcik, seciliGorsel, toplamSantiye])

  // Dokunmatik swipe (kaydırma) algılayıcıları
  const handleTouchStart = (e) => {
    setTouchEndX(null)
    setTouchStartX(e.targetTouches[0].clientX)
  }
  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }
  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return
    const fark = touchStartX - touchEndX
    if (fark > 45) {
      sagaCevir() // Sağa kaydırdı (sonraki şantiye)
    } else if (fark < -45) {
      solaCevir() // Sola kaydırdı (önceki şantiye)
    }
  }

  const aktifSantiyeKarusel = karuselSantiyeler[santiyeIndex] || karuselSantiyeler[0]
  const oncekiIndex = (santiyeIndex - 1 + toplamSantiye) % toplamSantiye
  const sonrakiIndex = (santiyeIndex + 1) % toplamSantiye
  const oncekiSantiyeObj = karuselSantiyeler[oncekiIndex]
  const sonrakiSantiyeObj = karuselSantiyeler[sonrakiIndex]

  // Pratik görev ekleme modalını açar (istenirse belirli bir şantiyeyi seçerek)
  const gorevEkleModaliniAc = (hedefSantiyeId = null) => {
    const secilecek = hedefSantiyeId || aktifSantiyeKarusel?.id || aktifSantiye?.id || (santiyeler[0]?.id || '')
    setYeniSantiyeId(secilecek)
    setYeniBaslik('')
    setYeniOncelik('sari')
    setYeniEtiketliler([])
    setYeniFotograf(null)
    setModalAcik(true)
  }

  const panodanYapistir = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type)
            const file = new File([blob], `gorev_panosu_${Date.now()}.png`, { type: blob.type })
            setYeniFotograf(file)
            return
          }
        }
      }
      alert('Panoda bir görsel bulunamadı.')
    } catch (err) {
      console.warn(err)
      alert('Panoya erişim sağlanamadı. Lütfen Ctrl+V ile yapıştırın veya dosya seçin.')
    }
  }

  const gorevEkle = async () => {
    if (!yeniBaslik.trim()) {
      alert('Lütfen görev başlığı yazın.')
      return
    }
    if (!yeniSantiyeId) {
      alert('Lütfen bir şantiye seçin.')
      return
    }

    setYukleniyor(true)
    let fotografUrl = null

    // Görsel varsa Google Drive'a optimize ederek yükle
    if (yeniFotograf) {
      try {
        const seciliSantiye = santiyeler.find((s) => s.id === yeniSantiyeId)
        const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
        const folderName = `Gorevler/${santiyeAdi}`
        const adSoyad = `Gorev-${yeniBaslik.substring(0, 25).trim()}`

        const optimizeGorsel = await compressImage(yeniFotograf)
        const driveSonuc = await uploadToGoogleDrive({
          file: optimizeGorsel,
          folderName,
          adSoyad,
          date: new Date().toISOString().slice(0, 10),
        })
        fotografUrl = driveSonuc.url
      } catch (err) {
        console.error('Google Drive yükleme hatası:', err)
        alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
        setYukleniyor(false)
        return
      }
    }

    let eklenecekGorev = {
      santiye_id: yeniSantiyeId === 'genel' ? null : yeniSantiyeId,
      baslik: yeniBaslik.trim(),
      olusturan: profile?.id,
      fotograf_url: fotografUrl || null,
      aciklama: fotografUrl ? `IMAGE_URL:${fotografUrl}` : null,
    }

    let { data, error } = await supabase.from('gorevler').insert(eklenecekGorev).select().single()

    // Eğer veritabanında fotograf_url sütunu henüz eklenmemişse hata vermemesi için fallback
    if (error && error.message?.includes('fotograf_url')) {
      delete eklenecekGorev.fotograf_url
      const retry = await supabase.from('gorevler').insert(eklenecekGorev).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      alert('Görev eklenemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    if (data) {
      // Öncelik etiketi
      await supabase.from('gorev_etiketleri').insert({ gorev_id: data.id, etiket_turu: 'oncelik', deger: yeniOncelik })

      // Fotoğraf etiketi (ek güvence)
      if (fotografUrl) {
        await supabase.from('gorev_etiketleri').insert({ gorev_id: data.id, etiket_turu: 'fotograf', deger: fotografUrl })
      }

      // Kişi etiketleri ve bildirimler
      for (const kullaniciId of yeniEtiketliler) {
        await supabase.from('gorev_etiketleri').insert({ gorev_id: data.id, etiket_turu: 'kisi', deger: kullaniciId })
        const kendiniEtiketledi = kullaniciId === profile?.id
        await supabase.from('bildirimler').insert({
          kullanici_id: kullaniciId,
          mesaj: kendiniEtiketledi
            ? `Kendinizi bir görevde etiketlediniz: "${yeniBaslik}"`
            : `${profile?.ad_soyad || 'Bir kullanıcı'} sizi bir görevde etiketledi: "${yeniBaslik}"`,
          gorev_id: data.id,
          olusturan: profile?.id,
        })
      }
    }

    setYeniBaslik('')
    setYeniFotograf(null)
    setYeniEtiketliler([])
    setModalAcik(false)
    setYukleniyor(false)
    gorevleriYukle()
  }

  const goreveSonradanFotografEkle = async (gorev, file) => {
    if (!file) return
    setYukleniyor(true)
    try {
      const seciliSantiye = santiyeler.find((s) => s.id === gorev.santiye_id)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      const folderName = `Gorevler/${santiyeAdi}`
      const adSoyad = `Gorev-${gorev.baslik.substring(0, 25).trim()}`

      const optimizeFile = await compressImage(file)
      const driveSonuc = await uploadToGoogleDrive({
        file: optimizeFile,
        folderName,
        adSoyad,
        date: new Date().toISOString().slice(0, 10),
      })

      let { error } = await supabase.from('gorevler').update({
        fotograf_url: driveSonuc.url,
        aciklama: `IMAGE_URL:${driveSonuc.url}`
      }).eq('id', gorev.id)

      if (error && error.message?.includes('fotograf_url')) {
        await supabase.from('gorevler').update({
          aciklama: `IMAGE_URL:${driveSonuc.url}`
        }).eq('id', gorev.id)
      }

      await supabase.from('gorev_etiketleri').insert({
        gorev_id: gorev.id,
        etiket_turu: 'fotograf',
        deger: driveSonuc.url
      })

      gorevleriYukle()
    } catch (err) {
      alert('Fotoğraf yüklenemedi: ' + err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  const altGorevEkle = async (ustId, santiyeId) => {
    if (!altGorevMetni.trim()) return
    const { error } = await supabase.from('gorevler').insert({
      santiye_id: santiyeId,
      baslik: altGorevMetni,
      olusturan: profile?.id,
      ust_gorev_id: ustId,
    })
    if (error) { alert('Alt görev eklenemedi: ' + error.message); return }
    setAltGorevMetni('')
    setAltGorevAcikId(null)
    gorevleriYukle()
  }

  const durumGuncelle = async (id, yeniDurum) => {
    await supabase.from('gorevler').update({ durum: yeniDurum }).eq('id', id)
    
    if (yeniDurum === 'tamamlandi') {
      await supabase.from('bildirimler').update({ okundu: true }).eq('gorev_id', id)
    } else {
      await supabase.from('bildirimler').update({ okundu: false }).eq('gorev_id', id)
    }
    
    gorevleriYukle()
  }

  const oncelikDegistir = async (gorev, yeniDeger) => {
    const mevcutEtiket = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
    if (mevcutEtiket) {
      await supabase.from('gorev_etiketleri').update({ deger: yeniDeger }).eq('id', mevcutEtiket.id)
    } else {
      await supabase.from('gorev_etiketleri').insert({ gorev_id: gorev.id, etiket_turu: 'oncelik', deger: yeniDeger })
    }
    setOncelikSeciciAcikId(null)
    gorevleriYukle()
  }

  const kisiEtiketiDegistir = async (gorev, kullaniciId) => {
    const mevcutEtiket = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'kisi' && e.deger === kullaniciId)
    if (mevcutEtiket) {
      await supabase.from('gorev_etiketleri').delete().eq('id', mevcutEtiket.id)
    } else {
      await supabase.from('gorev_etiketleri').insert({ gorev_id: gorev.id, etiket_turu: 'kisi', deger: kullaniciId })
      if (kullaniciId !== profile?.id) {
        await supabase.from('bildirimler').insert({
          kullanici_id: kullaniciId,
          mesaj: `${profile?.ad_soyad || 'Bir kullanıcı'} sizi bir görevde etiketledi: "${gorev.baslik}"`,
          gorev_id: gorev.id,
          olusturan: profile?.id,
        })
      }
    }
    gorevleriYukle()
  }

  const basligiKaydet = async (id) => {
    if (!duzenlenenBaslik.trim()) return
    await supabase.from('gorevler').update({ baslik: duzenlenenBaslik }).eq('id', id)
    setDuzenlenenId(null)
    gorevleriYukle()
  }

  const gorevSil = async (id) => {
    if (!window.confirm('Bu görevi (ve varsa alt görevlerini) silmek istediğinize emin misiniz?')) return
    
    const silinecek = gorevler.find((g) => g.id === id)
    const gorsel = gorevGorseliBul(silinecek)
    if (gorsel) {
      try {
        const s = santiyeler.find((x) => x.id === silinecek.santiye_id)
        const folderName = `Gorevler/${s ? s.ad : 'Genel'}`
        await moveToSilinenler(gorsel, folderName)
      } catch (e) {
        console.warn('Görsel silinenlere taşınamadı:', e)
      }
    }

    await supabase.from('gorevler').delete().eq('id', id)
    gorevleriYukle()
  }



  const hizliGorevEkle = async (e) => {
    if (e) e.preventDefault()
    if (!hizliBaslik.trim() || hizliYukleniyor) return
    setHizliYukleniyor(true)
    try {
      const seciliSantiyeId = aktifSantiyeKarusel?.id === 'genel' ? null : aktifSantiyeKarusel?.id
      let eklenecek = {
        santiye_id: seciliSantiyeId,
        baslik: hizliBaslik.trim(),
        olusturan: profile?.id,
      }
      let { data, error } = await supabase.from('gorevler').insert(eklenecek).select().single()
      if (error && error.message?.includes('fotograf_url')) {
        const retry = await supabase.from('gorevler').insert(eklenecek).select().single()
        data = retry.data
        error = retry.error
      }
      if (error) throw error
      if (data) {
        await supabase.from('gorev_etiketleri').insert({
          gorev_id: data.id,
          etiket_turu: 'oncelik',
          deger: hizliOncelik
        })
      }
      setHizliBaslik('')
      gorevleriYukle()
    } catch (err) {
      alert('Hızlı görev eklenemedi: ' + err.message)
    } finally {
      setHizliYukleniyor(false)
    }
  }

  const etiketliKisiToggle = (id) => {
    setYeniEtiketliler((onceki) => onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id])
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  // Görev Numaralandırması
  const numaraHaritasi = {}
  const kokTumTarihSirali = gorevler.filter((g) => !g.ust_gorev_id).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  const numarala = (gorev, prefix, derinlik = 0) => {
    if (derinlik > 20) return
    numaraHaritasi[gorev.id] = prefix
    const altlar = gorevler.filter((g) => g.ust_gorev_id === gorev.id).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    altlar.forEach((alt, i) => numarala(alt, `${prefix}.${i + 1}`, derinlik + 1))
  }
  kokTumTarihSirali.forEach((kok, i) => numarala(kok, String(i + 1)))

  const kisiListesiMetni = (gorev) => {
    const kisiler = (gorev.gorev_etiketleri || [])
      .filter((e) => e.etiket_turu === 'kisi')
      .map((e) => kullanicilar.find((k) => k.id === e.deger)?.ad_soyad)
      .filter(Boolean)
    return kisiler.length ? kisiler.join(', ') : 'Atanmamış'
  }

  const paylasMetniOlustur = (hepsi) => {
    const bolumler = [
      { durum: 'bekliyor', baslik: '🟡 BEKLEYEN GÖREVLER' },
      { durum: 'devam_ediyor', baslik: '🔵 DEVAM EDEN GÖREVLER' },
      { durum: 'gecikti', baslik: '🔴 GECİKEN GÖREVLER' },
    ]
    let metin = `📋 GÖREV RAPORU — ${guvenliTarih(new Date().toISOString())}\n\n`
    const kaynakListe = (!hepsi && seciliGorevler.length > 0) ? gorevler.filter((g) => seciliGorevler.includes(g.id)) : gorevler.filter(g => g.durum !== 'tamamlandi')
    bolumler.forEach((b) => {
      const liste = kaynakListe
        .filter((g) => g.durum === b.durum)
        .sort((a, c) => (numaraHaritasi[a.id] || '').localeCompare(numaraHaritasi[c.id] || '', undefined, { numeric: true }))
      if (liste.length === 0) return
      metin += `${b.baslik}\n`
      liste.forEach((g) => {
        metin += `${numaraHaritasi[g.id] || '?'}. ${g.baslik}\n`
        metin += `   Şantiye: ${g.santiyeler?.ad || '—'}\n`
        metin += `   Kişi: ${kisiListesiMetni(g)}\n`
        const gUrl = gorevGorseliBul(g)
        if (gUrl) metin += `   📷 Belge: ${gUrl}\n`
        metin += `   Ekleyen: ${g.profiles?.ad_soyad || 'Bilinmiyor'}, ${guvenliTarih(g.created_at)}\n\n`
      })
    })
    return metin
  }

  const paylas = async (hepsi) => {
    const metin = paylasMetniOlustur(hepsi)
    if (navigator.share) {
      try { await navigator.share({ text: metin, title: 'Görev Raporu' }) } catch { /* kullanıcı iptal etti */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  // Aktif görevler (Tamamlananlar Arşive gider)
  const aktifGorevler = gorevler.filter((g) => g.durum !== 'tamamlandi')
  const tamamlananGorevler = gorevler.filter((g) => g.durum === 'tamamlandi')

  // Şantiyelerin aktif görev sayıları haritası
  const santiyeGorevSayilari = {}
  const santiyeGecikenSayilari = {}
  karuselSantiyeler.forEach(s => {
    santiyeGorevSayilari[s.id] = aktifGorevler.filter(g => s.id === 'genel' ? !g.santiye_id : g.santiye_id === s.id).length
    santiyeGecikenSayilari[s.id] = gorevler.filter(g => (s.id === 'genel' ? !g.santiye_id : g.santiye_id === s.id) && g.durum === 'gecikti').length
  })

  // Karusel Modu için o anki aktif şantiyenin görevleri
  const karuselGorevleri = aktifGorevler.filter(g => {
    if (!aktifSantiyeKarusel) return true
    return aktifSantiyeKarusel.id === 'genel' ? !g.santiye_id : g.santiye_id === aktifSantiyeKarusel.id
  })

  // Aktif şantiyenin tamamlanma ve durum istatistikleri
  const oSantiyeGorevleri = gorevler.filter(g => {
    if (!aktifSantiyeKarusel) return false
    return aktifSantiyeKarusel.id === 'genel' ? !g.santiye_id : g.santiye_id === aktifSantiyeKarusel.id
  })
  const oSantiyeBekleyen = oSantiyeGorevleri.filter(g => g.durum === 'bekliyor').length
  const oSantiyeDevam = oSantiyeGorevleri.filter(g => g.durum === 'devam_ediyor').length
  const oSantiyeTamam = oSantiyeGorevleri.filter(g => g.durum === 'tamamlandi').length
  const oSantiyeGeciken = oSantiyeGorevleri.filter(g => g.durum === 'gecikti').length
  const oSantiyeToplam = oSantiyeGorevleri.length
  const oSantiyeYuzde = oSantiyeToplam > 0 ? Math.round((oSantiyeTamam / oSantiyeToplam) * 100) : 0

  // Liste Modu için filtreleme zinciri
  const santiyeyeGoreFiltreli = gorunumModu === 'karusel' 
    ? karuselGorevleri 
    : (filtreSantiye === 'hepsi' ? aktifGorevler : aktifGorevler.filter((g) => g.santiye_id === filtreSantiye))

  const kisiyeGoreFiltreli = filtreKisi === 'hepsi'
    ? santiyeyeGoreFiltreli
    : santiyeyeGoreFiltreli.filter((g) => g.gorev_etiketleri?.some((e) => e.etiket_turu === 'kisi' && e.deger === filtreKisi))
  
  const ekleyeneGoreFiltreli = filtreEkleyen === 'hepsi'
    ? kisiyeGoreFiltreli
    : kisiyeGoreFiltreli.filter((g) => g.olusturan === filtreEkleyen)
  
  const durumaGoreFiltreli = filtreDurum === 'hepsi' ? ekleyeneGoreFiltreli : ekleyeneGoreFiltreli.filter((g) => g.durum === filtreDurum)
  
  const aramayaGoreFiltreli = durumaGoreFiltreli.filter((g) => {
    if (!arama) return true
    return (g.baslik || '').toLowerCase().includes(arama.toLowerCase())
  })

  const kokGorevler = aramayaGoreFiltreli
    .filter((g) => !g.ust_gorev_id)
    .sort((a, b) => siralamaYonu === 'yeni' ? new Date(b.created_at || 0) - new Date(a.created_at || 0) : new Date(a.created_at || 0) - new Date(b.created_at || 0))
  
  const gosterilenKokGorevler = kokGorevler.slice(0, gosterilenSayisi)

  const altGorevleriBul = (ustId) => aramayaGoreFiltreli.filter((g) => g.ust_gorev_id === ustId)

  const ctx = {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler, kisiSeciciAcikId, setKisiSeciciAcikId,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir, kisiEtiketiDegistir,
    setSeciliGorsel, goreveSonradanFotografEkle
  }

  const aktifFiltreSayisi = [
    (gorunumModu === 'liste' && filtreSantiye !== 'hepsi'),
    filtreDurum !== 'hepsi',
    filtreKisi !== 'hepsi',
    filtreEkleyen !== 'hepsi'
  ].filter(Boolean).length

  return (
    <div className="sayfa sayfa-gorevler">
      {/* ÜST BAŞLIK VE EYLEM BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1D9596', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Görevler</span>
            <span style={{ fontSize: 13, background: '#E6F9F0', color: '#0B6B41', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              {aktifGorevler.length} Aktif
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Görünüm Değiştirici: Karusel / Liste */}
          <div className="gorunum-secici" style={{ margin: 0, padding: '2px', background: '#f4f3ed', borderRadius: 10 }}>
            <button 
              className={gorunumModu === 'karusel' ? 'secili-tab' : ''} 
              onClick={() => setGorunumModu('karusel')}
              style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
              title="Şantiye Karuseli Görünümü"
            >
              🎠 Karusel
            </button>
            <button 
              className={gorunumModu === 'liste' ? 'secili-tab' : ''} 
              onClick={() => setGorunumModu('liste')}
              style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8 }}
              title="Toplu Liste Görünümü"
            >
              📑 Liste
            </button>
          </div>

          {/* ARŞİV BUTONU (ÜST BARDA) */}
          <button 
            onClick={() => setArsivAcik(true)} 
            style={{ 
              fontSize: 12, 
              padding: '8px 12px', 
              borderRadius: 10, 
              background: 'linear-gradient(135deg, #118166, #0F6E56)', 
              color: '#ffffff', 
              border: 'none', 
              boxShadow: '0 2px 6px rgba(15, 110, 86, 0.25)', 
              fontWeight: 700, 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
            title="Tamamlanan Görevler Arşivi"
          >
            📦 Arşiv ({tamamlananGorevler.length})
          </button>

          <button onClick={() => setYazdirModaliAcik(true)} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', fontWeight: 700, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            🖨️ Yazdır
          </button>
          <button onClick={() => paylas(true)} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', fontWeight: 700, color: '#555', cursor: 'pointer' }}>
            📤 Paylaş
          </button>
        </div>
      </div>

      {seciliGorevler.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#E6F9F0', border: '1px solid #A3E5C8', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: '#0B6B41', fontWeight: 600 }}>
            {seciliGorevler.length} görev seçildi
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => paylas(false)} style={{ fontSize: 11, padding: '4px 8px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              📤 Seçilenleri Paylaş
            </button>
            <button onClick={() => setSeciliGorevler([])} style={{ fontSize: 11, padding: '4px 8px', background: 'transparent', border: 'none', color: '#D64545', cursor: 'pointer' }}>
              Seçimi Kaldır
            </button>
          </div>
        </div>
      )}

      {/* TÜM ŞANTİYELER GÖREV DAĞILIMI & HIZLI SEÇİM IZGARASI (TEK BAKIŞTA TÜM ŞANTİYELER) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏗️ Şantiye Görev Dağılımı</span>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>({karuselSantiyeler.length} Şantiye)</span>
          </span>
          <span style={{ fontSize: 11.5, color: '#0F766E', fontWeight: 600 }}>
            {gorunumModu === 'karusel' ? 'Karuseli odaklamak için şantiyeye tıklayın' : 'Listeyi filtrelemek için şantiyeye tıklayın'}
          </span>
        </div>

        <div className="santiye-gorev-izgara">
          {/* Liste modunda 'Tümü' seçeneği */}
          {gorunumModu === 'liste' && (
            <button
              type="button"
              onClick={() => setFiltreSantiye('hepsi')}
              className={`santiye-izgara-kart ${filtreSantiye === 'hepsi' ? 'aktif' : ''}`}
            >
              <div className="santiye-izgara-sol">
                <span className="santiye-izgara-ikon">🌐</span>
                <span className="santiye-izgara-ad">Tüm Şantiyeler</span>
              </div>
              <span className="santiye-izgara-rozet">{aktifGorevler.length}</span>
            </button>
          )}

          {karuselSantiyeler.map((s, idx) => {
            const aktifMi = gorunumModu === 'karusel'
              ? idx === santiyeIndex
              : filtreSantiye === s.id
            const gorevSayisi = santiyeGorevSayilari[s.id] || 0
            const gecikenSayisi = santiyeGecikenSayilari[s.id] || 0

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (gorunumModu === 'karusel') {
                    setSantiyeIndex(idx)
                  } else {
                    setFiltreSantiye(s.id)
                  }
                }}
                className={`santiye-izgara-kart ${aktifMi ? 'aktif' : ''} ${gecikenSayisi > 0 ? 'gecikenli' : ''}`}
                title={gecikenSayisi > 0 ? `${s.ad}: ${gorevSayisi} aktif görev, ${gecikenSayisi} gecikti!` : `${s.ad}: ${gorevSayisi} aktif görev`}
              >
                <div className="santiye-izgara-sol">
                  <span className="santiye-izgara-ikon">{s.id === 'genel' ? '📋' : '🏗️'}</span>
                  <span className="santiye-izgara-ad">{s.ad}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {gecikenSayisi > 0 && (
                    <span style={{ fontSize: 10, background: '#FEE2E2', color: '#B91C1C', padding: '1px 5px', borderRadius: 6, fontWeight: 800 }}>
                      🔴 {gecikenSayisi}
                    </span>
                  )}
                  <span className="santiye-izgara-rozet">
                    {gorevSayisi}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* KARUSEL GÖRÜNÜMÜ */}
      {gorunumModu === 'karusel' ? (
        <div>
          {/* 3D Sonsuz Dönen Karusel Sahnesi */}
          <div 
            className="karusel-sahne" 
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleTouchEnd}
          >
            {/* Merkez Ana Aktif Şantiye Kartı */}
            <div className="karusel-merkez-kart">
              {/* Şantiye Başlık Banner'ı */}
              <div className="santiye-kart-banner">
                <div className="banner-sol">
                  <div className="santiye-ikon">🏗️</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 className="santiye-ad">{aktifSantiyeKarusel?.ad}</h3>
                      <span className="santiye-sira-rozet">
                        {santiyeIndex + 1} / {toplamSantiye}
                      </span>
                    </div>
                    <div className="santiye-istatistik-satiri">
                      <span>{oSantiyeBekleyen + oSantiyeDevam + oSantiyeGeciken} Aktif Görev</span>
                      {oSantiyeGeciken > 0 && <span className="geciken-rozet">🔴 {oSantiyeGeciken} Gecikti</span>}
                      {oSantiyeTamam > 0 && <span className="tamam-rozet">🟢 %{oSantiyeYuzde} Tamamlandı</span>}
                    </div>
                    <div className="santiye-progress-bar">
                      <div className="santiye-progress-dolgu" style={{ width: `${oSantiyeYuzde}%` }} />
                    </div>
                    {/* Karusel Gösterge Noktaları */}
                    <div className="karusel-noktalar">
                      {karuselSantiyeler.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSantiyeIndex(idx)}
                          className={`karusel-nokta ${idx === santiyeIndex ? 'aktif' : ''}`}
                          title={`${s.ad} (${santiyeGorevSayilari[s.id] || 0} görev)`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* Önceki ve Sonraki Şantiye Butonları */}
                  {toplamSantiye > 1 && (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button 
                        type="button" 
                        onClick={solaCevir} 
                        className="karusel-nav-btn" 
                        title={`Önceki Şantiye: ${oncekiSantiyeObj?.ad}`}
                      >
                        ◀
                      </button>
                      <button 
                        type="button" 
                        onClick={sagaCevir} 
                        className="karusel-nav-btn" 
                        title={`Sonraki Şantiye: ${sonrakiSantiyeObj?.ad}`}
                      >
                        ▶
                      </button>
                    </div>
                  )}

                  <button 
                    className="hizli-ekle-mini-buton"
                    onClick={() => gorevEkleModaliniAc(aktifSantiyeKarusel?.id)}
                    title="Detaylı görev, sorumlu ve görsel ekle"
                  >
                    <span>✨</span> Detaylı Görev Ekle
                  </button>
                </div>
              </div>

              {/* HIZLI GÖREV GİRİŞ BARI (1 TIKLA ANINDA KAYIT) */}
              <form onSubmit={hizliGorevEkle} className="karusel-hizli-ekle-bar">
                <span className="hizli-bar-ikon">⚡</span>
                <input 
                  type="text" 
                  placeholder={`"${aktifSantiyeKarusel?.ad}" için hızlı görev yazıp Enter'a basın...`}
                  value={hizliBaslik}
                  onChange={(e) => setHizliBaslik(e.target.value)}
                  disabled={hizliYukleniyor}
                  className="karusel-hizli-input"
                />

                <div className="hizli-oncelik-secici" title="Öncelik">
                  {ONCELIKLER.map((o) => (
                    <button
                      key={o.deger}
                      type="button"
                      onClick={() => setHizliOncelik(o.deger)}
                      className={`hizli-oncelik-nokta ${hizliOncelik === o.deger ? 'aktif' : ''}`}
                      style={{ backgroundColor: o.renk }}
                      title={o.etiket}
                    />
                  ))}
                </div>



                <button 
                  type="submit" 
                  disabled={!hizliBaslik.trim() || hizliYukleniyor} 
                  className="hizli-ekle-onay-btn"
                >
                  {hizliYukleniyor ? '...' : '+ Ekle'}
                </button>
              </form>

              {/* Arama, Durum Filtresi ve Sıralama */}
              <div className="karusel-filtre-satiri">
                <div className="arama-input-sarici">
                  <span className="arama-ikon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Bu şantiyede ara..." 
                    value={arama} 
                    onChange={(e) => setArama(e.target.value)} 
                    className="arama-filtre-input"
                  />
                  {arama && <button type="button" onClick={() => setArama('')} className="arama-temizle-btn">✕</button>}
                </div>

                <select 
                  value={filtreDurum} 
                  onChange={(e) => setFiltreDurum(e.target.value)} 
                  className="filtre-durum-select"
                >
                  <option value="hepsi">Tüm Durumlar ({kokGorevler.length})</option>
                  {DURUMLAR.filter(d => d.deger !== 'tamamlandi').map((d) => <option key={d.deger} value={d.deger}>{d.etiket}</option>)}
                </select>

                <button
                  type="button"
                  onClick={() => setSiralamaYonu((onceki) => (onceki === 'yeni' ? 'eski' : 'yeni'))}
                  title="Sıralama yönünü değiştir"
                  className="filtre-siralama-btn"
                >
                  <span>⇅</span> {siralamaYonu === 'yeni' ? 'Yeni' : 'Eski'}
                </button>
              </div>

              {/* Görev Listesi */}
              <div className="karusel-kart-icerik">
                {gosterilenKokGorevler.map((g) => (
                  <GorevKarti key={g.id} gorev={g} seviye={0} ctx={ctx} />
                ))}

                {kokGorevler.length === 0 && (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#fafaf9', borderRadius: 12, border: '1px dashed #d3d1c7', margin: '8px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <p style={{ margin: '0 0 12px', fontSize: 14, color: '#666', fontWeight: 600 }}>
                      {arama || filtreDurum !== 'hepsi' 
                        ? 'Filtreye uygun görev bulunamadı.' 
                        : `${aktifSantiyeKarusel?.ad} için bekleyen görev bulunmuyor.`}
                    </p>
                    <button 
                      onClick={() => gorevEkleModaliniAc(aktifSantiyeKarusel?.id)}
                      style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)' }}
                    >
                      + İlk Görevi Ekle
                    </button>
                  </div>
                )}

                {kokGorevler.length > gosterilenSayisi && (
                  <button className="daha-fazla-buton" onClick={() => setGosterilenSayisi((n) => n + 15)}>
                    ▼ Daha fazla göster ({kokGorevler.length - gosterilenSayisi} tane daha)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* LİSTE GÖRÜNÜMÜ */
        <div>
          {/* ARAMA, SIRALAMA VE FİLTRE */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Görevlerde ara..." 
              value={arama} 
              onChange={(e) => setArama(e.target.value)} 
              style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', fontSize: 13, outline: 'none' }} 
            />
            <button
              type="button"
              onClick={() => setSiralamaYonu((onceki) => (onceki === 'yeni' ? 'eski' : 'yeni'))}
              title="Sıralama yönünü değiştir"
              style={{
                padding: '10px 14px',
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#ffffff',
                color: '#444',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                whiteSpace: 'nowrap'
              }}
            >
              <span>⇅</span> {siralamaYonu === 'yeni' ? 'Yeni → Eski' : 'Eski → Yeni'}
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setFiltrelerAcik(!filtrelerAcik)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: filtrelerAcik ? 'linear-gradient(135deg, #24b8b9, #1D9596)' : 'linear-gradient(to bottom, #ffffff, #fcfcf9)',
                color: filtrelerAcik ? '#fff' : '#333',
                border: filtrelerAcik ? 'none' : '1px solid rgba(0,0,0,0.04)',
                boxShadow: filtrelerAcik ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.04)',
                borderRadius: 12,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              <span>🔍 Filtreler {aktifFiltreSayisi > 0 ? `(${aktifFiltreSayisi} aktif)` : ''}</span>
              <span>{filtrelerAcik ? '▲ Gizle' : '▼ Göster'}</span>
            </button>

            {filtrelerAcik && (
              <div style={{ background: '#f8f7f2', padding: '16px', borderRadius: 12, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Şantiye</label>
                    <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', outline: 'none' }}>
                      <option value="hepsi">Tüm Şantiyeler</option>
                      {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Durum</label>
                    <select value={filtreDurum} onChange={(e) => setFiltreDurum(e.target.value)} style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', outline: 'none' }}>
                      <option value="hepsi">Tüm Durumlar</option>
                      {DURUMLAR.filter(d => d.deger !== 'tamamlandi').map((d) => <option key={d.deger} value={d.deger}>{d.etiket}</option>)}
                    </select>
                  </div>

                  {yonetici && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Kişi (Etiket)</label>
                      <select value={filtreKisi} onChange={(e) => setFiltreKisi(e.target.value)} style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', outline: 'none' }}>
                        <option value="hepsi">Tümü</option>
                        {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Ekleyen</label>
                    <select value={filtreEkleyen} onChange={(e) => setFiltreEkleyen(e.target.value)} style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', outline: 'none' }}>
                      <option value="hepsi">Tümü</option>
                      {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
                    </select>
                  </div>
                </div>

                {aktifFiltreSayisi > 0 && (
                  <button
                    onClick={() => { setFiltreSantiye('hepsi'); setFiltreDurum('hepsi'); setFiltreKisi('hepsi'); setFiltreEkleyen('hepsi') }}
                    style={{ width: '100%', padding: '10px', fontSize: 12, marginTop: 14, background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, color: '#D64545', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕ Filtreleri Temizle
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="liste">
            {gosterilenKokGorevler.map((g) => <GorevKarti key={g.id} gorev={g} seviye={0} ctx={ctx} />)}
            {kokGorevler.length === 0 && <p className="bos-mesaj">Bu filtrede aktif görev yok.</p>}
          </div>

          {kokGorevler.length > gosterilenSayisi && (
            <button className="daha-fazla-buton" style={{ marginTop: 8 }} onClick={() => setGosterilenSayisi((n) => n + 15)}>
              ▼ Daha fazla göster ({kokGorevler.length - gosterilenSayisi} tane daha)
            </button>
          )}
        </div>
      )}



      {/* =========================================================
          POP-UP GÖREV EKLEME MODALI (PRATİK & HIZLI)
          ========================================================= */}
      {modalAcik && (
        <div className="gorev-popup-overlay" onClick={() => !yukleniyor && setModalAcik(false)}>
          <div className="gorev-popup-kutu" onClick={(e) => e.stopPropagation()}>
            {/* Modal Başlık */}
            <div className="gorev-popup-ust">
              <h3>
                <span>✨</span> Yeni Görev Oluştur
              </h3>
              <button className="kapat-btn" onClick={() => !yukleniyor && setModalAcik(false)}>✕</button>
            </div>

            {/* Modal Gövdesi */}
            <div className="gorev-popup-govde">
              {/* 1. Şantiye Seçimi (Pratik Çipler + Dropdown) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  🏗️ Şantiye Seçin:
                </label>
                <div className="modal-santiye-cipler">
                  {karuselSantiyeler.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`modal-santiye-cip ${yeniSantiyeId === s.id ? 'secili' : ''}`}
                      onClick={() => setYeniSantiyeId(s.id)}
                    >
                      {yeniSantiyeId === s.id ? '✓ ' : ''}{s.ad}
                    </button>
                  ))}
                </div>
                <select 
                  value={yeniSantiyeId} 
                  onChange={(e) => setYeniSantiyeId(e.target.value)} 
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d3d1c7', fontSize: 13, marginTop: 6 }}
                >
                  {karuselSantiyeler.map((s) => (
                    <option key={s.id} value={s.id}>{s.ad}</option>
                  ))}
                </select>
              </div>

              {/* 2. Görev Başlığı ve Sesle Yazma */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    📝 Görev Başlığı:
                  </label>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    İpucu: <b>Ctrl+Enter</b> ile kaydet
                  </span>
                </div>

                {/* Hızlı Şablon Çipleri */}
                <div className="hazir-sablon-alani" style={{ marginBottom: 6 }}>
                  <div className="sablon-cipler">
                    {HAZIR_SABLONLAR.map((sablon) => (
                      <button
                        key={sablon}
                        type="button"
                        className="sablon-cip"
                        onClick={() => setYeniBaslik((onceki) => onceki ? `${onceki} - ${sablon}` : sablon)}
                        title="Şablonu ekle"
                      >
                        {sablon}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Ne yapılması gerekiyor? Görevi yazın..."
                    value={yeniBaslik}
                    onChange={(e) => setYeniBaslik(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !yukleniyor && gorevEkle()}
                    autoFocus
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #CBD5E1', fontSize: 14, outline: 'none' }}
                  />
                </div>
              </div>

              {/* 3. Öncelik Derecesi */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  ⚡ Öncelik Seviyesi:
                </label>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                  {ONCELIKLER.map((o) => (
                    <button
                      key={o.deger}
                      type="button"
                      onClick={() => setYeniOncelik(o.deger)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        border: yeniOncelik === o.deger ? 'none' : '1px solid rgba(0,0,0,0.08)',
                        background: yeniOncelik === o.deger ? o.renk : '#f8f7f2',
                        color: yeniOncelik === o.deger ? '#ffffff' : '#475569',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: yeniOncelik === o.deger ? `0 2px 8px ${o.renk}66` : 'none'
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: yeniOncelik === o.deger ? '#ffffff' : o.renk }} />
                      {o.etiket}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Sorumlu Kişiler */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
                  👤 Atanan Kişiler:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {kullanicilar.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => etiketliKisiToggle(k.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: yeniEtiketliler.includes(k.id) ? 'none' : '1px solid rgba(0,0,0,0.08)',
                        background: yeniEtiketliler.includes(k.id) ? 'linear-gradient(135deg, #24b8b9, #1D9596)' : '#ffffff',
                        color: yeniEtiketliler.includes(k.id) ? '#ffffff' : '#475569',
                        fontSize: 11,
                        fontWeight: yeniEtiketliler.includes(k.id) ? 700 : 500,
                        cursor: 'pointer',
                        boxShadow: yeniEtiketliler.includes(k.id) ? '0 2px 6px rgba(29, 149, 150, 0.3)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      {yeniEtiketliler.includes(k.id) ? '✓ ' : ''}{k.ad_soyad}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Fotoğraf / Görsel / Fiş Ekleme (Google Drive) */}
              <div className="gorsel-yukleme-alani">
                <label style={{ fontSize: 12, fontWeight: 700, color: '#0B6B41', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📷</span> Fotoğraf / Görsel Ekle (Opsiyonel):
                </label>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #A3E5C8',
                    color: '#0B6B41',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span>📎</span> {yeniFotograf ? 'Fotoğrafı Değiştir' : 'Fotoğraf / Dosya Seç'}
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      hidden 
                      onChange={(e) => e.target.files?.[0] && setYeniFotograf(e.target.files[0])} 
                    />
                  </label>

                  <button 
                    type="button" 
                    onClick={panodanYapistir}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: '#E0F2FE',
                      border: '1px solid #7DD3FC',
                      color: '#0369A1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📋 Panodan Yapıştır
                  </button>

                  {yeniFotograf && (
                    <button 
                      type="button" 
                      onClick={() => setYeniFotograf(null)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#FEE2E2',
                        border: '1px solid #FCA5A5',
                        color: '#B91C1C',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Kaldır
                    </button>
                  )}
                </div>

                {yeniFotograf && (
                  <div className="gorsel-onizleme-kapsayici">
                    <img 
                      src={URL.createObjectURL(yeniFotograf)} 
                      alt="Seçilen Görsel" 
                    />
                    <div style={{ fontSize: 12, overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {yeniFotograf.name}
                      </p>
                      <span style={{ fontSize: 11, color: '#64748B' }}>
                        {(yeniFotograf.size / 1024).toFixed(0)} KB • Google Drive'a yüklenecektir
                      </span>
                    </div>
                  </div>
                )}
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  💡 Görüntü kopyaladıktan sonra <b>Ctrl+V</b> ile de hızlıca ekleyebilirsiniz.
                </span>
              </div>

              {/* 6. Kaydet ve Vazgeç Butonları */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setModalAcik(false)}
                  disabled={yukleniyor}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#f8f7f2',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={gorevEkle}
                  disabled={yukleniyor}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #24b8b9, #1D9596)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(29, 149, 150, 0.4)'
                  }}
                >
                  {yukleniyor ? 'Kaydediliyor & Görsel Yükleniyor...' : '✓ Görevi Kaydet'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          GÖRSEL BÜYÜTME (LIGHTBOX) MODALI
          ========================================================= */}
      {seciliGorsel && (
        <div className="lightbox-overlay" onClick={() => setSeciliGorsel(null)}>
          <div className="lightbox-kutu" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#ffffff' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 16 }}>{seciliGorsel.baslik}</h4>
                {seciliGorsel.santiye && <span style={{ fontSize: 12, opacity: 0.8 }}>🏗️ {seciliGorsel.santiye}</span>}
              </div>
              <button 
                onClick={() => setSeciliGorsel(null)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 34, height: 34, color: '#fff', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <img 
              src={getGoogleDriveInlineImageUrl(seciliGorsel.url)} 
              alt="Görsel Tam Boyut" 
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <a 
                href={getGoogleDriveViewUrl(seciliGorsel.url)} 
                target="_blank" 
                rel="noreferrer"
                style={{ padding: '8px 16px', background: '#1D9596', color: '#fff', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 700 }}
              >
                🔗 Google Drive'da Aç
              </a>
              <button 
                onClick={() => setSeciliGorsel(null)}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARŞİV MODALI */}
      {arsivAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', width: '100%', maxWidth: 500, maxHeight: '80vh', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D9596', letterSpacing: '-0.3px' }}>Tamamlanan Görevler (Arşiv)</h3>
              <button onClick={() => setArsivAcik(false)} style={{ background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {tamamlananGorevler.map((g) => (
                <div key={g.id} style={{ padding: 12, background: 'linear-gradient(to bottom, #ffffff, #f8f7f2)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14, color: '#333' }}>{g.baslik}</p>
                    <span style={{ fontSize: 11, color: '#888780', fontWeight: 500 }}>{g.santiyeler?.ad || 'Genel'} · {guvenliTarih(g.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => durumGuncelle(g.id, 'bekliyor')}
                      style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)', transition: 'all 0.2s' }}
                    >
                      Aktife Al
                    </button>
                    <button
                      onClick={() => gorevSil(g.id)}
                      style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #e05e5e, #D64545)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(214, 69, 69, 0.2)', transition: 'all 0.2s' }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
              {tamamlananGorevler.length === 0 && <p className="bos-mesaj">Arşivde tamamlanan görev bulunmuyor.</p>}
            </div>
          </div>
        </div>
      )}

      {/* YAZDIRILACAK ALAN (A4) */}
      <div id="printable-a4" className={yazdirmaTasarimi === 'tablo' ? 'print-tasarim-tablo' : 'print-tasarim-kart'}>
        <h1 style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>GÜNLÜK GÖREV ÇİZELGESİ</h1>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 30 }}>Tarih: {guvenliTarih(new Date().toISOString())}</p>
        
        {Object.entries((seciliGorevler.length > 0 ? gorevler.filter(g => seciliGorevler.includes(g.id)) : aktifGorevler)
          .sort((a, b) => (numaraHaritasi[a.id] || '').localeCompare(numaraHaritasi[b.id] || '', undefined, { numeric: true }))
          .reduce((acc, g) => {
            const sAd = g.santiyeler?.ad || 'Genel / Belirtilmemiş';
            if (!acc[sAd]) acc[sAd] = [];
            acc[sAd].push(g);
            return acc;
          }, {})
        ).map(([santiyeAd, liste]) => (
          <div key={santiyeAd} style={{ marginBottom: 40, pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, borderBottom: '2px solid #333', paddingBottom: 5, marginBottom: 15 }}>🏗️ {santiyeAd}</h2>
            
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>No</th>
                  <th style={{ width: '45%' }}>Görev Başlığı</th>
                  <th style={{ width: '20%' }}>Sorumlu Kişi</th>
                  <th style={{ width: '15%' }}>Öncelik</th>
                  <th style={{ width: '15%' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(g => {
                  const oncelikEtiketi = g.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
                  const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
                  return (
                    <tr key={g.id}>
                      <td>{numaraHaritasi[g.id] || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{g.baslik}</div>
                        {g.ust_gorev_id && <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>↳ Alt görev</div>}
                      </td>
                      <td>{kisiListesiMetni(g)}</td>
                      <td>
                        <span 
                          className="print-oncelik-rozet"
                          style={{ background: oncelik?.renk || '#eee', color: oncelik ? 'white' : 'black' }}
                        >
                          {oncelik?.etiket || 'Belirtilmemiş'}
                        </span>
                      </td>
                      <td>{DURUMLAR.find(d => d.deger === g.durum)?.etiket || 'Bilinmiyor'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="kart-grid">
              {liste.map(g => {
                const oncelikEtiketi = g.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
                const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
                return (
                  <div key={g.id} className="print-gorev-kart">
                    <div className="kart-baslik">
                      <span style={{ color: '#888', marginRight: 6 }}>#{numaraHaritasi[g.id] || '-'}</span>
                      {g.baslik}
                    </div>
                    {g.ust_gorev_id && <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>↳ Alt görev</div>}
                    
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="print-oncelik-rozet" style={{ background: oncelik?.renk || '#eee', color: oncelik ? 'white' : 'black' }}>
                        {oncelik?.etiket || 'Öncelik Yok'}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#e0e0e0', fontSize: 11, fontWeight: 'bold' }}>
                        {DURUMLAR.find(d => d.deger === g.durum)?.etiket || 'Bilinmiyor'}
                      </span>
                    </div>

                    <div className="kart-alt-bilgi">
                      <span>👤 {kisiListesiMetni(g)}</span>
                      <span>📅 {guvenliTarih(g.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* YAZDIRMA ÖNİZLEME MODALI */}
      {yazdirModaliAcik && (
        <div className="print-onizleme-modal">
          <div className="print-onizleme-kutu">
            <div className="print-onizleme-baslik">
              <h3 style={{ margin: 0, fontSize: 18 }}>Tasarım Seç ve Yazdır</h3>
              <button onClick={() => setYazdirModaliAcik(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>
            
            <div className="print-onizleme-icerik">
              <div className="print-onizleme-sutun">
                <div className="print-onizleme-kontrol">
                  <button 
                    onClick={() => { setYazdirmaTasarimi('tablo'); setTimeout(() => window.print(), 100); }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}
                  >
                    🖨️ BU TASARIMI YAZDIR (Tablo)
                  </button>
                </div>
                <div className="print-onizleme-sayfa">
                  <div className="print-a4-kağıt print-tasarim-tablo" style={{ transform: 'scale(0.7)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 10 }}>GÜNLÜK GÖREV ÇİZELGESİ</h2>
                    <h3 style={{ borderBottom: '2px solid #333' }}>🏗️ Örnek Şantiye</h3>
                    <table className="print-table">
                      <thead><tr><th>No</th><th>Görev Başlığı</th><th>Kişi</th></tr></thead>
                      <tbody>
                        <tr><td>1</td><td>Malzemelerin sayımı yapılacak</td><td>Ahmet Yılmaz</td></tr>
                        <tr><td>2</td><td>Günlük rapor hazırlanacak</td><td>Mehmet Can</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="print-onizleme-sutun" style={{ borderLeft: '2px solid #ccc' }}>
                <div className="print-onizleme-kontrol">
                  <button 
                    onClick={() => { setYazdirmaTasarimi('kart'); setTimeout(() => window.print(), 100); }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #E08A2E, #C77522)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(224, 138, 46, 0.3)' }}
                  >
                    🖨️ BU TASARIMI YAZDIR (Kartlar)
                  </button>
                </div>
                <div className="print-onizleme-sayfa">
                  <div className="print-a4-kağıt print-tasarim-kart" style={{ transform: 'scale(0.7)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 10 }}>GÜNLÜK GÖREV ÇİZELGESİ</h2>
                    <h3 style={{ borderBottom: '2px solid #333' }}>🏗️ Örnek Şantiye</h3>
                    <div className="kart-grid">
                      <div className="print-gorev-kart">
                        <div className="kart-baslik">#1 Malzemelerin sayımı yapılacak</div>
                        <span className="print-oncelik-rozet" style={{ background: '#D64545', color: 'white' }}>Kritik</span>
                        <div className="kart-alt-bilgi"><span>👤 Ahmet Yılmaz</span></div>
                      </div>
                      <div className="print-gorev-kart">
                        <div className="kart-baslik">#2 Günlük rapor hazırlanacak</div>
                        <span className="print-oncelik-rozet" style={{ background: '#D9B429', color: 'white' }}>Orta</span>
                        <div className="kart-alt-bilgi"><span>👤 Mehmet Can</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}