import { useState, useRef, useEffect } from 'react'

export default function KategoriCokluSecici({
  seciliKategoriler = [],
  onDegisti,
  mevcutKategoriler = [],
  placeholder = 'Kategori ara veya ekle (en az 3 harf)...',
  disabled = false
}) {
  const [metin, setMetin] = useState('')
  const [acik, setAcik] = useState(false)
  const containerRef = useRef(null)

  // Dışarı tıklandığında öneri kutusunu kapat
  useEffect(() => {
    const handleDisaTikla = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAcik(false)
      }
    }
    document.addEventListener('mousedown', handleDisaTikla)
    return () => document.removeEventListener('mousedown', handleDisaTikla)
  }, [])

  const temizMetin = metin.trim()
  const q = temizMetin.toLocaleLowerCase('tr-TR')

  // 3 harf veya daha fazlası yazıldığında önerileri filtrele
  const oneriler = temizMetin.length >= 3
    ? mevcutKategoriler.filter((kat) => {
        const kKucuk = kat.toLocaleLowerCase('tr-TR')
        const zatenSecili = seciliKategoriler.some(
          (s) => s.toLocaleLowerCase('tr-TR') === kKucuk
        )
        return !zatenSecili && kKucuk.includes(q)
      })
    : []

  // Birebir eşleşme var mı?
  const tamEslestiMi = mevcutKategoriler.some(
    (k) => k.toLocaleLowerCase('tr-TR') === q
  )
  const zatenSeciliMi = seciliKategoriler.some(
    (s) => s.toLocaleLowerCase('tr-TR') === q
  )

  const kategoriEkle = (yeniKat) => {
    const duzgun = (yeniKat || '').trim()
    if (!duzgun) return
    const zatenVar = seciliKategoriler.some(
      (s) => s.toLocaleLowerCase('tr-TR') === duzgun.toLocaleLowerCase('tr-TR')
    )
    if (!zatenVar) {
      onDegisti([...seciliKategoriler, duzgun])
    }
    setMetin('')
    setAcik(false)
  }

  const kategoriKaldir = (silinecekKat) => {
    onDegisti(seciliKategoriler.filter((k) => k !== silinecekKat))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (temizMetin.length >= 2) {
        // Eğer ilk öneri birebir veya çok yakınsa onu al, değilse girilen metni ekle
        if (oneriler.length > 0 && oneriler[0].toLocaleLowerCase('tr-TR') === q) {
          kategoriEkle(oneriler[0])
        } else {
          kategoriEkle(temizMetin)
        }
      }
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {/* Seçilen Kategoriler (Etiket Rozetleri) */}
      {seciliKategoriler.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {seciliKategoriler.map((kat, idx) => (
            <span
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#F0FDFA',
                color: '#0F766E',
                border: '1px solid #99F6E4',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12.5,
                fontWeight: 700,
                boxShadow: '0 1px 2px rgba(15, 118, 110, 0.06)'
              }}
            >
              <span>🏷️</span>
              <span>{kat}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => kategoriKaldir(kat)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#0F766E',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontWeight: 800,
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.8
                  }}
                  title={`${kat} kategorisini kaldır`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Arama & Ekleme Girdisi */}
      {!disabled && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 12, color: '#94A3B8', fontSize: 13, pointerEvents: 'none' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={metin}
            onChange={(e) => {
              setMetin(e.target.value)
              setAcik(true)
            }}
            onFocus={() => {
              if (temizMetin.length >= 3) setAcik(true)
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              outline: 'none',
              background: '#FFFFFF',
              color: '#1E293B',
              boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {/* Açılır Öneri Listesi (3 harf veya fazlasında açılır) */}
      {!disabled && acik && temizMetin.length >= 3 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderRadius: 10,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            border: '1px solid #E2E8F0',
            zIndex: 100,
            maxHeight: 220,
            overflowY: 'auto',
            marginTop: 4,
            padding: 4
          }}
        >
          {oneriler.length > 0 ? (
            oneriler.map((kat, idx) => (
              <div
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault()
                  kategoriEkle(kat)
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#1E293B',
                  transition: 'background 0.1s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDFA')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span>🏷️ {kat}</span>
                <span style={{ fontSize: 11, color: '#0F766E', fontWeight: 700 }}>+ Seç</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#94A3B8' }}>
              Eşleşen mevcut kategori yok
            </div>
          )}

          {/* Yeni kategori olarak ekleme seçeneği */}
          {!tamEslestiMi && !zatenSeciliMi && temizMetin.length >= 2 && (
            <div
              onMouseDown={(e) => {
                e.preventDefault()
                kategoriEkle(temizMetin)
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
                color: '#0F766E',
                fontWeight: 800,
                background: '#F0FDFA',
                borderTop: '1px solid #CCFBF1',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>➕</span>
              <span>"{temizMetin}" yeni kategori olarak ekle</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
