import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { paraFormatla } from '../lib/format'

export default function CariKartlar() {
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  
  const [taseronlar, setTaseronlar] = useState([])
  const [seciliId, setSeciliId] = useState(null)
  const [taseron, setTaseron] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [notlar, setNotlar] = useState([])
  const [yeniNot, setYeniNot] = useState('')

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*').order('ad')
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data } = await query
    setTaseronlar(data || [])
  }

  const detayYukle = async (id) => {
    setSeciliId(id)
    
    // Taşeron kartı bilgisi
    const { data: tData } = await supabase.from('taseronlar').select('*').eq('id', id).single()
    setTaseron(tData)

    // Hakedişler ve Masraflar (Timeline için)
    const { data: hakedisler } = await supabase.from('hakedisler').select('*').eq('taseron_id', id)
    const { data: masraflar } = await supabase.from('masraflar').select('*, masraf_kategorileri(ad), odeme_yontemleri(ad)').eq('cari_id', id)

    const birlesik = [
      ...(hakedisler || []).map(h => ({ ...h, tip: 'hakedis', sortKey: new Date(h.created_at).getTime() })),
      ...(masraflar || []).map(m => ({ ...m, tip: 'masraf', sortKey: new Date(m.kayit_tarihi || m.created_at).getTime() }))
    ].sort((a, b) => b.sortKey - a.sortKey)

    setTimeline(birlesik)

    // Notlar
    const { data: nData } = await supabase.from('taseron_notlari').select('*').eq('taseron_id', id).order('created_at', { ascending: false })
    setNotlar(nData || [])
  }

  const gorunurlukDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ sef_gorunur: !mevcutDurum })
      .eq('id', id)
    
    if (!error) taseronlariYukle()
  }

  const taseronSil = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Bu cari hesabı ve tüm ilişkili kayıtlarını silmek istediğinize emin misiniz?')) return

    const { error } = await supabase.from('taseronlar').delete().eq('id', id)
    if (error) {
      alert('Silme başarısız: ' + error.message)
    } else {
      taseronlariYukle()
      if (seciliId === id) setSeciliId(null)
    }
  }

  const notEkle = async () => {
    if (!yeniNot.trim() || !seciliId) return
    await supabase.from('taseron_notlari').insert({
      taseron_id: seciliId,
      icerik: yeniNot,
      ekleyen: profile?.id
    })
    setYeniNot('')
    detayYukle(seciliId)
  }

  // DETAY GÖRÜNÜMÜ
  if (seciliId && taseron) return (
    <div className="sayfa">
      <button onClick={() => setSeciliId(null)} className="ekle-buton-genis" style={{ marginBottom: 14, width: 'auto', padding: '6px 14px' }}>← Listeye dön</button>
      <h2>{taseron.ad}</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>{taseron.firma || 'Firma bilgisi yok'}</p>

      <h3>Hareketler & Akış (Timeline)</h3>
      <div className="liste" style={{ marginBottom: 20 }}>
        {timeline.map((item, i) => (
          <div key={i} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{item.tip === 'hakedis' ? `Hakediş: ${item.donem || 'Dönemsiz'}` : item.baslik}</span>
              <span className="kart-tutar">{paraFormatla(item.tutar)} ₺</span>
            </div>
            <div className="kart-alt-tarih">
              <span>{item.tip === 'hakedis' ? 'Hakediş Kaydı' : `Ödeme (${item.odeme_yontemleri?.ad || 'Nakit/Kasa'})`}</span>
              <span>{new Date(item.sortKey).toLocaleString('tr-TR')}</span>
            </div>
            {item.aciklama && <p className="not-icerik" style={{ marginTop: 4 }}>{item.aciklama}</p>}
          </div>
        ))}
        {timeline.length === 0 && <p className="bos-mesaj">Henüz hareket yok.</p>}
      </div>

      <h3>Notlar</h3>
      <div className="liste" style={{ marginBottom: 10 }}>
        {notlar.map(n => (
          <div key={n.id} className="kart">
            <p className="not-icerik">{n.icerik}</p>
            <span style={{ fontSize: 11, color: '#888' }}>{new Date(n.created_at).toLocaleString('tr-TR')}</span>
          </div>
        ))}
      </div>
      <div className="ekleme-kutusu">
        <input type="text" placeholder="Not veya açıklama ekle..." value={yeniNot} onChange={e => setYeniNot(e.target.value)} />
        <button className="ekle-buton-genis" onClick={notEkle}>Notu Kaydet</button>
      </div>
    </div>
  )

  // LİSTE GÖRÜNÜMÜ
  return (
    <div className="sayfa">
      <h2>Cari Hesaplar</h2>
      <div className="liste">
        {taseronlar.map((t) => (
          <div key={t.id} className="kart" onClick={() => detayYukle(t.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600 }}>{t.ad}</p>
              <p style={{ fontSize: 12, color: '#666' }}>{t.firma}</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              {yonetici && (
                <>
                  <label onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={t.sef_gorunur || false} 
                      onChange={(e) => gorunurlukDegistir(t.id, t.sef_gorunur, e)}
                    /> Şef Görsün
                  </label>
                  
                  <button 
                    onClick={(e) => taseronSil(t.id, e)} 
                    style={{ background: '#ffe6e6', color: '#d9534f', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    🗑 Sil
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {taseronlar.length === 0 && <p className="bos-mesaj">Cari hesap bulunamadı.</p>}
      </div>
    </div>
  )
}