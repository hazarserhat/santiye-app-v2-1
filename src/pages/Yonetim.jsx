import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { paraFormatla } from '../lib/format'

const DEFAULT_SAYFALAR = [
  { yol: '/yonetim/proje-dosyalari', ad: 'Proje & Yönetim Dosyaları', aciklama: 'Sözleşme, vekalet, harita arşivi', ikon: '📁' },
  { yol: '/yonetim/santiyeler', ad: 'Şantiye Yönetimi', aciklama: 'Ekleme / düzenleme / silme', ikon: '🏗️' },
  { yol: '/yonetim/cek-takip', ad: 'Çek Takip Sayfası', aciklama: 'Sıralanabilir/filtrelenebilir tablo', ikon: '🏦' },
  { yol: '/yonetim/teminatlar/banka', ad: 'Banka Teminat Mektupları', aciklama: '', ikon: '📜' },
  { yol: '/yonetim/teminatlar/belediye', ad: 'Belediye Teminatları', aciklama: '', ikon: '🏛️' },
  { yol: '/yonetim/teminatlar/abonelik', ad: 'Abonelik Bedelleri / Teminatları', aciklama: 'Elektrik / Su / Doğalgaz', ikon: '🔌' },
  { yol: '/yonetim/yapi-kimlik', ad: 'Bina Yapı Kimlik Numaraları', aciklama: '', ikon: '🏢' },
  { yol: '/yonetim/proje-detaylari', ad: 'Proje Detaylı Bilgiler', aciklama: 'Şantiye başına teknik detaylar', ikon: '📋' },
  { yol: '/yonetim/fatura-bilgileri', ad: 'Fatura Bilgileri', aciklama: 'Elektrik/su sözleşme no', ikon: '🧾' },
  { yol: '/yonetim/yapi-denetim', ad: 'Yapı Denetim Bilgileri', aciklama: '', ikon: '🔍' },
  { yol: '/yonetim/santiye-adresleri', ad: 'Şantiye Adresleri', aciklama: 'Google Maps linkleri', ikon: '📍' },
  { yol: '/yonetim/yarisi-bizden', ad: 'Yarısı Bizden Ödemeleri', aciklama: 'Devlet desteği takibi', ikon: '🤝' },
  { yol: '/yonetim/proje-gelirleri', ad: 'Proje Gelirleri', aciklama: 'Malik bazlı alacak/ödeme takibi', ikon: '💰' },
  { yol: '/yonetim/kredi-kartlari', ad: 'Kredi Kartı Ödeme Tarihleri', aciklama: 'Kesim ve son ödeme tarihi takibi', ikon: '💳' },
]

