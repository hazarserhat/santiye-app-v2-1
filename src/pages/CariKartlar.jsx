import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import HizliSantiyeEkle from '../components/HizliSantiyeEkle'

export default function CariKartlar() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'

  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeHaritasi, setTaseronSantiyeHaritasi] = useState({}) // { taseronId: [{id, ad}, ...] }
  const [siralama, setSiralama] = useState('alfabetik') // 'alfabetik' | 'tarih'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [seciliId, setSeciliId] = useState(null)
  const [arama, setArama] = useState('')

  const [notlar, setNotlar] = useState([])
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])

  const [duzenleModu, setDuzenleModu] = useState(false)
  const [duzAd, setDuzAd] = useState('')
  const [duzSifat, setDuzSifat] = useState('')
  const [duzFirma, setDuzFirma] = useState('')
  const [duzTelefon, setDuzTelefon] = useState('')
  const [duzAdres, setDuzAdres] = useState('')

  const [yeniNot, setYeniNot] = useState('')
  const [duzenlenenNotId, setDuzenlenenNotId] = useState(null)
  const [duzenlenenNotMetni, setDuzenlenenNotMetni] = useState('')
  const [yeniTaseronAcik, setYeniTaseronAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSifat, setYeniSifat] = useState('')
  const [yeniFirma, setYeniFirma] = useState('')
  const [yeniTelefon, setYeniTelefon] = useState('')
  const [yeniAdres, setYeniAdres] = useState('')

  const [eklenecekSantiyeId, setEklenecekSantiyeId] = useState('')

  const [hkDonem, setHkDonem] = useState('')
  const [hkTutar, setHkTutar] = useState('')
  const [hkKesinti, setHkKesinti] = useState('')
  const [hkDurum, setHkDurum] = useState('bekliyor')
  const [hkAciklama, setHkAciklama] = useState('')

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    const { data } = await supabase.from('taseronlar').select('*')
    setTaseronlar(data || [])

    const { data: iliskiler } = await supabase.from('taseron_santiyeler').select('taseron_id, santiye_id, santiyeler(ad)')
    const harita = {}
    (iliskiler || []).forEach((r) => {
      if (!harita[r.taseron_id]) harita[r.taseron_id] = []
      if (r.santiyeler?.ad) harita[r.taseron_id].push({ id: r.santiye_id, ad: r.santiyeler.ad })
    })
    setTaseronSantiyeHaritasi(harita)
  }

  const detayYukle = async (id) => {
    setSeciliId(id)
    setEklenecekSantiyeId('')
    setDuzenleModu(false)

    const taseron = taseronlar.find((t) => t.id === id)
    if (taseron) {
      setDuzAd(taseron.ad); setDuzSifat(taseron.sifat || ''); setDuzFirma(taseron.firma || '')
      setDuzTelefon(taseron.telefon || ''); setDuzAdres(taseron.adres || '')
    }

    const { data: notData } = await supabase
      .from('taseron_notlari').select('*, profiles(ad_soyad)').eq('taseron_id', id).order('created_at', { ascending: false })
    setNotlar(notData || [])

    const { data: santiyeData } = await supabase.from('taseron_santiyeler').select('id, santiye_id, santiyeler(ad)').eq('taseron_id', id)
    setIliskiliSantiyeler(santiyeData || [])

    if (yonetici) {
      const { data: hkData } = await supabase.from('hakedisler').select('*').eq('taseron_id', id).order('donem', { ascending: false })
      setHakedisler(hkData || [])
    }
  }

  const taseronEkle = async () => {
    if (!yeniAd.trim()) return
    const { data, error } = await supabase
      .from('taseronlar')
      .insert({ ad: yeniAd, sifat: yeniSifat, firma: yeniFirma, telefon: yeniTelefon, adres: yeniAdres })
      .select().single()
    if (error) {
      alert('Taşeron eklenemedi: ' + error.message)
      return
    }
    if (data) {
      setYeniAd(''); setYeniSifat(''); setYeniFirma(''); setYeniTelefon(''); setYeniAdres('')
      setYeniTaseronAcik(false)
      taseronlariYukle()
    }
  }

  const taseronGuncelle = async () => {
    if (!duzAd.trim()) return
    const { error } = await supabase.from('taseronlar').update({
      ad: duzAd, sifat: duzSifat, firma: duzFirma, telefon: duzTelefon, adres: duzAdres,
    }).eq('id', seciliId)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenleModu(false)
    taseronlariYukle()
  }

  const santiyeIliskisiEkle = async () => {
    if (!eklenecekSantiyeId) return
    const { error } = await supabase.from('taseron_santiyeler').insert({ taseron_id: seciliId, santiye_id: eklenecekSantiyeId })
    if (error) {
      alert('Şantiye eklenemedi: ' + error.message)
      return
    }
    setEklenecekSantiyeId('')
    detayYukle(seciliId)
    taseronlariYukle()
  }

  const santiyeIliskisiSil = async (iliskiId) => {
    await supabase.from('taseron_santiyeler').delete().eq('id', iliskiId)
    detayYukle(seciliId)
    taseronlariYukle()
  }

  const notEkle = async () => {
    if (!yeniNot.trim()) return
    await supabase.from('taseron_notlari').insert({ taseron_id: seciliId, icerik: yeniNot, ekleyen: profile?.id })
    setYeniNot('')
    detayYukle(seciliId)
  }

  const notGuncelle = async (notId) => {
    if (!duzenlenenNotMetni.trim()) return
    const { error } = await supabase.from('taseron_notlari').update({ icerik: duzenlenenNotMetni }).eq('id', notId)
    if (error) { alert('Not güncellenemedi: ' + error.message); return }
    setDuzenlenenNotId(null)
    detayYukle(seciliId)
  }

  const notSil = async (notId) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('taseron_notlari').delete().eq('id', notId)
    if (error) { alert('Not silinemedi: ' + error.message); return }
    detayYukle(seciliId)
  }

  const hakedisEkle = async () => {
    if (!hkDonem.trim() || !hkTutar) return
    await supabase.from('hakedisler').insert({
      taseron_id: seciliId, donem: hkDonem, tutar: Number(hkTutar), kesinti_avans: Number(hkKesinti) || 0,
      odeme_durumu: hkDurum, aciklama: hkAciklama, ekleyen: profile?.id,
    })
    setHkDonem(''); setHkTutar(''); setHkKesinti(''); setHkDurum('bekliyor'); setHkAciklama('')
    detayYukle(seciliId)
  }

  const seciliTaseron = taseronlar.find((t) => t.id === seciliId)

  const filtreliListe = taseronlar
    .filter((t) => {
      const aramaMetni = arama.toLowerCase()
      const eslesiyorMu = t.ad.toLowerCase().includes(aramaMetni) || (t.sifat || '').toLowerCase().includes(aramaMetni)
      const santiyeyeUyuyorMu = filtreSantiye === 'hepsi' || (taseronSantiyeHaritasi[t.id] || []).some((s) => s.id === filtreSantiye)
      return eslesiyorMu && santiyeyeUyuyorMu
    })
    .sort((a, b) => siralama === 'alfabetik' ? a.ad.localeCompare(b.ad) : new Date(b.created_at) - new Date(a.created_at))

  const eklenebilirSantiyeler = santiyeler.filter((s) => !iliskiliSantiyeler.find((r) => r.santiye_id === s.id))

  // ---- DETAY GÖRÜNÜMÜ ----
  if (seciliId && seciliTaseron) {
    return (
      <div className="sayfa">
        <button className="geri-buton" onClick={() => setSeciliId(null)}>← Listeye dön</button>

        <div className="taseron-baslik-satiri">
          <div className="avatar-daire">{seciliTaseron.ad.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <p className="taseron-ad">{seciliTaseron.ad}</p>
            <p className="taseron-firma">{seciliTaseron.sifat}{seciliTaseron.sifat && seciliTaseron.firma ? ' · ' : ''}{seciliTaseron.firma}</p>
          </div>
          {yonetici && !duzenleModu && (
            <button className="sil-buton" onClick={() => setDuzenleModu(true)} aria-label="Düzenle">✎</button>
          )}
        </div>

        {duzenleModu ? (
          <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
            <input type="text" placeholder="Ad soyad" value={duzAd} onChange={(e) => setDuzAd(e.target.value)} />
            <input type="text" placeholder="Sıfat / unvan" value={duzSifat} onChange={(e) => setDuzSifat(e.target.value)} />
            <input type="text" placeholder="Firma" value={duzFirma} onChange={(e) => setDuzFirma(e.target.value)} />
            <input type="text" placeholder="Telefon" value={duzTelefon} onChange={(e) => setDuzTelefon(e.target.value)} />
            <input type="text" placeholder="Adres" value={duzAdres} onChange={(e) => setDuzAdres(e.target.value)} />
            <div className="ekleme-satiri-2">
              <button onClick={() => setDuzenleModu(false)}>Vazgeç</button>
              <button className="ekle-buton-genis" onClick={taseronGuncelle}>Kaydet</button>
            </div>
          </div>
        ) : (
          <div className="bilgi-kutusu">
            <div className="bilgi-satiri">
              <span>Telefon</span>
              {seciliTaseron.telefon ? (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a href={`tel:${seciliTaseron.telefon}`} style={{ color: '#0F6E56', fontWeight: 500 }}>{seciliTaseron.telefon}</a>
                  <button
                    className="sil-buton"
                    onClick={() => { navigator.clipboard.writeText(seciliTaseron.telefon); alert('Telefon numarası kopyalandı.') }}
                    aria-label="Telefonu kopyala"
                  >📋</button>
                </span>
              ) : <span>—</span>}
            </div>
            <div className="bilgi-satiri"><span>Adres</span><span>{seciliTaseron.adres || '—'}</span></div>
          </div>
        )}

        <p className="alt-baslik">Çalıştığı şantiyeler</p>
        <div className="etiket-satiri" style={{ marginBottom: 10 }}>
          {iliskiliSantiyeler.map((r) => (
            <span key={r.id} className="etiket etiket-vurgu" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {r.santiyeler?.ad}
              <button className="etiket-sil-x" onClick={() => santiyeIliskisiSil(r.id)} aria-label="Şantiye ilişkisini kaldır">×</button>
            </span>
          ))}
          {iliskiliSantiyeler.length === 0 && <span className="bos-mesaj" style={{ padding: 0 }}>Henüz şantiye eklenmemiş.</span>}
        </div>
        {eklenebilirSantiyeler.length > 0 && (
          <div className="ekleme-satiri-2" style={{ marginBottom: 16 }}>
            <select value={eklenecekSantiyeId} onChange={(e) => setEklenecekSantiyeId(e.target.value)}>
              <option value="">Şantiye seç...</option>
              {eklenebilirSantiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
            <button onClick={santiyeIliskisiEkle}>Ekle</button>
          </div>
        )}

        <p className="alt-baslik">Notlar</p>
        <div className="liste">
          {notlar.map((n) => (
            <div key={n.id} className="kart">
              {duzenlenenNotId === n.id ? (
                <>
                  <input
                    type="text"
                    value={duzenlenenNotMetni}
                    onChange={(e) => setDuzenlenenNotMetni(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && notGuncelle(n.id)}
                    autoFocus
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDuzenlenenNotId(null)} style={{ fontSize: 12 }}>Vazgeç</button>
                    <button onClick={() => notGuncelle(n.id)} style={{ fontSize: 12 }}>Kaydet</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                    <p className="not-icerik" style={{ flex: 1 }}>{n.icerik}</p>
                    {yonetici && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="sil-buton" onClick={() => { setDuzenlenenNotId(n.id); setDuzenlenenNotMetni(n.icerik) }} aria-label="Notu düzenle">✎</button>
                        <button className="sil-buton" onClick={() => notSil(n.id)} aria-label="Notu sil">🗑</button>
                      </div>
                    )}
                  </div>
                  <span className="not-alt">{n.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(n.created_at).toLocaleDateString('tr-TR')} {new Date(n.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          ))}
          {notlar.length === 0 && <p className="bos-mesaj">Henüz not yok.</p>}
        </div>
        <div className="ekleme-kutusu">
          <input type="text" placeholder="Not yaz..." value={yeniNot} onChange={(e) => setYeniNot(e.target.value)} />
          <button className="ekle-buton-genis" onClick={notEkle}>Notu ekle</button>
        </div>

        <p className="alt-baslik" style={{ marginTop: 20 }}>Hakediş kartları</p>

        {!yonetici && (
          <div className="kilit-kutusu">
            <span className="kilit-ikon">🔒</span>
            <p>Hakediş bilgileri sadece yöneticiler tarafından görülebilir.</p>
          </div>
        )}

        {yonetici && (
          <>
            <div className="liste">
              {hakedisler.map((h) => (
                <div key={h.id} className="kart">
                  <div className="kart-ust">
                    <span className="kart-baslik">{h.donem}</span>
                    <span className={`durum-rozet ${h.odeme_durumu === 'odendi' ? 'rozet-yesil' : 'rozet-sari'}`}>
                      {h.odeme_durumu === 'odendi' ? 'Ödendi' : 'Ödeme bekliyor'}
                    </span>
                  </div>
                  <div className="hakedis-hesap">
                    <span>Tutar</span><span>{Number(h.tutar).toLocaleString('tr-TR')} ₺</span>
                    <span>Kesinti/Avans</span><span>-{Number(h.kesinti_avans).toLocaleString('tr-TR')} ₺</span>
                    <span className="hakedis-net-etiket">Net</span>
                    <span className="hakedis-net-tutar">{(Number(h.tutar) - Number(h.kesinti_avans)).toLocaleString('tr-TR')} ₺</span>
                  </div>
                  {h.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{h.aciklama}</p>}
                </div>
              ))}
              {hakedisler.length === 0 && <p className="bos-mesaj">Henüz hakediş kaydı yok.</p>}
            </div>

            <div className="ekleme-kutusu">
              <input type="text" placeholder="Dönem (örn. Temmuz 2026)" value={hkDonem} onChange={(e) => setHkDonem(e.target.value)} />
              <div className="ekleme-satiri-2">
                <input type="number" placeholder="Tutar (₺)" value={hkTutar} onChange={(e) => setHkTutar(e.target.value)} />
                <input type="number" placeholder="Kesinti/Avans (₺)" value={hkKesinti} onChange={(e) => setHkKesinti(e.target.value)} />
              </div>
              <select value={hkDurum} onChange={(e) => setHkDurum(e.target.value)}>
                <option value="bekliyor">Ödeme bekliyor</option>
                <option value="odendi">Ödendi</option>
              </select>
              <input type="text" placeholder="Açıklama (opsiyonel)" value={hkAciklama} onChange={(e) => setHkAciklama(e.target.value)} />
              <button className="ekle-buton-genis" onClick={hakedisEkle}>Hakediş kaydı ekle</button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ---- LİSTE GÖRÜNÜMÜ ----
  return (
    <div className="sayfa">
      <h2>Cari kartlar</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input type="text" placeholder="Taşeron ara..." value={arama} onChange={(e) => setArama(e.target.value)} style={{ flex: 1, margin: 0 }} />
        <HizliSantiyeEkle />
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 12 }}>
        <button className={siralama === 'alfabetik' ? 'secili-tab' : ''} onClick={() => setSiralama('alfabetik')}>Alfabetik</button>
        <button className={siralama === 'tarih' ? 'secili-tab' : ''} onClick={() => setSiralama('tarih')}>Eklenme tarihi</button>
      </div>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      <div className="liste">
        {filtreliListe.map((t) => (
          <div key={t.id} className="kart taseron-satir" onClick={() => detayYukle(t.id)}>
            <div className="avatar-daire">{t.ad.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="taseron-ad">{t.ad}{t.sifat ? <span className="taseron-sifat"> · {t.sifat}</span> : ''}</p>
              <p className="taseron-firma">{(taseronSantiyeHaritasi[t.id] || []).map((s) => s.ad).join(', ') || 'Şantiye ataması yok'}</p>
            </div>
            <span className="chevron-buyuk">›</span>
          </div>
        ))}
        {filtreliListe.length === 0 && <p className="bos-mesaj">Taşeron bulunamadı.</p>}
      </div>

      {!yeniTaseronAcik ? (
        <button className="ekle-buton-genis" style={{ marginTop: 14 }} onClick={() => setYeniTaseronAcik(true)}>
          + Yeni taşeron ekle
        </button>
      ) : (
        <div className="ekleme-kutusu">
          <input type="text" placeholder="Ad soyad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
          <input type="text" placeholder="Sıfat / unvan (örn. Elektrik ustası)" value={yeniSifat} onChange={(e) => setYeniSifat(e.target.value)} />
          <input type="text" placeholder="Firma" value={yeniFirma} onChange={(e) => setYeniFirma(e.target.value)} />
          <input type="text" placeholder="Telefon" value={yeniTelefon} onChange={(e) => setYeniTelefon(e.target.value)} />
          <input type="text" placeholder="Adres" value={yeniAdres} onChange={(e) => setYeniAdres(e.target.value)} />
          <p style={{ fontSize: 11, color: '#888780', margin: 0 }}>Şantiye ataması kaydettikten sonra detay ekranından yapılabilir.</p>
          <button className="ekle-buton-genis" onClick={taseronEkle}>Taşeronu kaydet</button>
        </div>
      )}
    </div>
  )
}
