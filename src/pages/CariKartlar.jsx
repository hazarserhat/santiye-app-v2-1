import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function CariKartlar() {
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  const [taseronlar, setTaseronlar] = useState([])
  const [seciliId, setSeciliId] = useState(null)

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*').order('ad')
    // Eğer şantiye şefi ise sadece izin verilenleri görsün
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data } = await query
    setTaseronlar(data || [])
  }

  // Şantiye şefi görünürlük ayarını güncelle
  const gorunurlukDegistir = async (id, mevcutDurum) => {
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ sef_gorunur: !mevcutDurum })
      .eq('id', id)
    
    if (error) {
      alert('Hata oluştu: ' + error.message)
    } else {
      taseronlariYukle()
    }
  }

  // Cari hesabı silme fonksiyonu (Sadece Yönetici)
  const taseronSil = async (id, e) => {
    e.stopPropagation() // Kartın tıklama olayını engeller
    if (!window.confirm('Bu cari hesap kaydını silmek istediğinize emin misiniz?')) return

    const { error } = await supabase
      .from('taseronlar')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Silme işlemi başarısız: ' + error.message)
    } else {
      taseronlariYukle()
      if (seciliId === id) setSeciliId(null)
    }
  }

  return (
    <div className="sayfa">
      <h2>Cari Hesaplar</h2>
      <div className="liste">
        {taseronlar.map((t) => (
          <div key={t.id} className="kart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600 }}>{t.ad}</p>
              <p style={{ fontSize: 12, color: '#666' }}>{t.firma}</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
              {yonetici && (
                <>
                  <label style={{ cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={t.sef_gorunur || false} 
                      onChange={() => gorunurlukDegistir(t.id, t.sef_gorunur)}
                    /> Şef Görebilir
                  </label>
                  
                  <button 
                    onClick={(e) => taseronSil(t.id, e)} 
                    style={{ background: '#ffe6e6', color: '#d9534f', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    aria-label="Cari sil"
                  >
                    🗑 Sil
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}