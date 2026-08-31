import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SiteProvider } from './context/SiteContext'
import AltMenu from './components/AltMenu'
import Login from './pages/Login'
import Gorevler from './pages/Gorevler'
import Masraflar from './pages/Masraflar'
import Gelirler from './pages/Gelirler'
import CariKartlar from './pages/CariKartlar'
import Puantaj from './pages/Puantaj'
import GunlukRapor from './pages/GunlukRapor'
import Animsaticilar from './pages/Animsaticilar'
import Notlar from './pages/Notlar'
import Yonetim from './pages/Yonetim'
import YonetimSantiyeler from './pages/yonetim/YonetimSantiyeler'
import CekTakip from './pages/yonetim/CekTakip'
import Teminatlar from './pages/yonetim/Teminatlar'
import YapiKimlikNo from './pages/yonetim/YapiKimlikNo'
import ProjeDetaylari from './pages/yonetim/ProjeDetaylari'
import FaturaBilgileri from './pages/yonetim/FaturaBilgileri'
import YapiDenetim from './pages/yonetim/YapiDenetim'
import SantiyeAdresleri from './pages/yonetim/SantiyeAdresleri'
import YarisiBizden from './pages/yonetim/YarisiBizden'
import ProjeGelirleri from './pages/yonetim/ProjeGelirleri'
import KrediKartlari from './pages/KrediKartlari'

function YonetimKoruma({ children }) {
  const { profile } = useAuth()
  if (!profile?.sistem_yoneticisi) {
    return <div className="sayfa"><p className="bos-mesaj">Bu sayfaya erişim yetkiniz yok.</p></div>
  }
  return children
}

function GelirKoruma({ children }) {
  const { profile } = useAuth()
  if (profile?.rol === 'santiye_sefi') {
    return <Navigate to="/gorevler" replace />
  }
  return children
}

function IcerikAlani() {
  const { session, profile, yukleniyor, cikisYap } = useAuth()

  if (yukleniyor) return <p className="bos-mesaj">Yükleniyor...</p>
  if (!session) return <Login />

  return (
    <SiteProvider>
      <div className="uygulama-govde">
        <header className="ust-bar">
          <div className="ust-bar-sol">
            <span className="kullanici-adi">{profile?.ad_soyad || '...'}</span>
          </div>
          <button className="cikis-buton" onClick={cikisYap}>Çıkış</button>
        </header>

        <main className="icerik">
          <Routes>
            <Route path="/" element={<Navigate to="/gorevler" replace />} />
            <Route path="/gorevler" element={<Gorevler />} />
            <Route path="/masraflar" element={<Masraflar />} />
            <Route path="/gelirler" element={<GelirKoruma><Gelirler /></GelirKoruma>} />
            <Route path="/cari-kartlar" element={<CariKartlar />} />
            <Route path="/puantaj" element={<Puantaj />} />
            <Route path="/gunluk-rapor" element={<GunlukRapor />} />
            <Route path="/animsaticilar" element={<Animsaticilar />} />
            <Route path="/notlarim" element={<Notlar />} />

            <Route path="/yonetim" element={<YonetimKoruma><Yonetim /></YonetimKoruma>} />
            <Route path="/yonetim/santiyeler" element={<YonetimKoruma><YonetimSantiyeler /></YonetimKoruma>} />
            <Route path="/yonetim/cek-takip" element={<YonetimKoruma><CekTakip /></YonetimKoruma>} />
            <Route path="/yonetim/teminatlar/banka" element={<YonetimKoruma><Teminatlar tur="banka_teminat_mektubu" /></YonetimKoruma>} />
            <Route path="/yonetim/teminatlar/belediye" element={<YonetimKoruma><Teminatlar tur="belediye_teminati" /></YonetimKoruma>} />
            <Route path="/yonetim/teminatlar/abonelik" element={<YonetimKoruma><Teminatlar tur="abonelik_bedeli" /></YonetimKoruma>} />
            <Route path="/yonetim/yapi-kimlik" element={<YonetimKoruma><YapiKimlikNo /></YonetimKoruma>} />
            <Route path="/yonetim/proje-detaylari" element={<YonetimKoruma><ProjeDetaylari /></YonetimKoruma>} />
            <Route path="/yonetim/fatura-bilgileri" element={<YonetimKoruma><FaturaBilgileri /></YonetimKoruma>} />
            <Route path="/yonetim/yapi-denetim" element={<YonetimKoruma><YapiDenetim /></YonetimKoruma>} />
            <Route path="/yonetim/santiye-adresleri" element={<YonetimKoruma><SantiyeAdresleri /></YonetimKoruma>} />
            <Route path="/yonetim/yarisi-bizden" element={<YonetimKoruma><YarisiBizden /></YonetimKoruma>} />
            <Route path="/yonetim/proje-gelirleri" element={<YonetimKoruma><ProjeGelirleri /></YonetimKoruma>} />
            <Route path="/yonetim/kredi-kartlari" element={<YonetimKoruma><KrediKartlari /></YonetimKoruma>} />
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