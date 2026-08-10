import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla } from '../lib/format'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Cekler() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [cekler, setCekler] = useState([])
  const [bankalar, setBankalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  const [odemeKonusu, setOdemeKonusu] = useState('')
  const [santiyeId, setSantiyeId] = useState('')
  const [odeyen, setOdeyen] = useState('')
  const [odenen, setOdenen] = useState('')
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
  }, [])

  const cekleriYukle = async () => {
    const { data, error } = await supabase.from('cekler').select('*, santiyeler(ad), profiles(ad_soyad)').order('cek_vadesi', { ascending: true })
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

  const cekEkle = async () => {
    if (!odemeKonusu.trim() || !tutar) { alert('Ödeme konusu ve tutar zorunludur.'); return }
    setYukleniyor(true)

    let belgeUrl = null
    if (belge) {
      const dosyaAdi = `${Date.now()}_${belge.name}`
      const { data, error } = await supabase.storage.from('cek-belgeleri').upload(dosyaAdi, belge)
      if (!error) {
        const { data: url } = supabase.storage.from('cek-belgeleri').getPublicUrl(data.path)
        belgeUrl = url.publicUrl
      }
    }

    const { error } = await supabase.from('cekler').insert({
      odeme_konusu: odemeKonusu,
      santiye_id: santiyeId || null,
      odeyen,
      odenen,
      cek_seri_no: cekSeriNo,
      banka,
      verilis_tarihi: verilisTarihi,
      cek_vadesi: cekVadesi || null,
      tutar: Number(tutar),
      aciklama,
      belge_url: belgeUrl,
      ekleyen: profile?.id,
    })

    if (error) { alert('Çek eklenemedi: ' + error.message); setYukleniyor(false); return }

    setOdemeKonusu(''); setSantiyeId(''); setOdeyen(''); setOdenen(''); setCekSeriNo('')
    setCekVadesi(''); setTutar(''); setAciklama(''); setBelge(null); setVerilisTarihi(bugun())
    setYukleniyor(false)
    cekleriYukle()
  }

  const cekSil = async (id) => {
    if (!window.confirm('Bu çek kaydını silmek istediğinize emin misiniz?')) return
    await supabase.from('cekler').delete().eq('id', id)
    cekleriYukle()
  }

  const cekPaylas = async (c) => {
    const metin =
      `*Ödeme Konusu* : ${c.odeme_konusu}\n` +
      `*Şantiye* : ${c.santiyeler?.ad || '—'}\n` +
      `*Ödeyen* : ${c.odeyen || '—'}\n` +
      `*Ödenen* : ${c.odenen || '—'}\n` +
      `*Çek Seri No* : ${c.cek_seri_no || '—'}\n` +
      `*Banka* : ${c.banka || '—'}\n` +
      `*Veriliş Tarihi* : ${new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}\n` +
      `*Çek Vadesi* : ${c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}\n` +
      `*Tutar* : ${paraFormatla(c.tutar)}₺\n` +
      `*Açıklama / Not* : ${c.aciklama || '—'}`

    if (navigator.share) {
      try { await navigator.share({ text: metin }) } catch { /* iptal */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  return (
    <div>
      <div className="liste">
        {cekler.map((c) => (
          <div key={c.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{c.odeme_konusu}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="kart-tutar">{paraFormatla(c.tutar)} ₺</span>
                <button className="sil-buton" onClick={() => cekPaylas(c)} aria-label="Paylaş">📤</button>
                <button className="sil-buton" onClick={() => cekSil(c.id)} aria-label="Sil">🗑</button>
              </div>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">{c.santiyeler?.ad || 'Genel'}</span>
              <span className="etiket">{c.banka}</span>
              <span className="etiket">Seri: {c.cek_seri_no || '—'}</span>
              {c.belge_url && <a className="etiket" href={c.belge_url} target="_blank" rel="noreferrer">Belge</a>}
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
          </div>
        ))}
        {cekler.length === 0 && <p className="bos-mesaj">Henüz çek kaydı yok.</p>}
      </div>

      <div className="ekleme-kutusu">
        <input type="text" placeholder="Ödeme konusu..." value={odemeKonusu} onChange={(e) => setOdemeKonusu(e.target.value)} />

        <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)}>
          <option value="">Şantiye seç (opsiyonel)</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        <div className="ekleme-satiri-2">
          <input type="text" placeholder="Ödeyen" value={odeyen} onChange={(e) => setOdeyen(e.target.value)} />
          <input type="text" placeholder="Ödenen" value={odenen} onChange={(e) => setOdenen(e.target.value)} />
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

        <input type="number" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} />

        <textarea
          placeholder="Açıklama / Not (opsiyonel)..."
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <label className="dosya-buton">
          📎 {belge ? belge.name.slice(0, 22) : 'Fotoğraf / Galeri / Belge Tara'}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setBelge(e.target.files[0])} />
        </label>

        <button className="ekle-buton-genis" onClick={cekEkle} disabled={yukleniyor}>
          {yukleniyor ? 'Ekleniyor...' : 'Çek kaydını kaydet'}
        </button>
      </div>
    </div>
  )
}
