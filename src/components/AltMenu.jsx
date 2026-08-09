import { NavLink } from 'react-router-dom'

const OGELER = [
  { yol: '/gorevler', etiket: 'Görevler', simge: '✓' },
  { yol: '/masraflar', etiket: 'Muhasebe', simge: '₺' },
  { yol: '/cari-kartlar', etiket: 'Cariler', simge: '👤' },
  { yol: '/puantaj', etiket: 'Puantaj', simge: '📅' },
  { yol: '/gunluk-rapor', etiket: 'Rapor', simge: '📝' },
  { yol: '/animsaticilar', etiket: 'Uyarı', simge: '🔔' },
  { yol: '/notlarim', etiket: 'Notlarım', simge: '📌' },
]

export default function AltMenu() {
  return (
    <nav className="alt-menu">
      {OGELER.map((oge) => (
        <NavLink key={oge.yol} to={oge.yol} className={({ isActive }) => `alt-menu-oge ${isActive ? 'aktif' : ''}`}>
          <span className="alt-menu-simge">{oge.simge}</span>
          <span className="alt-menu-etiket">{oge.etiket}</span>
        </NavLink>
      ))}
    </nav>
  )
}
