import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SiteProvider, useSite } from './context/SiteContext'
import AltMenu from './components/AltMenu'
import Login from './pages/Login'

const Gorevler = lazy(() => import('./pages/Gorevler'))
const Masraflar = lazy(() => import('./pages/Masraflar'))
const Gelirler = lazy(() => import('./pages/Gelirler'))
const CariKartlar = lazy(() => import('./pages/CariKartlar'))
const Puantaj = lazy(() => import('./pages/Puantaj'))
const GunlukRapor = lazy(() => import('./pages/GunlukRapor'))
const Notlar = lazy(() => import('./pages/Notlar'))
const KasaVirmanlar = lazy(() => import('./pages/KasaVirmanlar'))
const Yonetim = lazy(() => import('./pages/Yonetim'))
const YonetimSantiyeler = lazy(() => import('./pages/yonetim/YonetimSantiyeler'))
const CekTakip = lazy(() => import('./pages/yonetim/CekTakip'))
const Teminatlar = lazy(() => import('./pages/yonetim/Teminatlar'))
const YapiKimlikNo = lazy(() => import('./pages/yonetim/YapiKimlikNo'))
const ProjeDetaylari = lazy(() => import('./pages/yonetim/ProjeDetaylari'))
const FaturaBilgileri = lazy(() => import('./pages/yonetim/FaturaBilgileri'))
const YapiDenetim = lazy(() => import('./pages/yonetim/YapiDenetim'))
const SantiyeAdresleri = lazy(() => import('./pages/yonetim/SantiyeAdresleri'))
const YarisiBizden = lazy(() => import('./pages/yonetim/YarisiBizden'))
const ProjeGelirleri = lazy(() => import('./pages/yonetim/ProjeGelirleri'))
const KrediKartlari = lazy(() => import('./pages/KrediKartlari'))
const SahaDosyalari = lazy(() => import('./pages/SahaDosyalari'))
const ProjeDosyalari = lazy(() => import('./pages/ProjeDosyalari'))
const AnlasmaPlanlama = lazy(() => import('./pages/yonetim/AnlasmaPlanlama'))
const MalikKordinasyon = lazy(() => import('./pages/yonetim/MalikKordinasyon'))
const MakineHafriyat = lazy(() => import('./pages/MakineHafriyat'))
const BetonDokumu = lazy(() => import('./pages/BetonDokumu'))
const SevkiyatKabul = lazy(() => import('./pages/SevkiyatKabul'))
const SevkiyatPlanlama = lazy(() => import('./pages/SevkiyatPlanlama'))
const SahaCepCetveli = lazy(() => import('./pages/SahaCepCetveli'))
const Operasyon = lazy(() => import('./pages/Operasyon'))

function YonetimKoruma({ children }) {
  const { profile } = useAuth()
  if (!profile?.sistem_yoneticisi) {
    return <div className="sayfa"><p className="bos-mesaj">Bu sayfaya erişim yetkiniz yok.</p></div>
  }
  return children
}

