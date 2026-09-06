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
  const [sayfa, setSayfa] = useState('kayit') // 'kayit' | 'takvim' | 'toplam' | 'calisan_rapor' | 'isci_yonetim'

  return (
    <div className="sayfa">
      <h2>Puantaj</h2>
      <div className="gorunum-secici" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
        <button className={sayfa === 'kayit' ? 'secili-tab' : ''} onClick={() => setSayfa('kayit')}>1- Kayıt Ekleme</button>
        <button className={sayfa === 'takvim' ? 'secili-tab' : ''} onClick={() => setSayfa('takvim')}>2- Takvim (Gözlem)</button>
        <button className={sayfa === 'toplam' ? 'secili-tab' : ''} onClick={() => setSayfa('toplam')}>3- Dönem Raporu</button>
        <button className={sayfa === 'calisan_rapor' ? 'secili-tab' : ''} onClick={() => setSayfa('calisan_rapor')}>4- Çalışan Raporu</button>
        <button className={sayfa === 'isci_yonetim' ? 'secili-tab' : ''} onClick={() => setSayfa('isci_yonetim')}>5- İşçi Yönetimi</button>
      </div>
      
      {sayfa === 'kayit' && <PuantajKayitEkleme />}
      {sayfa === 'takvim' && <PuantajTakvimGozlem />}
      {sayfa === 'toplam' && <PuantajToplam />}
      {sayfa === 'calisan_rapor' && <PuantajCalisanRapor />}
      {sayfa === 'isci_yonetim' && <PuantajCalisanKayit />}
    </div>
  )
}

