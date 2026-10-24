import { useState, useMemo } from 'react'

// Standart inşaat demiri birim ağırlıkları (kg/m) - TS 708 formülü: d^2 / 162
const DEMIR_BIRIM_AGIRLIKLARI = {
  8: 0.395,
  10: 0.617,
  12: 0.888,
  14: 1.208,
  16: 1.578,
  18: 2.000,
  20: 2.466,
  22: 2.984,
  25: 3.853,
  28: 4.834,
  32: 6.313
}

// 1 m² duvar için standart malzeme sarfiyat katsayıları
const DUVAR_TIPLERI = [
  { id: 'tugla_135', ad: "13.5'luk Tuğla (13.5x19x19)", sarfiyatM2: 25, harcM3: 0.025, paletAdet: 360 },
  { id: 'tugla_85', ad: "8.5'luk Tuğla (8.5x19x19)", sarfiyatM2: 25, harcM3: 0.018, paletAdet: 450 },
  { id: 'bims_19', ad: "19'luk Bims Blok (19x39x18.5)", sarfiyatM2: 13, harcM3: 0.015, paletAdet: 90 },
  { id: 'bims_15', ad: "15'lik Bims Blok (15x39x18.5)", sarfiyatM2: 13, harcM3: 0.012, paletAdet: 110 },
  { id: 'bims_10', ad: "10'luk Bims Blok (10x39x18.5)", sarfiyatM2: 13, harcM3: 0.010, paletAdet: 150 },
  { id: 'gazbeton_15', ad: "15'lik Gazbeton (15x60x25)", sarfiyatM2: 6.7, harcM3: 0.004, paletAdet: 48 },
  { id: 'gazbeton_10', ad: "10'luk Gazbeton (10x60x25)", sarfiyatM2: 6.7, harcM3: 0.003, paletAdet: 72 },
  { id: 'gazbeton_20', ad: "20'lik Gazbeton (20x60x25)", sarfiyatM2: 6.7, harcM3: 0.005, paletAdet: 36 }
]

const CETVEL_SEKMELERI = [
  { id: 'demir', baslik: 'Demir Tonajı', ikon: '🔩' },
  { id: 'beton', baslik: 'Beton & Kazık', ikon: '🧪' },
  { id: 'duvar', baslik: 'Tuğla & Bims', ikon: '🧱' },
  { id: 'sap', baslik: 'Zemin Şapı', ikon: '🌫️' },
  { id: 'siva', baslik: 'Sıva & Alçı', ikon: '🎨' },
  { id: 'parke', baslik: 'Parke & Süpürgelik', ikon: '🪵' },
  { id: 'seramik', baslik: 'Seramik & Kalekim', ikon: '🔲' },
  { id: 'hafriyat', baslik: 'Hafriyat Şişme', ikon: '🚜' },
  { id: 'egim', baslik: 'Kot & Eğim', ikon: '📐' }
]

