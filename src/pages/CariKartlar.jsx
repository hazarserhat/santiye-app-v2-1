import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'

export default function CariKartlar() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'

  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeHaritasi, setTaseronSantiyeHaritasi] = useState({})
  const [siralama, setSiralama] = useState('alfabetik')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [seciliId, setSeciliId] = useState(null)
  const [arama, setArama] = useState('')

  const [notlar, setNotlar] = useState([])
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [cekler, setCekler] = useState([]) // <--- ÇEK GİRDİLERİ İÇİN STATE

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

  // --- BİLGİ KARTI FORM STATE'LERİ ---
  const [hkDonem, setHkDonem] = useState('')
  const [hkTutar, setHkTutar] = useState('')
  const [hkKesinti, setHkKesinti] = useState('')
  const [hkAciklama, setHkAciklama] = useState('')

  // --- DÜZENLEME STATE'LERİ ---
  const [duzenlenenHakedisId, setDuzenlenenHakedisId] = useState(null)
  const [duzHkDonem, setDuzHkDonem] = useState('')
  const [duzHkTutar, setDuzHkTutar] = useState('')
  const [duzHkKesinti, setDuzHkKesinti] = useState('')
  const [duzHkAciklama, setDuzHkAciklama] = useState('')

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*')
    // Şantiye şefi sadece izin verilenleri görür
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data, error: taseronHata } = await query
    if (taseronHata) { alert('Taşeronlar yüklenemedi: ' + taseronHata.message); return }
    setTaseronlar(data || [])

    const { data: iliskiler, error: iliskiHata } = await supabase.from('taseron_santiyeler').select('taseron_id, santiye_id')
    if (iliskiHata) { alert('Şantiye ilişkileri yüklenemedi: ' + iliskiHata.message); return }
    const harita = {}
    ;(iliskiler || []).forEach((r) => {
      if (!harita[r.taseron_id]) harita[r.taseron_id] = []
      harita[r.taseron_id].push(r.santiye_id)
    })
    setTaseronSantiyeHaritasi(harita)
  }

  // Şantiye şefi görünürlük ayarını güncelle
  const gorunurlukDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ sef_gorunur: !mevcutDurum })
      .eq('id', id)
    
    if (error) {
      alert('Hata oluştu: ' + error.message)
    } else {
      taseronlariYukle()
    }
  }

  // Cari hesap silme (Yönetici)
  const taseronSil = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Bu cari hesap kaydını ve tüm ilişkili verilerini silmek istediğinize emin misiniz?')) return

    const { error } = await supabase.from('taseronlar').delete().eq('id', id)
    if (error) {
      alert('Silme başarısız: ' + error.message)
    } else {
      taseronlariYukle()
      if (seciliId === id) setSeciliId(null)
    }
  }

  const detayYukle = async (id) => {
    setSeciliId(id)
    setEklenecekSantiyeId('')
    setDuzenleModu(false)
    setDuzenlenenHakedisId(null)

    const taseron = taseronlar.find((t) => t.id === id)
    if (taseron) {
      setDuzAd(taseron.ad); setDuzSifat(taseron.sifat || ''); setDuzFirma(taseron.firma || '')
      setDuzTelefon(taseron.telefon || ''); setDuzAdres(taseron.adres || '')
    }

    const { data: notData, error: notHata } = await supabase
      .from('taseron_notlari').select('*, profiles(ad_soyad)').eq('taseron_id', id).order('created_at', { ascending: false })
    if (notHata) console.error('Notlar yüklenemedi:', notHata.message)
    setNotlar(notData || [])

    const { data: santiyeData, error: santiyeHata } = await supabase.from('taseron_santiyeler').select('id, santiye_id').eq('taseron_id', id)
    if (santiyeHata) { alert('Şantiye ilişkileri yüklenemedi: ' + santiyeHata.message); return }
    setIliskiliSantiyeler(santiyeData || [])

    // Masrafları çek (cari_id eşleşmesine göre)
    const { data: masrafData } = await supabase
      .from('masraflar')
      .select('*, santiyeler(ad), masraf_kategorileri(ad)')
      .eq('cari_id', id)
      .order('harcama_tarihi', { ascending: false })
    setMasraflar(masrafData || [])

    // Çekleri çek (cari_id eşleşmesine göre)
    const { data: cekData } = await supabase
      .from('cekler')
      .select('*')
      .eq('cari_id', id)
    setCekler(cekData || [])

    // Bilgi kartlarını çek
    const { data: hkData } = await supabase
      .from('hakedisler')
      .select('*')
      .eq('taseron_id', id)
      .order('created_at', { ascending: false })
    setHakedisler(hkData || [])
  }

  const taseronEkle = async () => {
    if (!yeniAd.trim()) return
    const { data, error } = await supabase
      .from('taseronlar')
      .insert({ ad: yeniAd, sifat: yeniSifat, firma: yeniFirma, telefon: yeniTelefon, adres: yeniAdres, sef_gorunur: true })
      .select().single()
    if (error) { alert('Taşeron eklenemedi: ' + error.message); return }
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
    if (error) { alert('Şantiye eklenemedi: ' + error.message); return }
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
    const { error } = await supabase.from('hakedisler').insert({
      taseron_id: seciliId,
      donem: hkDonem,
      tutar: Number(hkTutar),
      kesinti_avans: Number(hkKesinti) || 0,
      aciklama: hkAciklama,
      ekleyen: profile?.id,
    })
    if (error) { alert('Bilgi kartı eklenemedi: ' + error.message); return }
    setHkDonem(''); setHkTutar(''); setHkKesinti(''); setHkAciklama('')
    detayYukle(seciliId)
  }

  const hakedisGuncelle = async (hakedisId) => {
    if (!duzHkDonem.trim() || !duzHkTutar) return
    const { error } = await supabase.from('hakedisler').update({
      donem: duzHkDonem,
      tutar: Number(duzHkTutar),
      kesinti_avans: Number(duzHkKesinti) || 0,
      aciklama: duzHkAciklama,
    }).eq('id', hakedisId)

    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenHakedisId(null)
    detayYukle(seciliId)
  }

  const hakedisSil = async (hakedisId) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('hakedisler').delete().eq('id', hakedisId)
    if (error) { alert('Silinemedi: ' + error.message); return }
    detayYukle(seciliId)
  }

  const hakedisPaylas = (h) => {
    const netTutar = Number(h.tutar) - Number(h.kesinti_avans || 0)
    const metin =
      `📋 *BİLGİ KARTI: ${h.donem}*\n` +
      `*Taşeron/Cari* : ${seciliTaseron?.ad || '—'}\n` +
      `*Tutar* : ${paraFormatla(h.tutar)} ₺\n` +
      `*Kesinti/Avans* : -${paraFormatla(h.kesinti_avans || 0)} ₺\n` +
      `*Net Tutar* : ${paraFormatla(netTutar)} ₺\n` +
      `*Açıklama* : ${h.aciklama || '—'}`

    if (navigator.share) {
      try { navigator.share({ text: metin }) } catch { /* kullanıcı iptal etti */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  const seciliTaseron = taseronlar.find((t) => t.id === seciliId)

  const filtreliListe = taseronlar
    .filter((t) => {
      const aramaMetni = arama.toLowerCase()
      const eslesiyorMu = t.ad.toLowerCase().includes(aramaMetni) || (t.sifat || '').toLowerCase().includes(aramaMetni)
      const santiyeyeUyuyorMu = filtreSantiye === 'hepsi' || (taseronSantiyeHaritasi[t.id] || []).includes(filtreSantiye)
      return eslesiyorMu && santiyeyeUyuyorMu
    })
    .sort((a, b) => siralama === 'alfabetik' ? a.ad.localeCompare(b.ad) : new Date(b.created_at) - new Date(a.created_at))

  const eklenebilirSantiyeler = santiyeler.filter((s) => !iliskiliSantiyeler.find((r) => r.santiye_id === s.id))

  // ---- KRONOLOJİK TİMELİNE SIRALAMASI (HAKEDİŞLER + MASRAFLAR + ÇEKLER - GÜN, SAAT, SANİYE BAZINDA) ----
  const timelineOlaylari = [
    ...hakedisler.map((h) => ({
      tip: 'hakedis',
      sortKey: new Date(h.created_at || Date.now()).getTime(),
      veri: h,
    })),
    ...masraflar.map((m) => ({
      tip: 'masraf',
      sortKey: new Date(m.kayit_tarihi || m.harcama_tarihi || Date.now()).getTime(),
      veri: m,
    })),
    ...cekler.map((c) => ({
      tip: 'cek',
      sortKey: new Date(c.created_at || c.vade_tarihi || Date.now()).getTime(),
      veri: c,
    })),
  ].sort((a, b) => b.sortKey - a.sortKey)

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
              {santiyeler.find((s) => s.id === r.santiye_id)?.ad || '—'}
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

        {/* --- ORTAK TİMELİNE (BİLGİ KARTLARI, ÖDEMELER & ÇEKLER) --- */}
        <p className="alt-baslik" style={{ marginTop: 20 }}>Anlaşma / Avans / İskonto / Hakediş Bilgi Kartları & Finansal Akış</p>

        {!yonetici && (
          <div className="kilit-kutusu">
            <span className="kilit-ikon">🔒</span>
            <p>Finansal bilgiler sadece yöneticiler tarafından görülebilir.</p>
          </div>
        )}

        {yonetici && (
          <>
            <div className="liste">
              {timelineOlaylari.map((olay, index) => {
                if (olay.tip === 'hakedis') {
                  const h = olay.veri
                  const duzenlekte = duzenlenenHakedisId === h.id

                  return (
                    <div key={`hk-${h.id || index}`} className="kart" style={{ borderLeft: '4px solid #1D9596' }}>
                      {duzenlekte ? (
                        <div className="ekleme-kutusu" style={{ margin: 0, padding: 0, border: 'none', background: 'transparent' }}>
                          <input type="text" placeholder="Başlık" value={duzHkDonem} onChange={(e) => setDuzHkDonem(e.target.value)} style={{ marginBottom: 6 }} />
                          <div className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
                            <input type="number" placeholder="Tutar (₺)" value={duzHkTutar} onChange={(e) => setDuzHkTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />
                            <input type="number" placeholder="Kesinti/Avans (₺)" value={duzHkKesinti} onChange={(e) => setDuzHkKesinti(e.target.value)} onKeyDown={sadeceSayiTuslari} />
                          </div>
                          <input type="text" placeholder="Açıklama" value={duzHkAciklama} onChange={(e) => setDuzHkAciklama(e.target.value)} style={{ marginBottom: 8 }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setDuzenlenenHakedisId(null)} style={{ fontSize: 12 }}>Vazgeç</button>
                            <button onClick={() => hakedisGuncelle(h.id)} style={{ fontSize: 12 }}>Güncelle</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="kart-ust">
                            <span className="kart-baslik">{h.donem}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button className="sil-buton" onClick={() => hakedisPaylas(h)} aria-label="Paylaş">📤</button>
                              <button className="sil-buton" onClick={() => {
                                setDuzenlenenHakedisId(h.id)
                                setDuzHkDonem(h.donem)
                                setDuzHkTutar(h.tutar)
                                setDuzHkKesinti(h.kesinti_avans || '')
                                setDuzHkAciklama(h.aciklama || '')
                              }} aria-label="Düzenle">✎</button>
                              <button className="sil-buton" onClick={() => hakedisSil(h.id)} aria-label="Sil">🗑</button>
                            </div>
                          </div>
                          <div className="hakedis-hesap" style={{ marginTop: 4 }}>
                            <span>Tutar</span><span>{paraFormatla(h.tutar)} ₺</span>
                            <span>Kesinti/Avans</span><span>-{paraFormatla(h.kesinti_avans)} ₺</span>
                            <span className="hakedis-net-etiket">Net</span>
                            <span className="hakedis-net-tutar">{paraFormatla(Number(h.tutar) - Number(h.kesinti_avans))} ₺</span>
                          </div>
                          {h.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{h.aciklama}</p>}
                          <span className="not-alt" style={{ display: 'block', marginTop: 4 }}>Eklenme Zamanı: {new Date(h.created_at).toLocaleDateString('tr-TR')} {new Date(h.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </>
                      )}
                    </div>
                  )
                } else if (olay.tip === 'masraf') {
                  const m = olay.veri
                  return (
                    <div key={`msf-${m.id || index}`} className="kart" style={{ borderLeft: '4px solid #E08A2E' }}>
                      <div className="kart-ust">
                        <span className="kart-baslik">Ödeme / Masraf: {m.baslik}</span>
                        <span style={{ fontWeight: 700, color: '#D64545' }}>-{paraFormatla(m.tutar)} ₺</span>
                      </div>
                      <div className="etiket-satiri">
                        <span className="etiket etiket-vurgu">{m.santiyeler?.ad || 'Genel Gider'}</span>
                        <span className="etiket">{m.masraf_kategorileri?.ad || 'Ödeme'}</span>
                      </div>
                      {m.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{m.aciklama}</p>}
                      <span className="not-alt">Ödeme Tarihi: {m.harcama_tarihi ? new Date(m.harcama_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
                      <span className="not-alt" style={{ display: 'block', marginTop: 2 }}>Kayıt Zamanı: {m.kayit_tarihi ? `${new Date(m.kayit_tarihi).toLocaleDateString('tr-TR')} ${new Date(m.kayit_tarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '—'}</span>
                    </div>
                  )
                } else {
                  const c = olay.veri
                  return (
                    <div key={`cek-${c.id || index}`} className="kart" style={{ borderLeft: '4px solid #6366F1' }}>
                      <div className="kart-ust">
                        <span className="kart-baslik">Çek Girdisi: No: {c.cek_no || '—'} ({c.banka || 'Banka'})</span>
                        <span style={{ fontWeight: 700, color: '#6366F1' }}>{paraFormatla(c.tutar)} ₺</span>
                      </div>
                      <div className="etiket-satiri">
                        <span className="etiket">Vade: {c.vade_tarihi ? new Date(c.vade_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
                      </div>
                      {c.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{c.aciklama}</p>}
                      <span className="not-alt" style={{ display: 'block', marginTop: 4 }}>Kayıt Zamanı: {c.created_at ? `${new Date(c.created_at).toLocaleDateString('tr-TR')} ${new Date(c.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '—'}</span>
                    </div>
                  )
                }
              })}
              {timelineOlaylari.length === 0 && <p className="bos-mesaj">Henüz finansal hareket kaydı yok.</p>}
            </div>

            <div className="ekleme-kutusu">
              <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Yeni Bilgi Kartı Ekle (Anlaşma / Avans / İskonto / Hakediş)</p>
              <input type="text" placeholder="Başlık (örn. Temel İşçiliği Anlaşması)" value={hkDonem} onChange={(e) => setHkDonem(e.target.value)} style={{ marginBottom: 6 }} />
              <div className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
                <input type="number" placeholder="Tutar (₺)" value={hkTutar} onChange={(e) => setHkTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />
                <input type="number" placeholder="Kesinti/Avans (₺)" value={hkKesinti} onChange={(e) => setHkKesinti(e.target.value)} onKeyDown={sadeceSayiTuslari} />
              </div>
              <input type="text" placeholder="Açıklama (opsiyonel)" value={hkAciklama} onChange={(e) => setHkAciklama(e.target.value)} style={{ marginBottom: 8 }} />
              <button className="ekle-buton-genis" onClick={hakedisEkle}>Bilgi kartı kaydı ekle</button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ---- LİSTE GÖRÜNÜMÜ ----
  return (
    <div className="sayfa">
      <h2>Cari Hesaplar</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input type="text" placeholder="Taşeron ara..." value={arama} onChange={(e) => setArama(e.target.value)} style={{ flex: 1, margin: 0 }} />
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
          <div key={t.id} className="kart taseron-satir" onClick={() => detayYukle(t.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <div className="avatar-daire">{t.ad.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="taseron-ad">{t.ad}{t.sifat ? <span className="taseron-sifat"> · {t.sifat}</span> : ''}</p>
                <p className="taseron-firma">
                  {(taseronSantiyeHaritasi[t.id] || []).map((sid) => santiyeler.find((s) => s.id === sid)?.ad).filter(Boolean).join(', ') || 'Şantiye ataması yok'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, flexShrink: 0 }}>
              {yonetici && (
                <>
                  <label onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input 
                      type="checkbox" 
                      checked={t.sef_gorunur || false} 
                      onChange={(e) => gorunurlukDegistir(t.id, t.sef_gorunur, e)}
                    /> Şef Görsün
                  </label>
                  
                  <button 
                    onClick={(e) => taseronSil(t.id, e)} 
                    style={{ background: '#ffe6e6', color: '#d9534f', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >
                    🗑 Sil
                  </button>
                </>
              )}
              <span className="chevron-buyuk">›</span>
            </div>
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