export default function Yonetim() {
  const { profile } = useAuth()
  const [sekme, setSekme] = useState('menu') // 'menu', 'gelirler', 'giderler'
  const [gizli, setGizli] = useState(true)

  // DRAG & DROP İÇİN STATE VE REFLER
  const [sayfalar, setSayfalar] = useState(() => {
    try {
      const kayitli = localStorage.getItem('yonetimSiralama')
      if (kayitli) {
        const yollar = JSON.parse(kayitli)
        const sirali = []
        yollar.forEach(yol => {
          const bul = DEFAULT_SAYFALAR.find(s => s.yol === yol)
          if (bul) sirali.push(bul)
        })
        DEFAULT_SAYFALAR.forEach(s => {
          if (!yollar.includes(s.yol)) sirali.push(s)
        })
        return sirali
      }
    } catch(e) {}
    return DEFAULT_SAYFALAR
  })

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    let _sayfalar = [...sayfalar]
    const draggedItemContent = _sayfalar.splice(dragItem.current, 1)[0]
    _sayfalar.splice(dragOverItem.current, 0, draggedItemContent)
    
    dragItem.current = null
    dragOverItem.current = null
    
    setSayfalar(_sayfalar)
    localStorage.setItem('yonetimSiralama', JSON.stringify(_sayfalar.map(s => s.yol)))
  }

  // Gelir Datası
  const [gelirler, setGelirler] = useState([])
  const [alinanCekler, setAlinanCekler] = useState([])

  // Gider Datası
  const [masraflar, setMasraflar] = useState([])

  useEffect(() => {
    if (profile?.sistem_yoneticisi) {
      verileriYukle()
    }
  }, [profile])

  const verileriYukle = async () => {
    const { data: gData } = await supabase.from('gelirler').select('*')
    const { data: cData } = await supabase.from('cekler').select('*').eq('yon', 'alinan')
    const { data: mData } = await supabase.from('masraflar').select('*, odeme_yontemleri(ad)')
    
    if (gData) setGelirler(gData)
    if (cData) setAlinanCekler(cData)
    if (mData) setMasraflar(mData)
  }

  if (!profile?.sistem_yoneticisi) {
    return (
      <div className="premium-page-yonetim">
        <p style={{ textAlign: 'center', marginTop: 40, color: '#64748b', fontSize: 16 }}>Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    )
  }

  const suAn = new Date()
  const buAy = suAn.getMonth()
  const buYil = suAn.getFullYear()

  const buAyMi = (tarihStr) => {
    if (!tarihStr) return false
    const d = new Date(tarihStr)
    return d.getMonth() === buAy && d.getFullYear() === buYil
  }

  // HESAPLAMALAR - GELİRLER
  const malikGelirleri = gelirler.filter(g => g.malik_id != null)
  const ortakGelirleri = gelirler.filter(g => g.malik_id == null)

  const malikBuAy = malikGelirleri.filter(g => buAyMi(g.tarih)).reduce((acc, c) => acc + (c.tutar || 0), 0)
  const malikToplam = malikGelirleri.reduce((acc, c) => acc + (c.tutar || 0), 0)

  // Tahsilat Noktası Grupları
  const BANKALAR = ['Ruha Ziraat', 'Ruha QNB', 'Ruha Garanti']
  const KASALAR = ['Serhat Kasa', 'Fuat Kasa', 'Abdullah Kasa', 'Merkez Kasa', 'Şantiye Şefleri', 'Elden / Belirtilmeyen']

  const malikBankaDetay = {}
  BANKALAR.forEach(b => malikBankaDetay[b] = 0)
  let malikHavaleToplam = 0
  let malikHavaleBuAy = 0

  const malikKasaDetay = {}
  KASALAR.forEach(k => malikKasaDetay[k] = 0)
  let malikNakitToplam = 0
  let malikNakitBuAy = 0

  malikGelirleri.forEach(g => {
    const tutar = g.tutar || 0
    const nokta = g.tahsilat_noktasi || 'Elden / Belirtilmeyen'
    const isBuAy = buAyMi(g.tarih)

    if (BANKALAR.includes(nokta)) {
      malikBankaDetay[nokta] += tutar
      malikHavaleToplam += tutar
      if (isBuAy) malikHavaleBuAy += tutar
    } else {
      if (malikKasaDetay[nokta] === undefined) malikKasaDetay[nokta] = 0
      malikKasaDetay[nokta] += tutar
      malikNakitToplam += tutar
      if (isBuAy) malikNakitBuAy += tutar
    }
  })

  // Çekler
  const cekBuAy = alinanCekler.filter(c => buAyMi(c.created_at)).reduce((acc, c) => acc + (c.tutar || 0), 0)
  const cekToplam = alinanCekler.reduce((acc, c) => acc + (c.tutar || 0), 0)

  const simdi = new Date()

  // HESAPLAMALAR - GİDERLER
  const masrafBuAyListe = masraflar.filter(m => buAyMi(m.harcama_tarihi || m.kayit_tarihi))
  const giderBuAy = masrafBuAyListe.reduce((acc, c) => acc + (c.tutar || 0), 0)
  const giderToplam = masraflar.reduce((acc, c) => acc + (c.tutar || 0), 0)

  // Taksit Hesaplamaları
  let taksitBuAy = 0
  let taksitGelecekAylar = 0
  const aktifTaksitliIslemler = []

  masraflar.forEach(m => {
    if (m.taksit_sayisi && m.taksit_sayisi > 1) {
      const islemTarihi = new Date(m.harcama_tarihi || m.kayit_tarihi)
      if (!islemTarihi || isNaN(islemTarihi.getTime())) return

      const aylikTutar = m.tutar / m.taksit_sayisi
      const ayFarki = (simdi.getFullYear() - islemTarihi.getFullYear()) * 12 + (simdi.getMonth() - islemTarihi.getMonth())
      
      const odenenTaksitSayisi = Math.min(Math.max(ayFarki + 1, 0), m.taksit_sayisi)
      const kalanTaksitSayisi = m.taksit_sayisi - odenenTaksitSayisi

      if (ayFarki >= 0 && ayFarki < m.taksit_sayisi) {
        taksitBuAy += aylikTutar
      }

      if (kalanTaksitSayisi > 0) {
        taksitGelecekAylar += aylikTutar * kalanTaksitSayisi
        aktifTaksitliIslemler.push({
          baslik: m.baslik, aylikTutar, kalanTaksitSayisi, toplamTaksit: m.taksit_sayisi, kalanBorc: aylikTutar * kalanTaksitSayisi
        })
      }
    }
  })

  // Gider detayları
  const giderBuAyDetay = {}
  masrafBuAyListe.forEach(m => {
    const yontem = m.odeme_yontemleri?.ad || 'Diğer'
    giderBuAyDetay[yontem] = (giderBuAyDetay[yontem] || 0) + (m.tutar || 0)
  })

  const GizlenebilirDeger = ({ deger }) => (
    <span>{gizli ? '***.*** ₺' : `${paraFormatla(deger)} ₺`}</span>
  )

  return (
    <div className="premium-page-yonetim">
      <style>{`
        .premium-page-yonetim {
          animation: drvFadeIn 0.4s ease-out;
          max-width: 1200px;
          margin: 0 auto;
        }
        .yonetim-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .yonetim-title {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .yonetim-tabs {
          display: inline-flex;
          background: #f1f5f9;
          padding: 6px;
          border-radius: 16px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .yonetim-tab {
          padding: 10px 24px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          color: #64748b;
        }
        .yonetim-tab.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .premium-menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .premium-menu-card {
          background: linear-gradient(145deg, #ffffff, #f8fafc);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-decoration: none;
          color: inherit;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          cursor: grab;
        }
        .premium-menu-card:active {
          cursor: grabbing;
        }
        .premium-menu-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -3px rgba(0,0,0,0.08);
          border-color: #cbd5e1;
        }
        .menu-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-right: 16px;
        }
        .menu-card-content { flex: 1; }
        .menu-card-title {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }
        .menu-card-desc {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }
        .menu-card-drag-icon {
          color: #cbd5e1;
          font-size: 20px;
          font-weight: 900;
          transition: all 0.2s;
          cursor: grab;
        }
        .premium-menu-card:hover .menu-card-drag-icon {
          color: #94a3b8;
        }

        .stat-card-gelir {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.1);
        }
        .stat-card-gider {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1px solid #fecaca;
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.1);
        }
        .info-table { display: flex; flex-direction: column; gap: 12px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; }
        .info-label { color: #475569; font-size: 14px; font-weight: 500; }
        .info-value { font-size: 16px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; }
        
        .g-divider { border-bottom: 2px solid rgba(22, 163, 74, 0.2); padding-bottom: 12px; margin-bottom: 12px; }
        .g-text { color: #16a34a; }
        .g-sub { padding-left: 16px; border-left: 2px solid rgba(22, 163, 74, 0.2); margin-bottom: 12px; }

        .r-divider { border-bottom: 2px solid rgba(220, 38, 38, 0.2); padding-bottom: 12px; margin-bottom: 12px; }
        .r-text { color: #dc2626; }
        .r-sub { padding-left: 16px; border-left: 2px solid rgba(220, 38, 38, 0.2); margin-bottom: 12px; }

        .btn-gizle {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: all 0.2s;
        }
        .btn-gizle:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        
        @keyframes drvFadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="yonetim-header">
        <h2 className="yonetim-title">Yönetim Paneli</h2>
        <button className="btn-gizle" onClick={() => setGizli(!gizli)} title={gizli ? "Değerleri Göster" : "Değerleri Gizle"}>
          {gizli ? '👁️ Göster' : '🔒 Gizle'}
        </button>
      </div>

      <div className="yonetim-tabs">
        <button className={`yonetim-tab ${sekme === 'menu' ? 'active' : ''}`} onClick={() => setSekme('menu')}>Modüller Menüsü</button>
        <button className={`yonetim-tab ${sekme === 'gelirler' ? 'active' : ''}`} onClick={() => setSekme('gelirler')}>📈 Gelirler Durumu</button>
        <button className={`yonetim-tab ${sekme === 'giderler' ? 'active' : ''}`} onClick={() => setSekme('giderler')}>📉 Giderler Durumu</button>
      </div>

      {sekme === 'menu' && (
        <div className="premium-menu-grid">
          {sayfalar.map((s, index) => (
            <Link 
              key={s.yol} 
              to={s.yol} 
              className="premium-menu-card"
              draggable
              onDragStart={(e) => { dragItem.current = index; e.target.style.opacity = '0.5' }}
              onDragEnter={(e) => { dragOverItem.current = index }}
              onDragEnd={(e) => { handleSort(); e.target.style.opacity = '1' }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="menu-card-icon">{s.ikon}</div>
              <div className="menu-card-content">
                <h4 className="menu-card-title">{s.ad}</h4>
                {s.aciklama && <p className="menu-card-desc">{s.aciklama}</p>}
              </div>
              <span className="menu-card-drag-icon">⋮⋮</span>
            </Link>
          ))}
        </div>
      )}

      {sekme === 'gelirler' && (
        <div className="stat-card-gelir">
          <h3 style={{ marginTop: 0, marginBottom: 24, color: '#15803d', fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📈</span> Gelirler Durum Raporu
          </h3>
          <div className="info-table">
            <div className="info-row g-divider">
              <span className="info-label" style={{ fontWeight: 800, color: '#16a34a' }}>MALİKLERDEN GELEN TOPLAM ÖDEME</span> 
              <strong className="info-value g-text" style={{ fontSize: 18 }}><GizlenebilirDeger deger={malikToplam} /></strong>
            </div>
            <div className="info-row g-sub">
              <span className="info-label">↳ Bu Ay Gelen Malik Ödemeleri</span> 
              <strong className="info-value"><GizlenebilirDeger deger={malikBuAy} /></strong>
            </div>

            {/* BANKA (HAVALE) DETAYLARI */}
            <div className="info-row" style={{ marginTop: 24, borderBottom: '1px dashed #86efac', paddingBottom: 8, marginBottom: 8 }}>
              <span className="info-label" style={{ fontWeight: 700, color: '#15803d' }}>Maliklerden Gelen Toplam Havale (Banka)</span> 
              <strong className="info-value g-text"><GizlenebilirDeger deger={malikHavaleToplam} /></strong>
            </div>
            <div className="info-row g-sub" style={{ marginBottom: 12 }}>
              <span className="info-label" style={{ fontSize: 13, color: '#059669' }}>↳ Sadece Bu Ayki Havaleler:</span> 
              <strong className="info-value" style={{ fontSize: 14, color: '#059669' }}><GizlenebilirDeger deger={malikHavaleBuAy} /></strong>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
              {Object.entries(malikBankaDetay).map(([banka, tutar]) => (
                <div key={banka} style={{ background: 'rgba(255,255,255,0.6)', padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>🏦 {banka}</span>
                  <strong style={{ fontSize: 14, color: '#15803d', fontFamily: 'monospace' }}><GizlenebilirDeger deger={tutar} /></strong>
                </div>
              ))}
            </div>

            {/* KASA (NAKİT) DETAYLARI */}
            <div className="info-row" style={{ marginTop: 24, borderBottom: '1px dashed #86efac', paddingBottom: 8, marginBottom: 8 }}>
              <span className="info-label" style={{ fontWeight: 700, color: '#15803d' }}>Maliklerden Gelen Nakit / Elden Ödeme</span> 
              <strong className="info-value g-text"><GizlenebilirDeger deger={malikNakitToplam} /></strong>
            </div>
            <div className="info-row g-sub" style={{ marginBottom: 12 }}>
              <span className="info-label" style={{ fontSize: 13, color: '#059669' }}>↳ Sadece Bu Ayki Nakitler:</span> 
              <strong className="info-value" style={{ fontSize: 14, color: '#059669' }}><GizlenebilirDeger deger={malikNakitBuAy} /></strong>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, marginBottom: 16 }}>
              {Object.entries(malikKasaDetay).map(([kasa, tutar]) => (
                <div key={kasa} style={{ background: 'rgba(255,255,255,0.6)', padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>💵 {kasa}</span>
                  <strong style={{ fontSize: 14, color: '#15803d', fontFamily: 'monospace' }}><GizlenebilirDeger deger={tutar} /></strong>
                </div>
              ))}
            </div>

            {/* ÇEKLER */}
            <div className="info-row" style={{ marginTop: 24, borderTop: '2px solid rgba(22, 163, 74, 0.3)', paddingTop: 16 }}>
              <span className="info-label" style={{ fontWeight: 800, color: '#15803d' }}>Toplam Alınan Çek Miktarı (Genel Toplam)</span> 
              <strong className="info-value g-text" style={{ fontSize: 18 }}><GizlenebilirDeger deger={cekToplam} /></strong>
            </div>
            <div className="info-row g-sub">
              <span className="info-label">↳ Sadece Bu Ay Alınan Çekler</span> 
              <strong className="info-value"><GizlenebilirDeger deger={cekBuAy} /></strong>
            </div>
          </div>
        </div>
      )}

      {sekme === 'giderler' && (
        <div className="stat-card-gider">
          <h3 style={{ marginTop: 0, marginBottom: 24, color: '#b91c1c', fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📉</span> Giderler Durum Raporu
          </h3>
          <div className="info-table">
            <div className="info-row r-divider">
              <span className="info-label" style={{ fontWeight: 800, color: '#dc2626' }}>BU AYKİ TÜM HARCAMALAR (TOPLAM)</span> 
              <strong className="info-value r-text" style={{ fontSize: 18 }}><GizlenebilirDeger deger={giderBuAy} /></strong>
            </div>
            <div className="info-row r-sub">
              <span className="info-label">↳ Bu ayki taksit ödemeleri toplamı</span> 
              <strong className="info-value"><GizlenebilirDeger deger={taksitBuAy} /></strong>
            </div>
            
            <div className="info-row" style={{ marginTop: 16, borderBottom: '1px dashed #fca5a5', paddingBottom: 8, marginBottom: 8 }}>
              <span className="info-label" style={{ fontWeight: 800, color: '#ea580c' }}>KALAN TAKSİTLER TOPLAMI (GELECEK AYLAR)</span> 
              <strong className="info-value" style={{ color: '#ea580c', fontSize: 18 }}><GizlenebilirDeger deger={taksitGelecekAylar} /></strong>
            </div>
            
            {/* DEVAM EDEN TAKSİTLER DETAY LİSTESİ */}
            {aktifTaksitliIslemler.length > 0 && (
              <div style={{ padding: '16px', background: '#fff7ed', borderRadius: 16, border: '1px solid #ffedd5', marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#ea580c', fontWeight: 700 }}>⏳ Kalan Taksit Detayları:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aktifTaksitliIslemler.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, background: 'rgba(255,255,255,0.7)', padding: '10px 14px', borderRadius: 8 }}>
                      <span style={{ color: '#431407', fontWeight: 600, flex: 1 }}>{t.baslik}</span>
                      <span style={{ color: '#ea580c', fontWeight: 700, margin: '0 16px', background: '#ffedd5', padding: '4px 8px', borderRadius: 6 }}>{t.kalanTaksitSayisi}/{t.toplamTaksit} Taksit</span>
                      <span style={{ fontFamily: 'monospace', color: '#9a3412', fontWeight: 700 }}><GizlenebilirDeger deger={t.kalanBorc} /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="info-row" style={{ marginTop: 24, borderTop: '2px solid rgba(220, 38, 38, 0.3)', paddingTop: 16 }}>
              <span className="info-label" style={{ fontWeight: 800, color: '#b91c1c' }}>TÜM ZAMANLAR HARCAMALAR (GENEL TOPLAM)</span> 
              <strong className="info-value r-text" style={{ fontSize: 18 }}><GizlenebilirDeger deger={giderToplam} /></strong>
            </div>

            <div className="info-row" style={{ marginTop: 32, marginBottom: 12 }}>
              <span className="info-label" style={{ fontWeight: 700, color: '#991b1b', fontSize: 15 }}>💳 Ödeme Yöntemlerine Göre Giderler (Bu Ay)</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {Object.entries(giderBuAyDetay).sort((a,b) => b[1] - a[1]).map(([yontem, tutar]) => (
                <div key={yontem} style={{ background: 'rgba(255,255,255,0.8)', padding: '12px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fee2e2' }}>
                  <span style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 600 }}>{yontem}</span>
                  <strong style={{ fontSize: 14, color: '#dc2626', fontFamily: 'monospace' }}><GizlenebilirDeger deger={tutar} /></strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
