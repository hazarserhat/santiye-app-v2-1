import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'

const bugun = () => new Date().toISOString().slice(0, 10)

const KATEGORILER = {
  Kasalar: ['Merkez Kasa', 'Serhat Kasa', 'Abdullah Kasa', 'Fuat Kasa'],
  Bankalar: ['Ziraat', 'QNB', 'Garanti', 'Garanti Havale', 'Emlak Bank Havale'],
  'Kredi Kartları': ['Ziraat Kredi Kartı', 'Garanti Kredi Kartı', 'Qnb Kredi Kartı']
}

const KALDIRILACAKLAR = ['Nakit', 'Şirket Kredi kartı', 'Şirket kredi kartı', 'Malikler Ödedi', 'Kişisel kredi kartı', 'Kişisel Kredi Kartı']

export default function KasaVirmanlar() {
  const { profile } = useAuth()
  
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [dbKasalar, setDbKasalar] = useState([])
  const [gelirler, setGelirler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [kasaIslemleri, setKasaIslemleri] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [bakiyelerGizli, setBakiyelerGizli] = useState(true)

  // Accordion state
  const [acikKategoriler, setAcikKategoriler] = useState({
    Kasalar: false,
    Bankalar: false,
    'Kredi Kartları': false,
    'Ödeme Yapılmadı': false
  })

  // Form State
  const [islemTipi, setIslemTipi] = useState('virman') // 'virman' | 'mutabakat'
  const [cikisKasasi, setCikisKasasi] = useState('')
  const [girisKasasi, setGirisKasasi] = useState('')
  const [mutabakatYonu, setMutabakatYonu] = useState('arti') // 'arti' | 'eksi'
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(bugun())
  const [notMetni, setNotMetni] = useState('')

  useEffect(() => {
    verileriYukle()
  }, [])

  const verileriYukle = async () => {
    // 1. Ödeme yöntemlerini DB'den çek (Masraflarla ID eşleştirmek için)
    const { data: oData } = await supabase.from('odeme_yontemleri').select('*').order('sira')
    const dbGelen = oData || []
    setDbKasalar(dbGelen)
    
    // UI'da gösterilecek tam listeyi sabit KATEGORILER'den oluştur
    let tumKasalar = []
    Object.values(KATEGORILER).forEach(liste => {
      liste.forEach(ad => {
        const dbKarsiligi = dbGelen.find(k => k.ad.toLowerCase() === ad.toLowerCase())
        tumKasalar.push({ ad, id: dbKarsiligi ? dbKarsiligi.id : null })
      })
    })
    
    setOdemeYontemleri(tumKasalar)
    
    // Default değerleri ayarla
    if (tumKasalar.length >= 2) {
      setCikisKasasi(tumKasalar[0].ad)
      setGirisKasasi(tumKasalar[1].ad)
    } else if (tumKasalar.length === 1) {
      setCikisKasasi(tumKasalar[0].ad)
      setGirisKasasi(tumKasalar[0].ad)
    }

    // 2. Gelirleri çek
    const { data: gData } = await supabase.from('gelirler').select('tahsilat_noktasi, tutar')
    setGelirler(gData || [])

    // 3. Masrafları çek
    const { data: mData } = await supabase.from('masraflar').select('odeme_yontemi_id, tutar')
    setMasraflar(mData || [])

    // 4. Kasa işlemlerini (Virman ve Mütabakat) çek
    const { data: kiData } = await supabase
      .from('kasa_islemleri')
      .select('*, profiles(ad_soyad)')
      .order('kayit_tarihi', { ascending: false })
    setKasaIslemleri(kiData || [])
  }

  // Bakiye Hesaplama
  const bakiyeHesapla = (kasaAdi, kasaId) => {
    let toplam = 0
    const lowerKasa = kasaAdi.toLowerCase()
    
    // Gelirlerdeki (Tahsilat Noktası) karşılığını bul (Bankalar için "Ruha " ön eki kullanılıyor)
    let gelirKasaAdi = kasaAdi
    if (lowerKasa === 'ziraat') gelirKasaAdi = 'Ruha Ziraat'
    if (lowerKasa === 'qnb') gelirKasaAdi = 'Ruha QNB'
    if (lowerKasa === 'garanti' || lowerKasa === 'garanti havale') gelirKasaAdi = 'Ruha Garanti'
    if (lowerKasa === 'emlak bank havale') gelirKasaAdi = 'Ruha Emlak Bank'

    // + Gelirler
    gelirler.forEach(g => {
      if (g.tahsilat_noktasi === gelirKasaAdi || g.tahsilat_noktasi === kasaAdi) {
        toplam += Number(g.tutar)
      }
    })

    // - Masraflar (Masraflar sayfasında kasaId 'odeme_yontemi_id' alanında tutuluyor)
    masraflar.forEach(m => {
      if (m.odeme_yontemi_id === kasaId) {
        toplam -= Number(m.tutar)
      }
    })

    // Kasa İşlemleri (Virman ve Mütabakat)
    kasaIslemleri.forEach(islem => {
      if (islem.tip === 'virman') {
        if (islem.giris_noktasi === kasaAdi) toplam += Number(islem.tutar)
        if (islem.cikis_noktasi === kasaAdi) toplam -= Number(islem.tutar)
      } else if (islem.tip === 'mutabakat_arti') {
        if (islem.giris_noktasi === kasaAdi) toplam += Number(islem.tutar)
      } else if (islem.tip === 'mutabakat_eksi') {
        if (islem.cikis_noktasi === kasaAdi) toplam -= Number(islem.tutar)
      }
    })

    return toplam
  }

  const islemKaydet = async () => {
    if (!tutar || Number(temizleTutar(tutar)) <= 0) {
      alert('Geçerli bir tutar giriniz.')
      return
    }

    setYukleniyor(true)
    let tip = islemTipi
    let cikis = null
    let giris = null

    if (islemTipi === 'virman') {
      if (!cikisKasasi || !girisKasasi) {
        alert('Lütfen çıkış ve giriş kasasını seçin.')
        setYukleniyor(false)
        return
      }
      if (cikisKasasi === girisKasasi) {
        alert('Çıkış ve giriş kasası aynı olamaz.')
        setYukleniyor(false)
        return
      }
      cikis = cikisKasasi
      giris = girisKasasi
    } else {
      if (!cikisKasasi) {
        alert('Lütfen kasa seçin.')
        setYukleniyor(false)
        return
      }
      if (mutabakatYonu === 'arti') {
        tip = 'mutabakat_arti'
        giris = cikisKasasi
      } else {
        tip = 'mutabakat_eksi'
        cikis = cikisKasasi
      }
    }

    const { error } = await supabase.from('kasa_islemleri').insert({
      tip,
      cikis_noktasi: cikis,
      giris_noktasi: giris,
      tutar: temizleTutar(tutar),
      tarih,
      not_metni: notMetni,
      ekleyen: profile?.id
    })

    if (error) {
      alert('İşlem kaydedilemedi: ' + error.message)
    } else {
      setTutar('')
      setNotMetni('')
      verileriYukle()
    }
    setYukleniyor(false)
  }

  const islemSil = async (id) => {
    if (!window.confirm('Bu işlemi silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('kasa_islemleri').delete().eq('id', id)
    if (error) {
      alert('Silinemedi: ' + error.message)
    } else {
      verileriYukle()
    }
  }

  const muhasebePaylasimGuncelle = async (id, deger) => {
    const { error } = await supabase.from('kasa_islemleri').update({ muhasebe_paylasim: deger }).eq('id', id)
    if (error) {
      alert("Durum güncellenirken hata oluştu. Lütfen sayfayı yenileyin.\nDetay: " + error.message)
      return
    }
    setKasaIslemleri((onceki) => onceki.map((islem) => islem.id === id ? { ...islem, muhasebe_paylasim: deger } : islem))
  }

  const whatsappGorselliPaylas = (islem) => {
    let baslik = ''
    if (islem.tip === 'virman') {
      baslik = '🔄 VİRMAN (TRANSFER)'
    } else if (islem.tip === 'mutabakat_arti') {
      baslik = '🟢 KASA BÜYÜMESİ (GİRİŞ)'
    } else if (islem.tip === 'mutabakat_eksi') {
      baslik = '🔴 KASA KÜÇÜLMESİ (ÇIKIŞ)'
    }

    const metin = 
      `💰 *KASA İŞLEM BİLDİRİMİ*\n` +
      `📌 *İşlem Tipi:* ${baslik}\n` +
      `💵 *Tutar:* ${paraFormatla(islem.tutar)} ₺\n` +
      (islem.tip === 'virman' ? `📤 *Çıkış Kasası:* ${islem.cikis_noktasi}\n📥 *Giriş Kasası:* ${islem.giris_noktasi}\n` : '') +
      (islem.tip === 'mutabakat_arti' ? `📥 *İlgili Kasa:* ${islem.giris_noktasi}\n` : '') +
      (islem.tip === 'mutabakat_eksi' ? `📤 *İlgili Kasa:* ${islem.cikis_noktasi}\n` : '') +
      `📅 *Tarih:* ${new Date(islem.tarih).toLocaleDateString('tr-TR')}\n` +
      (islem.not_metni ? `📝 *Not:* ${islem.not_metni}\n` : '') +
      `👤 *İşlemi Yapan:* ${islem.profiles?.ad_soyad || 'Bilinmiyor'}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(metin)}`
    window.open(whatsappUrl, '_blank')
  }

  const toggleKategori = (kategoriAd) => {
    setAcikKategoriler(prev => ({
      ...prev,
      [kategoriAd]: !prev[kategoriAd]
    }))
  }

  // Toplam varlık hesabı
  const toplamVarlik = odemeYontemleri.reduce((acc, k) => acc + bakiyeHesapla(k.ad, k.id), 0)

  // Kategorilere ayırma
  const kategorilendirilmisKasalar = {
    Kasalar: [],
    Bankalar: [],
    'Kredi Kartları': []
  }
  
  let odemeYapilmadiKasa = null

  // DB'deki ödeme yapılmadı öğesini bul (Tüm Kasalar harici)
  dbKasalar.forEach(kasa => {
    if (kasa.ad.toLowerCase().includes('ödeme yapılmadı') || kasa.ad.toLowerCase().includes('ödenmedi')) {
      odemeYapilmadiKasa = kasa
    }
  })

  // Sadece KATEGORILER'deki tanımlı olanları dağıtıyoruz
  odemeYontemleri.forEach(kasa => {
    for (const [katAd, liste] of Object.entries(KATEGORILER)) {
      if (liste.map(l => l.toLowerCase()).includes(kasa.ad.toLowerCase())) {
        kategorilendirilmisKasalar[katAd].push(kasa)
        break
      }
    }
  })

  const KategoriCiz = ({ baslik, liste, ikon }) => {
    if (!liste || liste.length === 0) return null
    const acik = acikKategoriler[baslik]

    const kategoriToplami = liste.reduce((acc, k) => acc + bakiyeHesapla(k.ad, k.id), 0)

    return (
      <div style={{ marginBottom: 12 }}>
        <div 
          onClick={() => toggleKategori(baslik)}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(200,200,200,0.5)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            marginBottom: acik ? 8 : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{ikon}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#37474f' }}>{baslik}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: kategoriToplami < 0 ? '#c62828' : '#2e7d32' }}>
              {bakiyelerGizli ? '*** ₺' : `${paraFormatla(kategoriToplami)} ₺`}
            </span>
            <span style={{ fontSize: 12, color: '#90a4ae', transform: acik ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>▼</span>
          </div>
        </div>

        {acik && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: 10,
            paddingLeft: 10 
          }}>
            {liste.map(kasa => {
              const bakiye = bakiyeHesapla(kasa.ad, kasa.id)
              const isEksi = bakiye < 0
              return (
                <div key={kasa.id} style={{
                  background: 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  borderRadius: 8,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  borderLeft: `4px solid ${isEksi ? '#e53935' : '#43a047'}`
                }}>
                  <span style={{ fontSize: 11, color: '#546e7a', fontWeight: 600, marginBottom: 2 }}>{kasa.ad}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: isEksi ? '#c62828' : '#2e7d32' }}>
                    {bakiyelerGizli ? '*** ₺' : `${paraFormatla(bakiye)} ₺`}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sayfa">
      <div className="sayfa-baslik" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🏦 Kasa İşlemleri & Virmanlar</h2>
        <button 
          onClick={() => setBakiyelerGizli(!bakiyelerGizli)}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
          title={bakiyelerGizli ? "Bakiyeleri Göster" : "Bakiyeleri Gizle"}
        >
          {bakiyelerGizli ? '👁️' : '🙈'}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        {/* Toplam Varlık */}
        <div style={{
            background: 'linear-gradient(135deg, rgba(38,166,154,0.1) 0%, rgba(38,166,154,0.2) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(38,166,154,0.3)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            marginBottom: 16
          }}
        >
          <span style={{ fontSize: 13, color: '#00695C', fontWeight: 600, marginBottom: 4 }}>Tüm Bakiyeler Toplamı</span>
          <span style={{ fontSize: 26, fontWeight: 800, color: '#004D40' }}>
            {bakiyelerGizli ? '*** ₺' : `${paraFormatla(toplamVarlik)} ₺`}
          </span>
        </div>

        {odemeYapilmadiKasa && (() => {
          const bakiye = bakiyeHesapla(odemeYapilmadiKasa.ad, odemeYapilmadiKasa.id)
          const isEksi = bakiye < 0
          return (
            <div style={{
              background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
              border: '1px solid #ffcc80',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⏳</span>
                <span style={{ fontSize: 16, color: '#e65100', fontWeight: 700 }}>Ödeme Yapılmadı (Borçlanıldı)</span>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: isEksi ? '#c62828' : '#e65100' }}>
                {bakiyelerGizli ? '*** ₺' : `${paraFormatla(bakiye)} ₺`}
              </span>
            </div>
          )
        })()}

        {/* Kategoriler Accordion */}
        <KategoriCiz baslik="Kasalar" liste={kategorilendirilmisKasalar.Kasalar} ikon="💵" />
        <KategoriCiz baslik="Bankalar" liste={kategorilendirilmisKasalar.Bankalar} ikon="🏦" />
        <KategoriCiz baslik="Kredi Kartları" liste={kategorilendirilmisKasalar['Kredi Kartları']} ikon="💳" />
      </div>

      {/* Yeni İşlem Ekleme Kutusu */}
      <div className="ekleme-kutusu" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
          <button 
            onClick={() => setIslemTipi('virman')}
            style={{
              flex: 1, padding: 10, borderRadius: 8, fontWeight: 600,
              background: islemTipi === 'virman' ? '#e3f2fd' : '#f5f5f5',
              color: islemTipi === 'virman' ? '#1976d2' : '#757575',
              border: `1px solid ${islemTipi === 'virman' ? '#90caf9' : '#e0e0e0'}`
            }}
          >
            🔄 Virman (Transfer)
          </button>
          <button 
            onClick={() => setIslemTipi('mutabakat')}
            style={{
              flex: 1, padding: 10, borderRadius: 8, fontWeight: 600,
              background: islemTipi === 'mutabakat' ? '#f3e5f5' : '#f5f5f5',
              color: islemTipi === 'mutabakat' ? '#8e24aa' : '#757575',
              border: `1px solid ${islemTipi === 'mutabakat' ? '#ce93d8' : '#e0e0e0'}`
            }}
          >
            ⚖️ Kasa Mütabakatı
          </button>
        </div>

        {islemTipi === 'virman' ? (
          <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Çıkış Yapılacak Kasa</label>
              <select value={cikisKasasi} onChange={(e) => setCikisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Giriş Yapılacak Kasa</label>
              <select value={girisKasasi} onChange={(e) => setGirisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>İlgili Kasa</label>
              <select value={cikisKasasi} onChange={(e) => setCikisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>İşlem Yönü</label>
              <select value={mutabakatYonu} onChange={(e) => setMutabakatYonu(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                <option value="arti">🟢 Bakiye Ekle (+)</option>
                <option value="eksi">🔴 Bakiye Çıkar (-)</option>
              </select>
            </div>
          </div>
        )}

        <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tutar (₺)</label>
            <input type="text" placeholder="Tutar..." value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
          </div>
        </div>

        <textarea
          placeholder="İşlem açıklaması / notu..."
          value={notMetni}
          onChange={(e) => setNotMetni(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <button className="ekle-buton-genis" onClick={islemKaydet} disabled={yukleniyor} style={{ marginTop: 8 }}>
          {yukleniyor ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
        </button>
      </div>

      {/* Zaman Çizelgesi (Timeline) */}
      <div className="liste">
        <h3 style={{ fontSize: 14, color: '#2C3E50', marginBottom: 12, paddingLeft: 4 }}>Geçmiş İşlemler</h3>
        
        {kasaIslemleri.map(islem => {
          let renk = '#e0e0e0'
          let baslik = ''
          let ikon = ''
          let bg = '#fff'
          
          if (islem.tip === 'virman') {
            renk = '#2196F3'
            baslik = `${islem.cikis_noktasi} ➔ ${islem.giris_noktasi}`
            ikon = '🔄'
            bg = '#e3f2fd'
          } else if (islem.tip === 'mutabakat_arti') {
            renk = '#4CAF50'
            baslik = `${islem.giris_noktasi} (Ekleme)`
            ikon = '🟢'
            bg = '#e8f5e9'
          } else if (islem.tip === 'mutabakat_eksi') {
            renk = '#F44336'
            baslik = `${islem.cikis_noktasi} (Çıkarma)`
            ikon = '🔴'
            bg = '#ffebee'
          }

          return (
            <div key={islem.id} className="kart" style={{ borderLeft: `4px solid ${renk}`, padding: '12px 16px', background: '#fff' }}>
              <div className="kart-ust" style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, padding: '4px 8px', borderRadius: 6 }}>
                  <span style={{ fontSize: 14 }}>{ikon}</span>
                  <span className="kart-baslik" style={{ fontSize: 13, color: renk, fontWeight: 700 }}>{baslik}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="kart-tutar" style={{ color: '#2C3E50', fontSize: 15, fontWeight: 800 }}>{paraFormatla(islem.tutar)} ₺</span>
                  <button className="sil-buton" onClick={() => islemSil(islem.id)} aria-label="Sil">🗑</button>
                </div>
              </div>
              
              {islem.not_metni && <p className="not-icerik" style={{ margin: '8px 0', fontSize: 13, color: '#455a64' }}>{islem.not_metni}</p>}
              
              <div className="kart-alt-tarih" style={{ fontSize: 11, color: '#888', marginTop: 6, marginBottom: 8 }}>
                <span>{new Date(islem.tarih).toLocaleDateString('tr-TR')}</span>
                <span>Ekleyen: {islem.profiles?.ad_soyad || 'Bilinmiyor'}</span>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Muhasebe Paylaşım Kutucuğu */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 6,
                  background: islem.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
                  border: `1px solid ${islem.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: islem.muhasebe_paylasim ? '#0B6B41' : '#F57F17',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={islem.muhasebe_paylasim || false}
                    onChange={(e) => muhasebePaylasimGuncelle(islem.id, e.target.checked)}
                    style={{ accentColor: '#4CAF50', width: 16, height: 16 }}
                  />
                  {islem.muhasebe_paylasim ? '✓ Muhasebeye gönderildi' : 'Muhasebe ile paylaşıldı mı?'}
                </label>

                {/* WhatsApp Paylaş */}
                <button
                  className="ekle-buton-genis"
                  onClick={() => whatsappGorselliPaylas(islem)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', fontSize: 12 }}
                >
                  💬 WhatsApp ile Paylaş
                </button>
              </div>

            </div>
          )
        })}
        {kasaIslemleri.length === 0 && <p className="bos-mesaj">Henüz kasa işlemi bulunmuyor.</p>}
      </div>

    </div>
  )
}
