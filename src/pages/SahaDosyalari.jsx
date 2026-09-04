import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import {
  uploadToGoogleDrive,
  getGoogleDriveViewUrl,
  moveToSilinenler,
} from '../lib/googleDrive'

export default function SahaDosyalari() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  
  const [aktifSekme, setAktifSekme] = useState('tum')
  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [surukleniyor, setSurukleniyor] = useState(false)
  const [hedefSantiye, setHedefSantiye] = useState('')
  const [arama, setArama] = useState('')
  const [filtreSantiye, setFiltreSantiye] = useState('')
  const [seciliSantiyeKlasoru, setSeciliSantiyeKlasoru] = useState(null)
  
  const [duzenlenenNotId, setDuzenlenenNotId] = useState(null)
  const [geciciNot, setGeciciNot] = useState('')
  
  const dosyaInputRef = useRef(null)
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator' || profile?.sistem_yoneticisi

  useEffect(() => {
    dosyalariYukle()
  }, [])

  const dosyalariYukle = async () => {
    const { data, error } = await supabase
      .from('drive_dosyalar')
      .select('*, profiles(ad_soyad)')
      .eq('sayfa_turu', 'saha')
      .order('created_at', { ascending: false })

    if (error) console.error('Dosyalar yüklenirken hata:', error.message)
    else setDosyalar(data || [])
  }

  const handleDragOver = (e) => { e.preventDefault(); setSurukleniyor(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setSurukleniyor(false) }
  const handleDrop = (e) => {
    e.preventDefault(); setSurukleniyor(false)
    if (e.dataTransfer.files?.length > 0) dosyalariSistemeEkle(Array.from(e.dataTransfer.files))
  }
  const handleFileInput = (e) => {
    if (e.target.files?.length > 0) dosyalariSistemeEkle(Array.from(e.target.files))
  }

  const dosyalariSistemeEkle = async (yeniDosyalar) => {
    const yuklenecekSantiye = aktifSekme === 'klasorler' && seciliSantiyeKlasoru ? seciliSantiyeKlasoru : hedefSantiye
    if (!yuklenecekSantiye) {
      alert('Lütfen dosya yüklemeden önce hedef Şantiye seçiniz.')
      return
    }

    setYukleniyor(true)
    const santiyeAdi = santiyeler.find(s => s.id === yuklenecekSantiye)?.ad || 'Santiye'
    const driveFolderName = `SahaDosyalari/${santiyeAdi}`
    let basariliSayisi = 0

    for (let i = 0; i < yeniDosyalar.length; i++) {
      const file = yeniDosyalar[i]
      try {
        const ext = file.name.split('.').pop().toLowerCase()
        const driveSonuc = await uploadToGoogleDrive({
          file: file, folderName: driveFolderName, adSoyad: profile?.ad_soyad || 'Sistem', compress: true
        })
        await supabase.from('drive_dosyalar').insert({
          santiye_id: yuklenecekSantiye, sayfa_turu: 'saha', klasor_yolu: 'Genel',
          dosya_adi: file.name, dosya_url: driveSonuc.url, dosya_tipi: ext, yukleyen_id: profile?.id
        })
        basariliSayisi++
      } catch (err) {
        alert(`${file.name} yüklenirken hata: ${err.message}`)
      }
    }

    setYukleniyor(false)
    if (dosyaInputRef.current) dosyaInputRef.current.value = ''
    if (basariliSayisi > 0) dosyalariYukle()
  }

  const dosyaSil = async (dosya, e) => {
    e.stopPropagation()
    if (!yonetici) return alert('Sadece yöneticiler dosya silebilir.')
    if (!window.confirm(`"${dosya.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return

    try {
      const santiyeAdi = santiyeler.find(s => s.id === dosya.santiye_id)?.ad || 'Santiye'
      await moveToSilinenler(dosya.dosya_url, `Silinenler/SahaDosyalari/${santiyeAdi}`)
      const { error } = await supabase.from('drive_dosyalar').delete().eq('id', dosya.id)
      if (error) throw error
      dosyalariYukle()
    } catch (err) {
      alert('Dosya silinirken hata: ' + err.message)
    }
  }

  const dosyaPaylas = async (d) => {
    try {
      const gDriveLink = getGoogleDriveViewUrl(d.dosya_url)
      const metin = `📄 *Şantiye Dosyası*\n*Dosya:* ${d.dosya_adi}\n*Bağlantı:* ${gDriveLink}`
      if (navigator.share) await navigator.share({ title: d.dosya_adi, text: metin })
      else window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    } catch (err) {}
  }

  const notKaydet = async (dosyaId) => {
    try {
      const { error } = await supabase.from('drive_dosyalar').update({ aciklama: geciciNot }).eq('id', dosyaId)
      if (error) throw error
      setDuzenlenenNotId(null)
      dosyalariYukle()
    } catch (err) { alert('Not kaydedilirken hata: ' + err.message) }
  }

  const getDosyaIkon = (tip) => {
    if (['pdf'].includes(tip)) return '📕'
    if (['dwg', 'dxf', 'rvt'].includes(tip)) return '📐'
    if (['xls', 'xlsx', 'csv'].includes(tip)) return '📊'
    if (['doc', 'docx', 'txt'].includes(tip)) return '📝'
    if (['jpg', 'jpeg', 'png', 'heic'].includes(tip)) return '🖼️'
    return '📄'
  }

  let gosterilecekDosyalar = dosyalar
  if (aktifSekme === 'tum') {
    gosterilecekDosyalar = gosterilecekDosyalar.filter(d => {
      if (filtreSantiye && d.santiye_id !== filtreSantiye) return false
      if (arama && !d.dosya_adi.toLowerCase().includes(arama.toLowerCase())) return false
      return true
    })
  } else if (aktifSekme === 'klasorler' && seciliSantiyeKlasoru) {
    gosterilecekDosyalar = gosterilecekDosyalar.filter(d => {
      if (d.santiye_id !== seciliSantiyeKlasoru) return false
      if (arama && !d.dosya_adi.toLowerCase().includes(arama.toLowerCase())) return false
      return true
    })
  }

  return (
    <div className="premium-page">
      <style>{`
        .premium-page {
          animation: drvFadeIn 0.4s ease-out;
          max-width: 1200px;
          margin: 0 auto;
        }
        .drv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .drv-title {
          font-size: 28px;
          font-weight: 800;
          background: linear-gradient(135deg, #0f766e 0%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .drv-tabs {
          display: inline-flex;
          background: #f1f5f9;
          padding: 6px;
          border-radius: 16px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
          margin-bottom: 24px;
        }
        .drv-tab {
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
        .drv-tab.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .drv-upload-zone {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border: 2px dashed #cbd5e1;
          border-radius: 24px;
          padding: 40px 20px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
          margin-bottom: 24px;
        }
        .drv-upload-zone:hover {
          border-color: #0ea5e9;
          background: #f0f9ff;
        }
        .drv-upload-zone.drag-active {
          background: #e0f2fe;
          border-color: #0284c7;
          transform: scale(1.01);
          box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.15);
        }
        .drv-folder-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }
        .drv-folder {
          background: linear-gradient(145deg, #ffffff, #f8fafc);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 24px 16px;
          text-align: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .drv-folder:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 20px -3px rgba(0,0,0,0.08);
          border-color: #cbd5e1;
        }
        .drv-folder-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 16px;
          border-radius: 20px;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.05);
        }
        .drv-file-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
          border-radius: 16px;
          transition: all 0.2s;
        }
        .drv-file-item {
          background: #ffffff;
          border: 1px solid #f1f5f9;
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .drv-file-item:hover {
          transform: translateX(4px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.06);
          border-color: #e2e8f0;
        }
        .drv-file-icon {
          font-size: 32px;
          background: #f8fafc;
          padding: 12px;
          border-radius: 16px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .drv-input {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          background: #ffffff;
        }
        .drv-input:focus {
          border-color: #0ea5e9;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.1);
        }
        .drv-btn {
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .drv-btn-primary {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white;
          box-shadow: 0 4px 6px -1px rgba(2, 132, 199, 0.2);
        }
        .drv-btn-primary:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .drv-btn-success {
          background: #f0fdf4;
          color: #16a34a;
        }
        .drv-btn-success:hover { background: #dcfce7; }
        .drv-btn-danger {
          background: #fef2f2;
          color: #dc2626;
        }
        .drv-btn-danger:hover { background: #fee2e2; }
        .drv-btn-warning {
          background: #fffbeb;
          color: #d97706;
        }
        .drv-btn-warning:hover { background: #fef3c7; }
        
        @keyframes drvFadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="drv-header">
        <h2 className="drv-title">Şantiye Dosyaları</h2>
      </div>

      <div className="drv-tabs">
        <button className={`drv-tab ${aktifSekme === 'tum' ? 'active' : ''}`} onClick={() => { setAktifSekme('tum'); setArama('') }}>
          Tüm Evraklar
        </button>
        <button className={`drv-tab ${aktifSekme === 'klasorler' ? 'active' : ''}`} onClick={() => { setAktifSekme('klasorler'); setSeciliSantiyeKlasoru(null); setArama('') }}>
          Şantiye Klasörleri
        </button>
      </div>

      {aktifSekme === 'tum' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select className="drv-input" style={{ flex: '1 1 200px' }} value={hedefSantiye} onChange={(e) => setHedefSantiye(e.target.value)}>
              <option value="">Yükleme Yapılacak Şantiyeyi Seçin...</option>
              {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          </div>
          
          <div 
            className={`drv-upload-zone ${surukleniyor ? 'drag-active' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            onClick={() => {
              if (!hedefSantiye) alert('Lütfen önce şantiye seçin.')
              else if (!yukleniyor) dosyaInputRef.current?.click()
            }}
          >
            {yukleniyor ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 36 }}>⏳</span>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0ea5e9' }}>Dosyalar Buluta Aktarılıyor...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 42 }}>📥</span>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#334155' }}>
                  Dosyaları buraya sürükleyin veya <span style={{ color: '#0ea5e9' }}>tıklayın</span>
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>PDF, DWG, Görsel ve Excel dosyaları desteklenir</p>
              </div>
            )}
            <input type="file" multiple hidden ref={dosyaInputRef} onChange={handleFileInput} disabled={yukleniyor} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <input 
              type="text" className="drv-input" placeholder="Dosya adı ara..." 
              value={arama} onChange={(e) => setArama(e.target.value)} style={{ flex: '1 1 200px' }}
            />
            <select className="drv-input" value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ flex: '0 1 200px' }}>
              <option value="">Tüm Şantiyeler</option>
              {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          </div>
        </>
      )}

      {aktifSekme === 'klasorler' && !seciliSantiyeKlasoru && (
        <div className="drv-folder-grid">
          {santiyeler.map(s => (
            <div key={s.id} className="drv-folder" onClick={() => setSeciliSantiyeKlasoru(s.id)}>
              <div className="drv-folder-icon">📁</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{s.ad}</span>
            </div>
          ))}
        </div>
      )}

      {(aktifSekme === 'tum' || seciliSantiyeKlasoru) && (
        <div>
          {aktifSekme === 'klasorler' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button className="drv-btn" style={{ background: '#f1f5f9' }} onClick={() => setSeciliSantiyeKlasoru(null)}>← Geri</button>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#334155' }}>
                📁 {santiyeler.find(s => s.id === seciliSantiyeKlasoru)?.ad}
              </h3>
            </div>
          )}

          {aktifSekme === 'klasorler' && seciliSantiyeKlasoru && (
            <>
              <div 
                className={`drv-upload-zone ${surukleniyor ? 'drag-active' : ''}`} style={{ padding: '24px 16px', marginBottom: 20 }}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => { if (!yukleniyor) dosyaInputRef.current?.click() }}
              >
                {yukleniyor ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 24 }}>⏳</span>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0ea5e9' }}>Yükleniyor...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 32 }}>📥</span>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#475569' }}>Bu şantiyeye dosya yüklemek için tıklayın</p>
                  </div>
                )}
              </div>
              <input 
                type="text" className="drv-input" placeholder="Bu şantiyede ara..." 
                value={arama} onChange={(e) => setArama(e.target.value)} style={{ width: '100%', marginBottom: 20 }}
              />
            </>
          )}

          <div 
            className="drv-file-list"
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            style={{ background: surukleniyor ? '#f0f9ff' : 'transparent', padding: surukleniyor ? 10 : 0 }}
          >
            {gosterilecekDosyalar.map((d) => {
              const bSantiye = santiyeler.find(s => s.id === d.santiye_id)?.ad || 'Bilinmeyen'
              return (
                <div key={d.id} className="drv-file-item">
                  <div className="drv-file-icon">{getDosyaIkon(d.dosya_tipi)}</div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dosya_adi}</p>
                    
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: 8 }}>📍 {bSantiye}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>Yükleyen: {d.profiles?.ad_soyad} · {new Date(d.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    
                    {duzenlenenNotId === d.id ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <input 
                          type="text" className="drv-input" value={geciciNot} onChange={(e) => setGeciciNot(e.target.value)} 
                          placeholder="Notunuzu yazın..." style={{ flex: 1, padding: '8px 12px' }} autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') notKaydet(d.id) }}
                        />
                        <button className="drv-btn drv-btn-primary" onClick={() => notKaydet(d.id)}>Kaydet</button>
                        <button className="drv-btn" style={{ background: '#f1f5f9' }} onClick={() => setDuzenlenenNotId(null)}>İptal</button>
                      </div>
                    ) : (
                      d.aciklama && (
                        <div style={{ marginTop: 8, background: '#f8fafc', padding: '10px 14px', borderRadius: 10, borderLeft: '4px solid #0ea5e9' }}>
                          <p style={{ margin: 0, fontSize: 13, color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>{d.aciklama}</p>
                        </div>
                      )
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={getGoogleDriveViewUrl(d.dosya_url)} target="_blank" rel="noopener noreferrer" className="drv-btn drv-btn-primary" style={{ textDecoration: 'none' }}>Aç</a>
                      <button className="drv-btn drv-btn-success" onClick={() => dosyaPaylas(d)}>Paylaş</button>
                    </div>
                    {yonetici && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {duzenlenenNotId !== d.id && (
                          <button className="drv-btn drv-btn-warning" onClick={() => { setDuzenlenenNotId(d.id); setGeciciNot(d.aciklama || '') }}>
                            {d.aciklama ? 'Düzenle' : 'Not Ekle'}
                          </button>
                        )}
                        <button className="drv-btn drv-btn-danger" onClick={(e) => dosyaSil(d, e)}>Sil</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            {gosterilecekDosyalar.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 20 }}>
                <span style={{ fontSize: 48, filter: 'grayscale(1)', opacity: 0.5 }}>📁</span>
                <p style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>Buralar oldukça sessiz... Henüz dosya yüklenmemiş.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
