import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'
import { uploadToGoogleDrive, moveToSilinenler } from '../lib/googleDrive'
import CariAramaSecici from '../components/CariAramaSecici'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Gelirler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const [gelirler, setGelirler] = useState([])
  const [malikler, setMalikler] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')

  const [santiyeId, setSantiyeId] = useState('')
  const [malikId, setMalikId] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [odemeYapanAdi, setOdemeYapanAdi] = useState('')
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(bugun())
  const [notMetni, setNotMetni] = useState('')
  const [belge, setBelge] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    if (aktifSantiye) setSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    gelirleriYukle()
    supabase.from('malikler').select('*').order('ad_soyad').then(({ data }) => setMalikler(data || []))
  }, [])

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
      const seciliMalik = malikler.find((x) => x.id === malikId)
      const adSoyad = odemeYapanAdi || seciliMalik?.ad_soyad || profile?.ad_soyad || 'ISIMSIZ'
      try {
        const driveSonuc = await uploadToGoogleDrive({
          file: belge,
          folderName: 'Gelirler',
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
      tutar: Number(tutar),
      tarih,
      belge_url: belgeUrl,
      not_metni: notMetni,
      ekleyen: profile?.id,
    })

    if (error) { alert('Gelir eklenemedi: ' + error.message); setYukleniyor(false); return }

    setMalikId(''); setSecilenCariId(null); setOdemeYapanAdi(''); setTutar(''); setNotMetni(''); setBelge(null); setTarih(bugun())
    setYukleniyor(false)
    gelirleriYukle()
  }

  const gelirSil = async (id) => {
    if (!window.confirm('Bu geliri silmek istediğinize emin misiniz?')) return
    const silinecek = gelirler.find((g) => g.id === id)

    // Eğer Google Drive belgesi varsa Silinenler/Gelirler klasörüne taşı
    if (silinecek?.belge_url) {
      try {
        await moveToSilinenler(silinecek.belge_url, 'Gelirler')
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

  // WhatsApp ile Görsel ve Metin Paylaşım Fonksiyonu
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
        `📅 *Tarih:* ${g.tarih ? new Date(g.tarih).toLocaleDateString('tr-TR') : '—'}\n` +
        (g.not_metni ? `📝 *Not:* ${g.not_metni}` : '')

      if (navigator.canShare && navigator.canShare({ files: dosyalar })) {
        await navigator.share({
          title: 'Gelir Belgesi',
          text: metin,
          files: dosyalar,
        })
      } else if (navigator.share) {
        await navigator.share({
          title: 'Gelir Belgesi',
          text: metin + (g.belge_url ? `\n🔗 Belge Linki: ${g.belge_url}` : ''),
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

  const gorunenler = filtreSantiye === 'hepsi' ? gelirler : gelirler.filter((g) => g.santiye_id === filtreSantiye)
  const buAyToplam = gorunenler.filter((g) => g.tarih.slice(0, 7) === bugun().slice(0, 7)).reduce((t, g) => t + Number(g.tutar), 0)
  const genelToplam = gorunenler.reduce((t, g) => t + Number(g.tutar), 0)

  return (
    <div className="sayfa">
      <h2>Gelirler</h2>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Bu ay toplam</p>
          <p className="ozet-tutar">{paraFormatla(buAyToplam)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Genel toplam</p>
          <p className="ozet-tutar">{paraFormatla(genelToplam)} ₺</p>
        </div>
      </div>

      {/* YENİ GELİR EKLEME ALANI (EN ÜSTTE) */}
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
          <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        </div>

        <textarea
          placeholder="Not (opsiyonel)..."
          value={notMetni}
          onChange={(e) => setNotMetni(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <label className="dosya-buton">
          📷 {belge ? belge.name.slice(0, 22) : 'Belge / fotoğraf ekle'}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBelge(e.target.files[0])} />
        </label>

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

      {/* LİSTE / AKIŞ ALANI (ALTTA) */}
      <div className="liste">
        {gorunenler.map((g) => (
          <div key={g.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{g.odeme_yapan_adi || g.malikler?.ad_soyad || 'İsimsiz'}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="kart-tutar">{paraFormatla(g.tutar)} ₺</span>
                <button className="sil-buton" onClick={() => gelirSil(g.id)} aria-label="Sil">🗑</button>
              </div>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">{g.santiyeler?.ad}</span>
              <span className="etiket">{new Date(g.tarih).toLocaleDateString('tr-TR')}</span>
            </div>
            {g.not_metni && <p className="not-icerik" style={{ marginTop: 6 }}>{g.not_metni}</p>}

            {/* Belge / Fotoğraf Önizlemesi */}
            {g.belge_url && (
              <div style={{ marginTop: 8 }}>
                {g.belge_url.toLowerCase().includes('.pdf') ? (
                  <a 
                    href={g.belge_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      backgroundColor: '#F1EFE8',
                      borderRadius: 6,
                      textDecoration: 'none',
                      color: '#2C3E50',
                      fontWeight: 500,
                      fontSize: 13,
                      border: '1px solid #D3D1C7'
                    }}
                  >
                    📄 PDF Belgesini Aç / Görüntüle
                  </a>
                ) : (
                  <a href={g.belge_url} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={g.belge_url} 
                      alt="Gelir Belgesi" 
                      style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid #d3d1c7' }} 
                    />
                  </a>
                )}
              </div>
            )}

            {/* WhatsApp ile Görsel ve Metin Gönderme Butonu */}
            <button 
              onClick={() => gelirPaylas(g)}
              style={{ 
                marginTop: 8, 
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
        {gorunenler.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
      </div>
    </div>
  )
}