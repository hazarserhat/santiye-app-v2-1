import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import {
  uploadToGoogleDrive,
  getGoogleDriveInlineImageUrl,
  getGoogleDriveViewUrl,
  moveToSilinenler,
  isGoogleDriveUrl
} from '../lib/googleDrive'

const bugun = () => new Date().toISOString().slice(0, 10)
const gunEkle = (t, n) => {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const ALANLAR = [
  { anahtar: 'malzeme', etiket: 'Şantiyeye Gelen Malzemeler', emoji: '📦', simge: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> },
  { anahtar: 'ekipman', etiket: 'Ekipman / İş Makinesi', emoji: '🚜', simge: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> },
  { anahtar: 'yapilan_is', etiket: 'İmalat (Ne İş Yapıldı)', emoji: '🔨', simge: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg> },
  { anahtar: 'diger', etiket: 'Diğer', emoji: '📝', simge: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> },
  { anahtar: 'sorunlar', etiket: 'Sorunlar', emoji: '⚠️', simge: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> },
]

export default function GunlukRapor() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const [gorunum, setGorunum] = useState('liste') // 'liste' | 'takvim' | 'ekle'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreEkleyen, setFiltreEkleyen] = useState('hepsi')
  const [filtreAcik, setFiltreAcik] = useState(false)
  
  const [raporlar, setRaporlar] = useState([])
  const [takvimAyi, setTakvimAyi] = useState(bugun())
  const [detayAcikId, setDetayAcikId] = useState(null)
  const [fotograflar, setFotograflar] = useState({}) // { raporId: [url, ...] }

  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniTarih, setYeniTarih] = useState(bugun())
  const [alanlar, setAlanlar] = useState({ malzeme: '', ekipman: '', yapilan_is: '', diger: '', sorunlar: '' })
  const [yeniFotograflar, setYeniFotograflar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzAlanlar, setDuzAlanlar] = useState({ malzeme: '', ekipman: '', yapilan_is: '', diger: '', sorunlar: '' })

  useEffect(() => {
    if (aktifSantiye) setYeniSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    raporlariYukle()
  }, [filtreSantiye])

  const raporlariYukle = async () => {
    let sorgu = supabase.from('gunluk_raporlar').select('*, santiyeler(ad), profiles(ad_soyad)').order('tarih', { ascending: false })
    if (filtreSantiye !== 'hepsi') sorgu = sorgu.eq('santiye_id', filtreSantiye)
    const { data, error } = await sorgu
    if (error) { alert('Raporlar yüklenemedi: ' + error.message); return }
    setRaporlar(data || [])
  }

  const fotograflariYukle = async (raporId) => {
    if (fotograflar[raporId]) return
    const { data } = await supabase.from('gunluk_rapor_fotograflari').select('*').eq('rapor_id', raporId)
    setFotograflar((onceki) => ({ ...onceki, [raporId]: data || [] }))
  }

  const detayAc = async (id) => {
    const yeniDurum = detayAcikId === id ? null : id
    setDetayAcikId(yeniDurum)
    if (yeniDurum) {
      await fotograflariYukle(id)
    }
  }

  const raporEkle = async () => {
    if (!yeniSantiyeId) { alert('Lütfen şantiye seçin.'); return }
    setYukleniyor(true)
    const { data, error } = await supabase.from('gunluk_raporlar').insert({
      santiye_id: yeniSantiyeId,
      tarih: yeniTarih,
      malzeme: alanlar.malzeme,
      ekipman: alanlar.ekipman,
      yapilan_is: alanlar.yapilan_is,
      diger: alanlar.diger,
      sorunlar: alanlar.sorunlar,
      olusturan: profile?.id,
    }).select().single()

    if (error) { alert('Rapor eklenemedi: ' + error.message); setYukleniyor(false); return }

    for (let i = 0; i < yeniFotograflar.length; i++) {
      const dosya = yeniFotograflar[i]
      const seciliSantiye = santiyeler.find((s) => s.id === yeniSantiyeId)
      const folderName = `GunlukRapor/${seciliSantiye ? seciliSantiye.ad : 'Genel'}`
      
      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: dosya,
          folderName,
          adSoyad: `RaporFoto-${i + 1}`,
          date: yeniTarih,
        })
        await supabase.from('gunluk_rapor_fotograflari').insert({ rapor_id: data.id, url: driveSonuc.url })
      } catch (err) {
        console.error('Fotoğraf yükleme hatası:', err)
        alert('Bazı fotoğraflar Google Drive\'a yüklenemedi: ' + err.message)
      }
    }

    setAlanlar({ malzeme: '', ekipman: '', yapilan_is: '', diger: '', sorunlar: '' })
    setYeniFotograflar([])
    setYeniTarih(bugun())
    setYukleniyor(false)
    setGorunum('liste')
    raporlariYukle()
  }

  const raporDuzenlemeyiAc = (r) => {
    setDuzenlenenId(r.id)
    setDuzAlanlar({
      malzeme: r.malzeme || '',
      ekipman: r.ekipman || '',
      yapilan_is: r.yapilan_is || '',
      diger: r.diger || '',
      sorunlar: r.sorunlar || ''
    })
  }

  const raporGuncelle = async (id) => {
    setYukleniyor(true)
    const { error } = await supabase.from('gunluk_raporlar').update({
      malzeme: duzAlanlar.malzeme,
      ekipman: duzAlanlar.ekipman,
      yapilan_is: duzAlanlar.yapilan_is,
      diger: duzAlanlar.diger,
      sorunlar: duzAlanlar.sorunlar,
    }).eq('id', id)
    
    if (error) { alert('Rapor güncellenemedi: ' + error.message); setYukleniyor(false); return }
    
    setDuzenlenenId(null)
    setYukleniyor(false)
    raporlariYukle()
  }

  const canEdit = (r) => {
    if (profile?.sistem_yoneticisi || profile?.rol === 'yonetici') return true;
    const raporTarihGunu = new Date(r.tarih).getTime();
    const bugunGunu = new Date(bugun()).getTime();
    const farkGun = Math.floor((bugunGunu - raporTarihGunu) / (1000 * 3600 * 24));
    return farkGun >= 0 && farkGun <= 2;
  }

  // WhatsApp ile Çoklu Görsel ve Metin Paylaşım Fonksiyonu
  const raporPaylas = async (r) => {
    try {
      // Fotoğraflar henüz yüklenmediyse önce veritabanından çekelim
      let raporFotolari = fotograflar[r.id]
      if (!raporFotolari) {
        const { data } = await supabase.from('gunluk_rapor_fotograflari').select('*').eq('rapor_id', r.id)
        raporFotolari = data || []
        setFotograflar((onceki) => ({ ...onceki, [r.id]: raporFotolari }))
      }

      let dosyalar = []
      for (let i = 0; i < raporFotolari.length; i++) {
        const foto = raporFotolari[i]
        try {
          const fetchUrl = isGoogleDriveUrl(foto.url) ? getGoogleDriveInlineImageUrl(foto.url) : foto.url
          const response = await fetch(fetchUrl)
          const blob = await response.blob()
          let finalMimeType = blob.type
          if (!finalMimeType || finalMimeType.includes('octet-stream') || finalMimeType.includes('binary')) {
            finalMimeType = 'image/jpeg'
          }
          const file = new File([blob], `rapor_foto_${i + 1}.jpg`, { type: finalMimeType })
          dosyalar.push(file)
        } catch (e) {
          console.error('Fotoğraf indirilemedi:', e)
        }
      }

      let metin = `📋 *GÜNLÜK RAPOR* — ${new Date(r.tarih).toLocaleDateString('tr-TR')}\n`
      metin += `🏗 *Şantiye:* ${r.santiyeler?.ad || '—'}\n\n`
      
      ALANLAR.forEach((a) => {
        if (r[a.anahtar]) metin += `${a.emoji} *${a.etiket}*\n${r[a.anahtar]}\n\n`
      })
      metin += `👤 *Ekleyen:* ${r.profiles?.ad_soyad || 'Bilinmiyor'}`

      if (navigator.canShare && navigator.canShare({ files: dosyalar })) {
        await navigator.share({
          title: 'Günlük Rapor',
          text: metin,
          files: dosyalar,
        })
      } else if (navigator.share) {
        await navigator.share({
          title: 'Günlük Rapor',
          text: metin + (raporFotolari.length > 0 ? `\n🔗 Fotoğraflar yüklendi.` : ''),
        })
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Paylaşım hatası:', err)
        alert('Paylaşım sırasında bir hata oluştu.')
      }
    }
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  // Takvim hesaplamaları
  const ilkGunTarih = new Date(takvimAyi.slice(0, 8) + '01')
  const ayAdi = ilkGunTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const ayinGunSayisi = new Date(ilkGunTarih.getFullYear(), ilkGunTarih.getMonth() + 1, 0).getDate()
  const ilkGunHaftaIndeksi = (ilkGunTarih.getDay() + 6) % 7

  const ekleyenler = Array.from(new Set(raporlar.map((r) => r.olusturan))).map((id) => {
    const p = raporlar.find((r) => r.olusturan === id)?.profiles
    return { id, ad: p ? p.ad_soyad : 'Bilinmiyor' }
  }).filter((e) => e.id)

  const filtrelenmisRaporlar = raporlar.filter((r) => {
    if (filtreEkleyen !== 'hepsi' && r.olusturan !== filtreEkleyen) return false
    return true
  })

  const gunRaporSayisi = {}
  filtrelenmisRaporlar.forEach((r) => { gunRaporSayisi[r.tarih] = (gunRaporSayisi[r.tarih] || 0) + 1 })

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1D9596', letterSpacing: '-0.2px' }}>Günlük Rapor</h2>
        <button 
          onClick={() => setGorunum('ekle')}
          style={{ width: 'auto', padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg, #24b8b9, #1D9596)', border: 'none', boxShadow: '0 3px 8px rgba(29, 149, 150, 0.3)', fontWeight: 700, color: 'white', cursor: 'pointer', textShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'all 0.2s', fontSize: 13 }}
        >
          + Rapor Ekle
        </button>
      </div>

      {gorunum !== 'ekle' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)}>
              {filtreAcik ? 'Filtreleri Gizle' : 'Filtreleri Göster'}
            </button>
          </div>

          {filtreAcik && (
            <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
              <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
              <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
                <option value="hepsi">Tüm şantiyeler</option>
                {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              </select>

              <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Ekleyen Kişi</p>
              <select value={filtreEkleyen} onChange={(e) => setFiltreEkleyen(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
                <option value="hepsi">Tümü</option>
                {ekleyenler.map(e => <option key={e.id} value={e.id}>{e.ad}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', background: '#f4f3ed', padding: 4, borderRadius: 10, marginBottom: 16, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            <button 
              onClick={() => setGorunum('liste')}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: gorunum === 'liste' ? '#fff' : 'transparent', color: gorunum === 'liste' ? '#1D9596' : '#5F5E5A', fontWeight: gorunum === 'liste' ? 700 : 500, boxShadow: gorunum === 'liste' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13 }}
            >
              Liste
            </button>
            <button 
              onClick={() => setGorunum('takvim')}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: gorunum === 'takvim' ? '#fff' : 'transparent', color: gorunum === 'takvim' ? '#1D9596' : '#5F5E5A', fontWeight: gorunum === 'takvim' ? 700 : 500, boxShadow: gorunum === 'takvim' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 13 }}
            >
              Takvim
            </button>
          </div>
        </>
      )}

      {gorunum === 'liste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtrelenmisRaporlar.map((r) => (
            <div key={r.id} style={{ background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', border: '1px solid rgba(0,0,0,0.03)', borderRadius: 16, padding: '12px 16px', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255,255,255,0.8)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => detayAc(r.id)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#1D9596', display: 'flex', alignItems: 'center', transition: 'transform 0.2s', transform: detayAcikId === r.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#2b2b2b', letterSpacing: '-0.2px' }}>
                      {new Date(r.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 18, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f0efeb', color: '#555', fontWeight: 600, border: '1px solid rgba(0,0,0,0.03)' }}>{r.santiyeler?.ad}</span>
                    <span style={{ fontSize: 10, color: '#888780' }}>· Ekleyen: {r.profiles?.ad_soyad?.split(' ')[0] || 'Bilinmiyor'}</span>
                    <span style={{ fontSize: 10, color: '#a0a0a0' }}>· Eklenme: {new Date(r.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); raporPaylas(r) }}
                    style={{ 
                      padding: '6px 12px', 
                      background: 'linear-gradient(135deg, #32c45e, #25D366)', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: 8, 
                      cursor: 'pointer', 
                      fontWeight: 700, 
                      fontSize: 11, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 4,
                      boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                    Paylaş
                  </button>
                  {canEdit(r) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); raporDuzenlemeyiAc(r) }} 
                      style={{ 
                        padding: '6px 10px', 
                        background: '#fff', 
                        border: '1px solid rgba(29, 149, 150, 0.2)', 
                        borderRadius: 8, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 4, 
                        cursor: 'pointer', 
                        color: '#1D9596', 
                        fontWeight: 700,
                        fontSize: 11,
                        boxShadow: '0 2px 4px rgba(29, 149, 150, 0.05)', 
                        transition: 'all 0.2s' 
                      }}
                      title="Düzenle"
                    >
                      ✎ Düzenle
                    </button>
                  )}
                </div>
              </div>

              {detayAcikId === r.id && duzenlenenId !== r.id && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  {ALANLAR.map((a) => r[a.anahtar] && (
                    <div key={a.anahtar} style={{ marginBottom: 12, background: '#f8f7f2', padding: 10, borderRadius: 8, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.02)' }}>
                      <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 4px', color: '#1D9596' }}>{a.simge} {a.etiket}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#444', whiteSpace: 'pre-wrap' }}>{r[a.anahtar]}</p>
                    </div>
                  ))}
                  {(fotograflar[r.id] || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {fotograflar[r.id].map((f) => (
                        <a key={f.id} href={getGoogleDriveViewUrl(f.url)} target="_blank" rel="noreferrer">
                          <img src={getGoogleDriveInlineImageUrl(f.url)} alt="Rapor fotoğrafı" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {duzenlenenId === r.id && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  {ALANLAR.map((a) => (
                    <div key={a.anahtar} style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>{a.simge} {a.etiket}</label>
                      <textarea
                        value={duzAlanlar[a.anahtar]}
                        onChange={(e) => setDuzAlanlar((o) => ({ ...o, [a.anahtar]: e.target.value }))}
                        rows={2}
                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginTop: 4, outline: 'none' }}
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button 
                      onClick={() => setDuzenlenenId(null)}
                      style={{ padding: '8px 12px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, color: '#555', fontWeight: 600, cursor: 'pointer' }}
                    >
                      İptal
                    </button>
                    <button 
                      onClick={() => raporGuncelle(r.id)} 
                      disabled={yukleniyor}
                      style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: yukleniyor ? 0.7 : 1 }}
                    >
                      {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtrelenmisRaporlar.length === 0 && <p className="bos-mesaj">Bu filtrede rapor yok.</p>}
        </div>
      )}

      {gorunum === 'takvim' && (
        <>
          <div className="tarih-gezici">
            <button onClick={() => setTakvimAyi((t) => gunEkle(t, -30))}>‹</button>
            <span style={{ textTransform: 'capitalize' }}>{ayAdi}</span>
            <button onClick={() => setTakvimAyi((t) => gunEkle(t, 30))}>›</button>
          </div>
          <div className="takvim-baslik-satiri">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => <span key={g}>{g}</span>)}
          </div>
          <div className="takvim-grid">
            {Array.from({ length: ilkGunHaftaIndeksi }).map((_, i) => <div key={`bos-${i}`} />)}
            {Array.from({ length: ayinGunSayisi }).map((_, i) => {
              const gunTarihi = `${takvimAyi.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
              const sayi = gunRaporSayisi[gunTarihi]
              return (
                <button
                  key={gunTarihi}
                  className={`takvim-gun ${gunTarihi === bugun() ? 'bugun' : ''}`}
                  onClick={() => { if (sayi) { setGorunum('liste'); setDetayAcikId(null) } }}
                >
                  <span className="takvim-gun-no">{i + 1}</span>
                  <span className="takvim-gun-toplam">{sayi ? `${sayi} rapor` : ''}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {gorunum === 'ekle' && (
        <div className="ekleme-kutusu">
          <div className="ekleme-satiri-2">
            <select 
              value={yeniSantiyeId} 
              onChange={(e) => setYeniSantiyeId(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', fontSize: 13, outline: 'none' }}
            >
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
            <input 
              type="date" 
              value={yeniTarih} 
              onChange={(e) => setYeniTarih(e.target.value)} 
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', fontSize: 13, outline: 'none' }}
            />
          </div>

          {ALANLAR.map((a) => (
            <div key={a.anahtar}>
              <label style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>{a.simge} {a.etiket}</label>
              <textarea
                value={alanlar[a.anahtar]}
                onChange={(e) => setAlanlar((o) => ({ ...o, [a.anahtar]: e.target.value }))}
                rows={2}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginTop: 4, outline: 'none' }}
              />
            </div>
          ))}

          <label 
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginTop: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            {yeniFotograflar.length > 0 ? `${yeniFotograflar.length} fotoğraf seçildi` : 'Fotoğraf / Galeri ekle'}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setYeniFotograflar(Array.from(e.target.files))} />
          </label>

          <div className="ekleme-satiri-2" style={{ marginTop: 8 }}>
            <button 
              onClick={() => setGorunum('liste')}
              style={{ padding: '10px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 10, color: '#555', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
            >
              Vazgeç
            </button>
            <button 
              className="ekle-buton-genis" 
              onClick={raporEkle} 
              disabled={yukleniyor}
              style={{ padding: '10px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', opacity: yukleniyor ? 0.7 : 1 }}
            >
              {yukleniyor ? 'Kaydediliyor...' : 'Raporu kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}