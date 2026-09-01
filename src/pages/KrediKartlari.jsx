import React from 'react'
import { useNavigate } from 'react-router-dom'

const addDaysAndFindNextBusinessDay = (date, addDays) => {
  let result = new Date(date)
  result.setDate(result.getDate() + addDays)
  
  // 0 = Pazar, 6 = Cumartesi
  if (result.getDay() === 6) { // Cumartesi ise Pazartesiye atla
    result.setDate(result.getDate() + 2)
  } else if (result.getDay() === 0) { // Pazar ise Pazartesiye atla
    result.setDate(result.getDate() + 1)
  }
  return result
}

const getNextCutoffDate = (cutoffDay) => {
  const now = new Date()
  let cutoffDate = new Date(now.getFullYear(), now.getMonth(), cutoffDay)
  
  // Eğer bugünün tarihi kesim tarihini geçmişse, bir sonraki ayın aynı gününü al
  if (now > cutoffDate) {
    cutoffDate = new Date(now.getFullYear(), now.getMonth() + 1, cutoffDay)
  }
  return cutoffDate
}

export default function KrediKartlari() {
  const bankalar = [
    {
      ad: 'Ziraat Kredi Kartı',
      renk: '#E53935',
      arkaplan: '#FFEBEE',
      logo: '🏦',
      kesimGunu: 19,
      odemeGecikmesi: 10
    },
    {
      ad: 'QNB Kredi Kartı',
      renk: '#1E88E5',
      arkaplan: '#E3F2FD',
      logo: '💳',
      kesimGunu: 13,
      odemeGecikmesi: 5
    },
    {
      ad: 'Garanti Kredi Kartı',
      renk: '#43A047',
      arkaplan: '#E8F5E9',
      logo: '🍀',
      kesimGunu: 13,
      odemeGecikmesi: 5
    }
  ]

  const navigate = useNavigate()

  return (
    <div className="sayfa">
      <div style={{ marginBottom: 20 }}>
        <button 
          onClick={() => navigate('/yonetim')} 
          style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#F1EFE8', border: '1px solid #D3D1C7', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#5F5E5A', fontWeight: 600 }}
        >
          ‹ Yönetim Menüsüne Dön
        </button>
        <h2 style={{ margin: 0, marginBottom: 8 }}>Kredi Kartı Ödeme Tarihleri</h2>
        <p style={{ color: '#5F5E5A', fontSize: 13, margin: 0 }}>
          Kartlarınızın bir sonraki kesim ve son ödeme tarihlerini buradan takip edebilirsiniz.
          Son ödeme tarihleri otomatik olarak hafta sonuna denk geldiğinde ilk iş gününe (Pazartesi) kaydırılmaktadır.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {bankalar.map((banka, i) => {
          const kesimTarihi = getNextCutoffDate(banka.kesimGunu)
          const sonOdemeTarihi = addDaysAndFindNextBusinessDay(kesimTarihi, banka.odemeGecikmesi)

          // Tarihi formatlamak için yardımcılar
          const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
          const kesimStr = kesimTarihi.toLocaleDateString('tr-TR', options)
          const sonOdemeStr = sonOdemeTarihi.toLocaleDateString('tr-TR', options)
          
          // Kaç gün kaldı hesaplaması
          const simdi = new Date()
          const msPerDay = 1000 * 60 * 60 * 24
          
          // Son ödemeye kalan gün
          const kalanGun = Math.ceil((sonOdemeTarihi.getTime() - simdi.getTime()) / msPerDay)
          
          return (
            <div key={i} className="kart" style={{ borderLeft: `6px solid ${banka.renk}`, backgroundColor: banka.arkaplan }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{banka.logo}</span>
                <h3 style={{ margin: 0, color: banka.renk }}>{banka.ad}</h3>
              </div>
              
              <div className="info-row" style={{ paddingLeft: 0, marginBottom: 8 }}>
                <span className="info-label" style={{ fontWeight: 600 }}>Kesim Tarihi (Ayın {banka.kesimGunu}'u):</span> 
                <strong className="info-value" style={{ color: '#333' }}>{kesimStr}</strong>
              </div>
              
              <div className="info-row" style={{ paddingLeft: 0, marginBottom: 12 }}>
                <span className="info-label" style={{ fontWeight: 600 }}>Son Ödeme Tarihi (+{banka.odemeGecikmesi} Gün):</span> 
                <strong className="info-value" style={{ color: banka.renk, fontSize: 15 }}>{sonOdemeStr}</strong>
              </div>
              
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(0,0,0,0.1)', textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: kalanGun <= 3 ? '#E53935' : (kalanGun <= 7 ? '#FB8C00' : '#43A047'), padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.6)' }}>
                  Son Ödemeye {kalanGun} Gün Kaldı
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
