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
  { anahtar: 'malzeme', etiket: 'Şantiyeye Gelen Malzemeler', simge: '📦' },
  { anahtar: 'ekipman', etiket: 'Ekipman / İş Makinesi', simge: '🚜' },
  { anahtar: 'yapilan_is', etiket: 'İmalat (Ne İş Yapıldı)', simge: '🔨' },
  { anahtar: 'diger', etiket: 'Diğer', simge: '📝' },
  { anahtar: 'sorunlar', etiket: 'Sorunlar', simge: '⚠️' },
]

export default function GunlukRapor() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const [gorunum, setGorunum] = useState('liste') // 'liste' | 'takvim' | 'ekle'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [raporlar, setRaporlar] = useState([])
  const [takvimAyi, setTakvimAyi] = useState(bugun())
  const [detayAcikId, setDetayAcikId] = useState(null)
  const [fotograflar, setFotograflar] = useState({}) // { raporId: [url, ...] }

  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniTarih, setYeniTarih] = useState(bugun())
  const [alanlar, setAlanlar] = useState({ malzeme: '', ekipman: '', yapilan_is: '', diger: '', sorunlar: '' })
  const [yeniFotograflar, setYeniFotograflar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

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

  const raporSil = async (id) => {
    if (!window.confirm('Bu raporu silmek istediğinize emin misiniz?')) return
    
    // Fotoğrafları silinenlere taşı
    const { data: fotolar } = await supabase.from('gunluk_rapor_fotograflari').select('*').eq('rapor_id', id)
    if (fotolar && fotolar.length > 0) {
      const r = raporlar.find((x) => x.id === id)
      const s = santiyeler.find((x) => x.id === (r ? r.santiye_id : null))
      const folderName = `GunlukRapor/${s ? s.ad : 'Genel'}`
      
      for (const foto of fotolar) {
        if (isGoogleDriveUrl(foto.url) || String(foto.url).match(/^[a-zA-Z0-9_-]{25,}$/)) {
          await moveToSilinenler(foto.url, folderName)
        }
      }
    }

    await supabase.from('gunluk_raporlar').delete().eq('id', id)
    raporlariYukle()
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
          const response = await fetch(foto.url)
          const blob = await response.blob()
          const file = new File([blob], `rapor_foto_${i + 1}.jpg`, { type: blob.type })
          dosyalar.push(file)
        } catch (e) {
          console.error('Fotoğraf indirilemedi:', e)
        }
      }

      let metin = `📋 *GÜNLÜK RAPOR* — ${new Date(r.tarih).toLocaleDateString('tr-TR')}\n`
      metin += `🏗 *Şantiye:* ${r.santiyeler?.ad || '—'}\n\n`
      
      ALANLAR.forEach((a) => {
        if (r[a.anahtar]) metin += `${a.simge} *${a.etiket}*\n${r[a.anahtar]}\n\n`
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
  const gunRaporSayisi = {}
  raporlar.forEach((r) => { gunRaporSayisi[r.tarih] = (gunRaporSayisi[r.tarih] || 0) + 1 })

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Günlük Rapor</h2>
        <button className="ekle-buton-genis" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setGorunum('ekle')}>+ Rapor Ekle</button>
      </div>

      {gorunum !== 'ekle' && (
        <>
          <div className="filtre-satiri">
            <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
            {santiyeler.map((s) => (
              <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
            ))}
          </div>

          <div className="gorunum-secici" style={{ marginBottom: 14 }}>
            <button className={gorunum === 'liste' ? 'secili-tab' : ''} onClick={() => setGorunum('liste')}>Liste</button>
            <button className={gorunum === 'takvim' ? 'secili-tab' : ''} onClick={() => setGorunum('takvim')}>Takvim</button>
          </div>
        </>
      )}

      {gorunum === 'liste' && (
        <div className="liste">
          {raporlar.map((r) => (
            <div key={r.id} className="kart">
              <div className="kart-ust" onClick={() => detayAc(r.id)} style={{ cursor: 'pointer' }}>
                <div>
                  <span className="kart-baslik">{detayAcikId === r.id ? '▾' : '▸'} {new Date(r.tarih).toLocaleDateString('tr-TR')}</span>
                  <span className="etiket etiket-vurgu" style={{ marginLeft: 8 }}>{r.santiyeler?.ad}</span>
                </div>
                <button className="sil-buton" onClick={(e) => { e.stopPropagation(); raporSil(r.id) }} aria-label="Sil">🗑</button>
              </div>
              <div className="gorev-alt-bilgi">Ekleyen: {r.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(r.created_at).toLocaleDateString('tr-TR')} {new Date(r.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>

              {detayAcikId === r.id && (
                <div style={{ marginTop: 10 }}>
                  {ALANLAR.map((a) => r[a.anahtar] && (
                    <div key={a.anahtar} style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 2px' }}>{a.simge} {a.etiket}</p>
                      <p className="not-icerik">{r[a.anahtar]}</p>
                    </div>
                  ))}
                  {(fotograflar[r.id] || []).length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {fotograflar[r.id].map((f) => (
                        <a key={f.id} href={getGoogleDriveViewUrl(f.url)} target="_blank" rel="noreferrer">
                          <img src={getGoogleDriveInlineImageUrl(f.url)} alt="Rapor fotoğrafı" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8 }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp ile Çoklu Görsel ve Metin Gönderme Butonu */}
              <button 
                onClick={() => raporPaylas(r)}
                style={{ 
                  marginTop: 10, 
                  width: '100%', 
                  padding: '8px 12px', 
                  background: '#25D366', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 6, 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  fontSize: 12, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 6 
                }}
              >
                💬 WhatsApp ile Paylaş
              </button>
            </div>
          ))}
          {raporlar.length === 0 && <p className="bos-mesaj">Bu filtrede rapor yok.</p>}
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
            <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
            <input type="date" value={yeniTarih} onChange={(e) => setYeniTarih(e.target.value)} />
          </div>

          {ALANLAR.map((a) => (
            <div key={a.anahtar}>
              <label style={{ fontSize: 12, color: '#5F5E5A' }}>{a.simge} {a.etiket}</label>
              <textarea
                value={alanlar[a.anahtar]}
                onChange={(e) => setAlanlar((o) => ({ ...o, [a.anahtar]: e.target.value }))}
                rows={2}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginTop: 4 }}
              />
            </div>
          ))}

          <label className="dosya-buton">
            📷 {yeniFotograflar.length > 0 ? `${yeniFotograflar.length} fotoğraf seçildi` : 'Fotoğraf / Galeri ekle'}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setYeniFotograflar(Array.from(e.target.files))} />
          </label>

          <div className="ekleme-satiri-2">
            <button onClick={() => setGorunum('liste')}>Vazgeç</button>
            <button className="ekle-buton-genis" onClick={raporEkle} disabled={yukleniyor}>
              {yukleniyor ? 'Kaydediliyor...' : 'Raporu kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}