import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihFormatlaTR = (tarihStr) => {
  if (!tarihStr) return ''
  const parts = tarihStr.split('-')
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
  }
  return tarihStr
}

const gunEkle = (tarihStr, n) => {
  if (!tarihStr) return ''
  const d = new Date(tarihStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const BETON_SINIFLARI = ['C25/30', 'C30/37', 'C35/45', 'C40/50', 'C16/20 Grobeton', 'Özel Sınıf']

const KAT_SECENEKLERI = [
  'Temel / Sıfır Kotu',
  'Bodrum Kat (-2)',
  'Bodrum Kat (-1)',
  'Zemin Kat',
  'Asma Kat',
  '1. Kat',
  '2. Kat',
  '3. Kat',
  '4. Kat',
  '5. Kat',
  'Teras / Çatı Katı',
  'Diğer / Manuel'
]

const ELEMAN_SECENEKLERI = [
  'Tabliye / Döşeme',
  'Kolon',
  'Perde',
  'Tulum Döküm (Kolon+Perde+Tabliye)',
  'Radye Temel',
  'Sürekli Temel',
  'Merdiven & Sahanlık',
  'Saha / Zemin Betonu',
  'Grobeton',
  'Diğer'
]

const BETON_OZELLIKLERI = [
  'Normal Standart',
  'Süper Beton',
  'Brüt Beton',
  'Plus Beton',
  'Katkılı / Su Geçirimsiz',
  'Elyaf / Çelik Donatılı'
]

const DOKUM_SEKILLERI = [
  'Mobil Pompa',
  'Yer Pompası',
  'Mikser İle Direkt Döküm',
  'Vinç Kovası'
]

const LOCAL_STORAGE_BETON = 'santiye_beton_dokumleri_v1'
const LOCAL_STORAGE_SON_HACIM = 'santiye_son_mikser_hacmi'

export default function BetonDokumu() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()

  const [seciliTarihFiltresi, setSeciliTarihFiltresi] = useState('')
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [dokumListesi, setDokumListesi] = useState([])
  const [tumCariler, setTumCariler] = useState([])

  // Modal / Form States
  const [yeniDokumModalAcik, setYeniDokumModalAcik] = useState(false)
  const [seciliDokumId, setSeciliDokumId] = useState(null)
  const [buyukFotoUrl, setBuyukFotoUrl] = useState(null)

  // Yeni Döküm Form Alanları
  const [formTarih, setFormTarih] = useState(bugun())
  const [formKat, setFormKat] = useState('1. Kat')
  const [formManuelKat, setFormManuelKat] = useState('')
  const [formEleman, setFormEleman] = useState('Tabliye / Döşeme')
  const [formManuelEleman, setFormManuelEleman] = useState('')
  const [formOzellik, setFormOzellik] = useState('Normal Standart')
  const [formSinif, setFormSinif] = useState('C30/37')
  const [formSantral, setFormSantral] = useState('')
  const [formHedefM3, setFormHedefM3] = useState(120)
  const [formDokumSekli, setFormDokumSekli] = useState('Mobil Pompa')
  const [formSantiyeId, setFormSantiyeId] = useState('')

  // Hızlı Mikser Ekleme Modalı / Girişi
  const [mikserModalAcik, setMikserModalAcik] = useState(false)
  const [mikserPlaka, setMikserPlaka] = useState('')
  const [mikserIrsaliye, setMikserIrsaliye] = useState('')
  const [mikserHacim, setMikserHacim] = useState(9)
  const [mikserSlump, setMikserSlump] = useState('S4 (18-20 cm)')
  const [mikserKupAlindi, setMikserKupAlindi] = useState(false)
  const [mikserKupAdet, setMikserKupAdet] = useState(6)

  // Sayfa açıldığında son kullanılan mikser hacmini oku
  useEffect(() => {
    try {
      const sonHacim = localStorage.getItem(LOCAL_STORAGE_SON_HACIM)
      if (sonHacim) {
        setMikserHacim(parseFloat(sonHacim) || 9)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (aktifSantiye?.id) {
      setSeciliSantiyeId(aktifSantiye.id)
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad, sifat').then(({ data }) => {
      if (data) setTumCariler(data)
    })
  }, [])

  // LocalStorage'dan kayıtları çek
  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(LOCAL_STORAGE_BETON)
      if (kayitli) {
        setDokumListesi(JSON.parse(kayitli))
      } else {
        // Örnek başlangıç dökümü
        const ornek = [
          {
            id: 'b-1',
            tarih: bugun(),
            santiyeId: aktifSantiye?.id || 'santiye-1',
            santiyeAdi: aktifSantiye?.ad || 'Merkez Şantiye',
            kat: '1. Kat',
            eleman: 'Tulum Döküm (Kolon+Perde+Tabliye)',
            ozellik: 'Süper Beton',
            sinif: 'C30/37',
            santral: 'Akçansa / Çimsa Hazır Beton',
            hedefM3: 120,
            dokumSekli: 'Mobil Pompa',
            tamamlandi: false,
            irsaliyeFotolari: [],
            mikserler: [
              { id: 'm-1', plaka: '34 BC 4521', irsaliye: 'İRS-88412', hacim: 9, saat: '08:45', slump: '18 cm', kupAlindi: true, kupAdet: 6 },
              { id: 'm-2', plaka: '34 BC 4521', irsaliye: 'İRS-88425', hacim: 9, saat: '09:40', slump: '19 cm', kupAlindi: false, kupAdet: 0 },
              { id: 'm-3', plaka: '34 TR 9912', irsaliye: 'İRS-88433', hacim: 10, saat: '10:30', slump: '18 cm', kupAlindi: true, kupAdet: 6 }
            ],
            olusturulduAt: new Date().toISOString()
          }
        ]
        setDokumListesi(ornek)
        localStorage.setItem(LOCAL_STORAGE_BETON, JSON.stringify(ornek))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const dokumleriKaydet = (yeniListe) => {
    setDokumListesi(yeniListe)
    try {
      localStorage.setItem(LOCAL_STORAGE_BETON, JSON.stringify(yeniListe))
    } catch (e) {
      console.error(e)
    }
  }

  // Yeni Döküm Kartı Başlat
  const handleYeniDokumKaydet = (e) => {
    e.preventDefault()
    const katMetni = formKat === 'Diğer / Manuel' ? (formManuelKat.trim() || 'Kat Belirtilmedi') : formKat
    const elemanMetni = formEleman === 'Diğer' ? (formManuelEleman.trim() || 'Özel İmalat') : formEleman
    const hedefSantiyeId = formSantiyeId || seciliSantiyeId || aktifSantiye?.id || ''
    const santiyeObj = santiyeler.find(s => s.id === hedefSantiyeId) || aktifSantiye

    const yeniDokum = {
      id: 'b-' + Date.now(),
      tarih: formTarih || bugun(),
      santiyeId: hedefSantiyeId,
      santiyeAdi: santiyeObj?.ad || 'Şantiye',
      kat: katMetni,
      eleman: elemanMetni,
      ozellik: formOzellik,
      sinif: formSinif,
      santral: formSantral.trim() || 'Hazır Beton Santrali',
      hedefM3: parseFloat(formHedefM3) || 100,
      dokumSekli: formDokumSekli,
      tamamlandi: false,
      irsaliyeFotolari: [],
      mikserler: [],
      olusturulduAt: new Date().toISOString()
    }

    dokumleriKaydet([yeniDokum, ...dokumListesi])
    setYeniDokumModalAcik(false)
    setFormSantral('')
    setFormManuelKat('')
    setFormManuelEleman('')
  }

  // Hızlı Mikser Ekle
  const handleHizliMikserKaydet = (e) => {
    e.preventDefault()
    if (!seciliDokumId) return

    const suAn = new Date()
    const saatFormat = suAn.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    const girilenHacim = parseFloat(mikserHacim) || 9

    // Son kullanılan mikser hacmini kaydet (default gelsin diye)
    try {
      localStorage.setItem(LOCAL_STORAGE_SON_HACIM, girilenHacim.toString())
    } catch (err) {
      console.error(err)
    }

    const yeniMikser = {
      id: 'mikser-' + Date.now(),
      plaka: (mikserPlaka || '34 ...').toUpperCase().trim(),
      irsaliye: mikserIrsaliye.trim() || 'İRS-' + Math.floor(10000 + Math.random() * 90000),
      hacim: girilenHacim,
      saat: saatFormat,
      slump: mikserSlump,
      kupAlindi: mikserKupAlindi,
      kupAdet: mikserKupAlindi ? (parseInt(mikserKupAdet) || 6) : 0
    }

    const guncel = dokumListesi.map(d => {
      if (d.id === seciliDokumId) {
        return {
          ...d,
          mikserler: [...d.mikserler, yeniMikser]
        }
      }
      return d
    })

    dokumleriKaydet(guncel)
    setMikserModalAcik(false)
    setMikserPlaka('')
    setMikserIrsaliye('')
  }

  // Mikser Ekleme Modalı Açılırken Son Hacmi Yükle
  const handleMikserModalAc = (dokumId) => {
    setSeciliDokumId(dokumId)
    try {
      const sonHacim = localStorage.getItem(LOCAL_STORAGE_SON_HACIM)
      if (sonHacim) {
        setMikserHacim(parseFloat(sonHacim) || 9)
      }
    } catch (e) {
      console.error(e)
    }
    setMikserModalAcik(true)
  }

  // Toplu İrsaliye Fotoğrafı Yükle
  const handleTopluIrsaliyeYukle = (dokumId, e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    let yuklenenSayisi = 0
    const yeniFotoUrls = []

    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        yeniFotoUrls.push(reader.result)
        yuklenenSayisi++
        if (yuklenenSayisi === files.length) {
          const guncel = dokumListesi.map(d => {
            if (d.id === dokumId) {
              return {
                ...d,
                irsaliyeFotolari: [...(d.irsaliyeFotolari || []), ...yeniFotoUrls]
              }
            }
            return d
          })
          dokumleriKaydet(guncel)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  // Tekil İrsaliye Fotoğrafını Sil
  const handleIrsaliyeFotoSil = (dokumId, fotoIndex) => {
    if (window.confirm('Bu irsaliye fotoğrafını silmek istediğinize emin misiniz?')) {
      const guncel = dokumListesi.map(d => {
        if (d.id === dokumId) {
          return {
            ...d,
            irsaliyeFotolari: (d.irsaliyeFotolari || []).filter((_, i) => i !== fotoIndex)
          }
        }
        return d
      })
      dokumleriKaydet(guncel)
    }
  }

  // Mikseri Sil
  const handleSonMikseriSil = (dokumId, mikserId) => {
    if (window.confirm('Bu mikser kaydını silmek istediğinize emin misiniz?')) {
      const guncel = dokumListesi.map(d => {
        if (d.id === dokumId) {
          return {
            ...d,
            mikserler: d.mikserler.filter(m => m.id !== mikserId)
          }
        }
        return d
      })
      dokumleriKaydet(guncel)
    }
  }

  // Dökümü Tamamlandı / Açık Yap
  const handleDokumDurumDegistir = (dokumId) => {
    const guncel = dokumListesi.map(d => {
      if (d.id === dokumId) {
        return { ...d, tamamlandi: !d.tamamlandi }
      }
      return d
    })
    dokumleriKaydet(guncel)
  }

  // Döküm Kartını Sil
  const handleDokumSil = (dokumId) => {
    if (window.confirm('Bu beton döküm kartını ve bağlı tüm mikser kayıtlarını silmek istediğinize emin misiniz?')) {
      const guncel = dokumListesi.filter(d => d.id !== dokumId)
      dokumleriKaydet(guncel)
    }
  }

  // Filtrelenmiş Döküm Listesi
  const filtrelenmisDokumler = useMemo(() => {
    return dokumListesi.filter(d => {
      if (seciliSantiyeId && d.santiyeId && d.santiyeId !== seciliSantiyeId) return false
      if (seciliTarihFiltresi && d.tarih !== seciliTarihFiltresi) return false
      return true
    })
  }, [dokumListesi, seciliSantiyeId, seciliTarihFiltresi])

  // Toplam İstatistikler
  const istatistikler = useMemo(() => {
    let toplamDokulenM3 = 0
    let toplamMikserSayisi = 0
    let toplamKupSeti = 0

    filtrelenmisDokumler.forEach(d => {
      d.mikserler.forEach(m => {
        toplamDokulenM3 += Number(m.hacim) || 0
        toplamMikserSayisi += 1
        if (m.kupAlindi) toplamKupSeti += 1
      })
    })

    return {
      toplamDokulenM3: Math.round(toplamDokulenM3 * 10) / 10,
      toplamMikserSayisi,
      toplamKupSeti
    }
  }, [filtrelenmisDokumler])

  return (
    <div className="sayfa beton-dokum-sayfasi">
      {/* 1. ÜST BAŞLIK */}
      <div className="makine-ust-baslik-alani">
        <div className="makine-baslik-satiri">
          <div className="makine-baslik-metin">
            <h1>🧪 Beton Dökümü & Mikser Çetelesi</h1>
            <p className="makine-alt-bilgi">Saha hazır beton mikser akışı, hacim takibi, toplu irsaliye arşivi ve numune küp kırım hatırlatıcısı</p>
          </div>
          <button 
            type="button" 
            className="yeni-dokum-baslat-btn"
            onClick={() => {
              setFormTarih(bugun())
              setYeniDokumModalAcik(true)
            }}
          >
            ➕ Yeni Beton Dökümü Başlat
          </button>
        </div>

        {/* KPI KARTLARI */}
        <div className="makine-kpi-kartlari">
          <div className="makine-kpi-kart mavi">
            <div className="makine-kpi-ikon">🧪</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">{istatistikler.toplamDokulenM3} <small>m³</small></span>
              <span className="makine-kpi-etiket">Dökülen Toplam Beton</span>
            </div>
          </div>
          <div className="makine-kpi-kart turuncu">
            <div className="makine-kpi-ikon">🚚</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">{istatistikler.toplamMikserSayisi} <small>Mikser</small></span>
              <span className="makine-kpi-etiket">Gelen Mikser Çetelesi</span>
            </div>
          </div>
          <div className="makine-kpi-kart yesil">
            <div className="makine-kpi-ikon">📦</div>
            <div className="makine-kpi-icerik">
              <span className="makine-kpi-sayi">{istatistikler.toplamKupSeti} <small>Set</small></span>
              <span className="makine-kpi-etiket">Alınan Numune Küp Seti</span>
            </div>
          </div>
        </div>
      </div>

      {/* ŞANTİYE VE TARİH FİLTRESİ */}
      <div className="makine-kontrol-paneli">
        <div className="makine-filtre-oge santiye-secimi">
          <label>Şantiye:</label>
          <select 
            value={seciliSantiyeId} 
            onChange={(e) => setSeciliSantiyeId(e.target.value)}
            className="makine-select"
          >
            <option value="">Tüm Şantiyeler</option>
            {santiyeler.map(s => (
              <option key={s.id} value={s.id}>{s.ad}</option>
            ))}
          </select>
        </div>

        <div className="makine-filtre-oge">
          <label>Tarih Filtresi:</label>
          <input
            type="date"
            value={seciliTarihFiltresi}
            onChange={(e) => setSeciliTarihFiltresi(e.target.value)}
            className="makine-input"
            style={{ width: 'auto', height: 38 }}
          />
          {seciliTarihFiltresi && (
            <button
              type="button"
              className="arama-temizle"
              onClick={() => setSeciliTarihFiltresi('')}
              title="Tarih filtresini kaldır"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* DÖKÜM KARTLARI LİSTESİ */}
      <div className="beton-dokum-listesi">
        {filtrelenmisDokumler.length === 0 ? (
          <div className="bos-kayit-paneli">
            <span className="bos-ikon">🧪</span>
            <h4>Henüz kayıtlı beton dökümü bulunmuyor</h4>
            <p>"Yeni Beton Dökümü Başlat" butonuna dokunarak kat, eleman ve hedef m³ beton hacmini girin.</p>
          </div>
        ) : (
          filtrelenmisDokumler.map(dokum => {
            const dokulenM3 = dokum.mikserler.reduce((toplam, m) => toplam + (Number(m.hacim) || 0), 0)
            const oran = Math.min(100, Math.round((dokulenM3 / (dokum.hedefM3 || 1)) * 100))
            const kalanM3 = Math.max(0, Math.round((dokum.hedefM3 - dokulenM3) * 10) / 10)
            const sonHacimBirim = dokum.mikserler.length > 0 ? dokum.mikserler[dokum.mikserler.length - 1].hacim : 9
            const kalanMikserTahmin = Math.ceil(kalanM3 / (sonHacimBirim || 9))

            // Küp Kırım Tarihleri (7 ve 28 gün)
            const kirim7 = gunEkle(dokum.tarih, 7)
            const kirim28 = gunEkle(dokum.tarih, 28)

            return (
              <div key={dokum.id} className={`beton-dokum-karti ${dokum.tamamlandi ? 'tamamlandi' : ''}`}>
                {/* KART BAŞLIĞI */}
                <div className="dokum-kart-ust">
                  <div>
                    <div className="dokum-rozet-grubu">
                      <span className="dokum-sinif-rozet">{dokum.sinif}</span>
                      {dokum.ozellik && dokum.ozellik !== 'Normal Standart' && (
                        <span className="dokum-ozellik-rozet">✨ {dokum.ozellik}</span>
                      )}
                      <span className="dokum-tarih-rozet">📅 {tarihFormatlaTR(dokum.tarih)}</span>
                      {dokum.tamamlandi ? (
                        <span className="dokum-durum-rozet kapali">✓ Döküm Tamamlandı</span>
                      ) : (
                        <span className="dokum-durum-rozet acik">⚡ Döküm Devam Ediyor</span>
                      )}
                    </div>

                    <h3 className="dokum-bolge-baslik">
                      {dokum.kat ? `${dokum.kat} — ` : ''}{dokum.eleman || dokum.bolge}
                    </h3>

                    <div className="dokum-santral-bilgi">
                      <span>🏭 {dokum.santral}</span>
                      <span>•</span>
                      <span>🏗️ {dokum.santiyeAdi}</span>
                      <span>•</span>
                      <span>🚜 {dokum.dokumSekli || dokum.pompaTipi || 'Mobil Pompa'}</span>
                    </div>
                  </div>

                  <div className="dokum-kart-eylemler">
                    <button
                      type="button"
                      className={`dokum-durum-toggle-btn ${dokum.tamamlandi ? 'kapali' : 'acik'}`}
                      onClick={() => handleDokumDurumDegistir(dokum.id)}
                    >
                      {dokum.tamamlandi ? '↩ Dökümü Geri Aç' : '✓ Dökümü Tamamla'}
                    </button>
                    <button
                      type="button"
                      className="kart-icon-buton sil"
                      onClick={() => handleDokumSil(dokum.id)}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* İLERLEME ÇUBUĞU (PROGRESS BAR) */}
                <div className="dokum-ilerleme-alani">
                  <div className="dokum-ilerleme-metinler">
                    <span>
                      Dökülen: <strong>{dokulenM3} m³</strong> / Hedef: <strong>{dokum.hedefM3} m³</strong>
                    </span>
                    <span className="yuzde-vurgu">%{oran}</span>
                  </div>
                  <div className="dokum-bar-dis">
                    <div 
                      className={`dokum-bar-ic ${oran >= 100 ? 'tam' : ''}`} 
                      style={{ width: `${oran}%` }} 
                    />
                  </div>
                  <div className="dokum-kalan-bilgi">
                    {kalanM3 > 0 ? (
                      <span>Kalan Hacim: <strong>~{kalanM3} m³</strong> (Tahmini ~{kalanMikserTahmin} mikser daha gerekli)</span>
                    ) : (
                      <span className="hedef-tamamlandi">🎉 Hedeflenen beton hacmine ulaşıldı!</span>
                    )}
                  </div>
                </div>

                {/* KÜP KIRIM UYARI ŞERİDİ */}
                <div className="kup-kirim-seridi">
                  <div className="kirim-tarih-kutu">
                    <span className="kirim-etiket">7 Günlük Küp Kırımı:</span>
                    <strong className="kirim-tarih">{tarihFormatlaTR(kirim7)}</strong>
                  </div>
                  <div className="kirim-tarih-kutu vurgulu">
                    <span className="kirim-etiket">28 Günlük Nihai Kırım:</span>
                    <strong className="kirim-tarih">{tarihFormatlaTR(kirim28)}</strong>
                  </div>
                </div>

                {/* TOPLU İRSALİYE FOTOĞRAFLARI ARŞİVİ */}
                <div className="dokum-irsaliye-galeri-alani">
                  <div className="galeri-baslik-satiri">
                    <h4>📸 İrsaliye Fotoğrafları ({dokum.irsaliyeFotolari?.length || 0})</h4>
                    <label className="toplu-foto-yukle-label">
                      ➕ Toplu İrsaliye Fotoğrafı Ekle
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => handleTopluIrsaliyeYukle(dokum.id, e)}
                      />
                    </label>
                  </div>

                  {dokum.irsaliyeFotolari && dokum.irsaliyeFotolari.length > 0 ? (
                    <div className="irsaliye-foto-grid">
                      {dokum.irsaliyeFotolari.map((url, fIdx) => (
                        <div key={fIdx} className="irsaliye-foto-kapsayici">
                          <img
                            src={url}
                            alt={`İrsaliye ${fIdx + 1}`}
                            onClick={() => setBuyukFotoUrl(url)}
                          />
                          <button
                            type="button"
                            className="foto-sil-mini-btn"
                            onClick={() => handleIrsaliyeFotoSil(dokum.id, fIdx)}
                            title="Fotoğrafı sil"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="galeri-bos-metin">Bu döküme ait irsaliyelerin fotoğraflarını tek seferde topluca buraya yükleyebilirsiniz.</p>
                  )}
                </div>

                {/* MİKSERLER ÇETELE LİSTESİ */}
                <div className="mikser-cetele-bolumu">
                  <div className="cetele-baslik-satiri">
                    <h4>🚚 Gelen Mikserler ({dokum.mikserler.length} Adet - {dokulenM3} m³)</h4>
                    {!dokum.tamamlandi && (
                      <button
                        type="button"
                        className="mikser-ekle-hizli-btn"
                        onClick={() => handleMikserModalAc(dokum.id)}
                      >
                        🚚 +1 Mikser Geldi
                      </button>
                    )}
                  </div>

                  {dokum.mikserler.length === 0 ? (
                    <p className="mikser-yok-metin">Henüz gelen mikser kaydedilmedi. "+1 Mikser Geldi" butonuna dokunarak ilk mikseri girin.</p>
                  ) : (
                    <div className="mikser-kart-grid">
                      {dokum.mikserler.map((m, idx) => (
                        <div key={m.id || idx} className="mikser-kayit-karti">
                          <div className="mikser-no-sira">#{idx + 1}</div>
                          <div className="mikser-bilgiler">
                            <div className="mikser-plaka-irsaliye">
                              <strong>{m.plaka}</strong>
                              <span className="irsaliye-no">{m.irsaliye}</span>
                            </div>
                            <div className="mikser-detay-etiketler">
                              <span className="detay-hacim">{m.hacim} m³</span>
                              <span className="detay-saat">⏰ {m.saat}</span>
                              {m.slump && <span className="detay-slump">Slump: {m.slump}</span>}
                              {m.kupAlindi && <span className="detay-kup">🧪 {m.kupAdet} Numune Küp</span>}
                            </div>
                          </div>
                          {!dokum.tamamlandi && (
                            <button
                              type="button"
                              className="mikser-sil-btn"
                              onClick={() => handleSonMikseriSil(dokum.id, m.id)}
                              title="Sil"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ============================================================ */}
      {/* BÜYÜK FOTOĞRAF MODALI                                        */}
      {/* ============================================================ */}
      {buyukFotoUrl && (
        <div className="modal-arka-plan" onClick={() => setBuyukFotoUrl(null)}>
          <div className="modal-kutu buyuk-foto-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-kapat-btn ust-sag" onClick={() => setBuyukFotoUrl(null)}>✕</button>
            <img src={buyukFotoUrl} alt="İrsaliye Belgesi Büyütülmüş" className="buyuk-resim-icerik" />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: YENİ BETON DÖKÜMÜ BAŞLATMA                            */}
      {/* ============================================================ */}
      {yeniDokumModalAcik && (
        <div className="modal-arka-plan" onClick={() => setYeniDokumModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>🧪 Yeni Beton Dökümü Başlat</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setYeniDokumModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleYeniDokumKaydet}>
              {/* Döküm Tarihi ve Şantiye */}
              <div className="cetvel-cift-giris-grid">
                <div className="form-satir">
                  <label className="alan-baslik">Döküm Tarihi:</label>
                  <input
                    type="date"
                    value={formTarih}
                    onChange={(e) => setFormTarih(e.target.value)}
                    className="makine-input"
                    required
                  />
                  <small className="cetvel-ipucu">Dün veya geçmiş tarihli dökümler için seçebilirsiniz.</small>
                </div>
                <div className="form-satir">
                  <label className="alan-baslik">Şantiye:</label>
                  <select
                    value={formSantiyeId}
                    onChange={(e) => setFormSantiyeId(e.target.value)}
                    className="makine-select"
                  >
                    {santiyeler.map(s => (
                      <option key={s.id} value={s.id}>{s.ad}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kaçıncı Kat? */}
              <div className="form-satir">
                <label className="alan-baslik">Kaçıncı Kat?:</label>
                <div className="makine-turu-haplari">
                  {KAT_SECENEKLERI.map(k => (
                    <button
                      key={k}
                      type="button"
                      className={`makine-chip ${formKat === k ? 'aktif' : ''}`}
                      onClick={() => setFormKat(k)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                {formKat === 'Diğer / Manuel' && (
                  <input
                    type="text"
                    placeholder="Örn: Asansör Kulesi, Çatı Terası, 6. Kat..."
                    value={formManuelKat}
                    onChange={(e) => setFormManuelKat(e.target.value)}
                    className="makine-input"
                    style={{ marginTop: 6 }}
                    required
                  />
                )}
              </div>

              {/* İmalat Elemanı / Şekli */}
              <div className="form-satir">
                <label className="alan-baslik">İmalat Türü / Elemanı:</label>
                <div className="makine-turu-haplari">
                  {ELEMAN_SECENEKLERI.map(el => (
                    <button
                      key={el}
                      type="button"
                      className={`makine-chip ${formEleman === el ? 'aktif' : ''}`}
                      onClick={() => setFormEleman(el)}
                    >
                      {el}
                    </button>
                  ))}
                </div>
                {formEleman === 'Diğer' && (
                  <input
                    type="text"
                    placeholder="Örn: İstinat Duvarı, Asansör Çukuru..."
                    value={formManuelEleman}
                    onChange={(e) => setFormManuelEleman(e.target.value)}
                    className="makine-input"
                    style={{ marginTop: 6 }}
                    required
                  />
                )}
              </div>

              {/* Beton Özelliği: Süper / Brüt / Plus vb. */}
              <div className="form-satir">
                <label className="alan-baslik">Beton Özelliği / Katkısı (Süper / Brüt / Plus):</label>
                <div className="makine-turu-haplari">
                  {BETON_OZELLIKLERI.map(oz => (
                    <button
                      key={oz}
                      type="button"
                      className={`makine-chip ${formOzellik === oz ? 'aktif' : ''}`}
                      onClick={() => setFormOzellik(oz)}
                    >
                      {oz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Beton Sınıfı */}
              <div className="form-satir">
                <label className="alan-baslik">Beton Sınıfı:</label>
                <div className="makine-turu-haplari">
                  {BETON_SINIFLARI.map(sinif => (
                    <button
                      key={sinif}
                      type="button"
                      className={`makine-chip ${formSinif === sinif ? 'aktif' : ''}`}
                      onClick={() => setFormSinif(sinif)}
                    >
                      {sinif}
                    </button>
                  ))}
                </div>
              </div>

              {/* Santral ve Hedef Hacim */}
              <div className="cetvel-cift-giris-grid">
                <div className="form-satir">
                  <label className="alan-baslik">Hazır Beton Santrali:</label>
                  <input
                    type="text"
                    placeholder="Rehberden santral ara veya yaz..."
                    value={formSantral}
                    onChange={(e) => setFormSantral(e.target.value)}
                    className="makine-input"
                    list="santral-listesi"
                    required
                  />
                  <datalist id="santral-listesi">
                    {tumCariler.map(c => (
                      <option key={c.id} value={c.ad}>{c.ad}</option>
                    ))}
                  </datalist>
                </div>
                <div className="form-satir">
                  <label className="alan-baslik">Hedeflenen Hacim (m³):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formHedefM3}
                    onChange={(e) => setFormHedefM3(e.target.value)}
                    className="makine-input"
                    required
                  />
                </div>
              </div>

              {/* Beton Döküm Şekli */}
              <div className="form-satir">
                <label className="alan-baslik">Beton Döküm Şekli:</label>
                <div className="makine-turu-haplari">
                  {DOKUM_SEKILLERI.map(sekil => (
                    <button
                      key={sekil}
                      type="button"
                      className={`makine-chip ${formDokumSekli === sekil ? 'aktif' : ''}`}
                      onClick={() => setFormDokumSekli(sekil)}
                    >
                      {sekil}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setYeniDokumModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  Dökümü Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: HIZLI MİKSER EKLEME                                   */}
      {/* ============================================================ */}
      {mikserModalAcik && (
        <div className="modal-arka-plan" onClick={() => setMikserModalAcik(false)}>
          <div className="modal-kutu makine-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-baslik-satiri">
              <h3>🚚 Gelen Mikseri Kaydet</h3>
              <button type="button" className="modal-kapat-btn" onClick={() => setMikserModalAcik(false)}>✕</button>
            </div>

            <form onSubmit={handleHizliMikserKaydet}>
              <div className="cetvel-cift-giris-grid">
                <div className="form-satir">
                  <label className="alan-baslik">Mikser Plakası:</label>
                  <input
                    type="text"
                    placeholder="Örn: 34 BC 1234"
                    value={mikserPlaka}
                    onChange={(e) => setMikserPlaka(e.target.value)}
                    className="makine-input"
                    autoFocus
                  />
                </div>
                <div className="form-satir">
                  <label className="alan-baslik">İrsaliye No:</label>
                  <input
                    type="text"
                    placeholder="Örn: 88421"
                    value={mikserIrsaliye}
                    onChange={(e) => setMikserIrsaliye(e.target.value)}
                    className="makine-input"
                  />
                </div>
              </div>

              {/* Beton Hacmi (Gelen son araç default) */}
              <div className="form-satir">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="alan-baslik">Beton Hacmi (m³):</label>
                  <span className="cetvel-ipucu" style={{ margin: 0 }}>
                    💡 Son gelen araç default seçildi ({mikserHacim} m³)
                  </span>
                </div>

                <div className="makine-turu-haplari" style={{ marginBottom: 8 }}>
                  {[7, 8, 9, 10, 12].map(h => (
                    <button
                      key={h}
                      type="button"
                      className={`makine-chip ${Number(mikserHacim) === h ? 'aktif' : ''}`}
                      onClick={() => setMikserHacim(h)}
                    >
                      {h} m³
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Veya serbest yazın:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="20"
                    value={mikserHacim}
                    onChange={(e) => setMikserHacim(parseFloat(e.target.value) || 0)}
                    className="makine-input"
                    style={{ maxWidth: 120, height: 38 }}
                  />
                  <span style={{ fontWeight: 600 }}>m³</span>
                </div>
              </div>

              <div className="form-satir">
                <label className="alan-baslik">Slump / Kıvam Testi:</label>
                <select
                  value={mikserSlump}
                  onChange={(e) => setMikserSlump(e.target.value)}
                  className="makine-select"
                >
                  <option value="S4 (18-20 cm)">S4 (18-20 cm) Standart Pompalı</option>
                  <option value="S3 (12-15 cm)">S3 (12-15 cm) Katı Kıvam</option>
                  <option value="S5 (21+ cm)">S5 (21+ cm) Akıcı Kıvam</option>
                  <option value="Test Edilmedi">Test Edilmedi</option>
                </select>
              </div>

              {/* Küp Numune Kontrolü */}
              <div className="form-satir">
                <label className="alan-baslik">Numune Küp Alındı mı?</label>
                <div className="giris-tur-anahtari">
                  <button
                    type="button"
                    className={`giris-tur-btn ${mikserKupAlindi ? 'aktif' : ''}`}
                    onClick={() => setMikserKupAlindi(true)}
                  >
                    ✓ Evet (Küp Alındı)
                  </button>
                  <button
                    type="button"
                    className={`giris-tur-btn ${!mikserKupAlindi ? 'aktif' : ''}`}
                    onClick={() => setMikserKupAlindi(false)}
                  >
                    ✕ Hayır
                  </button>
                </div>

                {mikserKupAlindi && (
                  <div style={{ marginTop: 6 }}>
                    <label className="cetvel-alan-etiket">Alınan Küp Sayısı:</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={mikserKupAdet}
                      onChange={(e) => setMikserKupAdet(e.target.value)}
                      className="makine-input kucuk-input"
                    />
                  </div>
                )}
              </div>

              <div className="modal-buton-alani">
                <button type="button" className="modal-iptal-buton" onClick={() => setMikserModalAcik(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="modal-onay-buton">
                  Mikseri Çeteye Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
