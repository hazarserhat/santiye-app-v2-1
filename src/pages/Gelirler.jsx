import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { uploadToGoogleDrive, moveToSilinenler, isGoogleDriveUrl, getGoogleDriveInlineImageUrl, getGoogleDriveViewUrl } from '../lib/googleDrive'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'
import Cekler from './Cekler'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Gelirler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'
  const [sekme, setSekme] = useState('gelir') // 'gelir' | 'cek'

  const [gelirler, setGelirler] = useState([])
  const [malikler, setMalikler] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')

  const [santiyeId, setSantiyeId] = useState('')
  const [malikId, setMalikId] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [odemeYapanAdi, setOdemeYapanAdi] = useState('')
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(bugun())
  const [tahsilatNoktasi, setTahsilatNoktasi] = useState('Merkez Kasa')
  const [notMetni, setNotMetni] = useState('')
  const [belge, setBelge] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  // Düzenleme state'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzTutar, setDuzTutar] = useState('')
  const [duzTarih, setDuzTarih] = useState('')
  const [duzNot, setDuzNot] = useState('')
  const [duzOdemeYapan, setDuzOdemeYapan] = useState('')
  const [duzTahsilatNoktasi, setDuzTahsilatNoktasi] = useState('')

  const TAHSILAT_NOKTALARI = [
    'Merkez Kasa', 'Serhat Kasa', 'Fuat Kasa', 'Abdullah Kasa',
    'Ruha Ziraat', 'Ruha QNB', 'Ruha Garanti', 'Şantiye Şefleri'
  ]

  // Clipboard paste ref
  const dosyaAlaniRef = useRef(null)

  useEffect(() => {
    if (aktifSantiye) setSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    gelirleriYukle()
    supabase.from('malikler').select('*').order('ad_soyad').then(({ data }) => setMalikler(data || []))
  }, [])

  // Clipboard yapıştırma (Ctrl+V ile görüntü yükleme)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const yeniDosya = new File([file], `pano_gorseli_${Date.now()}.png`, { type: file.type })
            setBelge(yeniDosya)
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const panodanYapistir = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type)
            const file = new File([blob], `pano_gorseli_${Date.now()}.png`, { type: blob.type })
            setBelge(file)
            return
          }
        }
      }
      alert('Panoda bir görsel bulunamadı.')
    } catch (err) {
      console.error(err)
      alert('Panoya erişim sağlanamadı. (Cihazınız bu özelliği desteklemiyor veya izin reddedildi)')
    }
  }

  const gelirleriYukle = async () => {
    const { data, error } = await supabase.from('gelirler').select('*, santiyeler(ad), malikler(ad_soyad)').order('tarih', { ascending: false })
    if (error) { alert('Gelirler yüklenemedi: ' + error.message); return }
    setGelirler(data || [])
  }

  const malikSecildi = (id) => {
    setMalikId(id)
    const m = malikler.find((x) => x.id === id)
    if (m) setOdemeYapanAdi(m.ad_soyad)
  }

  const cariSecildi = (isim, cariId) => {
    setOdemeYapanAdi(isim)
    setSecilenCariId(cariId || null)
  }

  const malikleriSantiyeyeGoreFiltrele = (sId) => malikler.filter((m) => m.santiye_id === sId)

  const gelirEkle = async () => {
    if (!santiyeId || !tutar) { alert('Şantiye ve tutar zorunludur.'); return }
    setYukleniyor(true)

    let belgeUrl = null
    if (belge) {
      const seciliSantiye = santiyeler.find((s) => s.id === santiyeId)
      const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
      const folderName = `Gelirler/${santiyeAdi}/${tahsilatNoktasi || 'Diger'}`
      
      const seciliMalik = malikler.find((x) => x.id === malikId)
      const odenenAdi = odemeYapanAdi || seciliMalik?.ad_soyad || profile?.ad_soyad || 'ISIMSIZ'
      const kisaNot = notMetni ? notMetni.substring(0, 20) : 'Tahsilat'
      const adSoyad = `${kisaNot}-${odenenAdi}`

      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: belge,
          folderName,
          adSoyad,
          date: tarih,
        })
        belgeUrl = driveSonuc.url
      } catch (err) {
        console.error('Google Drive yükleme hatası:', err)
        alert('Görsel Google Drive\'a yüklenemedi: ' + err.message)
        setYukleniyor(false)
        return
      }
    }

    const { error } = await supabase.from('gelirler').insert({
      santiye_id: santiyeId,
      malik_id: malikId || null,
      cari_id: secilenCariId || null,
      odeme_yapan_adi: odemeYapanAdi,
      tutar: temizleTutar(tutar),
      tarih,
      tahsilat_noktasi: tahsilatNoktasi,
      belge_url: belgeUrl,
      not_metni: notMetni,
      ekleyen: profile?.id,
    })

    if (error) { alert('Gelir eklenemedi: ' + error.message); setYukleniyor(false); return }

    setMalikId(''); setSecilenCariId(null); setOdemeYapanAdi(''); setTutar(''); setNotMetni(''); setBelge(null); setTarih(bugun()); setTahsilatNoktasi('Merkez Kasa')
    setYukleniyor(false)
    gelirleriYukle()
  }

  const gelirSil = async (id) => {
    if (!window.confirm('Bu geliri silmek istediğinize emin misiniz?')) return
    const silinecek = gelirler.find((g) => g.id === id)

    if (silinecek?.belge_url) {
      try {
        const seciliSantiye = santiyeler.find((s) => s.id === silinecek.santiye_id)
        const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
        const folderName = `Gelirler/${santiyeAdi}/${silinecek.tahsilat_noktasi || 'Diger'}`
        await moveToSilinenler(silinecek.belge_url, folderName)
      } catch (err) {
        console.warn('Belge Silinenler klasörüne taşınırken hata oluştu:', err)
      }
    }

    const { error } = await supabase.from('gelirler').delete().eq('id', id)
    if (error) {
      alert('Gelir silinemedi: ' + error.message)
      return
    }
    gelirleriYukle()
  }

  const sonradanBelgeEkle = async (g, file) => {
    if (!file) return
    setYukleniyor(true)
    
    const seciliSantiye = santiyeler.find((s) => s.id === g.santiye_id)
    const santiyeAdi = seciliSantiye ? seciliSantiye.ad : 'Genel'
    const folderName = `Gelirler/${santiyeAdi}/${g.tahsilat_noktasi || 'Diger'}`
    
    const seciliMalik = malikler.find((x) => x.id === g.malik_id)
    const odenenAdi = g.odeme_yapan_adi || seciliMalik?.ad_soyad || 'ISIMSIZ'
    const kisaNot = g.not_metni ? g.not_metni.substring(0, 20) : 'Tahsilat'
    const adSoyad = `${kisaNot}-${odenenAdi}`
    
    try {
      const driveSonuc = await uploadToGoogleDrive({
        file,
        folderName,
        adSoyad,
        date: g.tarih || bugun(),
      })
      await supabase.from('gelirler').update({ belge_url: driveSonuc.url }).eq('id', g.id)
      gelirleriYukle()
    } catch (err) {
      alert('Belge Google Drive\'a yüklenemedi: ' + err.message)
    }
    setYukleniyor(false)
  }

  const gelirDuzenle = async (id) => {
    const { error } = await supabase.from('gelirler').update({
      tutar: temizleTutar(duzTutar),
      tarih: duzTarih,
      not_metni: duzNot,
      odeme_yapan_adi: duzOdemeYapan,
      tahsilat_noktasi: duzTahsilatNoktasi,
    }).eq('id', id)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenId(null)
    gelirleriYukle()
  }

  const muhasebePaylasimGuncelle = async (id, deger) => {
    const { error } = await supabase.from('gelirler').update({ muhasebe_paylasim: deger }).eq('id', id)
    if (error) {
      alert("Durum güncellenirken veritabanı hatası oluştu. Lütfen sayfayı yenileyin.\nDetay: " + error.message)
      return
    }
    setGelirler((onceki) => onceki.map((g) => g.id === id ? { ...g, muhasebe_paylasim: deger } : g))
  }

  const gelirPaylas = async (g) => {
    try {
      let dosyalar = []
      if (g.belge_url) {
        const response = await fetch(g.belge_url)
        const blob = await response.blob()
        const ext = blob.type.includes('pdf') ? 'pdf' : (blob.type.includes('png') ? 'png' : 'jpg')
        const dosyaAdi = g.odeme_yapan_adi ? `${g.odeme_yapan_adi.replace(/[^a-zA-Z0-9]/gi, '_').toLowerCase()}.${ext}` : `gelir_belgesi.${ext}`
        const file = new File([blob], dosyaAdi, { type: blob.type })
        dosyalar.push(file)
      }

      const yatanKisi = g.odeme_yapan_adi || g.malikler?.ad_soyad || 'İsimsiz'
      const santiyeAdi = g.santiyeler?.ad || 'Şantiye'
      const metin =
        `📈 *PROJE GELİR / TAHSİLAT BİLDİRİMİ*\n` +
        `👤 *Ödeme Yapan:* ${yatanKisi}\n` +
        `🏗 *Şantiye:* ${santiyeAdi}\n` +
        `💵 *Tutar:* ${paraFormatla(g.tutar)} ₺\n` +
        `📍 *Tahsilat Noktası:* ${g.tahsilat_noktasi || 'Belirtilmedi'}\n` +
        `📅 *Tarih:* ${g.tarih ? new Date(g.tarih).toLocaleDateString('tr-TR') : '—'}\n` +
        (g.not_metni ? `📝 *Not:* ${g.not_metni}` : '')

      if (navigator.canShare && navigator.canShare({ files: dosyalar })) {
        await navigator.share({ title: 'Gelir Belgesi', text: metin, files: dosyalar })
      } else if (navigator.share) {
        await navigator.share({ title: 'Gelir Belgesi', text: metin + (g.belge_url ? `\n🔗 Belge Linki: ${g.belge_url}` : '') })
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

  const gorunenler = filtreSantiye === 'hepsi' ? gelirler : gelirler.filter((g) => g.santiye_id === filtreSantiye)

  return (
    <div className="sayfa">
      <h2>Gelirler</h2>

      {/* SEKME SEÇİCİ (yönetici için) */}
      {yonetici && (
        <div className="gorunum-secici" style={{ marginBottom: 14 }}>
          <button className={sekme === 'gelir' ? 'secili-tab' : ''} onClick={() => setSekme('gelir')}>Nakit / Havale Girdileri</button>
          <button className={sekme === 'cek' ? 'secili-tab' : ''} onClick={() => setSekme('cek')}>Alınan Çek Girdileri</button>
        </div>
      )}

      {sekme === 'cek' && yonetici ? (
        <Cekler yon="alinan" />
      ) : (
        <>
          {/* YENİ GELİR EKLEME ALANI */}
          <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
            <select value={santiyeId} onChange={(e) => { setSantiyeId(e.target.value); setMalikId('') }}>
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>

            <select value={malikId} onChange={(e) => malikSecildi(e.target.value)}>
              <option value="">Malik seç (opsiyonel)...</option>
              {malikleriSantiyeyeGoreFiltrele(santiyeId).map((m) => <option key={m.id} value={m.id}>{m.ad_soyad}</option>)}
            </select>

            <CariAramaSecici
              deger={odemeYapanAdi}
              onDegisti={cariSecildi}
              placeholder="Cari / Ortak Ara (opsiyonel)..."
            />

            <input type="text" placeholder="Ödeme yapanın adı" value={odemeYapanAdi} onChange={(e) => setOdemeYapanAdi(e.target.value)} />

            <div className="ekleme-satiri-2">
              <input type="text" placeholder="Tahsilat tutarı (₺)..." value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
              <select value={tahsilatNoktasi} onChange={(e) => setTahsilatNoktasi(e.target.value)}>
                {TAHSILAT_NOKTALARI.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tarih</label>
              <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>

            <textarea
              placeholder="Not (opsiyonel)..."
              value={notMetni}
              onChange={(e) => setNotMetni(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />

            {/* Belge yükleme alanı — clipboard paste destekli */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <label style={{ fontSize: 12, color: '#5F5E5A', fontWeight: 600 }}>Fiş / Fatura / Görsel Ekle:</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="dosya-buton" style={{ flex: 1 }}>
                  📷 {belge ? belge.name.slice(0, 22) : 'Dosya seç'}
                  <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBelge(e.target.files[0])} />
                </label>
                <button type="button" onClick={panodanYapistir} style={{ padding: '8px 12px', background: '#e6f0ff', color: '#0056b3', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  📋 Yapıştır
                </button>
                {belge && (
                  <button onClick={() => setBelge(null)} style={{ padding: '6px 10px', background: '#ffe6e6', color: '#d9534f', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    ✕ Kaldır
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>💡 Görüntü kopyaladıktan sonra Ctrl+V ile de yapıştırabilirsiniz.</p>
            </div>

            <button className="ekle-buton-genis" onClick={gelirEkle} disabled={yukleniyor}>
              {yukleniyor ? 'Ekleniyor...' : 'Geliri kaydet'}
            </button>
          </div>

          <div className="filtre-satiri">
            <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
            {santiyeler.map((s) => (
              <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
            ))}
          </div>

          {/* LİSTE */}
          <div className="liste">
            {gorunenler.map((g) => (
              <div key={g.id} className="kart">
                {duzenlenenId === g.id && yonetici ? (
                  /* DÜZENLEME MODU */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input type="text" value={duzOdemeYapan} onChange={(e) => setDuzOdemeYapan(e.target.value)} placeholder="Ödeme yapan" />
                    <div className="ekleme-satiri-2">
                      <input type="text" value={duzTutar} onChange={(e) => setDuzTutar(formatInputTutar(e.target.value))} placeholder="Tutar" onKeyDown={sadeceSayiTuslari} />
                      <select value={duzTahsilatNoktasi} onChange={(e) => setDuzTahsilatNoktasi(e.target.value)}>
                        <option value="">Tahsilat Noktası Seç...</option>
                        {TAHSILAT_NOKTALARI.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <input type="date" value={duzTarih} onChange={(e) => setDuzTarih(e.target.value)} />
                    <textarea value={duzNot} onChange={(e) => setDuzNot(e.target.value)} placeholder="Not" rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setDuzenlenenId(null)} style={{ flex: 1, padding: '8px', background: '#f0f0ed', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Vazgeç</button>
                      <button onClick={() => gelirDuzenle(g.id)} style={{ flex: 1, padding: '8px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Kaydet</button>
                    </div>
                  </div>
                ) : (
                  /* NORMAL GÖRÜNÜM */
                  <>
                    <div className="kart-ust">
                      <span className="kart-baslik">{g.odeme_yapan_adi || g.malikler?.ad_soyad || 'İsimsiz'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="kart-tutar">{paraFormatla(g.tutar)} ₺</span>
                        {yonetici && (
                          <button className="sil-buton" onClick={() => {
                            setDuzenlenenId(g.id)
                            setDuzTutar(formatInputTutar(g.tutar))
                            setDuzTarih(g.tarih)
                            setDuzNot(g.not_metni || '')
                            setDuzOdemeYapan(g.odeme_yapan_adi || '')
                            setDuzTahsilatNoktasi(g.tahsilat_noktasi || 'Merkez Kasa')
                          }} aria-label="Düzenle">✎</button>
                        )}
                        <input
                          type="file"
                          id={`gorsel-sec-glr-${g.id}`}
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => sonradanBelgeEkle(g, e.target.files[0])}
                        />
                        <button className="sil-buton" onClick={() => document.getElementById(`gorsel-sec-glr-${g.id}`).click()} aria-label="Görsel Ekle/Değiştir" title="Görsel Ekle/Değiştir">🖼️</button>
                        <button className="sil-buton" onClick={() => gelirSil(g.id)} aria-label="Sil">🗑</button>
                      </div>
                    </div>
                    <div className="etiket-satiri">
                      <span className="etiket etiket-vurgu">{g.santiyeler?.ad}</span>
                      <span className="etiket">{new Date(g.tarih).toLocaleDateString('tr-TR')}</span>
                      {g.tahsilat_noktasi && <span className="etiket" style={{ background: '#E3F2FD', color: '#1976D2', border: '1px solid #BBDEFB' }}>📍 {g.tahsilat_noktasi}</span>}
                    </div>
                    {g.not_metni && <p className="not-icerik" style={{ marginTop: 6 }}>{g.not_metni}</p>}

                    {g.belge_url && (
                      <div style={{ marginTop: 8 }}>
                        {g.belge_url.toLowerCase().includes('.pdf') ? (
                          <a href={getGoogleDriveViewUrl(g.belge_url)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#F1EFE8', borderRadius: 6, textDecoration: 'none', color: '#2C3E50', fontWeight: 500, fontSize: 13, border: '1px solid #D3D1C7' }}>
                            📄 PDF Belgesini Aç / Görüntüle
                          </a>
                        ) : (
                          <a href={getGoogleDriveViewUrl(g.belge_url)} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={getGoogleDriveInlineImageUrl(g.belge_url)} 
                              alt="Gelir Belgesi" 
                              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid #d3d1c7' }} 
                              onError={(e) => {
                                e.target.style.display = 'none'
                                if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex'
                              }}
                            />
                            <div style={{ display: 'none', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#F1EFE8', borderRadius: 6, color: '#2C3E50', fontWeight: 500, fontSize: 13, border: '1px solid #D3D1C7' }}>
                              📄 Belgeyi Görüntüle
                            </div>
                          </a>
                        )}
                      </div>
                    )}

                    {/* Muhasebe Paylaşım Kutucuğu */}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                      padding: '7px 10px', borderRadius: 6,
                      background: g.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
                      border: `1px solid ${g.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
                      cursor: 'pointer', userSelect: 'none', fontSize: 12, fontWeight: 600,
                      color: g.muhasebe_paylasim ? '#2E7D32' : '#F57F17',
                    }}>
                      <input type="checkbox" checked={!!g.muhasebe_paylasim} onChange={(e) => muhasebePaylasimGuncelle(g.id, e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4CAF50' }} />
                      {g.muhasebe_paylasim ? '✅ Muhasebeye gönderildi' : '⏳ Muhasebeye gönderilmedi'}
                    </label>

                    <button onClick={() => gelirPaylas(g)} style={{ marginTop: 6, width: '100%', padding: '8px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      💬 WhatsApp ile Paylaş
                    </button>
                  </>
                )}
              </div>
            ))}
            {gorunenler.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
          </div>
        </>
      )}
    </div>
  )
}