// ============================================================
// 1- KAYIT EKLEME (Günlük Yoklama)
// ============================================================
function PuantajKayitEkleme() {
  const { aktifSantiye, santiyeler } = useSite()
  const [tarih, setTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  
  const [taseronlar, setTaseronlar] = useState([])
  const [calisanlar, setCalisanlar] = useState([]) // Seçili güne/şantiyeye uyan taşeronların tüm çalışanları
  const [kayitlar, setKayitlar] = useState([])
  const [calisanKayitlari, setCalisanKayitlari] = useState([])

  const [yeniTaseronId, setYeniTaseronId] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniCalisanAdi, setYeniCalisanAdi] = useState({}) // { taseronId: metin }

  useEffect(() => {
    // Sadece puantajda gösterilecek taşeronları yükle
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
    supabase.from('taseron_calisanlari').select('*').order('ad_soyad').then(({ data }) => setCalisanlar(data || []))
  }, [])

  useEffect(() => {
    if (aktifSantiye) setYeniSantiyeId(filtreSantiye !== 'hepsi' ? filtreSantiye : aktifSantiye.id)
  }, [aktifSantiye, filtreSantiye])

  useEffect(() => {
    kayitlariYukle()
  }, [tarih, filtreSantiye])

  const kayitlariYukle = async () => {
    let sorgu = supabase.from('puantaj_kayitlari').select('*, taseronlar(ad), santiyeler(ad)').eq('tarih', tarih)
    if (filtreSantiye !== 'hepsi') sorgu = sorgu.eq('santiye_id', filtreSantiye)
    const { data, error } = await sorgu
    if (error) { alert('Puantaj yüklenemedi: ' + error.message); return }
    
    // puantajda_goster filtrelemesi: eğer sonradan kapatıldıysa yine de kaydı varsa gelsin
    setKayitlar(data || [])

    let ck = supabase.from('puantaj_calisan_kayitlari').select('*').eq('tarih', tarih)
    if (filtreSantiye !== 'hepsi') ck = ck.eq('santiye_id', filtreSantiye)
    const { data: ckData } = await ck
    setCalisanKayitlari(ckData || [])
  }

  const satirEkle = async () => {
    if (!yeniTaseronId || !yeniSantiyeId) return
    const varMi = kayitlar.find((k) => k.taseron_id === yeniTaseronId && k.santiye_id === yeniSantiyeId)
    if (varMi) { alert('Bu taşeron için seçili tarihte zaten bir kayıt var.'); return }
    const { error } = await supabase.from('puantaj_kayitlari').insert({
      santiye_id: yeniSantiyeId, taseron_id: yeniTaseronId, tarih, kisi_sayisi: 0, diger_sayisi: 0,
    })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniTaseronId('')
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

  const calisanEkle = async (taseronId, santiyeId) => {
    const ad = (yeniCalisanAdi[taseronId] || '').trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, santiye_id: santiyeId, ad_soyad: ad }).select().single()
    if (error) { alert('Çalışan eklenemedi: ' + error.message); return }
    setCalisanlar((onceki) => [...onceki, data])
    setYeniCalisanAdi((onceki) => ({ ...onceki, [taseronId]: '' }))
  }

  const satirSil = async (id) => {
    if (!window.confirm('Bu puantaj kaydını silmek istediğinize emin misiniz?')) return
    await supabase.from('puantaj_kayitlari').delete().eq('id', id)
    kayitlariYukle()
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  const eklenebilirTaseronlar = taseronlar.filter((t) => !kayitlar.find((k) => k.taseron_id === t.id && k.santiye_id === yeniSantiyeId))

  return (
    <div>
      <div className="ekleme-kutusu" style={{ display: 'flex', gap: 10, marginBottom: 14, background: '#fdfdfd' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Şantiye:</span>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Yoklama Tarihi:</span>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
        </div>
      </div>

      <div className="liste">
        {kayitlar.map((k) => {
          const taseronCalisanlari = calisanlar.filter((c) => c.taseron_id === k.taseron_id && c.santiye_id === k.santiye_id)
          const isciSayisi = calisanKayitlari.filter((c) => c.santiye_id === k.santiye_id && c.taseron_id === k.taseron_id).length
          
          return (
            <div key={k.id} className="kart">
              <div className="kart-ust">
                <div>
                  <span className="kart-baslik">{k.taseronlar?.ad}</span>
                  {filtreSantiye === 'hepsi' && <span className="etiket etiket-vurgu" style={{ marginLeft: 8 }}>{k.santiyeler?.ad}</span>}
                  <span className="etiket" style={{ marginLeft: 6 }}>{isciSayisi} kişi tikli</span>
                </div>
                <button className="sil-buton" onClick={() => satirSil(k.id)} aria-label="Kaydı sil">🗑</button>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {taseronCalisanlari.map((c) => {
                  const tikli = !!calisanKayitlari.find((ck) => ck.santiye_id === k.santiye_id && ck.taseron_id === k.taseron_id && ck.calisan_id === c.id)
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, background: tikli ? '#f0fdf4' : '#f8fafc', border: tikli ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input type="checkbox" checked={tikli} onChange={() => calisanTikle(k, c.id)} style={{ width: 16, height: 16, accentColor: '#16a34a' }} />
                      <span style={{ fontWeight: tikli ? 600 : 500, color: tikli ? '#166534' : '#334155' }}>{c.ad_soyad}</span>
                    </label>
                  )
                })}
              </div>
              
              {taseronCalisanlari.length === 0 && <p className="bos-mesaj" style={{ padding: '4px 0' }}>Henüz kayıtlı çalışan yok.</p>}

              <div className="ekleme-satiri-2" style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                <input
                  type="text"
                  placeholder="Hızlıca yeni çalışan ekle..."
                  value={yeniCalisanAdi[k.taseron_id] || ''}
                  onChange={(e) => setYeniCalisanAdi((o) => ({ ...o, [k.taseron_id]: e.target.value.toLocaleUpperCase('tr-TR') }))}
                  onKeyDown={(e) => e.key === 'Enter' && calisanEkle(k.taseron_id, k.santiye_id)}
                />
                <button onClick={() => calisanEkle(k.taseron_id, k.santiye_id)}>Ekle</button>
              </div>
            </div>
          )
        })}
        {kayitlar.length === 0 && <p className="bos-mesaj">Seçili tarihte bu filtreyle hiçbir taşeron satırı açılmamış.</p>}
      </div>

      <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#333' }}>+ Yeni Taşeron Satırı Aç</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {filtreSantiye === 'hepsi' && (
            <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          )}
          <select value={yeniTaseronId} onChange={(e) => setYeniTaseronId(e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
            <option value="">Taşeron seç...</option>
            {eklenebilirTaseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
          <button style={{ padding: '10px 16px', background: '#0f172a', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer' }} onClick={satirEkle}>Satır Ekle</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 2- TAKVİM (Hızlı Gözlem Matrisi)
// ============================================================
function PuantajTakvimGozlem() {
  const { santiyeler } = useSite()
  const [tarih, setTarih] = useState(bugun())
  
  const [ayKayitlari, setAyKayitlari] = useState([])
  const [ayCalisanKayitlari, setAyCalisanKayitlari] = useState([])

  // Hiyerarşi state'leri
  const [seciliGun, setSeciliGun] = useState(null) // YYYY-MM-DD
  const [seciliSantiye, setSeciliSantiye] = useState(null) // ID
  const [seciliTaseron, setSeciliTaseron] = useState(null) // ID

  const [taseronIsimleri, setTaseronIsimleri] = useState({})
  const [calisanIsimleri, setCalisanIsimleri] = useState({})

  useEffect(() => {
    supabase.from('taseronlar').select('id, ad').then(({ data }) => {
      const harita = {}; (data||[]).forEach(d => harita[d.id] = d.ad); setTaseronIsimleri(harita)
    })
    supabase.from('taseron_calisanlari').select('id, ad_soyad').then(({ data }) => {
      const harita = {}; (data||[]).forEach(d => harita[d.id] = d.ad_soyad); setCalisanIsimleri(harita)
    })
  }, [])

  useEffect(() => {
    ayKayitlariniYukle()
  }, [tarih])

  const ayKayitlariniYukle = async () => {
    const ilkGun = tarih.slice(0, 8) + '01'
    const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
    
    const { data: gk } = await supabase.from('puantaj_kayitlari').select('santiye_id, taseron_id, tarih').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    setAyKayitlari(gk || [])

    const { data: ck } = await supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih, calisan_id').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    setAyCalisanKayitlari(ck || [])
  }

  const ilkGunTarih = new Date(tarih.slice(0, 8) + '01')
  const ayAdi = ilkGunTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const ayinGunSayisi = new Date(ilkGunTarih.getFullYear(), ilkGunTarih.getMonth() + 1, 0).getDate()
  const ilkGunHaftaIndeksi = (ilkGunTarih.getDay() + 6) % 7

  const gunTikla = (gunTarihi) => {
    if (seciliGun === gunTarihi) setSeciliGun(null)
    else { setSeciliGun(gunTarihi); setSeciliSantiye(null); setSeciliTaseron(null) }
  }

  // Aktif güne ait tüm şantiyeleri bul (distinct)
  const gununSantiyeleri = seciliGun ? [...new Set(ayKayitlari.filter(k => k.tarih === seciliGun).map(k => k.santiye_id))] : []
  // Aktif şantiyeye ait taşeronları bul
  const gununTaseronlari = seciliSantiye ? [...new Set(ayKayitlari.filter(k => k.tarih === seciliGun && k.santiye_id === seciliSantiye).map(k => k.taseron_id))] : []
  // Aktif taşerona ait çalışanları bul
  const gununCalisanlari = seciliTaseron ? ayCalisanKayitlari.filter(c => c.tarih === seciliGun && c.santiye_id === seciliSantiye && c.taseron_id === seciliTaseron).map(c => c.calisan_id) : []

  return (
    <div>
      <div className="tarih-gezici">
        <button onClick={() => { setTarih((t) => gunEkle(t, -30)); setSeciliGun(null) }}>‹</button>
        <span style={{ textTransform: 'capitalize' }}>{ayAdi}</span>
        <button onClick={() => { setTarih((t) => gunEkle(t, 30)); setSeciliGun(null) }}>›</button>
      </div>

      <div className="takvim-baslik-satiri">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => <span key={g}>{g}</span>)}
      </div>
      <div className="takvim-grid">
        {Array.from({ length: ilkGunHaftaIndeksi }).map((_, i) => <div key={`bos-${i}`} />)}
        {Array.from({ length: ayinGunSayisi }).map((_, i) => {
          const gunTarihi = `${tarih.slice(0, 8)}${String(i + 1).padStart(2, '0')}`
          
          // O gün kaç kişi çalışmış?
          const kisiSayisi = ayCalisanKayitlari.filter(c => c.tarih === gunTarihi).length
          const isSelected = seciliGun === gunTarihi

          return (
            <button
              key={gunTarihi}
              className={`takvim-gun ${gunTarihi === bugun() ? 'bugun' : ''}`}
              style={{ background: isSelected ? '#1e293b' : undefined, color: isSelected ? '#fff' : undefined, transform: isSelected ? 'scale(1.05)' : undefined }}
              onClick={() => gunTikla(gunTarihi)}
            >
              <span className="takvim-gun-no">{i + 1}</span>
              {kisiSayisi > 0 && <span className="takvim-gun-toplam" style={{ background: isSelected ? '#3b82f6' : undefined, color: isSelected ? '#fff' : undefined }}>{kisiSayisi} kişi</span>}
            </button>
          )
        })}
      </div>

      {/* HİYERARŞİ ALANI */}
      {seciliGun && (
        <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#0f172a' }}>{tarihGoster(seciliGun)} Detayları</h3>
          
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10 }}>
            {/* Şantiyeler */}
            <div style={{ flexShrink: 0, width: 250 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>1. Şantiye Seçin</p>
              {gununSantiyeleri.map(sId => {
                const sAd = santiyeler.find(s => s.id === sId)?.ad || 'Bilinmeyen Şantiye'
                const secili = seciliSantiye === sId
                return (
                  <button key={sId} onClick={() => { setSeciliSantiye(sId); setSeciliTaseron(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, background: secili ? '#1e293b' : '#fff', color: secili ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 600 : 400 }}>
                    {sAd}
                  </button>
                )
              })}
              {gununSantiyeleri.length === 0 && <p className="bos-mesaj">Kayıt yok</p>}
            </div>

            {/* Taşeronlar */}
            {seciliSantiye && (
              <div style={{ flexShrink: 0, width: 250, borderLeft: '2px solid #e2e8f0', paddingLeft: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>2. Taşeron Seçin</p>
                {gununTaseronlari.map(tId => {
                  const tAd = taseronIsimleri[tId] || 'Bilinmeyen Taşeron'
                  const secili = seciliTaseron === tId
                  return (
                    <button key={tId} onClick={() => setSeciliTaseron(tId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, background: secili ? '#3b82f6' : '#fff', color: secili ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 600 : 400 }}>
                      {tAd}
                    </button>
                  )
                })}
              </div>
            )}

            {/* İşçiler */}
            {seciliTaseron && (
              <div style={{ flexShrink: 0, width: 250, borderLeft: '2px solid #e2e8f0', paddingLeft: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#64748b' }}>3. İşe Gelenler</p>
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                  {gununCalisanlari.map((cId, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#10b981' }}>✓</span> {calisanIsimleri[cId] || 'Bilinmeyen'}
                    </div>
                  ))}
                  {gununCalisanlari.length === 0 && <div style={{ padding: '12px', fontSize: 13, color: '#64748b' }}>Kimse işaretlenmemiş.</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 3- DÖNEM RAPORU (Genel Toplamlar)
// ============================================================
function PuantajToplam() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [donem, setDonem] = useState('gunluk') // 'gunluk' | 'aylik' | 'aralik' | 'tum'
  const [tarih, setTarih] = useState(bugun())
  const [basTarih, setBasTarih] = useState(bugun())
  const [bitTarih, setBitTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreTaseron, setFiltreTaseron] = useState('hepsi')
  const [filtreAcik, setFiltreAcik] = useState(false)

  const [kayitlar, setKayitlar] = useState([])
  const [calisanSayilari, setCalisanSayilari] = useState({})
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
  }, [])

  useEffect(() => {
    raporuYukle()
  }, [donem, tarih, basTarih, bitTarih, filtreSantiye, filtreTaseron])

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
    } else if (donem === 'aralik') {
      sorgu = sorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
      ckSorgu = ckSorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
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
      <div style={{ marginBottom: 14 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)}>
          {filtreAcik ? 'Filtreleri Gizle' : 'Filtreleri Göster'}
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Taşeron Filtresi</p>
          <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Taşeronlar</option>
            {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
        </div>
      )}

      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button className={donem === 'gunluk' ? 'secili-tab' : ''} onClick={() => setDonem('gunluk')}>Günlük</button>
        <button className={donem === 'aylik' ? 'secili-tab' : ''} onClick={() => setDonem('aylik')}>Aylık</button>
        <button className={donem === 'aralik' ? 'secili-tab' : ''} onClick={() => setDonem('aralik')}>Tarih Aralığı</button>
        <button className={donem === 'tum' ? 'secili-tab' : ''} onClick={() => setDonem('tum')}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici">
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))}>‹</button>
          <span style={{ textTransform: 'capitalize' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 10, marginBottom: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Başlangıç Tarihi:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bitiş Tarihi:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
          </div>
        </div>
      )}

      <div className="ozet-kart" style={{ marginBottom: 14 }}>
        <p className="ozet-etiket">Genel toplam (İşçi yevmiyesi)</p>
        <p className="ozet-tutar">{yukleniyor ? '...' : genelToplam}</p>
      </div>

      {filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0 && (
        <>
          <p className="alt-baslik">Şantiye bazında</p>
          <div className="liste" style={{ marginBottom: 16 }}>
            {Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                <span style={{ fontSize: 13 }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{sayi} yevmiye</span>
              </div>
            ))}
          </div>
        </>
      )}

      {filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0 && (
        <>
          <p className="alt-baslik">Taşeron bazında</p>
          <div className="liste" style={{ marginBottom: 16 }}>
            {Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                <span style={{ fontSize: 13 }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{sayi} yevmiye</span>
              </div>
            ))}
          </div>
        </>
      )}

      {kayitlar.length === 0 && !yukleniyor && <p className="bos-mesaj">Bu filtrede kayıt yok.</p>}
    </>
  )
}

// ============================================================
// 4- ÇALIŞAN BAZLI RAPOR
// ============================================================
function PuantajCalisanRapor() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [donem, setDonem] = useState('aylik') // 'gunluk' | 'aylik' | 'aralik' | 'tum'
  const [tarih, setTarih] = useState(bugun())
  const [basTarih, setBasTarih] = useState(bugun())
  const [bitTarih, setBitTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreTaseron, setFiltreTaseron] = useState('hepsi')
  
  const [aramaIsim, setAramaIsim] = useState('')
  const [calisanRaporu, setCalisanRaporu] = useState([]) // [{ ad, santiye, taseron, sayi }]
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
  }, [])

  useEffect(() => {
    raporuYukle()
  }, [donem, tarih, basTarih, bitTarih, filtreSantiye, filtreTaseron])

  const raporuYukle = async () => {
    setYukleniyor(true)
    let ckSorgu = supabase.from('puantaj_calisan_kayitlari').select('santiye_id, taseron_id, tarih, calisan_id')

    if (donem === 'gunluk') {
      ckSorgu = ckSorgu.eq('tarih', tarih)
    } else if (donem === 'aylik') {
      const ilkGun = tarih.slice(0, 8) + '01'
      const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
      ckSorgu = ckSorgu.gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    } else if (donem === 'aralik') {
      ckSorgu = ckSorgu.gte('tarih', basTarih).lte('tarih', bitTarih)
    }
    
    if (filtreSantiye !== 'hepsi') { ckSorgu = ckSorgu.eq('santiye_id', filtreSantiye) }
    if (filtreTaseron !== 'hepsi') { ckSorgu = ckSorgu.eq('taseron_id', filtreTaseron) }

    const { data: ckData, error } = await ckSorgu
    if (error) { alert('Rapor yüklenemedi'); setYukleniyor(false); return }

    const { data: isciler } = await supabase.from('taseron_calisanlari').select('id, ad_soyad')
    const isciHaritasi = {}
    ;(isciler || []).forEach(i => isciHaritasi[i.id] = i.ad_soyad)

    // Gruplama: Anahtar = "CalisanId_SantiyeId_TaseronId"
    const gruplar = {}
    ;(ckData || []).forEach((c) => {
      if (c.calisan_id) {
        const anahtar = `${c.calisan_id}_${c.santiye_id}_${c.taseron_id}`
        if (!gruplar[anahtar]) {
          gruplar[anahtar] = {
            ad: isciHaritasi[c.calisan_id] || 'Bilinmeyen',
            santiye_id: c.santiye_id,
            taseron_id: c.taseron_id,
            sayi: 0
          }
        }
        gruplar[anahtar].sayi += 1
      }
    })

    setCalisanRaporu(Object.values(gruplar))
    setYukleniyor(false)
  }

  const filtrelenmis = calisanRaporu
    .filter(c => c.ad.toLocaleLowerCase('tr-TR').includes(aramaIsim.trim().toLocaleLowerCase('tr-TR')))
    .sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad))

  const raporuPaylas = () => {
    if (filtrelenmis.length === 0) return alert('Paylaşılacak kayıt yok.')
    
    let metin = `📋 *ÇALIŞAN BAZLI PUANTAJ RAPORU*\n`
    if (donem !== 'tum') {
       metin += `🗓 *Tarih:* ${donem === 'gunluk' ? tarihGoster(tarih) : (donem === 'aylik' ? new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : `${basTarih} - ${bitTarih}`)}\n`
    }
    metin += `\n`

    filtrelenmis.forEach(c => {
      const sAd = santiyeler.find(s => s.id === c.santiye_id)?.ad || '—'
      const tAd = taseronlar.find(t => t.id === c.taseron_id)?.ad || '—'
      metin += `👤 *${c.ad}*\n`
      metin += `📍 ${sAd} (${tAd})\n`
      metin += `✅ Toplam: ${c.sayi} Gün (Yevmiye)\n\n`
    })

    if (navigator.share) {
      navigator.share({ text: metin }).catch(() => {})
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  return (
    <div>
      <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
        <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Taşeron Filtresi</p>
        <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
          <option value="hepsi">Tüm Taşeronlar</option>
          {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Şantiye Filtresi</p>
        <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
          <option value="hepsi">Tüm Şantiyeler</option>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button className={donem === 'gunluk' ? 'secili-tab' : ''} onClick={() => setDonem('gunluk')}>Günlük</button>
        <button className={donem === 'aylik' ? 'secili-tab' : ''} onClick={() => setDonem('aylik')}>Aylık</button>
        <button className={donem === 'aralik' ? 'secili-tab' : ''} onClick={() => setDonem('aralik')}>Tarih Aralığı</button>
        <button className={donem === 'tum' ? 'secili-tab' : ''} onClick={() => setDonem('tum')}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici">
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))}>‹</button>
          <span style={{ textTransform: 'capitalize' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 10, marginBottom: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Başlangıç:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bitiş:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <p className="alt-baslik" style={{ margin: 0 }}>Rapor Çıktısı</p>
        <div style={{ display: 'flex', gap: 8, flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <input 
            type="text" 
            placeholder="İsim ara..." 
            value={aramaIsim} 
            onChange={(e) => setAramaIsim(e.target.value)} 
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, minWidth: '130px', flex: '1 1 130px' }}
          />
          <button onClick={raporuPaylas} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
            Paylaş
          </button>
        </div>
      </div>

      <div className="liste">
        {yukleniyor ? (
          <p className="bos-mesaj">Yükleniyor...</p>
        ) : calisanRaporu.length === 0 ? (
          <p className="bos-mesaj" style={{ marginTop: 0 }}>Bu kriterlere uygun işlenmiş yevmiye kaydı bulunmuyor.</p>
        ) : filtrelenmis.length === 0 ? (
          <p className="bos-mesaj">Aranan isimde kayıt bulunamadı.</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', background: '#f8fafc', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              <span>İSİM SOYİSİM</span>
              <span>ŞANTİYE & TAŞERON</span>
              <span style={{ textAlign: 'right' }}>GÜN</span>
            </div>
            {filtrelenmis.map((c, idx) => {
              const sAd = santiyeler.find(s => s.id === c.santiye_id)?.ad || '—'
              const tAd = taseronlar.find(t => t.id === c.taseron_id)?.ad || '—'
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', padding: '12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.ad}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{sAd} <br/><span style={{ opacity: 0.7 }}>({tAd})</span></span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: 14 }}>{c.sayi}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 5- İŞÇİ YÖNETİMİ
// ============================================================
function PuantajCalisanKayit() {
  const { santiyeler } = useSite()
  const [taseronlar, setTaseronlar] = useState([])
  const [santiyeId, setSantiyeId] = useState('')
  const [taseronId, setTaseronId] = useState('')
  const [calisanlar, setCalisanlar] = useState([])
  const [yeniAd, setYeniAd] = useState('')

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
  }, [])

  useEffect(() => {
    if (santiyeler.length && !santiyeId) setSantiyeId(santiyeler[0].id)
  }, [santiyeler])

  useEffect(() => {
    if (taseronId && santiyeId) calisanlariYukle()
    else setCalisanlar([])
  }, [santiyeId, taseronId])

  const calisanlariYukle = async () => {
    const { data, error } = await supabase.from('taseron_calisanlari').select('*').eq('taseron_id', taseronId).eq('santiye_id', santiyeId).order('ad_soyad')
    if (error) { alert('Çalışanlar yüklenemedi: ' + error.message); return }
    setCalisanlar(data || [])
  }

  const calisanEkle = async () => {
    const ad = yeniAd.trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, santiye_id: santiyeId, ad_soyad: ad }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniAd('')
    calisanlariYukle()
  }

  const calisanSil = async (id) => {
    if (!window.confirm('Bu çalışanı kayıtlardan çıkarmak istediğinize emin misiniz? (geçmiş puantaj kayıtları etkilenmez)')) return
    await supabase.from('taseron_calisanlari').delete().eq('id', id)
    calisanlariYukle()
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#64748b', marginTop: 0, marginBottom: 16 }}>
        Buradan sisteme tanımlayacağınız işçiler Kayıt Ekleme bölümünde karşınıza çıkacaktır. İsimler zorunlu olarak BÜYÜK HARFLE kaydedilir.
      </p>

      <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>1. Şantiye Seçin</p>
        <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6 }}>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>2. Taşeron Seçin</p>
        <select value={taseronId} onChange={(e) => setTaseronId(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6 }}>
          <option value="">Seçiniz...</option>
          {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>

        {taseronId && (
          <>
            <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>3. İsim Ekleyin</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Ad Soyad..." value={yeniAd} onChange={(e) => setYeniAd(e.target.value.toLocaleUpperCase('tr-TR'))} onKeyDown={(e) => e.key === 'Enter' && calisanEkle()} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', textTransform: 'uppercase' }} />
              <button className="ekle-buton-genis" onClick={calisanEkle} style={{ width: 'auto' }}>Listeye Ekle</button>
            </div>
          </>
        )}
      </div>

      {taseronId && (
        <div className="liste">
          <p className="alt-baslik">Kayıtlı Çalışanlar ({calisanlar.length})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {calisanlar.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{c.ad_soyad}</span>
                <button onClick={() => calisanSil(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} title="Sil">🗑</button>
              </div>
            ))}
          </div>
          {calisanlar.length === 0 && <p className="bos-mesaj">Bu şantiye ve taşerona ait işçi kaydı yok.</p>}
        </div>
      )}
    </div>
  )
}
