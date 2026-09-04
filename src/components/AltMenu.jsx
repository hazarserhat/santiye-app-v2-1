import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const OGELER = [
  { yol: '/gorevler', etiket: 'Görevler', simge: '✓' },
  { yol: '/masraflar', etiket: 'Giderler', simge: '₺' },
  { yol: '/gelirler', etiket: 'Gelirler', simge: '💰', ozelRol: true },
  { yol: '/cari-kartlar', etiket: 'Rehber', simge: '👤', yolIsmi: 'cari' },
  { yol: '/puantaj', etiket: 'Puantaj', simge: '📅' },
  { yol: '/gunluk-rapor', etiket: 'Rapor', simge: '📝' },
  { yol: '/saha-dosyalari', etiket: 'Drive', simge: '📁' },
  { yol: '/animsaticilar', etiket: 'Uyarı', simge: '🔔' },
  { yol: '/notlarim', etiket: 'Notlarım', simge: '📌' },
]

export default function AltMenu() {
  const { profile } = useAuth()
  
  let gorunurOgeler = profile?.rol === 'santiye_sefi' 
    ? OGELER.filter(o => !o.ozelRol) 
    : OGELER

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