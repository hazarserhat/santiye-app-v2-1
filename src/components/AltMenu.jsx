import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const OGELER = [
  { yol: '/gorevler', etiket: 'Görevler', simge: '✓' },
  { yol: '/masraflar', etiket: 'Giderler', simge: '₺' },
  { yol: '/gelirler', etiket: 'Gelirler', simge: '💰' },
  { yol: '/cari-kartlar', etiket: 'Rehber', simge: '👤' },
  { yol: '/puantaj', etiket: 'Puantaj', simge: '📅' },
  { yol: '/gunluk-rapor', etiket: 'Rapor', simge: '📝' },
  { yol: '/animsaticilar', etiket: 'Uyarı', simge: '🔔' },
  { yol: '/notlarim', etiket: 'Notlarım', simge: '📌' },
]

export default function AltMenu() {
  const { profile } = useAuth()
  const ogeler = profile?.sistem_yoneticisi
    ? [...OGELER, { yol: '/yonetim', etiket: 'Yönetim', simge: '⚙️' }]
    : OGELER

  return (
    <nav className="alt-menu">
      {ogeler.map((oge) => (
        <NavLink key={oge.yol} to={oge.yol} className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}>
          <span className="alt-menu-simge">{oge.simge}</span>
          <span className="alt-menu-etiket">{oge.etiket}</span>
        </NavLink>
      ))}
    </nav>
  )
}
