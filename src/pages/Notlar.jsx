import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { uploadToGoogleDrive } from '../lib/googleDrive'

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
  const [yeniKategori, setYeniKategori] = useState('')
  const [yeniIcerik, setYeniIcerik] = useState('')
  const [yeniDosyalar, setYeniDosyalar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzBaslik, setDuzBaslik] = useState('')
  const [duzKategori, setDuzKategori] = useState('')
  const [duzIcerik, setDuzIcerik] = useState('')
  const [duzDosyalar, setDuzDosyalar] = useState([])

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
  }

  const notEkle = async () => {
    if (!yeniIcerik.trim() && yeniDosyalar.length === 0) return
    setYukleniyor(true)
    let eklenenIcerik = yeniIcerik

    if (yeniDosyalar.length > 0) {
      for (const dosya of yeniDosyalar) {
        try {
          const result = await uploadToGoogleDrive({
            file: dosya,
            folderName: 'Notlar',
            adSoyad: profile?.ad_soyad || 'Kullanici'
          })
          const dosyaLink = result.directUrl || result.url
          eklenenIcerik += `\n\n![Görsel](${dosyaLink})`
        } catch (err) {
          alert('Görsel yüklenemedi: ' + err.message)
          setYukleniyor(false)
          return
        }
      }
    }

    const kategoriTemiz = yeniKategori.trim() || null

    const { error } = await supabase.from('kisisel_notlar').insert({
      kullanici_id: profile.id, baslik: yeniBaslik || null, kategori: kategoriTemiz, icerik: eklenenIcerik,
    })
    if (error) { alert('Not eklenemedi: ' + error.message); setYukleniyor(false); return }

    if (kategoriTemiz && !kategoriler.find((k) => k.ad.toLowerCase() === kategoriTemiz.toLowerCase())) {
      await supabase.from('not_kategorileri').insert({ kullanici_id: profile.id, ad: kategoriTemiz })
      kategorileriYukle()
    }

    setYeniBaslik(''); setYeniIcerik(''); setYeniKategori(''); setYeniDosyalar([]); setEkleAcik(false)
    setYukleniyor(false)
    notlariYukle()
  }

  const duzenlemeyiAc = (n) => {
    setDuzenlenenId(n.id); setDuzBaslik(n.baslik || ''); setDuzKategori(n.kategori || ''); setDuzIcerik(n.icerik); setDuzDosyalar([])
  }

  const notGuncelle = async (id) => {
    if (!duzIcerik.trim() && duzDosyalar.length === 0) return
    setYukleniyor(true)
    let eklenenIcerik = duzIcerik

    if (duzDosyalar.length > 0) {
      for (const dosya of duzDosyalar) {
        try {
          const result = await uploadToGoogleDrive({
            file: dosya,
            folderName: 'Notlar',
            adSoyad: profile?.ad_soyad || 'Kullanici'
          })
          const dosyaLink = result.directUrl || result.url
          eklenenIcerik += `\n\n![Görsel](${dosyaLink})`
        } catch (err) {
          alert('Görsel yüklenemedi: ' + err.message)
          setYukleniyor(false)
          return
        }
      }
    }

    const kategoriTemiz = duzKategori.trim() || null
    const { error } = await supabase.from('kisisel_notlar').update({ baslik: duzBaslik || null, kategori: kategoriTemiz, icerik: eklenenIcerik }).eq('id', id)
    if (error) { alert('Güncellenemedi: ' + error.message); setYukleniyor(false); return }
    if (kategoriTemiz && !kategoriler.find((k) => k.ad.toLowerCase() === kategoriTemiz.toLowerCase())) {
      await supabase.from('not_kategorileri').insert({ kullanici_id: profile.id, ad: kategoriTemiz })
      kategorileriYukle()
    }
    setDuzenlenenId(null)
    setDuzDosyalar([])
    setYukleniyor(false)
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
    duzBaslik, setDuzBaslik, duzKategori, setDuzKategori, duzIcerik, setDuzIcerik, duzDosyalar, setDuzDosyalar,
    duzenlemeyiAc, notGuncelle, notPaylas, notSil, arsivle, kategoriler, yukleniyor,
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

          <input type="text" placeholder="Kategori (opsiyonel)" value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} list="kategori-onerileri" />
          <datalist id="kategori-onerileri">
            {kategoriler.map((k) => <option key={k.id} value={k.ad} />)}
          </datalist>

          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <textarea
              placeholder="Not içeriği..."
              value={yeniIcerik}
              onChange={(e) => setYeniIcerik(e.target.value)}
              rows={3}
              style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', background: '#e2e0d8', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#333' }}>
                📷 Görsel Ekle
                <input type="file" accept="image/*" multiple onChange={(e) => setYeniDosyalar(Array.from(e.target.files))} style={{ display: 'none' }} />
              </label>
              {yeniDosyalar.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                  <span>{yeniDosyalar.length} dosya</span>
                  <button onClick={() => setYeniDosyalar([])} style={{ background: 'none', border: 'none', color: '#D64545', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              )}
            </div>
            <button className="ekle-buton-genis" onClick={notEkle} disabled={yukleniyor} style={{ opacity: yukleniyor ? 0.7 : 1, margin: 0, width: 'auto' }}>
              {yukleniyor ? 'Yükleniyor...' : 'Notu kaydet'}
            </button>
          </div>
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
    duzBaslik, setDuzBaslik, duzKategori, setDuzKategori, duzIcerik, setDuzIcerik, duzDosyalar, setDuzDosyalar,
    duzenlemeyiAc, notGuncelle, notPaylas, notSil, arsivle, kategoriler, yukleniyor,
  } = ctx

  return (
    <div className="kart" style={{ opacity: n.arsivlendi ? 0.75 : 1 }}>
      {duzenlenenId === n.id ? (
        <div>
          <input type="text" placeholder="Başlık" value={duzBaslik} onChange={(e) => setDuzBaslik(e.target.value)} style={{ marginBottom: 6 }} />
          <input type="text" placeholder="Kategori (opsiyonel)" value={duzKategori} onChange={(e) => setDuzKategori(e.target.value)} list="kategori-onerileri-duzenle" style={{ marginBottom: 6 }} />
          <datalist id="kategori-onerileri-duzenle">
            {kategoriler.map((k) => <option key={k.id} value={k.ad} />)}
          </datalist>
          <textarea value={duzIcerik} onChange={(e) => setDuzIcerik(e.target.value)} rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 12px', background: '#e2e0d8', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#333' }}>
              📷 Görsel Ekle
              <input type="file" accept="image/*" multiple onChange={(e) => setDuzDosyalar(Array.from(e.target.files))} style={{ display: 'none' }} />
            </label>
            {duzDosyalar.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                <span>{duzDosyalar.length} dosya</span>
                <button onClick={() => setDuzDosyalar([])} style={{ background: 'none', border: 'none', color: '#D64545', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setDuzenlenenId(null)} style={{ fontSize: 12 }} disabled={yukleniyor}>Vazgeç</button>
            <button onClick={() => notGuncelle(n.id)} style={{ fontSize: 12, opacity: yukleniyor ? 0.7 : 1 }} disabled={yukleniyor}>
              {yukleniyor ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
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
              {(() => {
                const textIcerik = n.icerik.replace(/!\[.*?\]\((.*?)\)/g, '').trim()
                const gorselUrller = [...n.icerik.matchAll(/!\[.*?\]\((.*?)\)/g)].map(m => m[1])
                return (
                  <div style={{ marginTop: 8 }}>
                    {textIcerik && <p className="not-icerik" style={{ whiteSpace: 'pre-wrap', marginBottom: gorselUrller.length > 0 ? 12 : 0 }}>{textIcerik}</p>}
                    {gorselUrller.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {gorselUrller.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="Not Görseli" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'contain', border: '1px solid #eee' }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
              <button onClick={() => arsivle(n.id, !n.arsivlendi)} style={{ marginTop: 12, fontSize: 12, padding: '6px 10px' }}>
                {n.arsivlendi ? '↩ Arşivden çıkar' : '📦 Arşivle'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
