import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

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
]

export default function Yonetim() {
  const { profile } = useAuth()

  if (!profile?.sistem_yoneticisi) {
    return (
      <div className="sayfa">
        <p className="bos-mesaj">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="sayfa">
      <h2>Yönetim</h2>
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
    </div>
  )
}
