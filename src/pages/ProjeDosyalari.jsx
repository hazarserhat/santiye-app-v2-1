import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import {
  uploadToGoogleDrive,
  getGoogleDriveViewUrl,
  moveToSilinenler,
} from '../lib/googleDrive'

const YONETIM_KLASORLERI = [
  { id: 'sozlesmeler', ad: 'Sözleşmeler', ikon: '🤝', renk: '#3B82F6', bg: '#EFF6FF' },
  { id: 'vekaletler', ad: 'Vekaletler', ikon: '📜', renk: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'harita', ad: 'Harita Evrakları', ikon: '🗺️', renk: '#10B981', bg: '#ECFDF5' },
  { id: 'diger_proje', ad: 'Diğer', ikon: '📁', renk: '#6B7280', bg: '#F3F4F6' },
]

export default function ProjeDosyalari() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  
  const [seciliSantiyeId, setSeciliSantiyeId] = useState('')
  const [aktifKlasor, setAktifKlasor] = useState(null)
  const [arama, setArama] = useState('')
  
  const [dosyalar, setDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [surukleniyor, setSurukleniyor] = useState(false)
  
  const dosyaInputRef = useRef(null)
  
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator' || profile?.sistem_yoneticisi

  useEffect(() => {
    if (aktifSantiye) setSeciliSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    if (seciliSantiyeId) {
      dosyalariYukle()
    } else {
      setDosyalar([])
    }
  }, [seciliSantiyeId, aktifKlasor])

  const dosyalariYukle = async () => {
    let sorgu = supabase
      .from('drive_dosyalar')
      .select('*, profiles(ad_soyad)')
      .eq('santiye_id', seciliSantiyeId)
      .eq('sayfa_turu', 'proje')
      .order('created_at', { ascending: false })

    if (aktifKlasor) {
      sorgu = sorgu.eq('klasor_yolu', aktifKlasor)
    }

    const { data, error } = await sorgu
    if (error) {
      console.error('Dosyalar yüklenirken hata:', error.message)
    } else {
      setDosyalar(data || [])
    }
  }

  const klasorSec = (klasorId) => {
    setAktifKlasor(klasorId)
    setArama('')
  }

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
    if (!seciliSantiyeId || !aktifKlasor) {
      alert('Lütfen önce bir şantiye ve klasör seçin.')
      return
    }

    setYukleniyor(true)
    const santiyeAdi = santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Santiye'
    const klasorAdi = YONETIM_KLASORLERI.find(k => k.id === aktifKlasor)?.ad || aktifKlasor
    const driveFolderName = `ProjeDosyalari/${santiyeAdi}/${klasorAdi}`

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
          santiye_id: seciliSantiyeId,
          sayfa_turu: 'proje',
          klasor_yolu: aktifKlasor,
          dosya_adi: file.name,
          dosya_url: driveSonuc.url,
          dosya_tipi: ext,
          yukleyen_id: profile?.id
        })
        basariliSayisi++
      } catch (err) {
        console.error('Dosya yükleme hatası:', file.name, err)
        alert(`${file.name} yüklenirken hata oluştu: ${err.message}`)
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
      const santiyeAdi = santiyeler.find(s => s.id === seciliSantiyeId)?.ad || 'Santiye'
      const klasorAdi = YONETIM_KLASORLERI.find(k => k.id === aktifKlasor)?.ad || aktifKlasor
      await moveToSilinenler(dosya.dosya_url, `Silinenler/ProjeDosyalari/${santiyeAdi}/${klasorAdi}`)

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
      const metin = `📄 *Proje/Resmi Dosya*\n*Dosya:* ${d.dosya_adi}\n*Bağlantı:* ${gDriveLink}`
      
      if (navigator.share) {
        await navigator.share({
          title: d.dosya_adi,
          text: metin,
        })
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

  const filtreliDosyalar = dosyalar.filter(d => {
    if (!arama) return true
    return d.dosya_adi.toLowerCase().includes(arama.toLowerCase()) || 
           (d.etiketler && d.etiketler.toLowerCase().includes(arama.toLowerCase()))
  })

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#3B82F6', letterSpacing: '-0.2px' }}>
          Proje & Yönetim Dosyaları
        </h2>
      </div>

      <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: 12, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>Şantiye Seçimi</label>
        <select 
          value={seciliSantiyeId} 
          onChange={(e) => { setSeciliSantiyeId(e.target.value); setAktifKlasor(null) }} 
          style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', outline: 'none' }}
        >
          <option value="">Şantiye seçin...</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
      </div>

      {!seciliSantiyeId ? (
        <p className="bos-mesaj">Lütfen bir şantiye seçin.</p>
      ) : !aktifKlasor ? (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#333' }}>Klasörler</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {YONETIM_KLASORLERI.map(klasor => (
              <div 
                key={klasor.id} 
                onClick={() => klasorSec(klasor.id)}
                style={{ 
                  background: klasor.bg, 
                  border: `1px solid ${klasor.renk}30`, 
                  borderRadius: 16, 
                  padding: '20px 16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  textAlign: 'center'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)' }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)' }}
              >
                <span style={{ fontSize: 32, marginBottom: 8 }}>{klasor.ikon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: klasor.renk, lineHeight: 1.2 }}>{klasor.ad}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button 
              onClick={() => setAktifKlasor(null)}
              style={{ padding: '6px 10px', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, cursor: 'pointer', color: '#555', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Geri
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
              / {YONETIM_KLASORLERI.find(k => k.id === aktifKlasor)?.ad}
            </span>
          </div>

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
              background: surukleniyor ? '#E0F2FE' : '#fcfcf9', 
              border: `2px dashed ${surukleniyor ? '#3B82F6' : 'rgba(0,0,0,0.15)'}`, 
              borderRadius: 16, 
              padding: '24px 16px', 
              textAlign: 'center',
              marginBottom: 20,
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => !yukleniyor && dosyaInputRef.current?.click()}
          >
            {yukleniyor ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>⏳</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>Dosyalar Yükleniyor... Lütfen bekleyin.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 32 }}>📥</span>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#555' }}>
                  Dosyaları buraya sürükleyin veya <span style={{ color: '#3B82F6', textDecoration: 'underline' }}>seçmek için tıklayın</span>
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Çoklu dosya (PDF, DWG, Görsel vb.) seçebilirsiniz</p>
              </div>
            )}
            <input 
              type="file" 
              multiple 
              hidden 
              ref={dosyaInputRef} 
              onChange={handleFileInput} 
              disabled={yukleniyor}
            />
          </div>

          <input 
            type="text" 
            placeholder="Bu klasörde dosya ara..." 
            value={arama} 
            onChange={(e) => setArama(e.target.value)} 
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.02)', fontSize: 13, outline: 'none', marginBottom: 16 }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtreliDosyalar.map((d) => (
              <div key={d.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 24 }}>{getDosyaIkon(d.dosya_tipi)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.dosya_adi}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                      Yükleyen: {d.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(d.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <a 
                    href={getGoogleDriveViewUrl(d.dosya_url)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: '#F0F9FF', color: '#0284C7', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Aç
                  </a>
                  
                  <button 
                    onClick={() => dosyaPaylas(d)}
                    style={{ background: '#ECFDF5', color: '#10B981', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Paylaş
                  </button>

                  {yonetici && (
                    <button 
                      onClick={(e) => dosyaSil(d, e)}
                      style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', padding: '6px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Sil"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {filtreliDosyalar.length === 0 && (
              <p className="bos-mesaj">Bu klasörde henüz dosya yok.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
