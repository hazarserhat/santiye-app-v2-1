import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Gelirler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const [gelirler, setGelirler] = useState([])
  const [malikler, setMalikler] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')

  const [santiyeId, setSantiyeId] = useState('')
  const [malikId, setMalikId] = useState('')
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

  const malikleriSantiyeyeGoreFiltrele = (sId) => malikler.filter((m) => m.santiye_id === sId)

  const gelirEkle = async () => {
    if (!santiyeId || !tutar) { alert('Şantiye ve tutar zorunludur.'); return }
    setYukleniyor(true)

    let belgeUrl = null
    if (belge) {
      const dosyaAdi = `${Date.now()}_${belge.name}`
      const { data, error } = await supabase.storage.from('gelir-belgeleri').upload(dosyaAdi, belge)
      if (!error) {
        const { data: url } = supabase.storage.from('gelir-belgeleri').getPublicUrl(data.path)
        belgeUrl = url.publicUrl
      }
    }

    const { error } = await supabase.from('gelirler').insert({
      santiye_id: santiyeId,
      malik_id: malikId || null,
      odeme_yapan_adi: odemeYapanAdi,
      tutar: Number(tutar),
      tarih,
      belge_url: belgeUrl,
      not_metni: notMetni,
      ekleyen: profile?.id,
    })

    if (error) { alert('Gelir eklenemedi: ' + error.message); setYukleniyor(false); return }

    setMalikId(''); setOdemeYapanAdi(''); setTutar(''); setNotMetni(''); setBelge(null); setTarih(bugun())
    setYukleniyor(false)
    gelirleriYukle()
  }

  const gelirSil = async (id) => {
    if (!window.confirm('Bu geliri silmek istediğinize emin misiniz?')) return
    await supabase.from('gelirler').delete().eq('id', id)
    gelirleriYukle()
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

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

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
              {g.belge_url && <a className="etiket" href={g.belge_url} target="_blank" rel="noreferrer">Belge</a>}
            </div>
            {g.not_metni && <p className="not-icerik" style={{ marginTop: 6 }}>{g.not_metni}</p>}
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
      </div>

      <div className="ekleme-kutusu">
        <select value={santiyeId} onChange={(e) => { setSantiyeId(e.target.value); setMalikId('') }}>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        <select value={malikId} onChange={(e) => malikSecildi(e.target.value)}>
          <option value="">Malik seç (opsiyonel)...</option>
          {malikleriSantiyeyeGoreFiltrele(santiyeId).map((m) => <option key={m.id} value={m.id}>{m.ad_soyad}</option>)}
        </select>

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
    </div>
  )
}