function SerhatHazarKoruma({ children }) {
  const { profile } = useAuth()
  const isSerhatHazar = Boolean(
    profile?.ad_soyad?.toLocaleLowerCase('tr-TR').includes('serhat') ||
    profile?.email?.toLowerCase().includes('serhat')
  )
  if (!isSerhatHazar) {
    return <div className="sayfa"><p className="bos-mesaj">Bu sayfaya yalnızca Serhat Hazar erişebilir.</p></div>
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

function GiderKoruma({ children }) {
  const { profile } = useAuth()
  const { sistemAyarlari } = useSite()
  
  if (profile?.rol === 'santiye_sefi' && sistemAyarlari?.sef_gider_erisimi !== 'true') {
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
          <Suspense fallback={<p className="bos-mesaj">Yükleniyor...</p>}>
            <Routes>
              <Route path="/" element={<Navigate to="/gorevler" replace />} />
              <Route path="/gorevler" element={<Gorevler />} />
              <Route path="/masraflar" element={<GiderKoruma><Masraflar /></GiderKoruma>} />
              <Route path="/gelirler" element={<GelirKoruma><Gelirler /></GelirKoruma>} />
              <Route path="/kasalar" element={<GelirKoruma><KasaVirmanlar /></GelirKoruma>} />
              <Route path="/cari-kartlar" element={<CariKartlar />} />
              <Route path="/puantaj" element={<Puantaj />} />
              <Route path="/gunluk-rapor" element={<GunlukRapor />} />
              <Route path="/makine-hafriyat" element={<MakineHafriyat />} />
              <Route path="/beton-dokumu" element={<BetonDokumu />} />
              <Route path="/sevkiyat-kabul" element={<SevkiyatKabul />} />
              <Route path="/sevkiyat-planlama" element={<SevkiyatPlanlama />} />
              <Route path="/saha-cep-cetveli" element={<SahaCepCetveli />} />
              <Route path="/operasyon" element={<Operasyon />} />
              <Route path="/saha-operasyonlari" element={<Operasyon />} />
              <Route path="/santiye-konumlari" element={<Operasyon />} />
              <Route path="/animsaticilar" element={<Navigate to="/gorevler" replace />} />
              <Route path="/notlarim" element={<Notlar />} />

              <Route path="/yonetim" element={<YonetimKoruma><Yonetim /></YonetimKoruma>} />
              <Route path="/yonetim/santiyeler" element={<YonetimKoruma><YonetimSantiyeler /></YonetimKoruma>} />
              <Route path="/yonetim/cek-takip" element={<SerhatHazarKoruma><CekTakip /></SerhatHazarKoruma>} />
              <Route path="/yonetim/teminatlar/banka" element={<YonetimKoruma><Teminatlar tur="banka_teminat_mektubu" /></YonetimKoruma>} />
              <Route path="/yonetim/teminatlar/belediye" element={<YonetimKoruma><Teminatlar tur="belediye_teminati" /></YonetimKoruma>} />
              <Route path="/yonetim/teminatlar/abonelik" element={<YonetimKoruma><Teminatlar tur="abonelik_bedeli" /></YonetimKoruma>} />
              <Route path="/yonetim/yapi-kimlik" element={<YonetimKoruma><YapiKimlikNo /></YonetimKoruma>} />
              <Route path="/yonetim/proje-detaylari" element={<YonetimKoruma><ProjeDetaylari /></YonetimKoruma>} />
              <Route path="/yonetim/fatura-bilgileri" element={<YonetimKoruma><FaturaBilgileri /></YonetimKoruma>} />
              <Route path="/yonetim/yapi-denetim" element={<YonetimKoruma><YapiDenetim /></YonetimKoruma>} />
              <Route path="/yonetim/santiye-adresleri" element={<YonetimKoruma><SantiyeAdresleri /></YonetimKoruma>} />
              <Route path="/yonetim/yarisi-bizden" element={<SerhatHazarKoruma><YarisiBizden /></SerhatHazarKoruma>} />
              <Route path="/yonetim/proje-gelirleri" element={<SerhatHazarKoruma><ProjeGelirleri /></SerhatHazarKoruma>} />
              <Route path="/yonetim/kredi-kartlari" element={<YonetimKoruma><KrediKartlari /></YonetimKoruma>} />
              <Route path="/yonetim/proje-dosyalari" element={<YonetimKoruma><ProjeDosyalari /></YonetimKoruma>} />
              <Route path="/yonetim/anlasma-planlama" element={<SerhatHazarKoruma><AnlasmaPlanlama /></SerhatHazarKoruma>} />
              <Route path="/yonetim/malik-koordinasyon" element={<YonetimKoruma><MalikKordinasyon /></YonetimKoruma>} />
              
              <Route path="/saha-dosyalari" element={<SahaDosyalari />} />
            </Routes>
          </Suspense>
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
