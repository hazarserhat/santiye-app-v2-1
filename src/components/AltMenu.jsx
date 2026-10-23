import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSite } from '../context/SiteContext'

const OGELER_ONCESI = [
  { yol: '/gorevler', etiket: 'Görevler', simge: '✓' }
]

const OGELER_SONRASI = [
  { yol: '/cari-kartlar', etiket: 'Rehber', simge: '👤', yolIsmi: 'cari' },
  { yol: '/puantaj', etiket: 'Puantaj', simge: '📅' },
  { yol: '/gunluk-rapor', etiket: 'Rapor', simge: '📝' },
  { yol: '/saha-dosyalari', etiket: 'Drive', simge: '📁' },
  // { yol: '/animsaticilar', etiket: 'Uyarı', simge: '🔔' }, // Geçici olarak kapatıldı
  { yol: '/notlarim', etiket: 'Notlarım', simge: '📌' },
]

export default function AltMenu() {
  const { profile } = useAuth()
  const { sistemAyarlari } = useSite()
  const location = useLocation()
  const navigate = useNavigate()
  const [finansAcik, setFinansAcik] = useState(false)

  // Sayfa değiştiğinde açılır menüyü kapat
  useEffect(() => {
    setFinansAcik(false)
  }, [location.pathname])

  // ESC tuşu ile kapat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFinansAcik(false)
    }
    if (finansAcik) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [finansAcik])

  // Finans alt öğeleri ve yetki kontrolü
  const finansAltOgeleri = [
    { 
      yol: '/masraflar', 
      etiket: 'Giderler', 
      aciklama: 'Harcama ve masraf kayıtları', 
      simge: '₺', 
      renk: '#dc2626',
      bg: '#fee2e2',
      izinli: !(profile?.rol === 'santiye_sefi' && sistemAyarlari?.sef_gider_erisimi !== 'true')
    },
    { 
      yol: '/gelirler', 
      etiket: 'Gelirler', 
      aciklama: 'Tahsilat ve hak edişler', 
      simge: '💰', 
      renk: '#16a34a',
      bg: '#dcfce7',
      izinli: profile?.rol !== 'santiye_sefi'
    },
    { 
      yol: '/kasalar', 
      etiket: 'Virman', 
      aciklama: 'Kasa transferi ve mütabakat', 
      simge: '🏦', 
      renk: '#2563eb',
      bg: '#dbeafe',
      izinli: profile?.rol !== 'santiye_sefi'
    },
  ].filter(item => item.izinli)

  const isFinansAktif = finansAltOgeleri.some(item => location.pathname === item.yol)

  let sonrasiOgeler = OGELER_SONRASI
  if (profile?.sistem_yoneticisi) {
    sonrasiOgeler = [...sonrasiOgeler, { yol: '/yonetim', etiket: 'Yönetim', simge: '⚙️' }]
  }

  const gitVeKapat = (yol) => {
    setFinansAcik(false)
    navigate(yol)
  }

  return (
    <>
      {/* Finans Açılır Menü Backdrop (Dışına tıklandığında kapatır) */}
      {finansAcik && (
        <div 
          className="finans-popup-arka-plan" 
          onClick={() => setFinansAcik(false)} 
        />
      )}

      {/* Finans Açılır Menü (Yukarı Doğru Genişleme) */}
      {finansAcik && (
        <div className="finans-popup-kapsayici">
          <div className="finans-popup-baslik">
            <span className="finans-popup-baslik-metin">
              <span>💳</span> Finans İşlemleri
            </span>
            <button 
              type="button" 
              className="finans-popup-kapat" 
              onClick={() => setFinansAcik(false)}
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          <div className="finans-popup-liste">
            {finansAltOgeleri.map((item) => {
              const aktifMi = location.pathname === item.yol
              return (
                <div
                  key={item.yol}
                  className={`finans-popup-kart ${aktifMi ? 'aktif' : ''}`}
                  onClick={() => gitVeKapat(item.yol)}
                  onKeyDown={(e) => { if (e.key === 'Enter') gitVeKapat(item.yol) }}
                  role="button"
                  tabIndex={0}
                >
                  <div 
                    className="finans-popup-ikon-kutusu" 
                    style={{ background: item.bg, color: item.renk }}
                  >
                    {item.simge}
                  </div>
                  <div className="finans-popup-metinler">
                    <div className="finans-popup-etiket">
                      {item.etiket}
                      {aktifMi && <span className="finans-popup-aktif-nokta" title="Şu an bu sayfadasınız" />}
                    </div>
                    <span className="finans-popup-aciklama">{item.aciklama}</span>
                  </div>
                  <span className="finans-popup-ok">›</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <nav className="alt-menu">
        {/* 1. Görevler */}
        {OGELER_ONCESI.map((oge) => (
          <NavLink 
            key={oge.yol} 
            to={oge.yol} 
            className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}
          >
            <span className="alt-menu-simge">{oge.simge}</span>
            <span className="alt-menu-etiket">{oge.etiket}</span>
          </NavLink>
        ))}

        {/* 2. Finans Sekmesi (Yukarı doğru genişleyen buton) */}
        {finansAltOgeleri.length > 0 && (
          <button
            type="button"
            onClick={() => setFinansAcik(prev => !prev)}
            className={`alt-menu-oge ${isFinansAktif ? 'aktif' : ''}`}
            title="Finans (Giderler, Gelirler, Virman)"
          >
            <span className="alt-menu-simge">💳</span>
            <span className="alt-menu-etiket" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              Finans
              <span style={{ 
                fontSize: 7, 
                opacity: 0.6,
                transition: 'transform 0.2s', 
                transform: finansAcik ? 'rotate(180deg)' : 'none' 
              }}>▲</span>
            </span>
          </button>
        )}

        {/* 3. Diğer Sayfalar (Rehber, Puantaj, Rapor, Drive, Notlarım, Yönetim) */}
        {sonrasiOgeler.map((oge) => (
          <NavLink 
            key={oge.yol} 
            to={oge.yol} 
            className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}
          >
            <span className="alt-menu-simge">{oge.simge}</span>
            <span className="alt-menu-etiket">{oge.etiket}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}