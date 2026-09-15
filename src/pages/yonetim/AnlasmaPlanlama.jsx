import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { useAuth } from '../../context/AuthContext'
import {
  uploadToGoogleDrive,
  getGoogleDriveInlineImageUrl,
  getGoogleDriveViewUrl,
  moveToSilinenler,
  isGoogleDriveUrl
} from '../../lib/googleDrive'

export default function AnlasmaPlanlama() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [kalemler, setKalemler] = useState([])
  const [anlasmalar, setAnlasmalar] = useState([]) // Ana anlaşmalar
  const [anlasmaSantiyeler, setAnlasmaSantiyeler] = useState([]) // Hangi anlaşma hangi şantiyede?
  const [dosyalar, setDosyalar] = useState([])
  
  const [yeniKalemAd, setYeniKalemAd] = useState('')
  const [kalemEkleAcik, setKalemEkleAcik] = useState(false)
  
  const [modalAcik, setModalAcik] = useState(false)
  const [seciliHems, setSeciliHems] = useState(null) // { kalemId, santiyeId }
  const [aktifAnlasma, setAktifAnlasma] = useState(null) // Eğer tıklanan hücre doluysa ilgili anlaşma objesi

  const [form, setForm] = useState({
    tedarikci: '',
    tutar: '',
    para_birimi: 'TL',
    detay: '',
    seciliSantiyeler: [] // Çoklu seçim için
  })
  const [secilenDosyalar, setSecilenDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  
  // Sadece aktif şantiyeleri listele (veya sırala)
  const gecerliSantiyeler = santiyeler || []

  useEffect(() => {
    verileriGetir()
  }, [])

  const verileriGetir = async () => {
    // Kalemleri getir
    const { data: kData } = await supabase.from('planlama_kalemleri').select('*').order('sira', { ascending: true }).order('created_at', { ascending: true })
    if (kData) setKalemler(kData)
    
    // Anlaşmaları getir
    const { data: aData } = await supabase.from('planlama_anlasmalar').select('*')
    if (aData) setAnlasmalar(aData)
    
    // İlişkileri getir
    const { data: asData } = await supabase.from('planlama_anlasma_santiyeler').select('*')
    if (asData) setAnlasmaSantiyeler(asData)
    
    // Dosyaları getir
    const { data: dData } = await supabase.from('planlama_dosyalari').select('*')
    if (dData) setDosyalar(dData)
  }

  const kalemEkle = async () => {
    if (!yeniKalemAd.trim()) return
    const { error } = await supabase.from('planlama_kalemleri').insert({ 
      ad: yeniKalemAd,
      sira: kalemler.length 
    })
    if (error) alert('Kalem eklenemedi: ' + error.message)
    else {
      setYeniKalemAd('')
      setKalemEkleAcik(false)
      verileriGetir()
    }
  }

  const kalemSiraDegistir = async (index, yon) => {
    const yeni = [...kalemler]
    if (yon === 'yukari' && index > 0) {
      const gecici = yeni[index]
      yeni[index] = yeni[index - 1]
      yeni[index - 1] = gecici
    } else if (yon === 'asagi' && index < yeni.length - 1) {
      const gecici = yeni[index]
      yeni[index] = yeni[index + 1]
      yeni[index + 1] = gecici
    } else {
      return
    }

    setKalemler(yeni) // Anında UI güncelle

    try {
      // Arka planda DB'yi güncelle
      for (let i = 0; i < yeni.length; i++) {
        await supabase.from('planlama_kalemleri').update({ sira: i }).eq('id', yeni[i].id)
      }
    } catch (err) {
      console.error('Sıralama hatası:', err)
    }
  }

  const hucreTikla = (kalemId, santiyeId) => {
    // Bu hücre dolu mu?
    const iliski = anlasmaSantiyeler.find(as => as.kalem_id === kalemId && as.santiye_id === santiyeId)
    // Wait, relation table has anlasma_id and santiye_id, not kalem_id!
    // We need to find the anlasma_id that belongs to this kalem_id and santiye_id.
    const ilgiliAnlasmalar = anlasmalar.filter(a => a.kalem_id === kalemId)
    const aktif = ilgiliAnlasmalar.find(a => 
      anlasmaSantiyeler.some(as => as.anlasma_id === a.id && as.santiye_id === santiyeId)
    )

    setSeciliHems({ kalemId, santiyeId })
    setSecilenDosyalar([])
    
    if (aktif) {
      setAktifAnlasma(aktif)
      const aitOlduguSantiyeler = anlasmaSantiyeler.filter(as => as.anlasma_id === aktif.id).map(as => as.santiye_id)
      setForm({
        tedarikci: aktif.tedarikci || '',
        tutar: aktif.tutar || '',
        para_birimi: aktif.para_birimi || 'TL',
        fiyat_tipi: aktif.fiyat_tipi || 'Toplam Fiyat',
        detay: aktif.detay || '',
        seciliSantiyeler: aitOlduguSantiyeler
      })
    } else {
      setAktifAnlasma(null)
      setForm({
        tedarikci: '',
        tutar: '',
        para_birimi: 'TL',
        fiyat_tipi: 'Toplam Fiyat',
        detay: '',
        seciliSantiyeler: [santiyeId]
      })
    }
    setModalAcik(true)
  }

  const anlasmaKaydet = async () => {
    if (!form.tedarikci || !form.tutar || form.seciliSantiyeler.length === 0) {
      alert('Tedarikçi, tutar ve en az bir şantiye seçilmelidir.')
      return
    }
    setYukleniyor(true)

    let anlasmaId = aktifAnlasma?.id

    try {
      if (aktifAnlasma) {
        // Güncelle
        const { error } = await supabase.from('planlama_anlasmalar').update({
          tedarikci: form.tedarikci,
          tutar: form.tutar,
          para_birimi: form.para_birimi,
          fiyat_tipi: form.fiyat_tipi,
          detay: form.detay,
        }).eq('id', anlasmaId)
        if (error) throw error

        // İlişkileri güncelle
        await supabase.from('planlama_anlasma_santiyeler').delete().eq('anlasma_id', anlasmaId)
      } else {
        // Yeni oluştur
        const { data, error } = await supabase.from('planlama_anlasmalar').insert({
          kalem_id: seciliHems.kalemId,
          tedarikci: form.tedarikci,
          tutar: form.tutar,
          para_birimi: form.para_birimi,
          fiyat_tipi: form.fiyat_tipi,
          detay: form.detay,
          olusturan: profile?.id
        }).select().single()
        if (error) throw error
        anlasmaId = data.id
      }

      // Şantiye ilişkilerini ekle
      const iliskiler = form.seciliSantiyeler.map(sId => ({
        anlasma_id: anlasmaId,
        santiye_id: sId
      }))
      const { error: asError } = await supabase.from('planlama_anlasma_santiyeler').insert(iliskiler)
      if (asError) throw asError

      // Dosyaları yükle
      if (secilenDosyalar.length > 0) {
        const kalemAdi = kalemler.find(k => k.id === seciliHems.kalemId)?.ad || 'Genel'
        const folderName = `Planlama/${kalemAdi}`

        for (let i = 0; i < secilenDosyalar.length; i++) {
          const dosya = secilenDosyalar[i]
          const islemZamani = new Date().toISOString()
          const driveSonuc = await uploadToGoogleDrive({
            file: dosya,
            folderName,
            adSoyad: `Sözleşme-${form.tedarikci}`,
            date: islemZamani,
            compress: true
          })
          await supabase.from('planlama_dosyalari').insert({
            anlasma_id: anlasmaId,
            url: driveSonuc.url
          })
        }
      }

      setModalAcik(false)
      verileriGetir()
    } catch (err) {
      alert('Hata oluştu: ' + err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  const anlasmaSil = async () => {
    if (!window.confirm('Bu anlaşmayı tamamen silmek istediğinize emin misiniz?')) return
    setYukleniyor(true)
    try {
      const anlasmaDosyalari = dosyalar.filter(d => d.anlasma_id === aktifAnlasma.id)
      for (const d of anlasmaDosyalari) {
        if (d.url && isGoogleDriveUrl(d.url)) {
          await moveToSilinenler(d.url, 'Planlama')
        }
      }
      
      await supabase.from('planlama_dosyalari').delete().eq('anlasma_id', aktifAnlasma.id)
      const { error } = await supabase.from('planlama_anlasmalar').delete().eq('id', aktifAnlasma.id)
      if (error) throw error

      setModalAcik(false)
      verileriGetir()
    } catch (err) {
      alert('Silinemedi: ' + err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  const anlasmaPaylas = async () => {
    if (!aktifAnlasma) return

    const kalemAdi = kalemler.find(k => k.id === seciliHems?.kalemId)?.ad || 'Genel'
    const santiyeAdlari = form.seciliSantiyeler.map(sId => santiyeler.find(s => s.id === sId)?.ad).filter(Boolean).join(', ')
    
    let metin = `📋 *Planlama & Satın Alım Anlaşması*\n\n`
    metin += `🏗️ *Şantiyeler:* ${santiyeAdlari}\n`
    metin += `🛠️ *İmalat Kalemi:* ${kalemAdi}\n`
    metin += `🏢 *Tedarikçi:* ${aktifAnlasma.tedarikci}\n`
    metin += `💰 *Tutar:* ${Number(aktifAnlasma.tutar).toLocaleString('tr-TR')} ${aktifAnlasma.para_birimi} (${aktifAnlasma.fiyat_tipi})\n`
    if (aktifAnlasma.detay) metin += `📝 *Notlar:* ${aktifAnlasma.detay}\n\n`

    const anlasmaDosyalari = dosyalar.filter(d => d.anlasma_id === aktifAnlasma.id)
    if (anlasmaDosyalari.length > 0) {
      metin += `📎 *İlgili Dosyalar/Sözleşmeler:*\n`
      anlasmaDosyalari.forEach((d, i) => {
        metin += `${i+1}. Dosya: ${getGoogleDriveViewUrl(d.url)}\n`
      })
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${kalemAdi} Anlaşması`,
          text: metin
        })
      } catch (err) {
        console.error('Paylaşım hatası:', err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(metin)
        alert('Anlaşma detayları panoya kopyalandı! WhatsApp veya istediğiniz bir yere yapıştırabilirsiniz.')
      } catch (err) {
        alert('Kopyalama işlemi başarısız oldu.')
      }
    }
  }

  const santiyeSecimDegistir = (sId) => {
    setForm(prev => {
      const yeniSantiyeler = prev.seciliSantiyeler.includes(sId)
        ? prev.seciliSantiyeler.filter(id => id !== sId)
        : [...prev.seciliSantiyeler, sId]
      return { ...prev, seciliSantiyeler: yeniSantiyeler }
    })
  }

  return (
    <div className="sayfa">
      <style>{`
        @media print {
          .ust-bar { display: none !important; }
          .alt-menu { display: none !important; }
          .btn-print-hide { display: none !important; }
          .sayfa { padding: 0 !important; margin: 0 !important; background: white !important; }
          body { background: white !important; }
          table { width: 100% !important; border: 1px solid #ddd; }
          th, td { border: 1px solid #ddd !important; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1D9596', letterSpacing: '-0.3px' }}>Anlaşma & Planlama</h2>
        <button 
          onClick={() => window.print()}
          className="btn-print-hide"
          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #1D9596', color: '#1D9596', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Matrisi Yazdır
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ padding: '16px 20px', background: '#fcfcf9', borderBottom: '2px solid rgba(29, 149, 150, 0.1)', borderRight: '1px solid rgba(0,0,0,0.04)', minWidth: 180, position: 'sticky', left: 0, zIndex: 2 }}>
                  <div style={{ color: '#555', fontSize: 13, fontWeight: 700 }}>İmalat Kalemi</div>
                </th>
                {gecerliSantiyeler.map(s => (
                  <th key={s.id} style={{ padding: '16px 12px', background: '#fcfcf9', borderBottom: '2px solid rgba(29, 149, 150, 0.1)', borderRight: '1px solid rgba(0,0,0,0.04)', minWidth: 160, textAlign: 'center' }}>
                    <div style={{ color: '#2b2b2b', fontSize: 13, fontWeight: 700 }}>{s.ad}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kalemler.map((kalem, index) => (
                <tr key={kalem.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                  <td style={{ padding: '14px 20px', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.04)', position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: '#444', fontSize: 14, fontWeight: 600 }}>{kalem.ad}</div>
                      <div className="btn-print-hide" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {index > 0 && (
                          <button onClick={() => kalemSiraDegistir(index, 'yukari')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa' }} title="Yukarı Taşı">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                          </button>
                        )}
                        {index < kalemler.length - 1 && (
                          <button onClick={() => kalemSiraDegistir(index, 'asagi')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa' }} title="Aşağı Taşı">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                  {gecerliSantiyeler.map(santiye => {
                    const ilgiliAnlasmalar = anlasmalar.filter(a => a.kalem_id === kalem.id)
                    const hucreAnlasmasi = ilgiliAnlasmalar.find(a => 
                      anlasmaSantiyeler.some(as => as.anlasma_id === a.id && as.santiye_id === santiye.id)
                    )

                    return (
                      <td 
                        key={santiye.id} 
                        style={{ padding: '6px', borderRight: '1px solid rgba(0,0,0,0.02)' }}
                      >
                        {hucreAnlasmasi ? (
                          <div 
                            onClick={() => hucreTikla(kalem.id, santiye.id)}
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: 'white',
                              borderRadius: 10,
                              padding: '12px 10px',
                              cursor: 'pointer',
                              textAlign: 'center',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                              transition: 'transform 0.2s, boxShadow 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{hucreAnlasmasi.tedarikci}</div>
                            <div style={{ fontSize: 11, opacity: 0.9 }}>
                              {Number(hucreAnlasmasi.tutar).toLocaleString('tr-TR')} {hucreAnlasmasi.para_birimi} 
                              <span style={{ opacity: 0.7, fontSize: 10, display: 'block', marginTop: 2 }}>
                                ({hucreAnlasmasi.fiyat_tipi === 'Birim Fiyat' ? 'Birim' : 'Toplam'})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => hucreTikla(kalem.id, santiye.id)}
                            className="btn-print-hide"
                            style={{
                              background: 'rgba(0,0,0,0.02)',
                              border: '1px dashed rgba(0,0,0,0.1)',
                              borderRadius: 10,
                              height: 60,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'rgba(0,0,0,0.3)',
                              transition: 'background 0.2s, color 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(29, 149, 150, 0.05)'; e.currentTarget.style.color = '#1D9596' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; e.currentTarget.style.color = 'rgba(0,0,0,0.3)' }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="btn-print-hide">
                <td style={{ padding: '14px 20px', background: '#fff', position: 'sticky', left: 0, zIndex: 1 }}>
                  {!kalemEkleAcik ? (
                    <button 
                      onClick={() => setKalemEkleAcik(true)}
                      style={{ padding: '8px 12px', background: 'transparent', border: '1px dashed #1D9596', borderRadius: 8, color: '#1D9596', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                    >
                      + Yeni Kalem Ekle
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input 
                        type="text" 
                        placeholder="Kalem Adı" 
                        value={yeniKalemAd}
                        onChange={e => setYeniKalemAd(e.target.value)}
                        style={{ flex: 1, padding: '8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13, outline: 'none' }}
                        autoFocus
                      />
                      <button onClick={kalemEkle} style={{ padding: '8px 12px', background: '#1D9596', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Ekle</button>
                    </div>
                  )}
                </td>
                <td colSpan={gecerliSantiyeler.length} style={{ padding: '14px', background: '#fafafa' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {modalAcik && (
        <div className="btn-print-hide" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#2b2b2b' }}>
                {aktifAnlasma ? 'Anlaşma Detayı' : 'Yeni Anlaşma Ekle'}
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {aktifAnlasma && (
                  <button onClick={anlasmaPaylas} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }} title="WhatsApp veya panoya kopyala">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Paylaş
                  </button>
                )}
                <button onClick={() => setModalAcik(false)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#888' }}>&times;</button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ background: '#f4f3ed', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 4 }}>İmalat Kalemi</div>
                <div style={{ fontSize: 15, color: '#1D9596', fontWeight: 700 }}>{kalemler.find(k => k.id === seciliHems?.kalemId)?.ad}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 6 }}>Tedarikçi / Taşeron Adı</label>
                <input 
                  type="text" 
                  value={form.tedarikci}
                  onChange={e => setForm({...form, tedarikci: e.target.value})}
                  placeholder="Örn: X Yapı A.Ş."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fcfcf9', fontSize: 14, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 6 }}>Fiyat Tipi</label>
                  <select 
                    value={form.fiyat_tipi}
                    onChange={e => setForm({...form, fiyat_tipi: e.target.value})}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fcfcf9', fontSize: 14, outline: 'none' }}
                  >
                    <option value="Birim Fiyat">Birim Fiyat</option>
                    <option value="Toplam Fiyat">Toplam Fiyat</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 6 }}>Tutar</label>
                  <input 
                    type="number" 
                    value={form.tutar}
                    onChange={e => setForm({...form, tutar: e.target.value})}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fcfcf9', fontSize: 14, outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 6 }}>Birim</label>
                  <select 
                    value={form.para_birimi}
                    onChange={e => setForm({...form, para_birimi: e.target.value})}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fcfcf9', fontSize: 14, outline: 'none' }}
                  >
                    <option value="TL">TL</option>
                    <option value="USD">Dolar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 6 }}>Açıklama & Notlar</label>
                <textarea 
                  value={form.detay}
                  onChange={e => setForm({...form, detay: e.target.value})}
                  rows={3}
                  placeholder="Vade, ödeme planı veya ekstra notlar..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.1)', background: '#fcfcf9', fontSize: 14, outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 8 }}>Kapsayan Şantiyeler (Çoklu Seçim)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {gecerliSantiyeler.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: form.seciliSantiyeler.includes(s.id) ? 'rgba(29, 149, 150, 0.08)' : '#fcfcf9', border: form.seciliSantiyeler.includes(s.id) ? '1px solid rgba(29, 149, 150, 0.3)' : '1px solid rgba(0,0,0,0.06)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input 
                        type="checkbox" 
                        checked={form.seciliSantiyeler.includes(s.id)} 
                        onChange={() => santiyeSecimDegistir(s.id)} 
                        style={{ accentColor: '#1D9596' }}
                      />
                      <span style={{ fontSize: 13, color: form.seciliSantiyeler.includes(s.id) ? '#1D9596' : '#555', fontWeight: form.seciliSantiyeler.includes(s.id) ? 600 : 500 }}>{s.ad}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, color: '#444', fontWeight: 600, display: 'block', marginBottom: 8 }}>Sözleşme / Dosya Yükle</label>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#fcfcf9', border: '1.5px dashed rgba(29, 149, 150, 0.3)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D9596" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{secilenDosyalar.length > 0 ? `${secilenDosyalar.length} dosya seçildi` : 'Belge veya fotoğraf seçmek için tıklayın'}</span>
                  <input type="file" multiple hidden onChange={(e) => setSecilenDosyalar(Array.from(e.target.files))} />
                </label>

                {/* Mevcut dosyalar */}
                {aktifAnlasma && dosyalar.filter(d => d.anlasma_id === aktifAnlasma.id).length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 8 }}>Yüklenmiş Dosyalar:</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {dosyalar.filter(d => d.anlasma_id === aktifAnlasma.id).map(f => (
                        <a key={f.id} href={getGoogleDriveViewUrl(f.url)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <div style={{ padding: '8px 12px', background: '#f0f7f7', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, color: '#1D9596', fontSize: 12, fontWeight: 600, border: '1px solid rgba(29, 149, 150, 0.2)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            Belge Gör
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {aktifAnlasma && (
                  <button 
                    onClick={anlasmaSil}
                    disabled={yukleniyor}
                    style={{ flex: 1, padding: '14px', background: '#fff', border: '1px solid #ef4444', borderRadius: 12, color: '#ef4444', fontWeight: 700, cursor: 'pointer', opacity: yukleniyor ? 0.7 : 1 }}
                  >
                    Sil
                  </button>
                )}
                <button 
                  onClick={anlasmaKaydet} 
                  disabled={yukleniyor}
                  style={{ flex: aktifAnlasma ? 2 : 1, padding: '14px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(29, 149, 150, 0.25)', opacity: yukleniyor ? 0.7 : 1 }}
                >
                  {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
