import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Notlar() {
  const { profile } = useAuth()
  const [notlar, setNotlar] = useState([])
  const [sekme, setSekme] = useState('aktif') // 'aktif' | 'arsiv'
  const [filtreKategori, setFiltreKategori] = useState('hepsi')
  const [acikId, setAcikId] = useState(null)
  const [arama, setArama] = useState('')

  const [ekleAcik, setEkleAcik] = useState(false)
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniKategori, setYeniKategori] = useState('')
  const [yeniIcerik, setYeniIcerik] = useState('')
  const [dinliyor, setDinliyor] = useState(false)

  useEffect(() => {
    if (profile) notlariYukle()
  }, [profile])

  const notlariYukle = async () => {
    const { data, error } = await supabase.from('kisisel_notlar').select('*').eq('kullanici_id', profile.id).order('created_at', { ascending: false })
    if (error) { alert('Notlar yüklenemedi: ' + error.message); return }
    setNotlar(data || [])
  }

  const notEkle = async () => {
    if (!yeniIcerik.trim()) return
    const { error } = await supabase.from('kisisel_notlar').insert({
      kullanici_id: profile.id, baslik: yeniBaslik || null, kategori: yeniKategori || null, icerik: yeniIcerik,
    })
    if (error) { alert('Not eklenemedi: ' + error.message); return }
    setYeniBaslik(''); setYeniKategori(''); setYeniIcerik(''); setEkleAcik(false)
    notlariYukle()
  }

  const arsivle = async (id, arsivDurumu) => {
    await supabase.from('kisisel_notlar').update({ arsivlendi: arsivDurumu }).eq('id', id)
    setAcikId(null)
    notlariYukle()
  }

  const notSil = async (id) => {
    if (!window.confirm('Bu notu kalıcı olarak silmek istediğinize emin misiniz?')) return
    await supabase.from('kisisel_notlar').delete().eq('id', id)
    notlariYukle()
  }

  const sesleYaz = () => {
    const Tanima = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Tanima) { alert('Tarayıcınız sesli girişi desteklemiyor.'); return }
    const tanima = new Tanima()
    tanima.lang = 'tr-TR'
    tanima.onresult = (e) => setYeniIcerik((onceki) => onceki + e.results[0][0].transcript)
    tanima.onstart = () => setDinliyor(true)
    tanima.onend = () => setDinliyor(false)
    tanima.start()
  }

  const kategoriler = [...new Set(notlar.map((n) => n.kategori).filter(Boolean))]

  const gorunenler = notlar
    .filter((n) => (sekme === 'aktif' ? !n.arsivlendi : n.arsivlendi))
    .filter((n) => filtreKategori === 'hepsi' || n.kategori === filtreKategori)
    .filter((n) => {
      const metin = arama.toLowerCase()
      return !metin || (n.baslik || '').toLowerCase().includes(metin) || n.icerik.toLowerCase().includes(metin)
    })

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Notlarım</h2>
        <button className="ekle-buton-genis" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => setEkleAcik(!ekleAcik)}>
          {ekleAcik ? 'Vazgeç' : '+ Not Ekle'}
        </button>
      </div>

      {ekleAcik && (
        <div className="ekleme-kutusu">
          <input type="text" placeholder="Başlık (opsiyonel)" value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} />
          <input type="text" placeholder="Kategori (opsiyonel, örn. İş, Kişisel)" value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} list="kategori-onerileri" />
          <datalist id="kategori-onerileri">
            {kategoriler.map((k) => <option key={k} value={k} />)}
          </datalist>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <textarea
              placeholder="Not içeriği..."
              value={yeniIcerik}
              onChange={(e) => setYeniIcerik(e.target.value)}
              rows={3}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <button className="mikrofon-buton" onClick={sesleYaz}>{dinliyor ? '●' : '🎤'}</button>
          </div>
          <button className="ekle-buton-genis" onClick={notEkle}>Notu kaydet</button>
        </div>
      )}

      <input type="text" placeholder="Notlarımda ara..." value={arama} onChange={(e) => setArama(e.target.value)} style={{ marginBottom: 12 }} />

      <div className="gorunum-secici" style={{ marginBottom: 12 }}>
        <button className={sekme === 'aktif' ? 'secili-tab' : ''} onClick={() => setSekme('aktif')}>Notlarım</button>
        <button className={sekme === 'arsiv' ? 'secili-tab' : ''} onClick={() => setSekme('arsiv')}>📦 Arşiv</button>
      </div>

      {kategoriler.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreKategori === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKategori('hepsi')}>Tümü</button>
          {kategoriler.map((k) => (
            <button key={k} className={`filtre-chip ${filtreKategori === k ? 'secili' : ''}`} onClick={() => setFiltreKategori(k)}>{k}</button>
          ))}
        </div>
      )}

      <div className="liste">
        {gorunenler.map((n) => (
          <div key={n.id} className="kart" style={{ opacity: n.arsivlendi ? 0.75 : 1 }}>
            <div className="kart-ust" onClick={() => setAcikId(acikId === n.id ? null : n.id)} style={{ cursor: 'pointer' }}>
              <span className="kart-baslik">
                {acikId === n.id ? '▾' : '▸'} {n.baslik || n.icerik.slice(0, 40)}
              </span>
              <button className="sil-buton" onClick={(e) => { e.stopPropagation(); notSil(n.id) }} aria-label="Sil">🗑</button>
            </div>
            <div className="etiket-satiri">
              {n.kategori && <span className="etiket etiket-vurgu">{n.kategori}</span>}
              <span className="etiket">{new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
            </div>

            {acikId === n.id && (
              <>
                <p className="not-icerik" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{n.icerik}</p>
                <button
                  onClick={() => arsivle(n.id, !n.arsivlendi)}
                  style={{ marginTop: 8, fontSize: 12, padding: '6px 10px' }}
                >
                  {n.arsivlendi ? '↩ Arşivden çıkar' : '📦 Arşivle'}
                </button>
              </>
            )}
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">{sekme === 'arsiv' ? 'Arşivde not yok.' : 'Henüz not yok.'}</p>}
      </div>
    </div>
  )
}
