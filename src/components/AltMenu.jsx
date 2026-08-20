import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const OGELER = [
  { yol: '/gorevler', etiket: 'Görevler', simge: '✓' },
  { yol: '/masraflar', etiket: 'Giderler', simge: '₺' },
  { yol: '/gelirler', etiket: 'Gelirler', simge: '💰', ozelRol: true }, // ozelRol: Gelirler için işaret
  { yol: '/rehber', etiket: 'Rehber', simge: '👤' }, // DÜZELTİLDİ: Yol /rehber yapıldı
  { yol: '/cari-kartlar', etiket: 'Cari', simge: '📑' }, // DÜZELTİLDİ: Etiket 'Cari' yapıldı
  { yol: '/puantaj', etiket: 'Puantaj', simge: '📅' },
  { yol: '/gunluk-rapor', etiket: 'Rapor', simge: '📝' },
  { yol: '/animsaticilar', etiket: 'Uyarı', simge: '🔔' },
  { yol: '/notlarim', etiket: 'Notlarım', simge: '📌' },
]

export default function AltMenu() {
  const { profile } = useAuth()
  
  // 1. Şantiye Şefi ise 'Gelirler' öğesini listeden çıkar
  let gorunurOgeler = profile?.rol === 'santiye_sefi' 
    ? OGELER.filter(o => !o.ozelRol) 
    : OGELER

  // 2. Sistem yöneticisi ise Yönetim'i ekle
  if (profile?.sistem_yoneticisi) {
    gorunurOgeler = [...gorunurOgeler, { yol: '/yonetim', etiket: 'Yönetim', simge: '⚙️' }]
  }

  return (
    <nav className="alt-menu">
      {gorunurOgeler.map((oge) => (
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
  )
}