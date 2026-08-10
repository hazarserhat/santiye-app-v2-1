import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'

const bugun = () => new Date().toISOString().slice(0, 10)
const gunEkle = (t, n) => {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
const tarihGoster = (t) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Puantaj() {
  const [sayfa, setSayfa] = useState('takvim') // 'takvim' | 'toplam'

  return (
    <div className="sayfa">
      <h2>Puantaj</h2>
      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button className={sayfa === 'takvim' ? 'secili-tab' : ''} onClick={() => setSayfa('takvim')}>Takvim</button>
        <button className={sayfa === 'toplam' ? 'secili-tab' : ''} onClick={() => setSayfa('toplam')}>Toplam / Rapor</button>
      </div>
      {sayfa === 'takvim' ? <PuantajTakvim /> : <PuantajToplam />}
    </div>
  )
}

// ============================================================
// SAYFA 1 — TAKVİM (günlük giriş + aylık takvim özeti)
// ============================================================
function PuantajTakvim() {
  const { aktifSantiye, santiyeler } = useSite()
  const [gorunum, setGorunum] = useState('gunluk')
  const [tarih, setTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')

  const [taseronlar, setTaseronlar] = useState([])
  const [calisanlar, setCalisanlar] = useState([]) // tüm taşeronların tüm çalışanları
  const [kayitlar, setKayitlar] = useState([])
  const [calisanKayitlari, setCalisanKayitlari] = useState([])
  const [ayKayitlari, setAyKayitlari] = useState([])
  const [ayCalisanKayitlari, setAyCalisanKayitlari] = useState([])

  const [yeniTaseronId, setYeniTaseronId] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [acikKayitlar, setAcikKayitlar] = useState({})
  const [yeniCalisanAdi, setYeniCalisanAdi] = useState({}) // { taseronId: metin }

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
    supabase.from('taseron_calisanlari').select('*').order('ad_soyad').then(({ data }) => setCalisanlar(data || []))
  }, [])

  useEffect(() => {
    if (aktifSantiye) setYeniSantiyeId(filtreSantiye !== 'hepsi' ? filtreSantiye : aktifSantiye.id)
  }, [aktifSantiye, filtreSantiye])

  useEffect(() => {
    if (gorunum === 'gunluk') kayitlariYukle()
  }, [tarih, filtreSantiye, gorunum])

  useEffect(() => {
    if (gorunum === 'aylik') ayKayitlariniYukle()
  }, [tarih, filtreSantiye, gorunum])

  const kayitlariYukle = async () => {
    let sorgu = supabase.from('puantaj_kayitlari').select('*, taseronlar(ad), santiyeler(ad)').eq('tarih', tarih)
    if (filtreSantiye !== 'hepsi') sorgu = sorgu.eq('santiye_id', filtreSantiye)
    const { data, error } = await sorgu
    if (error) { alert('Puantaj yüklenemedi: ' + error.message); return }
    setKayitlar(data || [])

    let ck = supabase.from('puantaj_calisan_kayitlari').select('*').eq('tarih', tarih)
    if (filtreSantiye !== 'hepsi') ck = ck.eq('santiye_id', filtreSantiye)
    const { data: ckData } = await ck
    setCalisanKayitlari(ckData || [])
  }

  const ayKayitlariniYukle = async () => {
    const ilkGun = tarih.slice(0, 8) + '01'
    const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
    let sorgu = supabase.from('puantaj_kayitlari').select('santiye_id, taseron_id, tarih, diger_sayisi').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    if (filtreSantiye !== 'hepsi') sorgu = sorgu.eq('santiye_id', filtreSantiye)
    const { data } = await sorgu
    setAyKayitlari(data || [])

    let ck = supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    if (filtreSantiye !== 'hepsi') ck = ck.eq('santiye_id', filtreSantiye)
    const { data: ckData } = await ck
    setAyCalisanKayitlari(ckData || [])
  }

  const satirEkle = async () => {
    if (!yeniTaseronId || !yeniSantiyeId) return
    const varMi = kayitlar.find((k) => k.taseron_id === yeniTaseronId && k.santiye_id === yeniSantiyeId)
    if (varMi) { alert('Bu taşeron için bugün zaten bir kayıt var.'); return }
    const { error } = await supabase.from('puantaj_kayitlari').insert({
      santiye_id: yeniSantiyeId, taseron_id: yeniTaseronId, tarih, kisi_sayisi: 0, diger_sayisi: 0,
    })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniTaseronId('')
    kayitlariYukle()
  }

  const digerGuncelle = async (kayit, delta) => {
    const yeni = Math.max(0, (kayit.diger_sayisi || 0) + delta)
    setKayitlar((onceki) => onceki.map((k) => (k.id === kayit.id ? { ...k, diger_sayisi: yeni } : k)))
    await supabase.from('puantaj_kayitlari').update({ diger_sayisi: yeni }).eq('id', kayit.id)
  }

  const notGuncelle = async (kayit, metin) => {
    await supabase.from('puantaj_kayitlari').update({ not_metni: metin }).eq('id', kayit.id)
  }

  const satirSil = async (id) => {
    if (!window.confirm('Bu puantaj kaydını (ve işaretli çalışanlarını) silmek istediğinize emin misiniz?')) return
    await supabase.from('puantaj_kayitlari').delete().eq('id', id)
    kayitlariYukle()
  }

  const calisanTikle = async (kayit, calisanId) => {
    const mevcutKayit = calisanKayitlari.find((c) => c.santiye_id === kayit.santiye_id && c.taseron_id === kayit.taseron_id && c.calisan_id === calisanId)
    if (mevcutKayit) {
      setCalisanKayitlari((onceki) => onceki.filter((c) => c.id !== mevcutKayit.id))
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('id', mevcutKayit.id)
    } else {
      const gecici = { id: `gecici-${calisanId}`, santiye_id: kayit.santiye_id, taseron_id: kayit.taseron_id, calisan_id: calisanId, tarih }
      setCalisanKayitlari((onceki) => [...onceki, gecici])
      const { data, error } = await supabase.from('puantaj_calisan_kayitlari')
        .insert({ santiye_id: kayit.santiye_id, taseron_id: kayit.taseron_id, calisan_id: calisanId, tarih })
        .select().single()
      if (error) { alert('İşaretlenemedi: ' + error.message); kayitlariYukle(); return }
      setCalisanKayitlari((onceki) => onceki.map((c) => (c.id === gecici.id ? data : c)))
    }
  }

  const calisanEkle = async (taseronId) => {
    const ad = (yeniCalisanAdi[taseronId] || '').trim()
    if (!ad) return
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, ad_soyad: ad }).select().single()
    if (error) { alert('Çalışan eklenemedi: ' + error.message); return }
    setCalisanlar((onceki) => [...onceki, data])
    setYeniCalisanAdi((onceki) => ({ ...onceki, [taseronId]: '' }))
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  const kayitToplam = (kayit) => {
    const tikliSayisi = calisanKayitlari.filter((c) => c.santiye_id === kayit.santiye_id && c.taseron_id === kayit.taseron_id).length
    return tikliSayisi + (kayit.diger_sayisi || 0)
  }
  const gunlukToplam = kayitlar.reduce((t, k) => t + kayitToplam(k), 0)
  const eklenebilirTaseronlar = taseronlar.filter((t) => !kayitlar.find((k) => k.taseron_id === t.id && k.santiye_id === yeniSantiyeId))

  const gunToplamHaritasi = {}
  ayKayitlari.forEach((k) => {
    const anahtar = k.tarih
    const tikli = ayCalisanKayitlari.filter((c) => c.tarih === k.tarih && c.santiye_id === k.santiye_id && c.taseron_id === k.taseron_id).length
    gunToplamHaritasi[anahtar] = (gunToplamHaritasi[anahtar] || 0) + tikli + (k.diger_sayisi || 0)
  })

  const ilkGunTarih = new Date(tarih.slice(0, 8) + '01')
  const ayAdi = ilkGunTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const ayinGunSayisi = new Date(ilkGunTarih.getFullYear(), ilkGunTarih.getMonth() + 1, 0).getDate()
  const ilkGunHaftaIndeksi = (ilkGunTarih.getDay() + 6) % 7

  return (
    <>
      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      <div className="gorunum-secici">
        <button className={gorunum === 'gunluk' ? 'secili-tab' : ''} onClick={() => setGorunum('gunluk')}>Günlük</button>
        <button className={gorunum === 'aylik' ? 'secili-tab' : ''} onClick={() => setGorunum('aylik')}>Aylık</button>
      </div>

      {gorunum === 'gunluk' && (
        <>
          <div className="tarih-gezici">
            <button onClick={() => setTarih((t) => gunEkle(t, -1))}>‹</button>
            <span>{tarihGoster(tarih)}</span>
            <button onClick={() => setTarih((t) => gunEkle(t, 1))}>›</button>
          </div>

          <div className="ozet-kart" style={{ marginBottom: 14 }}>
            <p className="ozet-etiket">Toplam çalışan</p>
            <p className="ozet-tutar">{gunlukToplam}</p>
          </div>

          <div className="liste">
            {kayitlar.map((k) => {
              const taseronCalisanlari = calisanlar.filter((c) => c.taseron_id === k.taseron_id)
              const acik = acikKayitlar[k.id]
              return (
                <div key={k.id} className="kart">
                  <div className="kart-ust" onClick={() => setAcikKayitlar((o) => ({ ...o, [k.id]: !o[k.id] }))} style={{ cursor: 'pointer' }}>
                    <div>
                      <span className="kart-baslik">{acik ? '▾' : '▸'} {k.taseronlar?.ad}</span>
                      {filtreSantiye === 'hepsi' && <span className="etiket etiket-vurgu" style={{ marginLeft: 8 }}>{k.santiyeler?.ad}</span>}
                      <span className="etiket" style={{ marginLeft: 6 }}>{kayitToplam(k)} kişi</span>
                    </div>
                    <button className="sil-buton" onClick={(e) => { e.stopPropagation(); satirSil(k.id) }} aria-label="Kaydı sil">🗑</button>
                  </div>

                  {acik && (
                    <div style={{ marginTop: 10 }}>
                      {taseronCalisanlari.map((c) => {
                        const tikli = !!calisanKayitlari.find((ck) => ck.santiye_id === k.santiye_id && ck.taseron_id === k.taseron_id && ck.calisan_id === c.id)
                        return (
                          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                            <input type="checkbox" checked={tikli} onChange={() => calisanTikle(k, c.id)} style={{ width: 16, height: 16 }} />
                            {c.ad_soyad}
                          </label>
                        )
                      })}
                      {taseronCalisanlari.length === 0 && <p className="bos-mesaj" style={{ padding: '4px 0' }}>Henüz kayıtlı çalışan yok.</p>}

                      <div className="ekleme-satiri-2" style={{ marginTop: 6 }}>
                        <input
                          type="text"
                          placeholder="Yeni çalışan adı..."
                          value={yeniCalisanAdi[k.taseron_id] || ''}
                          onChange={(e) => setYeniCalisanAdi((o) => ({ ...o, [k.taseron_id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && calisanEkle(k.taseron_id)}
                        />
                        <button onClick={() => calisanEkle(k.taseron_id)}>Ekle</button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1EFE8' }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>Diğer (kayıtsız çalışan)</span>
                        <div className="stepper-satiri" style={{ marginTop: 0 }}>
                          <button className="stepper-buton" onClick={() => digerGuncelle(k, -1)}>−</button>
                          <span className="stepper-sayi">{k.diger_sayisi || 0}</span>
                          <button className="stepper-buton" onClick={() => digerGuncelle(k, 1)}>+</button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Not (opsiyonel)"
                        defaultValue={k.not_metni || ''}
                        onBlur={(e) => notGuncelle(k, e.target.value)}
                        style={{ marginTop: 8, fontSize: 12 }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            {kayitlar.length === 0 && <p className="bos-mesaj">Bu tarihte kayıt yok.</p>}
          </div>

          <div className="ekleme-kutusu">
            {filtreSantiye === 'hepsi' && (
              <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
                {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              </select>
            )}
            <select value={yeniTaseronId} onChange={(e) => setYeniTaseronId(e.target.value)}>
              <option value="">Taşeron seç...</option>
              {eklenebilirTaseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
            </select>
            <button className="ekle-buton-genis" onClick={satirEkle}>Taşeron satırı ekle</button>
          </div>
        </>
      )}

      {gorunum === 'aylik' && (
        <>
          <div className="tarih-gezici">
            <button onClick={() => setTarih((t) => gunEkle(t, -30))}>‹</button>
            <span style={{ textTransform: 'capitalize' }}>{ayAdi}</span>
            <button onClick={() => setTarih((t) => gunEkle(t, 30))}>›</button>
          </div>

          <div className="takvim-baslik-satiri">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => <span key={g}>{g}</span>)}
          </div>
          <div className="takvim-grid">
            {Array.from({ length: ilkGunHaftaIndeksi }).map((_, i) => <div key={`bos-${i}`} />)}
            {Array.from({ length: ayinGunSayisi }).map((_, i) => {
              const gunTarihi = `${tarih.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
              const toplam = gunToplamHaritasi[gunTarihi]
              return (
                <button
                  key={gunTarihi}
                  className={`takvim-gun ${gunTarihi === bugun() ? 'bugun' : ''}`}
                  onClick={() => { setTarih(gunTarihi); setGorunum('gunluk') }}
                >
                  <span className="takvim-gun-no">{i + 1}</span>
                  <span className="takvim-gun-toplam">{toplam ?? '–'}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

// ============================================================
// SAYFA 2 — TOPLAM / RAPOR (esnek filtreli özet)
// ============================================================
function PuantajToplam() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [donem, setDonem] = useState('gunluk') // 'gunluk' | 'aylik' | 'tum'
  const [tarih, setTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreTaseron, setFiltreTaseron] = useState('hepsi')

  const [kayitlar, setKayitlar] = useState([])
  const [calisanSayilari, setCalisanSayilari] = useState({}) // { "santiyeId_taseronId_tarih": sayi }
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
  }, [])

  useEffect(() => {
    raporuYukle()
  }, [donem, tarih, filtreSantiye, filtreTaseron])

  const raporuYukle = async () => {
    setYukleniyor(true)
    let sorgu = supabase.from('puantaj_kayitlari').select('santiye_id, taseron_id, tarih, diger_sayisi, santiyeler(ad), taseronlar(ad)')
    let ckSorgu = supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih')

    if (donem === 'gunluk') {
      sorgu = sorgu.eq('tarih', tarih); ckSorgu = ckSorgu.eq('tarih', tarih)
    } else if (donem === 'aylik') {
      const ilkGun = tarih.slice(0, 8) + '01'
      const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
      sorgu = sorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
      ckSorgu = ckSorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    }
    if (filtreSantiye !== 'hepsi') { sorgu = sorgu.eq('santiye_id', filtreSantiye); ckSorgu = ckSorgu.eq('santiye_id', filtreSantiye) }
    if (filtreTaseron !== 'hepsi') { sorgu = sorgu.eq('taseron_id', filtreTaseron); ckSorgu = ckSorgu.eq('taseron_id', filtreTaseron) }

    const { data, error } = await sorgu
    if (error) { alert('Rapor yüklenemedi: ' + error.message); setYukleniyor(false); return }
    setKayitlar(data || [])

    const { data: ckData } = await ckSorgu
    const sayac = {}
    ;(ckData || []).forEach((c) => {
      const anahtar = `${c.santiye_id}_${c.taseron_id}_${c.tarih}`
      sayac[anahtar] = (sayac[anahtar] || 0) + 1
    })
    setCalisanSayilari(sayac)
    setYukleniyor(false)
  }

  const kayitToplami = (k) => {
    const anahtar = `${k.santiye_id}_${k.taseron_id}_${k.tarih}`
    return (calisanSayilari[anahtar] || 0) + (k.diger_sayisi || 0)
  }

  const genelToplam = kayitlar.reduce((t, k) => t + kayitToplami(k), 0)

  const santiyeBazinda = {}
  const taseronBazinda = {}
  kayitlar.forEach((k) => {
    const t = kayitToplami(k)
    const sAdi = k.santiyeler?.ad || '—'
    const tAdi = k.taseronlar?.ad || '—'
    santiyeBazinda[sAdi] = (santiyeBazinda[sAdi] || 0) + t
    taseronBazinda[tAdi] = (taseronBazinda[tAdi] || 0) + t
  })

  return (
    <>
      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreTaseron === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreTaseron('hepsi')}>Tüm taşeronlar</button>
        {taseronlar.map((t) => (
          <button key={t.id} className={`filtre-chip ${filtreTaseron === t.id ? 'secili' : ''}`} onClick={() => setFiltreTaseron(t.id)}>{t.ad}</button>
        ))}
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button className={donem === 'gunluk' ? 'secili-tab' : ''} onClick={() => setDonem('gunluk')}>Günlük</button>
        <button className={donem === 'aylik' ? 'secili-tab' : ''} onClick={() => setDonem('aylik')}>Aylık</button>
        <button className={donem === 'tum' ? 'secili-tab' : ''} onClick={() => setDonem('tum')}>Tümü</button>
      </div>

      {donem !== 'tum' && (
        <div className="tarih-gezici">
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))}>‹</button>
          <span style={{ textTransform: 'capitalize' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))}>›</button>
        </div>
      )}

      <div className="ozet-kart" style={{ marginBottom: 14 }}>
        <p className="ozet-etiket">Genel toplam</p>
        <p className="ozet-tutar">{yukleniyor ? '...' : genelToplam}</p>
      </div>

      {filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0 && (
        <>
          <p className="alt-baslik">Şantiye bazında</p>
          <div className="liste" style={{ marginBottom: 16 }}>
            {Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                <span style={{ fontSize: 13 }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{sayi}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0 && (
        <>
          <p className="alt-baslik">Taşeron bazında</p>
          <div className="liste">
            {Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                <span style={{ fontSize: 13 }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{sayi}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {kayitlar.length === 0 && !yukleniyor && <p className="bos-mesaj">Bu filtrede kayıt yok.</p>}
    </>
  )
}
