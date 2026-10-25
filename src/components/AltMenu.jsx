import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSite } from '../context/SiteContext'

export default function AltMenu() {
  const { profile } = useAuth()
  const { sistemAyarlari } = useSite()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Aktif açılır menü: 'finans' | 'imalat' | 'operasyon' | 'depolama' | null
  const [acikMenu, setAcikMenu] = useState(null)

  // Sayfa değiştiğinde açılır menüyü kapat
  useEffect(() => {
    setAcikMenu(null)
  }, [location.pathname])

  // ESC tuşu ile kapat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setAcikMenu(null)
    }
    if (acikMenu) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [acikMenu])

  // 1. Finans alt öğeleri ve yetki kontrolü
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

  // 2. İmalat Kayıtları alt öğeleri (Puantaj, Günlük Rapor, Hafriyat & Makineler)
  const imalatAltOgeleri = [
    { 
      yol: '/puantaj', 
      etiket: 'Puantaj', 
      aciklama: 'Personel ve işçi devam takibi', 
      simge: '📅', 
      renk: '#7c3aed',
      bg: '#ede9fe'
    },
    { 
      yol: '/gunluk-rapor', 
      etiket: 'Günlük Rapor', 
      aciklama: 'Hava durumu, imalat ve saha raporu', 
      simge: '📝', 
      renk: '#0284c7',
      bg: '#e0f2fe'
    },
    { 
      yol: '/makine-hafriyat', 
      etiket: 'Hafriyat & Makineler', 
      aciklama: 'İş makineleri saati ve kamyon seferleri', 
      simge: '🚜', 
      renk: '#ea580c',
      bg: '#ffedd5'
    },
  ]

  const isYoneticiSerhat = Boolean(
    profile?.sistem_yoneticisi ||
    profile?.ad_soyad?.toLowerCase().includes('serhat') ||
    profile?.email?.toLowerCase().includes('serhat') ||
    profile?.rol === 'yonetici' ||
    profile?.rol === 'koordinator' ||
    profile?.rol !== 'santiye_sefi'
  )

  // 3. Saha Operasyonları alt öğeleri (Şantiye Haritası, Beton Dökümü, Sevkiyat Planlama, Sevkiyat Kabul, Saha Cep Cetveli)
  const operasyonAltOgeleri = [
    { 
      yol: '/operasyon', 
      etiket: 'Şantiye Konumları', 
      aciklama: 'Google Haritalar şantiye konumları ve yol tarifi', 
      simge: '📍', 
      renk: '#0284c7',
      bg: '#e0f2fe',
      izinli: true
    },
    { 
      yol: '/beton-dokumu', 
      etiket: 'Beton & Mikser', 
      aciklama: 'Beton dökümü ve mikser çetelesi', 
      simge: '🧪', 
      renk: '#2563eb',
      bg: '#dbeafe',
      izinli: true
    },
    { 
      yol: '/sevkiyat-planlama', 
      etiket: 'Sevkiyat Planlama', 
      aciklama: 'Sahaya gelecek malzeme & teslimat takvimi', 
      simge: '🚚', 
      renk: '#1D9596',
      bg: '#e6f4f1',
      izinli: isYoneticiSerhat
    },
    { 
      yol: '/sevkiyat-kabul', 
      etiket: 'Sevkiyat Kabul', 
      aciklama: 'Gelen malzeme ve irsaliye/fatura kabulü', 
      simge: '📦', 
      renk: '#059669',
      bg: '#d1fae5',
      izinli: true
    },
    { 
      yol: '/saha-cep-cetveli', 
      etiket: 'Saha Cep Cetveli', 
      aciklama: 'Hızlı pratik inşaat hesaplayıcıları', 
      simge: '🧮', 
      renk: '#d97706',
      bg: '#fef3c7',
      izinli: true
    },
  ].filter(item => item.izinli)

  // 4. Depolama alt öğeleri (Drive & Notlarım)
  const depolamaAltOgeleri = [
    { 
      yol: '/saha-dosyalari', 
      etiket: 'Drive', 
      aciklama: 'Saha arşivi ve Google Drive belgeleri', 
      simge: '📁', 
      renk: '#0284c7',
      bg: '#e0f2fe'
    },
    { 
      yol: '/notlarim', 
      etiket: 'Notlarım', 
      aciklama: 'Kişisel notlar ve taslaklar', 
      simge: '📌', 
      renk: '#d97706',
      bg: '#fef3c7'
    },
  ]

  const isFinansAktif = finansAltOgeleri.some(item => location.pathname === item.yol)
  const isImalatAktif = imalatAltOgeleri.some(item => location.pathname === item.yol)
  const isOperasyonAktif = operasyonAltOgeleri.some(item => location.pathname === item.yol)
  const isDepolamaAktif = depolamaAltOgeleri.some(item => location.pathname === item.yol)

  const toggleMenu = (menuKey) => {
    setAcikMenu(prev => prev === menuKey ? null : menuKey)
  }

  const gitVeKapat = (yol) => {
    setAcikMenu(null)
    navigate(yol)
  }

  const popupVerileri = {
    finans: {
      baslik: 'Finans İşlemleri',
      ikon: '💳',
      ogeler: finansAltOgeleri,
    },
    imalat: {
      baslik: 'İmalat Kayıtları',
      ikon: '🔨',
      ogeler: imalatAltOgeleri,
    },
    operasyon: {
      baslik: 'Saha Operasyonları',
      ikon: '⚡',
      ogeler: operasyonAltOgeleri,
    },
    depolama: {
      baslik: 'Depolama & Belgeler',
      ikon: '🗄️',
      ogeler: depolamaAltOgeleri,
    },
  }

  const aktifPopup = acikMenu ? popupVerileri[acikMenu] : null

  return (
    <>
      {/* Menü Açılır Arka Planı (Dışına tıklandığında kapatır) */}
      {acikMenu && (
        <div 
          className="altmenu-popup-arka-plan" 
          onClick={() => setAcikMenu(null)} 
        />
      )}

      {/* Dinamik Açılır Menü (Finans, İmalat, Operasyon veya Depolama) */}
      {aktifPopup && (
        <div className="altmenu-popup-kapsayici">
          <div className="altmenu-popup-baslik">
            <span className="altmenu-popup-baslik-metin">
              <span>{aktifPopup.ikon}</span> {aktifPopup.baslik}
            </span>
            <button 
              type="button" 
              className="altmenu-popup-kapat" 
              onClick={() => setAcikMenu(null)}
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>

          <div className="altmenu-popup-liste">
            {aktifPopup.ogeler.map((item) => {
              const aktifMi = location.pathname === item.yol
              return (
                <div
                  key={item.yol}
                  className={`altmenu-popup-kart ${aktifMi ? 'aktif' : ''}`}
                  onClick={() => gitVeKapat(item.yol)}
                  onKeyDown={(e) => { if (e.key === 'Enter') gitVeKapat(item.yol) }}
                  role="button"
                  tabIndex={0}
                >
                  <div 
                    className="altmenu-popup-ikon-kutusu" 
                    style={{ background: item.bg, color: item.renk }}
                  >
                    {item.simge}
                  </div>
                  <div className="altmenu-popup-metinler">
                    <div className="altmenu-popup-etiket">
                      {item.etiket}
                      {aktifMi && <span className="altmenu-popup-aktif-nokta" title="Şu an bu sayfadasınız" />}
                    </div>
                    <span className="altmenu-popup-aciklama">{item.aciklama}</span>
                  </div>
                  <span className="altmenu-popup-ok">›</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <nav className="alt-menu">
        {/* 1. Görevler */}
        <NavLink 
          to="/gorevler" 
          className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}
        >
          <span className="alt-menu-simge">✓</span>
          <span className="alt-menu-etiket">Görevler</span>
        </NavLink>

        {/* 2. Rehber (Cari Kartlar) */}
        <NavLink 
          to="/cari-kartlar" 
          className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}
        >
          <span className="alt-menu-simge">👤</span>
          <span className="alt-menu-etiket">Rehber</span>
        </NavLink>

        {/* 3. Finans Sekmesi (Yukarı doğru genişleyen buton) */}
        {finansAltOgeleri.length > 0 && (
          <button
            type="button"
            onClick={() => toggleMenu('finans')}
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
                transform: acikMenu === 'finans' ? 'rotate(180deg)' : 'none' 
              }}>▲</span>
            </span>
          </button>
        )}

        {/* 4. İmalat Sekmesi (Puantaj, Günlük Rapor, Hafriyat & Makineler) */}
        <button
          type="button"
          onClick={() => toggleMenu('imalat')}
          className={`alt-menu-oge ${isImalatAktif ? 'aktif' : ''}`}
          title="İmalat Kayıtları (Puantaj, Rapor, Makineler)"
        >
          <span className="alt-menu-simge">🔨</span>
          <span className="alt-menu-etiket" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            İmalat
            <span style={{ 
              fontSize: 7, 
              opacity: 0.6,
              transition: 'transform 0.2s', 
              transform: acikMenu === 'imalat' ? 'rotate(180deg)' : 'none' 
            }}>▲</span>
          </span>
        </button>

        {/* 5. Operasyon Sekmesi (Beton & Mikser, Sevkiyat Kabul, Saha Cep Cetveli) */}
        <button
          type="button"
          onClick={() => toggleMenu('operasyon')}
          className={`alt-menu-oge ${isOperasyonAktif ? 'aktif' : ''}`}
          title="Saha Operasyonları (Beton, Sevkiyat, Cep Cetveli)"
        >
          <span className="alt-menu-simge">⚡</span>
          <span className="alt-menu-etiket" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            Operasyon
            <span style={{ 
              fontSize: 7, 
              opacity: 0.6,
              transition: 'transform 0.2s', 
              transform: acikMenu === 'operasyon' ? 'rotate(180deg)' : 'none' 
            }}>▲</span>
          </span>
        </button>

        {/* 6. Depolama Sekmesi (Drive & Notlarım) */}
        <button
          type="button"
          onClick={() => toggleMenu('depolama')}
          className={`alt-menu-oge ${isDepolamaAktif ? 'aktif' : ''}`}
          title="Depolama (Drive, Notlarım)"
        >
          <span className="alt-menu-simge">🗄️</span>
          <span className="alt-menu-etiket" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            Depolama
            <span style={{ 
              fontSize: 7, 
              opacity: 0.6,
              transition: 'transform 0.2s', 
              transform: acikMenu === 'depolama' ? 'rotate(180deg)' : 'none' 
            }}>▲</span>
          </span>
        </button>

        {/* 7. Yönetim (Sadece Sistem Yöneticisi) */}
        {profile?.sistem_yoneticisi && (
          <NavLink 
            to="/yonetim" 
            className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}
          >
            <span className="alt-menu-simge">⚙️</span>
            <span className="alt-menu-etiket">Yönetim</span>
          </NavLink>
        )}
      </nav>
    </>
  )
}