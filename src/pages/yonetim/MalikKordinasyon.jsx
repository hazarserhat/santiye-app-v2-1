import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { useAuth } from '../../context/AuthContext'

export default function MalikKordinasyon() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  
  const [santiyeId, setSantiyeId] = useState('')
  const [malikler, setMalikler] = useState([])
  const [sutunlar, setSutunlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  // Yeni sütun ekleme state'leri
  const [sutunEkleAcik, setSutunEkleAcik] = useState(false)
  const [yeniSutunAd, setYeniSutunAd] = useState('')
  const [yeniSutunTip, setYeniSutunTip] = useState('checkbox')

  useEffect(() => {
    if (santiyeler.length > 0 && !santiyeId) {
      setSantiyeId(santiyeler[0].id)
    }
  }, [santiyeler])

  useEffect(() => {
    if (santiyeId) {
      verileriYukle()
    }
  }, [santiyeId])

  const verileriYukle = async () => {
    setYukleniyor(true)
    
    // Şantiye sütunlarını getir
    const seciliSantiye = santiyeler.find(s => s.id === santiyeId)
    if (seciliSantiye) {
      setSutunlar(seciliSantiye.koordinasyon_sutunlari || [])
    }

    // Malikleri getir
    const { data: mData, error } = await supabase
      .from('malikler')
      .select('*')
      .eq('santiye_id', santiyeId)
      .order('daire_no')
      
    if (error) {
      console.error('Malikler yüklenemedi:', error)
    } else {
      const siralanmis = (mData || []).sort((a, b) => {
        const da = a.daire_no ? String(a.daire_no) : ''
        const db = b.daire_no ? String(b.daire_no) : ''
        return da.localeCompare(db, undefined, { numeric: true, sensitivity: 'base' })
      })
      setMalikler(siralanmis)
    }
    
    setYukleniyor(false)
  }

  const sutunEkle = async () => {
    if (!yeniSutunAd.trim()) return
    
    const seciliSantiye = santiyeler.find(s => s.id === santiyeId)
    if (!seciliSantiye) return
    
    const yeniSutun = {
      id: `col_${Date.now()}`,
      ad: yeniSutunAd.trim(),
      tip: yeniSutunTip // 'checkbox' veya 'text'
    }
    
    const mevcutSutunlar = seciliSantiye.koordinasyon_sutunlari || []
    const guncelSutunlar = [...mevcutSutunlar, yeniSutun]
    
    const { error } = await supabase
      .from('santiyeler')
      .update({ koordinasyon_sutunlari: guncelSutunlar })
      .eq('id', santiyeId)
      
    if (error) {
      alert('Sütun eklenemedi: ' + error.message)
      return
    }
    
    // Frontend state'ini hemen güncelle (Context içindeki veri bir sonraki yenilemede gelir ama biz yerel state'i de güncelliyoruz)
    seciliSantiye.koordinasyon_sutunlari = guncelSutunlar
    setSutunlar(guncelSutunlar)
    setSutunEkleAcik(false)
    setYeniSutunAd('')
    setYeniSutunTip('checkbox')
  }
  
  const sutunSil = async (sutunId) => {
    if (!window.confirm('Bu sütunu silmek istediğinize emin misiniz? (Mevcut veriler kaybolmaz ama sütun gizlenir)')) return
    
    const seciliSantiye = santiyeler.find(s => s.id === santiyeId)
    if (!seciliSantiye) return
    
    const mevcutSutunlar = seciliSantiye.koordinasyon_sutunlari || []
    const guncelSutunlar = mevcutSutunlar.filter(s => s.id !== sutunId)
    
    const { error } = await supabase
      .from('santiyeler')
      .update({ koordinasyon_sutunlari: guncelSutunlar })
      .eq('id', santiyeId)
      
    if (error) {
      alert('Sütun silinemedi: ' + error.message)
      return
    }
    
    seciliSantiye.koordinasyon_sutunlari = guncelSutunlar
    setSutunlar(guncelSutunlar)
  }

  const hucreGuncelle = async (malikId, sutunId, yeniDeger) => {
    const malik = malikler.find(m => m.id === malikId)
    if (!malik) return
    
    // Optimizasyon için UI'ı anında güncelle
    const guncelVeriler = { ...(malik.koordinasyon_verileri || {}) }
    guncelVeriler[sutunId] = yeniDeger
    
    setMalikler(prev => prev.map(m => m.id === malikId ? { ...m, koordinasyon_verileri: guncelVeriler } : m))
    
    // Veritabanına kaydet
    const { error } = await supabase
      .from('malikler')
      .update({ koordinasyon_verileri: guncelVeriler })
      .eq('id', malikId)
      
    if (error) {
      alert('Değer kaydedilemedi: ' + error.message)
      verileriYukle() // Hatada geri al
    }
  }

  return (
    <div className="sayfa" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Malik Koordinasyon Matrisi</h2>
      </div>

      <div className="ekleme-kutusu" style={{ marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, borderRadius: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6, display: 'block' }}>İncelenecek Şantiye</label>
          <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', width: '100%', fontSize: 14, fontWeight: 500, color: '#1e293b', outline: 'none', background: '#fff' }}>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
        
        <div style={{ flexShrink: 0, marginTop: 22 }}>
          <button 
            onClick={() => setSutunEkleAcik(!sutunEkleAcik)}
            style={{ padding: '10px 16px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 4px rgba(15, 110, 86, 0.2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Yeni Sütun Ekle
          </button>
        </div>
      </div>

      {sutunEkleAcik && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 20, borderRadius: 16, marginBottom: 24, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', animation: 'fadeIn 0.3s' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>Yeni Sütun Oluştur</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 2 }}>
              <input 
                type="text" 
                placeholder="Sütun Adı (örn: Otopark Harcı, Sözleşme Durumu...)" 
                value={yeniSutunAd}
                onChange={(e) => setYeniSutunAd(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <select 
                value={yeniSutunTip} 
                onChange={(e) => setYeniSutunTip(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', outline: 'none' }}
              >
                <option value="checkbox">Evet / Hayır (Onay Kutusu)</option>
                <option value="text">Kısa Metin (Not / Açıklama)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSutunEkleAcik(false)} style={{ padding: '0 16px', background: '#f1f5f9', border: 'none', borderRadius: 10, color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
              <button onClick={sutunEkle} style={{ padding: '0 24px', background: '#0ea5e9', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
            </div>
          </div>
        </div>
      )}

      {yukleniyor ? (
        <p className="bos-mesaj">Veriler yükleniyor...</p>
      ) : malikler.length === 0 ? (
        <p className="bos-mesaj">Bu şantiyede kayıtlı malik bulunamadı.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Daire</th>
                <th style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Malik Adı</th>
                {sutunlar.map(sutun => (
                  <th key={sutun.id} style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: 13, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {sutun.ad}
                      <button 
                        onClick={() => sutunSil(sutun.id)}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', opacity: 0.7 }}
                        title="Sütunu Sil"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {malikler.map((malik, idx) => {
                const veriler = malik.koordinasyon_verileri || {}
                
                return (
                  <tr key={malik.id} style={{ borderBottom: idx === malikler.length - 1 ? 'none' : '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfcfc', transition: 'background 0.2s' }}>
                    <td style={{ padding: '14px 20px', color: '#64748b', fontWeight: 600, fontSize: 14 }}>{malik.daire_no || '-'}</td>
                    <td style={{ padding: '14px 20px', color: '#0f172a', fontWeight: 600, fontSize: 14 }}>{malik.ad_soyad}</td>
                    
                    {sutunlar.map(sutun => (
                      <td key={sutun.id} style={{ padding: '14px 20px' }}>
                        {sutun.tip === 'checkbox' ? (
                          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={!!veriler[sutun.id]}
                              onChange={(e) => hucreGuncelle(malik.id, sutun.id, e.target.checked)}
                              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#0F6E56' }}
                            />
                          </label>
                        ) : (
                          <input 
                            type="text"
                            value={veriler[sutun.id] || ''}
                            onChange={(e) => hucreGuncelle(malik.id, sutun.id, e.target.value)}
                            placeholder="Not girin..."
                            style={{ width: '100%', minWidth: '150px', padding: '8px 12px', border: '1px solid transparent', background: 'transparent', borderRadius: 6, fontSize: 13, outline: 'none', transition: 'all 0.2s' }}
                            onFocus={(e) => { e.target.style.border = '1px solid #cbd5e1'; e.target.style.background = '#fff' }}
                            onBlur={(e) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent' }}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
