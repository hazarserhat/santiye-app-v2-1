import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { paraFormatla } from '../lib/format'

const SAYFALAR = [
  { yol: '/yonetim/santiyeler', ad: 'Şantiye Yönetimi', aciklama: 'Ekleme / düzenleme / silme' },
  { yol: '/yonetim/cek-takip', ad: 'Çek Takip Sayfası', aciklama: 'Sıralanabilir/filtrelenebilir tablo' },
  { yol: '/yonetim/teminatlar/banka', ad: 'Banka Teminat Mektupları', aciklama: '' },
  { yol: '/yonetim/teminatlar/belediye', ad: 'Belediye Teminatları', aciklama: '' },
  { yol: '/yonetim/teminatlar/abonelik', ad: 'Abonelik Bedelleri / Teminatları', aciklama: 'Elektrik / Su / Doğalgaz' },
  { yol: '/yonetim/yapi-kimlik', ad: 'Bina Yapı Kimlik Numaraları', aciklama: '' },
  { yol: '/yonetim/proje-detaylari', ad: 'Proje Detaylı Bilgiler', aciklama: 'Şantiye başına teknik detaylar' },
  { yol: '/yonetim/fatura-bilgileri', ad: 'Fatura Bilgileri', aciklama: 'Elektrik/su sözleşme no' },
  { yol: '/yonetim/yapi-denetim', ad: 'Yapı Denetim Bilgileri', aciklama: '' },
  { yol: '/yonetim/santiye-adresleri', ad: 'Şantiye Adresleri', aciklama: 'Google Maps linkleri' },
  { yol: '/yonetim/yarisi-bizden', ad: 'Yarısı Bizden Ödemeleri', aciklama: 'Devlet desteği takibi' },
  { yol: '/yonetim/proje-gelirleri', ad: 'Proje Gelirleri', aciklama: 'Malik bazlı alacak/ödeme takibi' },
  { yol: '/yonetim/kredi-kartlari', ad: 'Kredi Kartı Ödeme Tarihleri', aciklama: 'Kesim ve son ödeme tarihi takibi' },
]

