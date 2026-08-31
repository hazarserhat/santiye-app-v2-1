import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Cekler() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [cekler, setCekler] = useState([])
  const [bankalar, setBankalar] = useState([])
  const [taseronlar, setTaseronlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  // Düzenleme State'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)

  // Filtre ve Sıralama State'leri
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtrelerAcik, setFiltrelerAcik] = useState(false)
  const [siralamaYonu, setSiralamaYonu] = useState('eklenme_yeni') // 'eklenme_yeni' | 'vade_yakin' | 'vade_uzak'

  const [odemeKonusu, setOdemeKonusu] = useState('')
  const [santiyeId, setSantiyeId] = useState('')
  const [odeyen, setOdeyen] = useState('')
  const [odenen, setOdenen] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [cekSeriNo, setCekSeriNo] = useState('')
  const [banka, setBanka] = useState('')
  const [yeniBankaAcik, setYeniBankaAcik] = useState(false)
  const [yeniBankaAdi, setYeniBankaAdi] = useState('')
  const [verilisTarihi, setVerilisTarihi] = useState(bugun())
  const [cekVadesi, setCekVadesi] = useState('')
  const [tutar, setTutar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [belge, setBelge] = useState(null)

  useEffect(() => {
    cekleriYukle()
    bankalariYukle()
    
    supabase.from('taseronlar').select('*').then(({ data }) => {
      setTaseronlar(data || [])
    })
  }, [])

  const cekleriYukle = async () => {
    const { data, error } = await supabase.from('cekler').select('*, santiyeler(ad), profiles(ad_soyad)').order('created_at', { ascending: false })
    if (error) { alert('Çekler yüklenemedi: ' + error.message); return }
    setCekler(data || [])
  }

  const bankalariYukle = async () => {
    const { data } = await supabase.from('cek_bankalari').select('*').order('ad')
    setBankalar(data || [])
    if (data?.length && !banka) setBanka(data[0].ad)
  }

  const bankaEkle = async () => {
    if (!yeniBankaAdi.trim()) return
    const { data, error } = await supabase.from('cek_bankalari').insert({ ad: yeniBankaAdi }).select().single()
    if (error) { alert('Banka eklenemedi: ' + error.message); return }
    setBankalar((onceki) => [...onceki, data].sort((a, b) => a.ad.localeCompare(b.ad)))
    setBanka(data.ad)
    setYeniBankaAdi('')
    setYeniBankaAcik(false)
  }

  const formuSifirla = () => {
    setOdemeKonusu('')
    setSantiyeId('')
    setOdeyen('')
    setOdenen('')
    setSecilenCariId(null)
    setCekSeriNo('')
    setCekVadesi('')
    setTutar('')
    setAciklama('')
    setBelge(null)
    setVerilisTarihi(bugun())
    setDuzenlenenId(null)
  }

  const duzenlemeyiBaslat = (c) => {
    setDuzenlenenId(c.id)
    setOdemeKonusu(c.odeme_konusu || '')
    setSantiyeId(c.santiye_id || '')
    setOdeyen(c.odeyen || '')
    setOdenen(c.odenen || '')
    setSecilenCariId(c.cari_id || null)
    setCekSeriNo(c.cek_seri_no || '')
    setBanka(c.banka || (bankalar[0]?.ad ?? ''))
    setVerilisTarihi(c.verilis_tarihi ? c.verilis_tarihi.slice(0, 10) : bugun())
    setCekVadesi(c.cek_vadesi ? c.cek_vadesi.slice(0, 10) : '')
    setTutar(c.tutar ? String(c.tutar) : '')
    setAciklama(c.aciklama || '')
    setBelge(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cekKaydetVeyaGuncelle = async () => {
    if (!odemeKonusu.trim() || !tutar) { alert('Ödeme konusu ve tutar zorunludur.'); return }
    setYukleniyor(true)

    let finalCariId = secilenCariId
    if (!finalCariId && odenen.trim()) {
      const bulunan = taseronlar.find(t => t.ad.toLowerCase() === odenen.trim().toLowerCase() || (t.firma && t.firma.toLowerCase() === odenen.trim().toLowerCase()))
      if (bulunan) {
        finalCariId = bulunan.id
      }
    }

    let belgeUrl = null
    // Mevcut kaydı güncelliyorsak ve yeni belge seçilmediyse eski belgeyi koruyabiliriz
    if (belge) {
      const safeName = belge.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const dosyaAdi = `${Date.now()}_${safeName}`
      const { data, error } = await supabase.storage.from('cek-belgeleri').upload(dosyaAdi, belge)
      if (error) {
        alert('Belge yüklenemedi: ' + error.message)
        setYukleniyor(false)
        return
      }
      if (data) {
        const { data: url } = supabase.storage.from('cek-belgeleri').getPublicUrl(data.path)
        belgeUrl = url.publicUrl
      }
    }

    const veri = {
      odeme_konusu: odemeKonusu,
      santiye_id: santiyeId || null,
      odeyen,
      odenen,
      cari_id: finalCariId || null,
      cek_seri_no: cekSeriNo,
      banka,
      verilis_tarihi: verilisTarihi,
      cek_vadesi: cekVadesi || null,
      tutar: Number(tutar),
      aciklama,
      ...(belgeUrl ? { belge_url: belgeUrl } : {}),
      ...(!duzenlenenId ? { ekleyen: profile?.id } : {})
    }

    if (duzenlenenId) {
      const { error } = await supabase.from('cekler').update(veri).eq('id', duzenlenenId)
      if (error) { alert('Çek güncellenemedi: ' + error.message); setYukleniyor(false); return }
    } else {
      const { error } = await supabase.from('cekler').insert(veri)
      if (error) { alert('Çek eklenemedi: ' + error.message); setYukleniyor(false); return }
    }

    formuSifirla()
    setYukleniyor(false)
    cekleriYukle()
  }

  const cekSil = async (id) => {
    if (!window.confirm('Bu çek kaydını silmek istediğinize emin misiniz?')) return
    await supabase.from('cekler').delete().eq('id', id)
    cekleriYukle()
  }

  // Mobil mi masaüstü mü tespiti
  const mobilCihaz = () => navigator.maxTouchPoints > 0

  // WhatsApp ile Görsel ve Metin Paylaşım Fonksiyonu
  const cekPaylas = async (c) => {
    try {
      const metin =
        `💳 *ÇEK / ÖDEME BİLDİRİMİ*\n` +
        `📌 *Konu:* ${c.odeme_konusu}\n` +
        `🏗 *Şantiye:* ${c.santiyeler?.ad || 'Genel'}\n` +
        `💵 *Tutar:* ${paraFormatla(c.tutar)} ₺\n` +
        `🏦 *Banka:* ${c.banka || '—'}\n` +
        `🔢 *Seri No:* ${c.cek_seri_no || '—'}\n` +
        `👤 *Ödeyen:* ${c.odeyen || '—'}\n` +
        `👤 *Ödenen:* ${c.odenen || '—'}\n` +
        `📅 *Veriliş:* ${new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}\n` +
        `⏳ *Vade:* ${c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}\n` +
        (c.aciklama ? `📝 *Not:* ${c.aciklama}` : '')

      // Mobilse: belge varsa dosya + metin birlikte paylaş
      if (mobilCihaz() && c.belge_url && navigator.canShare) {
        const response = await fetch(c.belge_url)
        const blob = await response.blob()
        const uzanti = blob.type.includes('pdf') ? 'pdf' : 'jpg'
        const dosyaAdi = c.odeme_konusu ? `${c.odeme_konusu.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${uzanti}` : `cek_belgesi.${uzanti}`
        const file = new File([blob], dosyaAdi, { type: blob.type })
        if (navigator.canShare({ files: [file], text: metin })) {
          await navigator.share({ title: 'Çek Belgesi', text: metin, files: [file] })
          return
        }
      }

      // Masaüstü veya belge yoksa: metin + link olarak paylaş
      const metinVeLink = metin + (c.belge_url ? `\n🔗 Belge: ${c.belge_url}` : '')
      if (navigator.share) {
        await navigator.share({ title: 'Çek Belgesi', text: metinVeLink })
      } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(metinVeLink), '_blank')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Paylaşım hatası:', err)
        alert('Paylaşım sırasında bir hata oluştu.')
      }
    }
  }

  const muhasebePaylasimGuncelle = async (id, deger) => {
    await supabase.from('cekler').update({ muhasebe_paylasim: deger }).eq('id', id)
    setCekler((onceki) => onceki.map((c) => c.id === id ? { ...c, muhasebe_paylasim: deger } : c))
  }

  // Filtreleme ve Sıralama Mantığı
  const filtrelenmisCekler = cekler.filter((c) => {
    const santiyeUyar = filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye
    const bankaUyar = filtreBanka === 'hepsi' || c.banka === filtreBanka
    return santiyeUyar && bankaUyar
  })

  const siraliCekler = [...filtrelenmisCekler].sort((a, b) => {
    if (siralamaYonu === 'eklenme_yeni') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    } else if (siralamaYonu === 'vade_yakin') {
      const tarihA = a.cek_vadesi ? new Date(a.cek_vadesi) : new Date(8640000000000000)
      const tarihB = b.cek_vadesi ? new Date(b.cek_vadesi) : new Date(8640000000000000)
      return tarihA - tarihB
    } else {
      const tarihA = a.cek_vadesi ? new Date(a.cek_vadesi) : new Date(0)
      const tarihB = b.cek_vadesi ? new Date(b.cek_vadesi) : new Date(0)
      return tarihB - tarihA
    }
  })

  const aktifFiltreSayisi = [
    filtreSantiye !== 'hepsi',
    filtreBanka !== 'hepsi'
  ].filter(Boolean).length

  const siralamaMetni = 
    siralamaYonu === 'eklenme_yeni' ? 'Sıralama: Eklenme Tarihi (Yeni → Eski)' :
    siralamaYonu === 'vade_yakin' ? 'Sıralama: Vade (Yakından Uzağa)' : 'Sıralama: Vade (Uzaktan Yakına)'

  return (
    <div>
      {/* YENİ ÇEK EKLEME VEYA DÜZENLEME ALANI (EN ÜSTTE) */}
      <div className="ekleme-kutusu" style={{ marginBottom: 16, border: duzenlenenId ? '2px solid #0F6E56' : '1px solid #d3d1c7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, margin: 0, color: duzenlenenId ? '#0F6E56' : '#333' }}>
            {duzenlenenId ? '✏️ Çek Kaydını Düzenliyorsunuz' : '➕ Yeni Çek Ekle'}
          </h3>
          {duzenlenenId && (
            <button onClick={formuSifirla} style={{ background: '#D64545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>
              Düzenlemeden Çık
            </button>
          )}
        </div>

        <input type="text" placeholder="Ödeme konusu..." value={odemeKonusu} onChange={(e) => setOdemeKonusu(e.target.value)} />

        <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)}>
          <option value="">Şantiye seç (opsiyonel)</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        <div className="ekleme-satiri-2">
          <input type="text" placeholder="Ödeyen" value={odeyen} onChange={(e) => setOdeyen(e.target.value)} />
          
          <CariAramaSecici 
            deger={odenen} 
            onDegisti={(isim, cariId) => { 
              setOdenen(isim)
              setSecilenCariId(cariId || null) 
            }} 
            placeholder="Ödenen kişi/firma..." 
          />
        </div>

        <input type="text" placeholder="Çek seri no..." value={cekSeriNo} onChange={(e) => setCekSeriNo(e.target.value)} />

        {!yeniBankaAcik ? (
          <div className="ekleme-satiri-2">
            <select value={banka} onChange={(e) => setBanka(e.target.value)}>
              {bankalar.map((b) => <option key={b.id} value={b.ad}>{b.ad}</option>)}
            </select>
            <button onClick={() => setYeniBankaAcik(true)}>+ Banka ekle</button>
          </div>
        ) : (
          <div className="ekleme-satiri-2">
            <input type="text" placeholder="Yeni banka adı" value={yeniBankaAdi} onChange={(e) => setYeniBankaAdi(e.target.value)} />
            <button onClick={bankaEkle}>Kaydet</button>
          </div>
        )}

        <div className="ekleme-satiri-2">
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A' }}>Veriliş tarihi</label>
            <input type="date" value={verilisTarihi} onChange={(e) => setVerilisTarihi(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A' }}>Çek vadesi</label>
            <input type="date" value={cekVadesi} onChange={(e) => setCekVadesi(e.target.value)} />
          </div>
        </div>

        <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />

        <textarea
          placeholder="Açıklama / Not (opsiyonel)..."
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <label className="dosya-buton">
          📎 {belge ? belge.name.slice(0, 22) : 'Fotoğraf / Galeri / Belge Değiştir (opsiyonel)'}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBelge(e.target.files[0])} />
        </label>

        <button className="ekle-buton-genis" onClick={cekKaydetVeyaGuncelle} disabled={yukleniyor} style={{ background: duzenlenenId ? '#0F6E56' : undefined }}>
          {yukleniyor ? 'Kaydediliyor...' : (duzenlenenId ? 'Çek Güncellemesini Kaydet' : 'Çek kaydını kaydet')}
        </button>
      </div>

      {/* AÇILIR - KAPANIR FİLTRE PANELİ */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setFiltrelerAcik(!filtrelerAcik)}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: filtrelerAcik ? '#0F6E56' : '#f0f0ed',
            color: filtrelerAcik ? '#fff' : '#333',
            border: '1px solid #d3d1c7',
            borderRadius: 8,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          <span>🔍 Filtreler {aktifFiltreSayisi > 0 ? `(${aktifFiltreSayisi} aktif)` : ''}</span>
          <span>{filtrelerAcik ? '▲ Gizle' : '▼ Göster'}</span>
        </button>

        {filtrelerAcik && (
          <div style={{ background: '#faf9f5', padding: '12px', borderRadius: 8, border: '1px solid #d3d1c7', marginTop: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 4px', color: '#555' }}>Şantiye</p>
            <div className="filtre-satiri" style={{ marginBottom: 8 }}>
              <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tümü</button>
              {santiyeler.map((s) => (
                <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
              ))}
            </div>

            <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 4px', color: '#555' }}>Banka</p>
            <div className="filtre-satiri" style={{ marginBottom: 4 }}>
              <button className={`filtre-chip ${filtreBanka === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreBanka('hepsi')}>Tümü</button>
              {bankalar.map((b) => (
                <button key={b.id} className={`filtre-chip ${filtreBanka === b.ad ? 'secili' : ''}`} onClick={() => setFiltreBanka(b.ad)}>{b.ad}</button>
              ))}
            </div>

            {aktifFiltreSayisi > 0 && (
              <button
                onClick={() => { setFiltreSantiye('hepsi'); setFiltreBanka('hepsi') }}
                style={{ fontSize: 11, marginTop: 8, background: 'none', border: 'none', color: '#D64545', cursor: 'pointer', padding: 0, fontWeight: 600 }}
              >
                ✕ Filtreleri Temizle
              </button>
            )}
          </div>
        )}
      </div>

      {/* DÖNGÜSEL SIRALAMA BUTONU */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => {
            setSiralamaYonu((onceki) => {
              if (onceki === 'eklenme_yeni') return 'vade_yakin'
              if (onceki === 'vade_yakin') return 'vade_uzak'
              return 'eklenme_yeni'
            })
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#fff',
            border: '1px solid #d3d1c7',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          {siralamaMetni}
        </button>
      </div>

      {/* LİSTE / AKIŞ ALANI (ALTTA) */}
      <div className="liste">
        {siraliCekler.map((c) => (
          <div key={c.id} className="kart" style={{ border: duzenlenenId === c.id ? '2px solid #0F6E56' : undefined }}>
            <div className="kart-ust">
              <span className="kart-baslik">{c.odeme_konusu}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="kart-tutar">{paraFormatla(c.tutar)} ₺</span>
                <button className="sil-buton" onClick={() => duzenlemeyiBaslat(c)} aria-label="Düzenle">✎</button>
                <button className="sil-buton" onClick={() => cekSil(c.id)} aria-label="Sil">🗑</button>
              </div>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">{c.santiyeler?.ad || 'Genel'}</span>
              <span className="etiket">{c.banka}</span>
              <span className="etiket">Seri: {c.cek_seri_no || '—'}</span>
            </div>
            <div className="kart-alt-tarih">
              <span>Veriliş: {new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}</span>
              <span>Vade: {c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}</span>
            </div>
            <div className="kart-alt-tarih" style={{ marginTop: 2 }}>
              <span>Ödeyen: {c.odeyen || '—'}</span>
              <span>Ödenen: {c.odenen || '—'}</span>
            </div>
            {c.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{c.aciklama}</p>}

            {/* Belge / Fotoğraf Önizlemesi */}
            {c.belge_url && (
              <div style={{ marginTop: 8 }}>
                <a href={c.belge_url} target="_blank" rel="noopener noreferrer">
                  <img 
                    src={c.belge_url} 
                    alt="Çek Belgesi" 
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid #d3d1c7' }} 
                  />
                </a>
              </div>
            )}

            {/* Muhasebe Paylaşım Kutucuğu */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              padding: '7px 10px',
              borderRadius: 6,
              background: c.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
              border: `1px solid ${c.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 12,
              fontWeight: 600,
              color: c.muhasebe_paylasim ? '#2E7D32' : '#F57F17',
            }}>
              <input
                type="checkbox"
                checked={!!c.muhasebe_paylasim}
                onChange={(e) => muhasebePaylasimGuncelle(c.id, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4CAF50' }}
              />
              {c.muhasebe_paylasim ? '✅ Muhasebeye gönderildi' : '⏳ Muhasebeye gönderilmedi'}
            </label>

            {/* WhatsApp ile Görsel ve Metin Gönderme Butonu */}
            <button 
              onClick={() => cekPaylas(c)}
              style={{ 
                marginTop: 6, 
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
        {siraliCekler.length === 0 && <p className="bos-mesaj">Bu filtrede çek kaydı yok.</p>}
      </div>
    </div>
  )
}