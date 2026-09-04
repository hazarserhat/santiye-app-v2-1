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
  
  // UI State
  const [aktifSekme, setAktifSekme] = useState('tum') // 'tum' veya 'klasorler'
  
  // Data State
  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [surukleniyor, setSurukleniyor] = useState(false)
  
  // Form State (Yükleme için)
  const [hedefSantiye, setHedefSantiye] = useState('')
  
  // Filtre ve Arama State (Tüm Evraklar)
  const [arama, setArama] = useState('')
  const [filtreSantiye, setFiltreSantiye] = useState('')

  // Klasör State (Şantiyelere Göre Klasörler)
  const [seciliSantiyeKlasoru, setSeciliSantiyeKlasoru] = useState(null)
  
  const dosyaInputRef = useRef(null)
  
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator' || profile?.sistem_yoneticisi

  // Sadece tüm saha dosyalarını çeker
  useEffect(() => {
    dosyalariYukle()
  }, [])

  const dosyalariYukle = async () => {
    const { data, error } = await supabase
      .from('drive_dosyalar')
      .select('*, profiles(ad_soyad)')
      .eq('sayfa_turu', 'saha')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Dosyalar yüklenirken hata:', error.message)
    } else {
      setDosyalar(data || [])
    }
  }

  // --- SÜRÜKLE BIRAK OLAYLARI ---
  const handleDragOver = (e) => {
    e.preventDefault()
    setSurukleniyor(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    setSurukleniyor(false)
  }
  const handleDrop = (e) => {
    e.preventDefault()
    setSurukleniyor(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      dosyalariSistemeEkle(Array.from(e.dataTransfer.files))
    }
  }
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      dosyalariSistemeEkle(Array.from(e.target.files))
    }
  }

  const dosyalariSistemeEkle = async (yeniDosyalar) => {
    const yuklenecekSantiye = aktifSekme === 'klasorler' && seciliSantiyeKlasoru ? seciliSantiyeKlasoru : hedefSantiye
    
    if (!yuklenecekSantiye) {
      alert('Lütfen dosya yüklemeden önce hedef Şantiye seçiniz.')
      return
    }

    setYukleniyor(true)
    const santiyeAdi = santiyeler.find(s => s.id === yuklenecekSantiye)?.ad || 'Santiye'
    // Artık kategori yok, doğrudan şantiye klasörüne yüklüyoruz
    const driveFolderName = `SahaDosyalari/${santiyeAdi}`

    let basariliSayisi = 0

    for (let i = 0; i < yeniDosyalar.length; i++) {
      const file = yeniDosyalar[i]
      try {
        const ext = file.name.split('.').pop().toLowerCase()
        const driveSonuc = await uploadToGoogleDrive({
          file: file,
          folderName: driveFolderName,
          adSoyad: profile?.ad_soyad || 'Sistem',
          compress: true
        })

        await supabase.from('drive_dosyalar').insert({
          santiye_id: yuklenecekSantiye,
          sayfa_turu: 'saha',
          klasor_yolu: 'Genel', // Kategori kaldırıldı, DB boş kalmasın diye 'Genel' atıyoruz
          dosya_adi: file.name,
          dosya_url: driveSonuc.url,
          dosya_tipi: ext,
          yukleyen_id: profile?.id
        })
        basariliSayisi++
      } catch (err) {
        console.error('Dosya yükleme hatası:', file.name, err)
        alert(`${file.name} yüklenirken hata: ${err.message}`)
      }
    }

    setYukleniyor(false)
    if (dosyaInputRef.current) dosyaInputRef.current.value = ''
    if (basariliSayisi > 0) {
      dosyalariYukle()
    }
  }

  const dosyaSil = async (dosya, e) => {
    e.stopPropagation()
    if (!yonetici) {
      alert('Sadece yöneticiler dosya silebilir.')
      return
    }
    if (!window.confirm(`"${dosya.dosya_adi}" dosyasını silmek istediğinize emin misiniz?`)) return

    try {
      const santiyeAdi = santiyeler.find(s => s.id === dosya.santiye_id)?.ad || 'Santiye'
      await moveToSilinenler(dosya.dosya_url, `Silinenler/SahaDosyalari/${santiyeAdi}`)

      const { error } = await supabase.from('drive_dosyalar').delete().eq('id', dosya.id)
      if (error) throw error
      
      dosyalariYukle()
    } catch (err) {
      alert('Dosya silinirken bir hata oluştu: ' + err.message)
    }
  }

  const dosyaPaylas = async (d) => {
    try {
      const gDriveLink = getGoogleDriveViewUrl(d.dosya_url)
      const metin = `📄 *Saha Dosyası*\n*Dosya:* ${d.dosya_adi}\n*Bağlantı:* ${gDriveLink}`
      
      if (navigator.share) {
        await navigator.share({ title: d.dosya_adi, text: metin })
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
      }
    } catch (err) {
      console.error('Paylaşım hatası:', err)
    }
  }

  const getDosyaIkon = (tip) => {
    if (['pdf'].includes(tip)) return '📕'
    if (['dwg', 'dxf', 'rvt'].includes(tip)) return '📐'
    if (['xls', 'xlsx', 'csv'].includes(tip)) return '📊'
    if (['doc', 'docx', 'txt'].includes(tip)) return '📝'
    if (['jpg', 'jpeg', 'png', 'heic'].includes(tip)) return '🖼️'
    return '📄'
  }

  // --- LİSTE FİLTRELEME ---
  let gosterilecekDosyalar = dosyalar

  if (aktifSekme === 'tum') {
    gosterilecekDosyalar = gosterilecekDosyalar.filter(d => {
      let uyuyor = true
      if (filtreSantiye && d.santiye_id !== filtreSantiye) uyuyor = false
      if (arama && !d.dosya_adi.toLowerCase().includes(arama.toLowerCase())) uyuyor = false
      return uyuyor
    })
  } else if (aktifSekme === 'klasorler' && seciliSantiyeKlasoru) {
    gosterilecekDosyalar = gosterilecekDosyalar.filter(d => {
      let uyuyor = d.santiye_id === seciliSantiyeKlasoru
      if (arama && !d.dosya_adi.toLowerCase().includes(arama.toLowerCase())) uyuyor = false
      return uyuyor
    })
  }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1D9596', letterSpacing: '-0.2px' }}>
          Saha Dosyaları
        </h2>
      </div>

      {/* SEKMELER */}
      <div className="gorunum-secici" style={{ marginBottom: 16 }}>
        <button className={aktifSekme === 'tum' ? 'secili-tab' : ''} onClick={() => { setAktifSekme('tum'); setArama('') }}>
          Tüm Evraklar
        </button>
        <button className={aktifSekme === 'klasorler' ? 'secili-tab' : ''} onClick={() => { setAktifSekme('klasorler'); setSeciliSantiyeKlasoru(null); setArama('') }}>
          Şantiye Klasörleri
        </button>
      </div>

      {/* AKTİF SEKME: TÜM EVRAKLAR */}
      {aktifSekme === 'tum' && (
        <>
          {/* YÜKLEME ALANI */}
          <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
            <p style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#374151' }}>Yeni Dosya Yükle</p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <select 
                  value={hedefSantiye} onChange={(e) => setHedefSantiye(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', outline: 'none' }}
                >
                  <option value="">Hedef Şantiye Seçin...</option>
                  {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
              </div>
            </div>
            
            <div 
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              style={{ 
                background: surukleniyor ? '#E0F2FE' : '#fff', 
                border: `2px dashed ${surukleniyor ? '#3B82F6' : '#d1d5db'}`, 
                borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onClick={() => {
                if (!hedefSantiye) alert('Lütfen önce şantiye seçin.')
                else if (!yukleniyor) dosyaInputRef.current?.click()
              }}
            >
              {yukleniyor ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>⏳</span>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D9596' }}>Dosyalar Yükleniyor...</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 28 }}>📥</span>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#4B5563' }}>Dosyaları buraya sürükleyin veya <span style={{ color: '#1D9596' }}>tıklayın</span></p>
                </div>
              )}
              <input type="file" multiple hidden ref={dosyaInputRef} onChange={handleFileInput} disabled={yukleniyor} />
            </div>
          </div>

          {/* FİLTRE VE ARAMA */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input 
              type="text" placeholder="Dosya adı ara..." value={arama} onChange={(e) => setArama(e.target.value)}
              style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none' }}
            />
            <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ flex: '1 1 140px', padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13 }}>
              <option value="">Tüm Şantiyeler</option>
              {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          </div>
        </>
      )}

      {/* AKTİF SEKME: KLASÖRLER (KÖK) */}
      {aktifSekme === 'klasorler' && !seciliSantiyeKlasoru && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {santiyeler.map(s => (
            <div 
              key={s.id} onClick={() => setSeciliSantiyeKlasoru(s.id)}
              style={{ 
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: '24px 16px', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', textAlign: 'center'
              }}
            >
              <span style={{ fontSize: 36, marginBottom: 8 }}>📁</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#334155', lineHeight: 1.2 }}>{s.ad}</span>
            </div>
          ))}
        </div>
      )}

      {/* KLASÖR İÇİ VEYA TÜM EVRAKLAR LİSTESİ */}
      {(aktifSekme === 'tum' || seciliSantiyeKlasoru) && (
        <div>
          {aktifSekme === 'klasorler' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setSeciliSantiyeKlasoru(null)} style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Geri</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
                📁 {santiyeler.find(s => s.id === seciliSantiyeKlasoru)?.ad}
              </span>
            </div>
          )}

          {aktifSekme === 'klasorler' && seciliSantiyeKlasoru && (
            <>
              <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: '#374151' }}>Bu Şantiyeye Dosya Yükle</p>
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  style={{ 
                    background: surukleniyor ? '#E0F2FE' : '#fff', 
                    border: `2px dashed ${surukleniyor ? '#3B82F6' : '#d1d5db'}`, 
                    borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    if (!yukleniyor) dosyaInputRef.current?.click()
                  }}
                >
                  {yukleniyor ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>⏳</span>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1D9596' }}>Dosyalar Yükleniyor...</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 28 }}>📥</span>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#4B5563' }}>Dosyaları buraya sürükleyin veya <span style={{ color: '#1D9596' }}>tıklayın</span></p>
                    </div>
                  )}
                </div>
              </div>
              <input 
                type="text" placeholder="Bu şantiyede ara..." value={arama} onChange={(e) => setArama(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', marginBottom: 16 }}
              />
            </>
          )}

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
              display: 'flex', flexDirection: 'column', gap: 10, 
              minHeight: 200, 
              background: surukleniyor ? '#E0F2FE' : 'transparent',
              borderRadius: 12,
              padding: surukleniyor ? 10 : 0,
              transition: 'all 0.2s'
            }}
          >
            {gosterilecekDosyalar.map((d) => {
              const bSantiye = santiyeler.find(s => s.id === d.santiye_id)?.ad || 'Bilinmeyen'
              
              return (
                <div key={d.id} style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 24, marginTop: 2 }}>{getDosyaIkon(d.dosya_tipi)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dosya_adi}</p>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 10 }}>📍 {bSantiye}</span>
                      </div>
                      
                      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
                        Yükleyen: <strong style={{ color: '#6B7280' }}>{d.profiles?.ad_soyad}</strong> · {new Date(d.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <a href={getGoogleDriveViewUrl(d.dosya_url)} target="_blank" rel="noopener noreferrer" style={{ background: '#F0F9FF', color: '#0284C7', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Aç</a>
                      <button onClick={() => dosyaPaylas(d)} style={{ background: '#ECFDF5', color: '#10B981', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Paylaş</button>
                    </div>
                    {yonetici && (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={(e) => dosyaSil(d, e)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Sil</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            {gosterilecekDosyalar.length === 0 && (
              <p className="bos-mesaj">Evrak bulunamadı.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
