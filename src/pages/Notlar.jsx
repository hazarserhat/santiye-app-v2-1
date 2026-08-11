import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Notlar() {
  const { profile } = useAuth()
  const [notlar, setNotlar] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [sekme, setSekme] = useState('aktif') // 'aktif' | 'arsiv'
  const [gorunumTuru, setGorunumTuru] = useState('liste') // 'liste' | 'kategori'
  const [siralamaYonu, setSiralamaYonu] = useState('yeni') // 'yeni' | 'eski'
  const [filtreKategori, setFiltreKategori] = useState('hepsi')
  const [acikId, setAcikId] = useState(null)
  const [arama, setArama] = useState('')

  const [ekleAcik, setEkleAcik] = useState(false)
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniKategoriId, setYeniKategoriId] = useState('')
  const [yeniKategoriEkleAcik, setYeniKategoriEkleAcik] = useState(false)
  const [yeniKategoriAdi, setYeniKategoriAdi] = useState('')
  const [yeniIcerik, setYeniIcerik] = useState('')
  const [dinliyor, setDinliyor] = useState(false)

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzBaslik, setDuzBaslik] = useState('')
  const [duzKategori, setDuzKategori] = useState('')
  const [duzIcerik, setDuzIcerik] = useState('')

  useEffect(() => {
    if (profile) { notlariYukle(); kategorileriYukle() }
  }, [profile])

  const notlariYukle = async () => {
    const { data, error } = await supabase.from('kisisel_notlar').select('*').eq('kullanici_id', profile.id).order('created_at', { ascending: false })
    if (error) { alert('Notlar yüklenemedi: ' + error.message); return }
    setNotlar(data || [])
  }

  const kategorileriYukle = async () => {
    const { data } = await supabase.from('not_kategorileri').select('*').eq('kullanici_id', profile.id).order('ad')
    setKategoriler(data || [])
    if (data?.length && !yeniKategoriId) setYeniKategoriId(data[0].ad)
  }

  const kategoriEkle = async () => {
    if (!yeniKategoriAdi.trim()) return
    const { data, error } = await supabase.from('not_kategorileri').insert({ kullanici_id: profile.id, ad: yeniKategoriAdi }).select().single()
    if (error) { alert('Kategori eklenemedi: ' + error.message); return }
    setKategoriler((onceki) => [...onceki, data].sort((a, b) => a.ad.localeCompare(b.ad)))
    setYeniKategoriId(data.ad)
    setYeniKategoriAdi('')
    setYeniKategoriEkleAcik(false)
  }

  const notEkle = async () => {
    if (!yeniIcerik.trim()) return
    const { error } = await supabase.from('kisisel_notlar').insert({
      kullanici_id: profile.id, baslik: yeniBaslik || null, kategori: yeniKategoriId || null, icerik: yeniIcerik,
    })
    if (error) { alert('Not eklenemedi: ' + error.message); return }
    setYeniBaslik(''); setYeniIcerik(''); setEkleAcik(false)
    notlariYukle()
  }

  const duzenlemeyiAc = (n) => {
    setDuzenlenenId(n.id); setDuzBaslik(n.baslik || ''); setDuzKategori(n.kategori || ''); setDuzIcerik(n.icerik)
  }

  const notGuncelle = async (id) => {
    if (!duzIcerik.trim()) return
    const { error } = await supabase.from('kisisel_notlar').update({ baslik: duzBaslik || null, kategori: duzKategori || null, icerik: duzIcerik }).eq('id', id)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenId(null)
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

  const notPaylas = async (n) => {
    const metin = `*${n.baslik || 'Not'}*\n${n.kategori ? `Kategori: ${n.kategori}\n` : ''}\n${n.icerik}`
    if (navigator.share) {
      try { await navigator.share({ text: metin }) } catch { /* iptal */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
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

  const kullanilanKategoriler = [...new Set(notlar.map((n) => n.kategori).filter(Boolean))]

  const gorunenler = notlar
    .filter((n) => (sekme === 'aktif' ? !n.arsivlendi : n.arsivlendi))
    .filter((n) => filtreKategori === 'hepsi' || n.kategori === filtreKategori)
    .filter((n) => {
      const metin = arama.toLowerCase()
      return !metin || (n.baslik || '').toLowerCase().includes(metin) || n.icerik.toLowerCase().includes(metin)
    })
    .sort((a, b) => siralamaYonu === 'yeni' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at))

  const ctx = {
    acikId, setAcikId, duzenlenenId, setDuzenlenenId,
    duzBaslik, setDuzBaslik, duzKategori, setDuzKategori, duzIcerik, setDuzIcerik,
    duzenlemeyiAc, notGuncelle, notPaylas, notSil, arsivle, kategoriler,
  }

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

          {!yeniKategoriEkleAcik ? (
            <div className="ekleme-satiri-2">
              <select value={yeniKategoriId} onChange={(e) => setYeniKategoriId(e.target.value)}>
                <option value="">Kategori yok</option>
                {kategoriler.map((k) => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
              <button onClick={() => setYeniKategoriEkleAcik(true)}>+ Yeni kategori</button>
            </div>
          ) : (
            <div className="ekleme-satiri-2">
              <input type="text" placeholder="Kategori adı" value={yeniKategoriAdi} onChange={(e) => setYeniKategoriAdi(e.target.value)} />
              <button onClick={kategoriEkle}>Kaydet</button>
            </div>
          )}

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

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setSiralamaYonu((y) => y === 'yeni' ? 'eski' : 'yeni')} style={{ fontSize: 12, padding: '6px 10px' }}>
          {siralamaYonu === 'yeni' ? '↓ Yeniden eskiye' : '↑ Eskiden yeniye'}
        </button>
        <button onClick={() => setGorunumTuru((g) => g === 'liste' ? 'kategori' : 'liste')} style={{ fontSize: 12, padding: '6px 10px' }}>
          {gorunumTuru === 'liste' ? '📂 Kategorilere göre grupla' : '📄 Düz liste göster'}
        </button>
      </div>

      {gorunumTuru === 'liste' && kullanilanKategoriler.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreKategori === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKategori('hepsi')}>Tümü</button>
          {kullanilanKategoriler.map((k) => (
            <button key={k} className={`filtre-chip ${filtreKategori === k ? 'secili' : ''}`} onClick={() => setFiltreKategori(k)}>{k}</button>
          ))}
        </div>
      )}

      {gorunumTuru === 'liste' ? (
        <div className="liste">
          {gorunenler.map((n) => <NotKarti key={n.id} n={n} ctx={ctx} />)}
          {gorunenler.length === 0 && <p className="bos-mesaj">{sekme === 'arsiv' ? 'Arşivde not yok.' : 'Henüz not yok.'}</p>}
        </div>
      ) : (
        <>
          {[...kullanilanKategoriler, null].map((kategori) => {
            const oberkNotlar = gorunenler.filter((n) => n.kategori === kategori)
            if (oberkNotlar.length === 0) return null
            return (
              <div key={kategori || 'kategorisiz'} style={{ marginBottom: 18 }}>
                <p className="alt-baslik">{kategori || 'Kategorisiz'}</p>
                <div className="liste">
                  {oberkNotlar.map((n) => <NotKarti key={n.id} n={n} ctx={ctx} />)}
                </div>
              </div>
            )
          })}
          {gorunenler.length === 0 && <p className="bos-mesaj">{sekme === 'arsiv' ? 'Arşivde not yok.' : 'Henüz not yok.'}</p>}
        </>
      )}
    </div>
  )
}

