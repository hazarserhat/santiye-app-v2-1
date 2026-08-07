import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SiteProvider } from './context/SiteContext'
import SiteSwitcher from './components/SiteSwitcher'
import AltMenu from './components/AltMenu'
import Login from './pages/Login'
import Gorevler from './pages/Gorevler'
import Masraflar from './pages/Masraflar'
import CariKartlar from './pages/CariKartlar'
import Puantaj from './pages/Puantaj'
import YapimAsamasinda from './pages/YapimAsamasinda'

const SANTIYE_SECICI_GIZLI_SAYFALAR = ['/gorevler', '/masraflar', '/cari-kartlar']

function IcerikAlani() {
  const { session, yukleniyor, cikisYap } = useAuth()
  const konum = useLocation()
  const seciciGizli = SANTIYE_SECICI_GIZLI_SAYFALAR.includes(konum.pathname)

  if (yukleniyor) return <p className="bos-mesaj">Yükleniyor...</p>
  if (!session) return <Login />

  return (
    <SiteProvider>
      <div className="uygulama-govde">
        <header className="ust-bar">
          {seciciGizli ? <span /> : <SiteSwitcher />}
          <button className="cikis-buton" onClick={cikisYap}>Çıkış</button>
        </header>

        <main className="icerik">
          <Routes>
            <Route path="/" element={<Navigate to="/gorevler" replace />} />
            <Route path="/gorevler" element={<Gorevler />} />
            <Route path="/masraflar" element={<Masraflar />} />
            <Route path="/cari-kartlar" element={<CariKartlar />} />
            <Route path="/puantaj" element={<Puantaj />} />
            <Route path="/gunluk-rapor" element={<YapimAsamasinda baslik="Günlük Rapor" />} />
            <Route path="/animsaticilar" element={<YapimAsamasinda baslik="Anımsatıcı / Uyarı" />} />
            <Route path="/notlarim" element={<YapimAsamasinda baslik="Notlarım" />} />
          </Routes>
        </main>

        <AltMenu />
      </div>
    </SiteProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <IcerikAlani />
      </AuthProvider>
    </BrowserRouter>
  )
}