export default function Yonetim() {
  const { profile } = useAuth()
  const [sekme, setSekme] = useState('menu') // 'menu', 'gelirler', 'giderler'
  const [gizli, setGizli] = useState(true)

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
      <div className="sayfa">
        <p className="bos-mesaj">Bu sayfaya erişim yetkiniz yok.</p>
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

  // Malik Banka (Havale) Detayları
  const malikBankaDetay = {}
  BANKALAR.forEach(b => malikBankaDetay[b] = 0)
  let malikHavaleToplam = 0
  let malikHavaleBuAy = 0

  // Malik Kasa (Nakit) Detayları
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
      // Geri kalanları kasa/nakit kabul et
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
  const gelecekAyinBasi = new Date(simdi.getFullYear(), simdi.getMonth() + 1, 1)

  // HESAPLAMALAR - GİDERLER
  const masrafBuAyListe = masraflar.filter(m => buAyMi(m.harcama_tarihi || m.kayit_tarihi))
  const giderBuAy = masrafBuAyListe.reduce((acc, c) => acc + (c.tutar || 0), 0)
  const giderToplam = masraflar.reduce((acc, c) => acc + (c.tutar || 0), 0)

  // Taksit Hesaplamaları
  const taksitBuAy = masrafBuAyListe
    .filter(m => (m.baslik || '').includes('Taksit)') && (m.odeme_yontemleri?.ad || '').toLowerCase().includes('kart'))
    .reduce((acc, c) => acc + (c.tutar || 0), 0)

  const taksitGelecekAylar = masraflar
    .filter(m => {
       const tarihStr = m.harcama_tarihi || m.kayit_tarihi
       if (!tarihStr) return false
       const tarih = new Date(tarihStr)
       return tarih >= gelecekAyinBasi && (m.baslik || '').includes('Taksit)') && (m.odeme_yontemleri?.ad || '').toLowerCase().includes('kart')
    })
    .reduce((acc, c) => acc + (c.tutar || 0), 0)

  // Gider detayları (Ödeme Yöntemine göre bu ay)
  const giderBuAyDetay = {}
  masrafBuAyListe.forEach(m => {
    const yontem = m.odeme_yontemleri?.ad || 'Diğer'
    giderBuAyDetay[yontem] = (giderBuAyDetay[yontem] || 0) + (m.tutar || 0)
  })

  const GizlenebilirDeger = ({ deger }) => (
    <span>{gizli ? '***.*** ₺' : `${paraFormatla(deger)} ₺`}</span>
  )

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Yönetim</h2>
        <button 
          onClick={() => setGizli(!gizli)}
          style={{ background: 'none', border: '1px solid #D3D1C7', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}
          title={gizli ? "Değerleri Göster" : "Değerleri Gizle"}
        >
          {gizli ? '👁️' : '🔒'}
        </button>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 16 }}>
        <button className={sekme === 'menu' ? 'secili-tab' : ''} onClick={() => setSekme('menu')}>Menü</button>
        <button className={sekme === 'gelirler' ? 'secili-tab' : ''} onClick={() => setSekme('gelirler')}>Gelirler Durumu</button>
        <button className={sekme === 'giderler' ? 'secili-tab' : ''} onClick={() => setSekme('giderler')}>Giderler Durumu</button>
      </div>

      {sekme === 'menu' && (
        <div className="liste">
          {SAYFALAR.map((s) => (
            <Link key={s.yol} to={s.yol} className="kart taseron-satir" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ flex: 1 }}>
                <p className="taseron-ad">{s.ad}</p>
                {s.aciklama && <p className="taseron-firma">{s.aciklama}</p>}
              </div>
              <span className="chevron-buyuk">›</span>
            </Link>
          ))}
        </div>
      )}

      {sekme === 'gelirler' && (
        <div className="kart" style={{ background: '#F8F9FA' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, color: '#0F6E56', display: 'flex', alignItems: 'center', gap: 8 }}>
            📈 Gelirler Durum Bilgisi
          </h3>
          <div className="info-table">
            <div className="info-row" style={{ borderBottom: '2px solid #0F6E56', paddingBottom: 8, marginBottom: 8 }}>
              <span className="info-label" style={{ fontWeight: 800, color: '#0F6E56' }}>MALİKLERDEN GELEN TOPLAM ÖDEME</span> 
              <strong className="info-value" style={{ color: '#0F6E56', fontSize: 16 }}><GizlenebilirDeger deger={malikToplam} /></strong>
            </div>
            <div className="info-row" style={{ paddingLeft: 12, marginBottom: 16 }}>
              <span className="info-label">↳ Bu Ay Gelen Malik Ödemeleri</span> 
              <strong className="info-value"><GizlenebilirDeger deger={malikBuAy} /></strong>
            </div>

            {/* BANKA (HAVALE) DETAYLARI */}
            <div className="info-row" style={{ marginTop: 12, borderBottom: '1px solid #d1eae2', paddingBottom: 6, marginBottom: 6 }}>
              <span className="info-label" style={{ fontWeight: 700 }}>Maliklerden Gelen Toplam Havale (Banka)</span> 
              <strong className="info-value"><GizlenebilirDeger deger={malikHavaleToplam} /></strong>
            </div>
            <div className="info-row" style={{ paddingLeft: 12, marginBottom: 8 }}>
              <span className="info-label" style={{ fontSize: 12, color: '#888' }}>↳ Sadece Bu Ayki Havaleler:</span> 
              <strong className="info-value" style={{ fontSize: 13, color: '#888' }}><GizlenebilirDeger deger={malikHavaleBuAy} /></strong>
            </div>
            
            {Object.entries(malikBankaDetay).map(([banka, tutar]) => (
              <div key={banka} className="info-row" style={{ paddingLeft: 20 }}>
                <span className="info-label" style={{ fontSize: 13 }}>🏦 {banka}:</span>
                <strong className="info-value" style={{ fontSize: 14 }}><GizlenebilirDeger deger={tutar} /></strong>
              </div>
            ))}

            {/* KASA (NAKİT) DETAYLARI */}
            <div className="info-row" style={{ marginTop: 24, borderBottom: '1px solid #d1eae2', paddingBottom: 6, marginBottom: 6 }}>
              <span className="info-label" style={{ fontWeight: 700 }}>Maliklerden Gelen Nakit / Elden Ödeme</span> 
              <strong className="info-value"><GizlenebilirDeger deger={malikNakitToplam} /></strong>
            </div>
            <div className="info-row" style={{ paddingLeft: 12, marginBottom: 8 }}>
              <span className="info-label" style={{ fontSize: 12, color: '#888' }}>↳ Sadece Bu Ayki Nakitler:</span> 
              <strong className="info-value" style={{ fontSize: 13, color: '#888' }}><GizlenebilirDeger deger={malikNakitBuAy} /></strong>
            </div>
            
            {Object.entries(malikKasaDetay).map(([kasa, tutar]) => (
              <div key={kasa} className="info-row" style={{ paddingLeft: 20 }}>
                <span className="info-label" style={{ fontSize: 13 }}>💵 {kasa}:</span>
                <strong className="info-value" style={{ fontSize: 14 }}><GizlenebilirDeger deger={tutar} /></strong>
              </div>
            ))}

            {/* ÇEKLER */}
            <div className="info-row" style={{ marginTop: 24, borderTop: '2px solid #e0e0e0', paddingTop: 12 }}>
              <span className="info-label" style={{ fontWeight: 700 }}>Toplam Alınan Çek Miktarı (Genel Toplam)</span> 
              <strong className="info-value" style={{ fontSize: 16 }}><GizlenebilirDeger deger={cekToplam} /></strong>
            </div>
            <div className="info-row" style={{ paddingLeft: 12 }}>
              <span className="info-label">↳ Sadece Bu Ay Alınan Çekler</span> 
              <strong className="info-value"><GizlenebilirDeger deger={cekBuAy} /></strong>
            </div>
          </div>
        </div>
      )}

      {sekme === 'giderler' && (
        <div className="kart" style={{ background: '#FDF7F7' }}>
          <h3 style={{ marginTop: 0, marginBottom: 16, color: '#D64545', display: 'flex', alignItems: 'center', gap: 8 }}>
            📉 Giderler Durum Bilgisi
          </h3>
          <div className="info-table">
            <div className="info-row" style={{ borderBottom: '2px solid #f0cdcd', paddingBottom: 8, marginBottom: 8 }}><span className="info-label" style={{ fontWeight: 700 }}>Bu ayki tüm harcamalar (Toplam)</span> <strong className="info-value" style={{ color: '#D64545', fontSize: 16 }}><GizlenebilirDeger deger={giderBuAy} /></strong></div>
            <div className="info-row" style={{ paddingLeft: 12 }}><span className="info-label">↳ Bu ayki taksit ödemeleri toplamı</span> <strong className="info-value"><GizlenebilirDeger deger={taksitBuAy} /></strong></div>
            
            <div className="info-row" style={{ marginTop: 12, borderTop: '2px solid #f0cdcd', paddingTop: 12, marginBottom: 8 }}><span className="info-label" style={{ fontWeight: 700, color: '#E65100' }}>Geriye kalan taksitler toplamı (Gelecek Aylar)</span> <strong className="info-value" style={{ color: '#E65100', fontSize: 16 }}><GizlenebilirDeger deger={taksitGelecekAylar} /></strong></div>
            
            <div className="info-row" style={{ marginTop: 12, borderTop: '1px dashed #f0cdcd', paddingTop: 8 }}><span className="info-label">Tüm zamanlar harcamalar (Genel Toplam)</span> <strong className="info-value"><GizlenebilirDeger deger={giderToplam} /></strong></div>

            <div className="info-row" style={{ marginTop: 16, borderTop: '2px solid #e0e0e0', paddingTop: 12, marginBottom: 8 }}><span className="info-label" style={{ fontWeight: 700 }}>Ödeme Yöntemlerine Göre Giderler (Bu Ay)</span></div>
            {Object.entries(giderBuAyDetay).sort((a,b) => b[1] - a[1]).map(([yontem, tutar]) => (
              <div key={yontem} className="info-row" style={{ paddingLeft: 12 }}>
                <span className="info-label" style={{ fontSize: 13, color: '#888' }}>↳ {yontem} ile:</span>
                <strong className="info-value" style={{ fontSize: 14, color: '#D64545' }}><GizlenebilirDeger deger={tutar} /></strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .info-table { display: flex; flex-direction: column; gap: 8px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
        .info-label { color: #5F5E5A; font-size: 14px; }
        .info-value { font-size: 15px; font-family: monospace; }
      `}</style>
    </div>
  )
}