export default function SahaCepCetveli() {
  const [aktifHesaplayici, setAktifHesaplayici] = useState('demir')

  // --- 1. DEMİR HESAPLAYICI STATE'LERİ ---
  const [demirCap, setDemirCap] = useState(14)
  const [demirGirisTuru, setDemirGirisTuru] = useState('boy') // 'boy' (12m) | 'metre'
  const [demirMiktar, setDemirMiktar] = useState(50)

  // --- 2. BETON HACİM & MİKSER HESAPLAYICI STATE'LERİ ---
  const [betonMod, setBetonMod] = useState('alan') // 'alan' | 'boyut' | 'kazik'
  const [betonAlan, setBetonAlan] = useState(150)
  const [betonKalinlikCm, setBetonKalinlikCm] = useState(15)
  const [betonEn, setBetonEn] = useState(10)
  const [betonBoy, setBetonBoy] = useState(15)
  const [betonYukseklik, setBetonYukseklik] = useState(0.5)
  // Kazık Alanları
  const [kazikCapCm, setKazikCapCm] = useState(80) // cm
  const [kazikBoyM, setKazikBoyM] = useState(15) // metre
  const [kazikAdet, setKazikAdet] = useState(24) // adet
  const [betonZayiat, setBetonZayiat] = useState(5) // % zayiat
  const [mikserKapasitesi, setMikserKapasitesi] = useState(9) // m³

  // --- 3. DUVAR & TUĞLA HESAPLAYICI STATE'LERİ ---
  const [duvarUzunluk, setDuvarUzunluk] = useState(20)
  const [duvarYukseklik, setDuvarYukseklik] = useState(2.8)
  const [duvarBoslukM2, setDuvarBoslukM2] = useState(4.5)
  const [seciliDuvarTipi, setSeciliDuvarTipi] = useState('tugla_135')
  const [duvarFireYuzdesi, setDuvarFireYuzdesi] = useState(7) // % fire

  // --- 4. ŞAP HESAPLAYICI STATE'LERİ ---
  const [sapTur, setSapTur] = useState('klasik_sap') // 'klasik_sap' | 'hazir_tesviye'
  const [sapAlanM2, setSapAlanM2] = useState(100)
  const [sapKalinlikCm, setSapKalinlikCm] = useState(4)

  // --- 5. SIVA & ALÇI HESAPLAYICI STATE'LERİ ---
  const [sivaTur, setSivaTur] = useState('alci_siva') // 'alci_siva' | 'kaba_siva' | 'ince_siva'
  const [sivaAlanM2, setSivaAlanM2] = useState(150)
  const [sivaKalinlikCm, setSivaKalinlikCm] = useState(1.5)

  // --- 6. PARKE & SÜPÜRGELİK STATE'LERİ ---
  const [parkeAlanM2, setParkeAlanM2] = useState(85)
  const [kapiAdedi, setKapiAdedi] = useState(5)
  const [parkeFireOrani, setParkeFireOrani] = useState(5) // %5 veya %10
  const [parkePaketM2, setParkePaketM2] = useState(1.85) // m²/paket
  const [supurgelikBoyM, setSupurgelikBoyM] = useState(2.40)

  // --- 7. SERAMİK & YAPIŞTIRICI & DERZ STATE'LERİ ---
  const [seramikAlanM2, setSeramikAlanM2] = useState(45)
  const [seramikKutuM2, setSeramikKutuM2] = useState(1.44)
  const [seramikFireOrani, setSeramikFireOrani] = useState(8)

  // --- 8. HAFRİYAT KABARMA (ŞİŞME) & KAMYON HESAPLAYICI ---
  const [kaziHacmiNet, setKaziHacmiNet] = useState(500) // m³
  const [zeminTipi, setZeminTipi] = useState('killi') // 'kumlu', 'killi', 'kaya'
  const [kamyonKapasiteM3, setKamyonKapasiteM3] = useState(16) // m³

  // --- 9. KOT & EĞİM HESAPLAYICI ---
  const [egimMesafe, setEgimMesafe] = useState(10) // metre
  const [egimYuzde, setEgimYuzde] = useState(5) // %

  // ==========================================
  // HESAPLAMA MANTIKLARI
  // ==========================================

  // 1. Demir Hesabı
  const demirHesabi = useMemo(() => {
    const birimAgirlik = DEMIR_BIRIM_AGIRLIKLARI[demirCap] || 0
    const miktar = parseFloat(demirMiktar) || 0
    const toplamMetre = demirGirisTuru === 'boy' ? miktar * 12 : miktar
    const toplamKg = toplamMetre * birimAgirlik
    const toplamTon = toplamKg / 1000
    return { toplamMetre, toplamKg, toplamTon, birimAgirlik }
  }, [demirCap, demirGirisTuru, demirMiktar])

  // 2. Beton Hesabı
  const betonHesabi = useMemo(() => {
    let netM3 = 0
    let kazikTekilM3 = 0

    if (betonMod === 'alan') {
      const alan = parseFloat(betonAlan) || 0
      const kalinlikM = (parseFloat(betonKalinlikCm) || 0) / 100
      netM3 = alan * kalinlikM
    } else if (betonMod === 'boyut') {
      const en = parseFloat(betonEn) || 0
      const boy = parseFloat(betonBoy) || 0
      const yuk = parseFloat(betonYukseklik) || 0
      netM3 = en * boy * yuk
    } else if (betonMod === 'kazik') {
      const capM = (parseFloat(kazikCapCm) || 80) / 100
      const r = capM / 2
      const boyM = parseFloat(kazikBoyM) || 0
      const adet = parseInt(kazikAdet) || 0
      kazikTekilM3 = Math.PI * Math.pow(r, 2) * boyM
      netM3 = kazikTekilM3 * adet
    }

    const zayiatOrani = 1 + ((parseFloat(betonZayiat) || 0) / 100)
    const brutM3 = netM3 * zayiatOrani
    const mikserKapasite = Math.max(1, parseFloat(mikserKapasitesi) || 9)
    const mikserSayisi = Math.ceil(brutM3 / mikserKapasite)

    return {
      netM3: Math.round(netM3 * 100) / 100,
      brutM3: Math.round(brutM3 * 100) / 100,
      zayiatM3: Math.round((brutM3 - netM3) * 100) / 100,
      kazikTekilM3: Math.round(kazikTekilM3 * 100) / 100,
      mikserSayisi
    }
  }, [betonMod, betonAlan, betonKalinlikCm, betonEn, betonBoy, betonYukseklik, kazikCapCm, kazikBoyM, kazikAdet, betonZayiat, mikserKapasitesi])

  // 3. Duvar Hesabı
  const duvarHesabi = useMemo(() => {
    const uz = parseFloat(duvarUzunluk) || 0
    const yuk = parseFloat(duvarYukseklik) || 0
    const bosluk = parseFloat(duvarBoslukM2) || 0
    const toplamBrutM2 = uz * yuk
    const netM2 = Math.max(0, toplamBrutM2 - bosluk)

    const seciliTip = DUVAR_TIPLERI.find(t => t.id === seciliDuvarTipi) || DUVAR_TIPLERI[0]
    const netAdet = Math.ceil(netM2 * seciliTip.sarfiyatM2)
    const fireKatsayisi = 1 + ((parseFloat(duvarFireYuzdesi) || 0) / 100)
    const fireliAdet = Math.ceil(netAdet * fireKatsayisi)
    const paletAdedi = Math.ceil(fireliAdet / (seciliTip.paletAdet || 360))
    const tahminiHarcM3 = Math.round(netM2 * seciliTip.harcM3 * 100) / 100
    const tahminiCimentoTorba = Math.ceil(tahminiHarcM3 * 5)

    return {
      toplamBrutM2: Math.round(toplamBrutM2 * 100) / 100,
      netM2: Math.round(netM2 * 100) / 100,
      netAdet,
      fireliAdet,
      paletAdedi,
      tahminiHarcM3,
      tahminiCimentoTorba,
      tipAdi: seciliTip.ad
    }
  }, [duvarUzunluk, duvarYukseklik, duvarBoslukM2, seciliDuvarTipi, duvarFireYuzdesi])

  // 4. Şap Hesabı
  const sapHesabi = useMemo(() => {
    const alan = parseFloat(sapAlanM2) || 0
    const kalinlikM = (parseFloat(sapKalinlikCm) || 0) / 100
    const hacimM3 = alan * kalinlikM

    if (sapTur === 'klasik_sap') {
      const torbaCimento = Math.ceil(hacimM3 * 5)
      const cimentoKg = torbaCimento * 50
      const kumM3 = Math.round(hacimM3 * 1.15 * 10) / 10
      const kumTon = Math.round(kumM3 * 1.6 * 10) / 10
      const elyafGram = Math.round(hacimM3 * 600)

      return {
        hacimM3: Math.round(hacimM3 * 100) / 100,
        torbaCimento,
        cimentoKg,
        kumM3,
        kumTon,
        elyafGram
      }
    } else {
      const kalinlikMm = (parseFloat(sapKalinlikCm) || 1) * 10
      const toplamKg = alan * kalinlikMm * 1.6
      const torbaSayisi = Math.ceil(toplamKg / 25)
      return {
        hacimM3: Math.round(hacimM3 * 100) / 100,
        toplamKg: Math.round(toplamKg),
        torbaSayisi
      }
    }
  }, [sapTur, sapAlanM2, sapKalinlikCm])

  // 5. Sıva & Alçı Hesabı
  const sivaHesabi = useMemo(() => {
    const alan = parseFloat(sivaAlanM2) || 0
    const kalinlikM = (parseFloat(sivaKalinlikCm) || 0) / 100
    const hacimM3 = alan * kalinlikM

    if (sivaTur === 'alci_siva') {
      const perlitliKg = alan * (parseFloat(sivaKalinlikCm) || 1) * 9
      const perlitliTorba = Math.ceil(perlitliKg / 35)
      const satenKg = alan * 0.8
      const satenTorba = Math.ceil(satenKg / 25)

      return {
        hacimM3: Math.round(hacimM3 * 100) / 100,
        perlitliTorba,
        perlitliKg: Math.round(perlitliKg),
        satenTorba,
        satenKg: Math.round(satenKg)
      }
    } else {
      const dozaj = sivaTur === 'kaba_siva' ? 250 : 200
      const cimentoKg = hacimM3 * dozaj * 1.05
      const torbaCimento = Math.ceil(cimentoKg / 50)
      const kumM3 = Math.round(hacimM3 * 1.15 * 10) / 10

      return {
        hacimM3: Math.round(hacimM3 * 100) / 100,
        torbaCimento,
        cimentoKg: Math.round(cimentoKg),
        kumM3
      }
    }
  }, [sivaTur, sivaAlanM2, sivaKalinlikCm])

  // 6. Parke & Süpürgelik Hesabı
  const parkeHesabi = useMemo(() => {
    const alan = parseFloat(parkeAlanM2) || 0
    const fireOrani = 1 + ((parseFloat(parkeFireOrani) || 0) / 100)
    const siparisAlanM2 = Math.round(alan * fireOrani * 10) / 10
    const paketM2 = parseFloat(parkePaketM2) || 1.85
    const paketSayisi = Math.ceil(siparisAlanM2 / paketM2)

    const tahminiCevre = Math.round(4 * Math.sqrt(alan) * 1.1 * 10) / 10
    const kapiDusumu = (parseInt(kapiAdedi) || 0) * 0.90
    const netSupurgelikM = Math.max(0, tahminiCevre - kapiDusumu)
    const fireliSupurgelikM = netSupurgelikM * 1.10
    const supurgelikBoy = parseFloat(supurgelikBoyM) || 2.40
    const supurgelikAdet = Math.ceil(fireliSupurgelikM / supurgelikBoy)

    return {
      netAlanM2: alan,
      siparisAlanM2,
      paketSayisi,
      silteM2: Math.ceil(alan * 1.05),
      netSupurgelikM: Math.round(netSupurgelikM * 10) / 10,
      supurgelikAdet
    }
  }, [parkeAlanM2, parkeFireOrani, parkePaketM2, kapiAdedi, supurgelikBoyM])

  // 7. Seramik & Yapıştırıcı & Derz Hesabı
  const seramikHesabi = useMemo(() => {
    const alan = parseFloat(seramikAlanM2) || 0
    const fireOrani = 1 + ((parseFloat(seramikFireOrani) || 0) / 100)
    const siparisM2 = Math.round(alan * fireOrani * 10) / 10
    const kutuM2 = parseFloat(seramikKutuM2) || 1.44
    const kutuSayisi = Math.ceil(siparisM2 / kutuM2)

    const yapistiriciKg = Math.round(alan * 4.8)
    const yapistiriciTorba = Math.ceil(yapistiriciKg / 25)

    const derzKg = Math.round(alan * 0.40 * 10) / 10
    const derzKova = Math.ceil(derzKg / 20)

    return {
      netAlanM2: alan,
      siparisM2,
      kutuSayisi,
      yapistiriciKg,
      yapistiriciTorba,
      derzKg,
      derzKova
    }
  }, [seramikAlanM2, seramikFireOrani, seramikKutuM2])

  // 8. Hafriyat Kabarma & Kamyon Hesabı
  const hafriyatHesabi = useMemo(() => {
    const net = parseFloat(kaziHacmiNet) || 0
    let katsayi = 1.30
    if (zeminTipi === 'kumlu') katsayi = 1.15
    if (zeminTipi === 'kaya') katsayi = 1.50

    const kabarmisM3 = net * katsayi
    const kamyonKapasite = parseFloat(kamyonKapasiteM3) || 16
    const kamyonSayisi = Math.ceil(kabarmisM3 / kamyonKapasite)

    return {
      net,
      kabarmisM3: Math.round(kabarmisM3 * 10) / 10,
      katsayi,
      kamyonSayisi
    }
  }, [kaziHacmiNet, zeminTipi, kamyonKapasiteM3])

  // 9. Kot & Eğim Hesabı
  const egimHesabi = useMemo(() => {
    const mesafeM = parseFloat(egimMesafe) || 0
    const yuzde = parseFloat(egimYuzde) || 0
    const kotFarkiM = (mesafeM * yuzde) / 100
    const kotFarkiCm = kotFarkiM * 100
    return {
      kotFarkiM: Math.round(kotFarkiM * 1000) / 1000,
      kotFarkiCm: Math.round(kotFarkiCm * 10) / 10
    }
  }, [egimMesafe, egimYuzde])

  return (
    <div className="sayfa saha-cetvel-sayfasi">
      {/* 1. ÜST BAŞLIK */}
      <div className="cetvel-ust-baslik">
        <div className="cetvel-baslik-satiri">
          <span className="cetvel-baslik-ikon">🧮</span>
          <div>
            <h1>Saha Cep Cetveli</h1>
            <p className="cetvel-alt-baslik">Şantiyede anlık yaklaşık metraj ve malzeme hesaplayıcıları</p>
          </div>
        </div>
      </div>

      {/* 2. ZORUNLU MÜHENDİSLİK VE YASAL UYARI BANNERI */}
      <div className="cetvel-uyari-banner">
        <span className="uyari-kalkan-ikon">⚠️</span>
        <div className="uyari-icerik">
          <strong>Hızlı Şantiye Tahmini (Ön Hesaplama):</strong>
          <p>
            Bu sayfadaki hesaplayıcılar sahada anlık pratik öngörü ve sipariş ön kontrolü içindir. Statik projeler, resmi metrajlar ve mühendislik hesapları yerine geçmez.
          </p>
        </div>
      </div>

      {/* 3. HESAPLAYICILAR MATRİKS IZGARASI (3x3 NİZAMLI GÖRÜNÜM) */}
      <div className="cetvel-matris-konteynir">
        <div className="cetvel-matris-izgarasi">
          {CETVEL_SEKMELERI.map(s => {
            const isAktif = aktifHesaplayici === s.id
            return (
              <button
                key={s.id}
                type="button"
                className={`matris-hesap-karti ${isAktif ? 'aktif' : ''}`}
                onClick={() => setAktifHesaplayici(s.id)}
              >
                <span className="matris-hesap-ikon">{s.ikon}</span>
                <span className="matris-hesap-baslik">{s.baslik}</span>
                {isAktif && <span className="matris-aktif-nokta" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. DEMİR TONAJ & AĞIRLIK HESAPLAYICI (LİSTESİZ - DİREKT)     */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'demir' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🔩 İnşaat Demiri Tonaj & Metraj Hesabı</h3>
              <p className="hesap-karti-aciklama">TS 708 standart birim ağırlıklarına göre anlık ağırlık hesabı</p>
            </div>
            <span className="standart-rozet">TS 708</span>
          </div>

          {/* Çap Seçim Izgarası */}
          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">
              Donatı Çapı Seçin: <strong className="vurgulu-cap-metin">Ø{demirCap} mm</strong>
              <span className="birim-bilgi-metni">({DEMIR_BIRIM_AGIRLIKLARI[demirCap]} kg/metre)</span>
            </label>
            <div className="demir-cap-izgara-duzenli">
              {Object.keys(DEMIR_BIRIM_AGIRLIKLARI).map(cap => (
                <button
                  key={cap}
                  type="button"
                  className={`duzenli-cap-btn ${demirCap === Number(cap) ? 'aktif' : ''}`}
                  onClick={() => setDemirCap(Number(cap))}
                >
                  Ø{cap}
                </button>
              ))}
            </div>
          </div>

          {/* Giriş Şekli Segmented Control */}
          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Hesaplama Türü:</label>
            <div className="duzenli-segmented-bar">
              <button
                type="button"
                className={`segmented-secenek ${demirGirisTuru === 'boy' ? 'aktif' : ''}`}
                onClick={() => setDemirGirisTuru('boy')}
              >
                12 Metrelik Boy (Çubuk) Adedi
              </button>
              <button
                type="button"
                className={`segmented-secenek ${demirGirisTuru === 'metre' ? 'aktif' : ''}`}
                onClick={() => setDemirGirisTuru('metre')}
              >
                Toplam Metre Cinsinden
              </button>
            </div>
          </div>

          {/* Miktar Girişi */}
          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">
              {demirGirisTuru === 'boy' ? '12 Metre Çubuk Adedi:' : 'Toplam Metraj:'}
            </label>
            <div className="entegre-input-grubu">
              <input
                type="number"
                min="1"
                step="1"
                value={demirMiktar}
                onChange={(e) => setDemirMiktar(e.target.value)}
                className="entegre-input"
                placeholder="Miktar giriniz"
              />
              <span className="entegre-birim-etiket">
                {demirGirisTuru === 'boy' ? 'Boy (12m)' : 'Metre'}
              </span>
            </div>
          </div>

          {/* STANDART PREMİUM SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">TOPLAM DEMİR AĞIRLIĞI</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{demirHesabi.toplamTon.toFixed(3)}</strong>
                <span className="birim-alt">TON</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Kilogram (kg):</span>
                <strong className="metrik-deger">{Math.round(demirHesabi.toplamKg).toLocaleString('tr-TR')} kg</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Toplam Metraj:</span>
                <strong className="metrik-deger">{demirHesabi.toplamMetre.toLocaleString('tr-TR')} Metre</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Birim Ağırlık:</span>
                <strong className="metrik-deger">{demirHesabi.birimAgirlik} kg/m</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. BETON HACMİ ($m^3$) & MİKSER İHTİYACI & KAZIK            */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'beton' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🧪 Hazır Beton Hacmi & Mikser Hesabı</h3>
              <p className="hesap-karti-aciklama">Döşeme, kolon, temel ve fore kazık yuvarlak döküm hacimleri</p>
            </div>
            <span className="standart-rozet">Hacim m³</span>
          </div>

          {/* Hesaplama Modu */}
          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">İmalat Geometrisi / Modu:</label>
            <div className="duzenli-segmented-bar">
              <button
                type="button"
                className={`segmented-secenek ${betonMod === 'alan' ? 'aktif' : ''}`}
                onClick={() => setBetonMod('alan')}
              >
                Döşeme (Alan × Kalınlık)
              </button>
              <button
                type="button"
                className={`segmented-secenek ${betonMod === 'boyut' ? 'aktif' : ''}`}
                onClick={() => setBetonMod('boyut')}
              >
                Prizmatik (En × Boy × Yükseklik)
              </button>
              <button
                type="button"
                className={`segmented-secenek ${betonMod === 'kazik' ? 'aktif' : ''}`}
                onClick={() => setBetonMod('kazik')}
              >
                Fore Kazık / Silindirik
              </button>
            </div>
          </div>

          {/* Mod Girişleri */}
          {betonMod === 'alan' && (
            <div className="cetvel-iki-sutun-grid">
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Döşeme / Tabliye Alanı:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    min="1"
                    value={betonAlan}
                    onChange={(e) => setBetonAlan(e.target.value)}
                    className="entegre-input"
                  />
                  <span className="entegre-birim-etiket">m²</span>
                </div>
              </div>
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Döşeme Kalınlığı:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    min="5"
                    step="1"
                    value={betonKalinlikCm}
                    onChange={(e) => setBetonKalinlikCm(e.target.value)}
                    className="entegre-input"
                  />
                  <span className="entegre-birim-etiket">cm</span>
                </div>
              </div>
            </div>
          )}

          {betonMod === 'boyut' && (
            <div className="cetvel-uc-sutun-grid">
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">En:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    step="0.1"
                    value={betonEn}
                    onChange={(e) => setBetonEn(e.target.value)}
                    className="entegre-input"
                  />
                  <span className="entegre-birim-etiket">Metre</span>
                </div>
              </div>
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Boy:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    step="0.1"
                    value={betonBoy}
                    onChange={(e) => setBetonBoy(e.target.value)}
                    className="entegre-input"
                  />
                  <span className="entegre-birim-etiket">Metre</span>
                </div>
              </div>
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Yükseklik:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    step="0.05"
                    value={betonYukseklik}
                    onChange={(e) => setBetonYukseklik(e.target.value)}
                    className="entegre-input"
                  />
                  <span className="entegre-birim-etiket">Metre</span>
                </div>
              </div>
            </div>
          )}

          {betonMod === 'kazik' && (
            <div className="cetvel-uc-sutun-grid">
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Kazık Çapı (Ø):</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    step="5"
                    min="20"
                    value={kazikCapCm}
                    onChange={(e) => setKazikCapCm(e.target.value)}
                    className="entegre-input"
                    placeholder="80"
                  />
                  <span className="entegre-birim-etiket">cm</span>
                </div>
              </div>
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Kazık Boyu / Derinlik:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={kazikBoyM}
                    onChange={(e) => setKazikBoyM(e.target.value)}
                    className="entegre-input"
                    placeholder="15"
                  />
                  <span className="entegre-birim-etiket">Metre</span>
                </div>
              </div>
              <div className="cetvel-blok">
                <label className="cetvel-blok-etiket">Kazık Adedi:</label>
                <div className="entegre-input-grubu">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={kazikAdet}
                    onChange={(e) => setKazikAdet(e.target.value)}
                    className="entegre-input"
                    placeholder="24"
                  />
                  <span className="entegre-birim-etiket">Adet</span>
                </div>
              </div>
            </div>
          )}

          {/* Zayiat ve Mikser Hacmi */}
          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Zayiat / Pompa Payı:</label>
              <select
                value={betonZayiat}
                onChange={(e) => setBetonZayiat(Number(e.target.value))}
                className="duzenli-select"
              >
                <option value="0">%0 (Zayiatsız Net)</option>
                <option value="3">%3 (Düşük Zayiat)</option>
                <option value="5">%5 (Standart Şantiye Payı)</option>
                <option value="8">%8 (Kalıp Esnemesi & Pompa)</option>
                <option value="12">%12 (Fore Kazık Zemin Kaçması)</option>
                <option value="15">%15 (Yüksek Kaçma Payı)</option>
              </select>
            </div>

            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Mikser Kapasitesi (m³):</label>
              <div className="mikser-kapasite-giris-satiri">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="25"
                  value={mikserKapasitesi}
                  onChange={(e) => setMikserKapasitesi(parseFloat(e.target.value) || 9)}
                  className="entegre-input kucuk-kutucuk"
                />
                <div className="hizli-mikser-butonlari">
                  {[8, 9, 10, 12].map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`hizli-hacim-btn ${Number(mikserKapasitesi) === h ? 'aktif' : ''}`}
                      onClick={() => setMikserKapasitesi(h)}
                    >
                      {h}m³
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">SİPARİŞ EDİLECEK TOPLAM BETON</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{betonHesabi.brutM3}</strong>
                <span className="birim-alt">m³</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Net Hacim:</span>
                <strong className="metrik-deger">{betonHesabi.netM3} m³</strong>
              </div>
              {betonMod === 'kazik' && (
                <div className="metrik-kutu">
                  <span className="metrik-baslik">Tekil Kazık Hacmi:</span>
                  <strong className="metrik-deger">{betonHesabi.kazikTekilM3} m³ / adet</strong>
                </div>
              )}
              <div className="metrik-kutu">
                <span className="metrik-baslik">Zayiat Payı:</span>
                <strong className="metrik-deger">+{betonHesabi.zayiatM3} m³ (%{betonZayiat})</strong>
              </div>
              <div className="metrik-kutu vurgulu-kutu">
                <span className="metrik-baslik">Gereken Mikser:</span>
                <strong className="metrik-deger">~{betonHesabi.mikserSayisi} Mikser ({mikserKapasitesi} m³)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. DUVAR / TUĞLA / BİMS HESAPLAYICI                          */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'duvar' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🧱 Duvar Tuğla, Bims & Gazbeton Hesabı</h3>
              <p className="hesap-karti-aciklama">Firesiz net ihtiyaç ve % fireli sipariş adetleri</p>
            </div>
            <span className="standart-rozet">Adet & Harç</span>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Duvar Bloğu Cinsi:</label>
            <div className="secenek-hap-izgarasi">
              {DUVAR_TIPLERI.map(tip => (
                <button
                  key={tip.id}
                  type="button"
                  className={`secenek-hap ${seciliDuvarTipi === tip.id ? 'aktif' : ''}`}
                  onClick={() => setSeciliDuvarTipi(tip.id)}
                >
                  {tip.ad}
                </button>
              ))}
            </div>
          </div>

          <div className="cetvel-uc-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Duvar Uzunluğu:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  value={duvarUzunluk}
                  onChange={(e) => setDuvarUzunluk(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">Metre</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Duvar Yüksekliği:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.1"
                  value={duvarYukseklik}
                  onChange={(e) => setDuvarYukseklik(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">Metre</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Kapı/Pencere Düşümü:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  value={duvarBoslukM2}
                  onChange={(e) => setDuvarBoslukM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m²</span>
              </div>
            </div>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Kırılma ve Köşe Kesim Fire Oranı:</label>
            <div className="duzenli-segmented-bar">
              {[0, 5, 7, 10].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`segmented-secenek ${Number(duvarFireYuzdesi) === f ? 'aktif' : ''}`}
                  onClick={() => setDuvarFireYuzdesi(f)}
                >
                  %{f} {f === 0 ? '(Firesiz)' : 'Fire'}
                </button>
              ))}
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">SİPARİŞ VERİLECEK MİKTAR (%{duvarFireYuzdesi} FİRELİ)</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{duvarHesabi.fireliAdet.toLocaleString('tr-TR')}</strong>
                <span className="birim-alt">ADET (~{duvarHesabi.paletAdedi} PALET)</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Net İhtiyaç (Firesiz):</span>
                <strong className="metrik-deger">{duvarHesabi.netAdet.toLocaleString('tr-TR')} Adet</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Net Duvar Alanı:</span>
                <strong className="metrik-deger">{duvarHesabi.netM2} m²</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Tahmini Örgü Harcı:</span>
                <strong className="metrik-deger">~{duvarHesabi.tahminiHarcM3} m³</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Gereken Çimento:</span>
                <strong className="metrik-deger">~{duvarHesabi.tahminiCimentoTorba} Torba (50kg)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. ŞAP HESAPLAYICI (REVİZE EDİLMİŞ ŞANTİYE NORMLARI)        */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'sap' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🌫️ Zemin Şapı Malzeme İhtiyacı</h3>
              <p className="hesap-karti-aciklama">Gerçekçi şantiye kum ve çimento harç dozaj hesabı</p>
            </div>
            <span className="standart-rozet">Şap Dozajı</span>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Şap Tipi:</label>
            <div className="duzenli-segmented-bar">
              <button
                type="button"
                className={`segmented-secenek ${sapTur === 'klasik_sap' ? 'aktif' : ''}`}
                onClick={() => { setSapTur('klasik_sap'); setSapKalinlikCm(4); }}
              >
                Şantiyede Klasik Şap (Kum + Çimento)
              </button>
              <button
                type="button"
                className={`segmented-secenek ${sapTur === 'hazir_tesviye' ? 'aktif' : ''}`}
                onClick={() => { setSapTur('hazir_tesviye'); setSapKalinlikCm(0.5); }}
              >
                Hazır Torbalı Akıllı Tesviye Şapı
              </button>
            </div>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Şap Dökülecek Net Alan:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  min="1"
                  value={sapAlanM2}
                  onChange={(e) => setSapAlanM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m²</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Ortalama Şap Kalınlığı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  min="0.3"
                  value={sapKalinlikCm}
                  onChange={(e) => setSapKalinlikCm(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">cm</span>
              </div>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            {sapTur === 'klasik_sap' ? (
              <>
                <div className="sonuc-ana-gosterge-satiri">
                  <span className="sonuc-etiket-ust">GEREKLİ ÇİMENTO (50 KG STANDART TORBA)</span>
                  <div className="sonuc-rakam-vurgu-buyuk">
                    <strong>{sapHesabi.torbaCimento}</strong>
                    <span className="birim-alt">TORBA ({sapHesabi.cimentoKg} KG)</span>
                  </div>
                </div>

                <div className="sonuc-alt-metrikler-grid">
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Net Şap Hacmi:</span>
                    <strong className="metrik-deger">{sapHesabi.hacimM3} m³</strong>
                  </div>
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Yıkanmış Şap Kumu:</span>
                    <strong className="metrik-deger">~{sapHesabi.kumM3} m³ (~{sapHesabi.kumTon} Ton)</strong>
                  </div>
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Çatlak Önleyici Elyaf:</span>
                    <strong className="metrik-deger">~{(sapHesabi.elyafGram / 1000).toFixed(1)} kg Elyaf</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sonuc-ana-gosterge-satiri">
                  <span className="sonuc-etiket-ust">GEREKEN 25 KG HAZIR ŞAP TORBASI</span>
                  <div className="sonuc-rakam-vurgu-buyuk">
                    <strong>{sapHesabi.torbaSayisi}</strong>
                    <span className="birim-alt">TORBA ({sapHesabi.toplamKg} KG)</span>
                  </div>
                </div>

                <div className="sonuc-alt-metrikler-grid">
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Net Harç Hacmi:</span>
                    <strong className="metrik-deger">{sapHesabi.hacimM3} m³</strong>
                  </div>
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">1 Torba Kaplaması:</span>
                    <strong className="metrik-deger">~{((25 / (sapAlanM2 > 0 ? (sapHesabi.toplamKg / sapAlanM2) : 1))).toFixed(1)} m²</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. SIVA & ALÇI HESAPLAYICI                                    */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'siva' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🎨 Sıva & Alçı Malzeme İhtiyacı</h3>
              <p className="hesap-karti-aciklama">İç cephe perlitli alçı, saten alçı ve klasik sıva sarfiyatı</p>
            </div>
            <span className="standart-rozet">Sıva</span>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Sıva Uygulama Cinsi:</label>
            <div className="duzenli-segmented-bar">
              <button
                type="button"
                className={`segmented-secenek ${sivaTur === 'alci_siva' ? 'aktif' : ''}`}
                onClick={() => { setSivaTur('alci_siva'); setSivaKalinlikCm(1.5); }}
              >
                İç Alçı Sıva (Perlitli + Saten)
              </button>
              <button
                type="button"
                className={`segmented-secenek ${sivaTur === 'kaba_siva' ? 'aktif' : ''}`}
                onClick={() => { setSivaTur('kaba_siva'); setSivaKalinlikCm(2.0); }}
              >
                Klasik Kaba Sıva
              </button>
              <button
                type="button"
                className={`segmented-secenek ${sivaTur === 'ince_siva' ? 'aktif' : ''}`}
                onClick={() => { setSivaTur('ince_siva'); setSivaKalinlikCm(1.0); }}
              >
                Klasik İnce Sıva
              </button>
            </div>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Sıvanacak Duvar Alanı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  min="1"
                  value={sivaAlanM2}
                  onChange={(e) => setSivaAlanM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m²</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Ortalama Sıva Kalınlığı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={sivaKalinlikCm}
                  onChange={(e) => setSivaKalinlikCm(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">cm</span>
              </div>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            {sivaTur === 'alci_siva' ? (
              <>
                <div className="sonuc-ana-gosterge-satiri">
                  <span className="sonuc-etiket-ust">PERLİTLİ SIVA ALÇISI (35 KG TORBA)</span>
                  <div className="sonuc-rakam-vurgu-buyuk">
                    <strong>{sivaHesabi.perlitliTorba}</strong>
                    <span className="birim-alt">TORBA ({sivaHesabi.perlitliKg} KG)</span>
                  </div>
                </div>

                <div className="sonuc-alt-metrikler-grid">
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Saten Perdahlama Alçısı:</span>
                    <strong className="metrik-deger">{sivaHesabi.satenTorba} Torba (25kg - {sivaHesabi.satenKg} kg)</strong>
                  </div>
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Köşe Profili:</span>
                    <strong className="metrik-deger">~{Math.ceil(sivaAlanM2 / 6)} Boy Profil</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="sonuc-ana-gosterge-satiri">
                  <span className="sonuc-etiket-ust">ÇİMENTO İHTİYACI (50 KG TORBA)</span>
                  <div className="sonuc-rakam-vurgu-buyuk">
                    <strong>{sivaHesabi.torbaCimento}</strong>
                    <span className="birim-alt">TORBA ({sivaHesabi.cimentoKg} KG)</span>
                  </div>
                </div>

                <div className="sonuc-alt-metrikler-grid">
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Gereken Sıva Kumu:</span>
                    <strong className="metrik-deger">~{sivaHesabi.kumM3} m³ Yıkanmış Kum</strong>
                  </div>
                  <div className="metrik-kutu">
                    <span className="metrik-baslik">Harç Hacmi:</span>
                    <strong className="metrik-deger">{sivaHesabi.hacimM3} m³</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. PARKE & SÜPÜRGELİK HESAPLAYICI                            */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'parke' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🪵 Laminat Parke & Süpürgelik Hesabı</h3>
              <p className="hesap-karti-aciklama">Paket hesabı, süpürgelik boyu ve şilte metrajı</p>
            </div>
            <span className="standart-rozet">Zemin</span>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Döşenecek Zemin Alanı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  min="1"
                  value={parkeAlanM2}
                  onChange={(e) => setParkeAlanM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m²</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Kapı Sayısı (Süpürgelik Düşümü):</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={kapiAdedi}
                  onChange={(e) => setKapiAdedi(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">Adet Kapı</span>
              </div>
            </div>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Döşeme Fire Payı:</label>
              <div className="duzenli-segmented-bar">
                {[5, 8, 10].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={`segmented-secenek ${Number(parkeFireOrani) === f ? 'aktif' : ''}`}
                    onClick={() => setParkeFireOrani(f)}
                  >
                    %{f} {f === 5 ? '(Düz)' : '(Verev)'}
                  </button>
                ))}
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">1 Paket Parke Alanı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.05"
                  min="1"
                  value={parkePaketM2}
                  onChange={(e) => setParkePaketM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m² / Paket</span>
              </div>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">SİPARİŞ EDİLECEK PARKE PAKETİ</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{parkeHesabi.paketSayisi}</strong>
                <span className="birim-alt">PAKET ({parkeHesabi.siparisAlanM2} M²)</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Gereken Süpürgelik:</span>
                <strong className="metrik-deger">~{parkeHesabi.supurgelikAdet} Boy ({supurgelikBoyM}m'lik - {parkeHesabi.netSupurgelikM}m)</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Kapron / Şilte İhtiyacı:</span>
                <strong className="metrik-deger">~{parkeHesabi.silteM2} m² Kapron</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. SERAMİK & KALEKİM & DERZ HESAPLAYICI                      */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'seramik' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🔲 Seramik, Fayans & Yapıştırıcı (Kalekim) Hesabı</h3>
              <p className="hesap-karti-aciklama">Kutu seramik, torba yapıştırıcı harç ve derz dolgusu</p>
            </div>
            <span className="standart-rozet">Kaplama</span>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Kaplama Alanı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  min="1"
                  value={seramikAlanM2}
                  onChange={(e) => setSeramikAlanM2(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">m²</span>
              </div>
            </div>
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">1 Kutu Seramik Metrajı:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  value={seramikKutuM2}
                  onChange={(e) => setSeramikKutuM2(e.target.value)}
                  className="entegre-input"
                  placeholder="1.44"
                />
                <span className="entegre-birim-etiket">m² / Kutu</span>
              </div>
            </div>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Kesim / Köşe Firesi:</label>
            <div className="duzenli-segmented-bar">
              {[5, 8, 10].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`segmented-secenek ${Number(seramikFireOrani) === f ? 'aktif' : ''}`}
                  onClick={() => setSeramikFireOrani(f)}
                >
                  %{f} {f === 5 ? '(Düz Alan)' : (f === 8 ? '(Islak Hacim)' : '(Zor Köşeli)')}
                </button>
              ))}
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">SİPARİŞ EDİLECEK SERAMİK KUTUSU</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{seramikHesabi.kutuSayisi}</strong>
                <span className="birim-alt">KUTU ({seramikHesabi.siparisM2} M²)</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Yapıştırıcı (Kalekim):</span>
                <strong className="metrik-deger">{seramikHesabi.yapistiriciTorba} Torba (25kg - {seramikHesabi.yapistiriciKg} kg)</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Derz Dolgu (Fuga):</span>
                <strong className="metrik-deger">~{seramikHesabi.derzKg} kg ({seramikHesabi.derzKova} Kova 20kg)</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. HAFRİYAT ŞİŞME (KABARMA) & KAMYON HESAPLAYICI             */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'hafriyat' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>🚜 Hafriyat Kabarma & Kamyon Seferi Hesabı</h3>
              <p className="hesap-karti-aciklama">Sıkı yerinde kazı hacminden kabarmış gevşek sefer hesabına</p>
            </div>
            <span className="standart-rozet">Kazı</span>
          </div>

          <div className="cetvel-blok">
            <label className="cetvel-blok-etiket">Sıkı / Yerinde Kazı Hacmi:</label>
            <div className="entegre-input-grubu">
              <input
                type="number"
                min="10"
                value={kaziHacmiNet}
                onChange={(e) => setKaziHacmiNet(e.target.value)}
                className="entegre-input"
              />
              <span className="entegre-birim-etiket">m³ Sıkı Kazı</span>
            </div>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Zemin Cinsi (Kabarma Katsayısı):</label>
              <select
                value={zeminTipi}
                onChange={(e) => setZeminTipi(e.target.value)}
                className="duzenli-select"
              >
                <option value="kumlu">Kumlu / Çakıllı Toprak (×1.15 Kabarma)</option>
                <option value="killi">Killi / Bitkisel / Karışık Toprak (×1.30 Kabarma)</option>
                <option value="kaya">Kırılmış Sert Kaya / Moloz (×1.50 Kabarma)</option>
              </select>
            </div>

            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Kamyon Damper Hacmi:</label>
              <select
                value={kamyonKapasiteM3}
                onChange={(e) => setKamyonKapasiteM3(e.target.value)}
                className="duzenli-select"
              >
                <option value="14">14 m³ (Standart 3 Dingil Kamyon)</option>
                <option value="16">16 m³ (4 Dingil Kırkayak Kamyon)</option>
                <option value="18">18 m³ (Büyük Damperli Kırkayak)</option>
                <option value="22">22 m³ (Tır Damper)</option>
              </select>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">TAHMİNİ KAMYON SEFERİ İHTİYACI</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>~{hafriyatHesabi.kamyonSayisi}</strong>
                <span className="birim-alt">SEFER ({kamyonKapasiteM3} M³'LÜK)</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Yerinde Sıkı Kazı:</span>
                <strong className="metrik-deger">{hafriyatHesabi.net} m³</strong>
              </div>
              <div className="metrik-kutu">
                <span className="metrik-baslik">Kabarmış Gevşek Hacim:</span>
                <strong className="metrik-deger">{hafriyatHesabi.kabarmisM3} m³ (×{hafriyatHesabi.katsayi})</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. KOT & EĞİM HESAPLAYICI                                    */}
      {/* ============================================================ */}
      {aktifHesaplayici === 'egim' && (
        <div className="hesaplayici-karti animasyonlu-giris">
          <div className="hesap-karti-ust-bar">
            <div>
              <h3>📐 Rampa, Drenaj & Kot Farkı Hesabı</h3>
              <p className="hesap-karti-aciklama">Yatay mesafe ve eğim yüzdesine göre kot farkı</p>
            </div>
            <span className="standart-rozet">Geometri</span>
          </div>

          <div className="cetvel-iki-sutun-grid">
            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Yatay Mesafe:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={egimMesafe}
                  onChange={(e) => setEgimMesafe(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">Metre</span>
              </div>
            </div>

            <div className="cetvel-blok">
              <label className="cetvel-blok-etiket">Eğim Yüzdesi:</label>
              <div className="entegre-input-grubu">
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={egimYuzde}
                  onChange={(e) => setEgimYuzde(e.target.value)}
                  className="entegre-input"
                />
                <span className="entegre-birim-etiket">% Eğim</span>
              </div>
            </div>
          </div>

          {/* SONUÇ KARTI */}
          <div className="cetvel-premium-sonuc-karti">
            <div className="sonuc-ana-gosterge-satiri">
              <span className="sonuc-etiket-ust">OLUŞAN KOT / YÜKSEKLİK FARKI</span>
              <div className="sonuc-rakam-vurgu-buyuk">
                <strong>{egimHesabi.kotFarkiCm}</strong>
                <span className="birim-alt">CM ({egimHesabi.kotFarkiM} METRE)</span>
              </div>
            </div>

            <div className="sonuc-alt-metrikler-grid tek-satir">
              <div className="metrik-kutu">
                <span className="metrik-baslik">Metre Başına Düşüş / Çıkış:</span>
                <strong className="metrik-deger">{egimMesafe} metrede her 1 metre için {egimYuzde} cm yükseklik farkı oluşur.</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