function NotKarti({ n, ctx }) {
  const {
    acikId, setAcikId, duzenlenenId, setDuzenlenenId,
    duzBaslik, setDuzBaslik, duzKategori, setDuzKategori, duzIcerik, setDuzIcerik,
    duzenlemeyiAc, notGuncelle, notPaylas, notSil, arsivle, kategoriler,
  } = ctx

  return (
    <div className="kart" style={{ opacity: n.arsivlendi ? 0.75 : 1 }}>
      {duzenlenenId === n.id ? (
        <div>
          <input type="text" placeholder="Başlık" value={duzBaslik} onChange={(e) => setDuzBaslik(e.target.value)} style={{ marginBottom: 6 }} />
          <select value={duzKategori} onChange={(e) => setDuzKategori(e.target.value)} style={{ marginBottom: 6 }}>
            <option value="">Kategori yok</option>
            {kategoriler.map((k) => <option key={k.id} value={k.ad}>{k.ad}</option>)}
          </select>
          <textarea value={duzIcerik} onChange={(e) => setDuzIcerik(e.target.value)} rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setDuzenlenenId(null)} style={{ fontSize: 12 }}>Vazgeç</button>
            <button onClick={() => notGuncelle(n.id)} style={{ fontSize: 12 }}>Kaydet</button>
          </div>
        </div>
      ) : (
        <>
          <div className="kart-ust" onClick={() => setAcikId(acikId === n.id ? null : n.id)} style={{ cursor: 'pointer' }}>
            <span className="kart-baslik">{acikId === n.id ? '▾' : '▸'} {n.baslik || n.icerik.slice(0, 40)}</span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button className="sil-buton" onClick={(e) => { e.stopPropagation(); notPaylas(n) }} aria-label="Paylaş">📤</button>
              <button className="sil-buton" onClick={(e) => { e.stopPropagation(); duzenlemeyiAc(n) }} aria-label="Düzenle">✎</button>
              <button className="sil-buton" onClick={(e) => { e.stopPropagation(); notSil(n.id) }} aria-label="Sil">🗑</button>
            </div>
          </div>
          <div className="etiket-satiri">
            {n.kategori && <span className="etiket etiket-vurgu">{n.kategori}</span>}
            <span className="etiket">{new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
          </div>
          {acikId === n.id && (
            <>
              <p className="not-icerik" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{n.icerik}</p>
              <button onClick={() => arsivle(n.id, !n.arsivlendi)} style={{ marginTop: 8, fontSize: 12, padding: '6px 10px' }}>
                {n.arsivlendi ? '↩ Arşivden çıkar' : '📦 Arşivle'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
