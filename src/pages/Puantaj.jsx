import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { RobotoBase64 } from '../lib/fonts/RobotoRegular'

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1D9596', letterSpacing: '-0.5px' }}>Puantaj Yönetimi</h2>
      </div>      
      <div className="gorunum-secici" style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setSayfa('kayit')} style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '130px', padding: '12px 14px', borderRadius: 14, fontWeight: 600, fontSize: 13, border: sayfa === 'kayit' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: sayfa === 'kayit' ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: sayfa === 'kayit' ? '#fff' : '#555', boxShadow: sayfa === 'kayit' ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>1- Yoklama / Kayıt</button>
        <button onClick={() => setSayfa('takvim')} style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '130px', padding: '12px 14px', borderRadius: 14, fontWeight: 600, fontSize: 13, border: sayfa === 'takvim' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: sayfa === 'takvim' ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: sayfa === 'takvim' ? '#fff' : '#555', boxShadow: sayfa === 'takvim' ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>2- Takvim Matrisi</button>
        <button onClick={() => setSayfa('toplam')} style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '130px', padding: '12px 14px', borderRadius: 14, fontWeight: 600, fontSize: 13, border: sayfa === 'toplam' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: sayfa === 'toplam' ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: sayfa === 'toplam' ? '#fff' : '#555', boxShadow: sayfa === 'toplam' ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>3- Dönem Raporu</button>
        <button onClick={() => setSayfa('calisan_rapor')} style={{ flex: '1 1 calc(50% - 8px)', minWidth: '130px', padding: '12px 14px', borderRadius: 14, fontWeight: 600, fontSize: 13, border: sayfa === 'calisan_rapor' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: sayfa === 'calisan_rapor' ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: sayfa === 'calisan_rapor' ? '#fff' : '#555', boxShadow: sayfa === 'calisan_rapor' ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>4- Çalışan Raporu</button>
        <button onClick={() => setSayfa('isci_yonetim')} style={{ flex: '1 1 calc(50% - 8px)', minWidth: '130px', padding: '12px 14px', borderRadius: 14, fontWeight: 600, fontSize: 13, border: sayfa === 'isci_yonetim' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: sayfa === 'isci_yonetim' ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: sayfa === 'isci_yonetim' ? '#fff' : '#555', boxShadow: sayfa === 'isci_yonetim' ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.02)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>5- İşçi Yönetimi</button>
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
  const [yeniCalisanSifat, setYeniCalisanSifat] = useState({}) // { taseronId: metin }

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
    const sifat = (yeniCalisanSifat[taseronId] || '').trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const tamAd = sifat ? `${ad} (${sifat})` : ad
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, santiye_id: santiyeId, ad_soyad: tamAd }).select().single()
    if (error) { alert('Çalışan eklenemedi: ' + error.message); return }
    setCalisanlar((onceki) => [...onceki, data])
    setYeniCalisanAdi((onceki) => ({ ...onceki, [taseronId]: '' }))
    setYeniCalisanSifat((onceki) => ({ ...onceki, [taseronId]: '' }))
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
      <div className="ekleme-kutusu" style={{ marginBottom: 20, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#333' }}>+ Yeni Taşeron Satırı Aç</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {filtreSantiye === 'hepsi' && (
            <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)} style={{ flex: 1, minWidth: 150, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
              <option value="">Şantiye Seç...</option>
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          )}
          <select value={yeniTaseronId} onChange={(e) => setYeniTaseronId(e.target.value)} style={{ flex: 2, minWidth: 200, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
            <option value="">Taşeron seç...</option>
            {eklenebilirTaseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
          <button style={{ padding: '12px 20px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: '#fff', borderRadius: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }} onClick={satirEkle}>
            Satır Ekle
          </button>
        </div>
      </div>

      <div className="ekleme-kutusu" style={{ display: 'flex', gap: 12, marginBottom: 16, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şantiye Filtresi</span>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Yoklama Tarihi</span>
          <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', cursor: 'pointer' }} />
        </div>
      </div>

      <div className="liste">
        {kayitlar.map((k) => {
          const taseronCalisanlari = calisanlar.filter((c) => c.taseron_id === k.taseron_id && c.santiye_id === k.santiye_id)
          const isciSayisi = calisanKayitlari.filter((c) => c.santiye_id === k.santiye_id && c.taseron_id === k.taseron_id).length
          
          return (
            <div key={k.id} className="kart" style={{ background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03), inset 0 2px 4px rgba(255,255,255,0.8)', padding: 16, marginBottom: 14 }}>
              <div className="kart-ust" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #1D9596, #117575)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)' }}>
                    {k.taseronlar?.ad?.slice(0, 2).toUpperCase() || 'TŞ'}
                  </div>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#333', display: 'block' }}>{k.taseronlar?.ad}</span>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      {filtreSantiye === 'hepsi' && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f8f7f2', color: '#555', fontWeight: 600, border: '1px solid rgba(0,0,0,0.03)' }}>{k.santiyeler?.ad}</span>}
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', fontWeight: 600, border: '1px solid rgba(22, 163, 74, 0.2)' }}>{isciSayisi} kişi tikli</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => satirSil(k.id)} style={{ background: '#fff', border: '1px solid rgba(214, 69, 69, 0.2)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#D64545', boxShadow: '0 2px 4px rgba(214, 69, 69, 0.05)', transition: 'all 0.2s' }} title="Kaydı sil">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {taseronCalisanlari.map((c) => {
                  const tikli = !!calisanKayitlari.find((ck) => ck.santiye_id === k.santiye_id && ck.taseron_id === k.taseron_id && ck.calisan_id === c.id)
                  return (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', fontSize: 13, background: tikli ? '#f0fdf4' : '#fcfcf9', border: tikli ? '1px solid #bbf7d0' : '1px solid rgba(0,0,0,0.05)', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s', boxShadow: tikli ? '0 2px 8px rgba(22, 163, 74, 0.15)' : 'none', transform: tikli ? 'translateY(-1px)' : 'none' }}>
                      <input type="checkbox" checked={tikli} onChange={() => calisanTikle(k, c.id)} style={{ width: 18, height: 18, accentColor: '#16a34a', cursor: 'pointer' }} />
                      <span style={{ fontWeight: tikli ? 700 : 500, color: tikli ? '#166534' : '#555' }}>{c.ad_soyad}</span>
                    </label>
                  )
                })}
              </div>
              
              {taseronCalisanlari.length === 0 && <p className="bos-mesaj" style={{ padding: '8px 0', fontSize: 13 }}>Bu şantiye için henüz tanımlı çalışan yok.</p>}

              <div style={{ marginTop: 16, borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: 16, display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="İsim soyisim..."
                  value={yeniCalisanAdi[k.taseron_id] || ''}
                  onChange={(e) => setYeniCalisanAdi((o) => ({ ...o, [k.taseron_id]: e.target.value.toLocaleUpperCase('tr-TR') }))}
                  onKeyDown={(e) => e.key === 'Enter' && calisanEkle(k.taseron_id, k.santiye_id)}
                  style={{ flex: 2, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#f8f7f2', fontSize: 13, outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Sıfat/Görev..."
                  value={yeniCalisanSifat[k.taseron_id] || ''}
                  onChange={(e) => setYeniCalisanSifat((o) => ({ ...o, [k.taseron_id]: e.target.value.toLocaleUpperCase('tr-TR') }))}
                  onKeyDown={(e) => e.key === 'Enter' && calisanEkle(k.taseron_id, k.santiye_id)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#f8f7f2', fontSize: 13, outline: 'none' }}
                />
                <button onClick={() => calisanEkle(k.taseron_id, k.santiye_id)} style={{ padding: '10px 16px', background: '#f4f3ed', color: '#555', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>Ekle</button>
              </div>
            </div>
          )
        })}
        {kayitlar.length === 0 && <p className="bos-mesaj">Seçili tarihte bu filtreyle hiçbir taşeron satırı açılmamış.</p>}
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
      <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
        <button onClick={() => { setTarih((t) => gunEkle(t, -30)); setSeciliGun(null) }} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
        <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>{ayAdi}</span>
        <button onClick={() => { setTarih((t) => gunEkle(t, 30)); setSeciliGun(null) }} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
      </div>

      <div className="takvim-baslik-satiri" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8, textAlign: 'center', fontWeight: 700, fontSize: 12, color: '#888780', textTransform: 'uppercase' }}>
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => <span key={g}>{g}</span>)}
      </div>
      <div className="takvim-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
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
              style={{
                background: isSelected ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff',
                color: isSelected ? '#fff' : '#333',
                transform: isSelected ? 'scale(1.02)' : 'none',
                border: isSelected ? 'none' : (gunTarihi === bugun() ? '2px solid #1D9596' : '1px solid rgba(0,0,0,0.05)'),
                borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 60, cursor: 'pointer', boxShadow: isSelected ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s'
              }}
              onClick={() => gunTikla(gunTarihi)}
            >
              <span className="takvim-gun-no" style={{ fontSize: 14, fontWeight: 700, opacity: isSelected ? 1 : 0.8 }}>{i + 1}</span>
              {kisiSayisi > 0 && <span className="takvim-gun-toplam" style={{ marginTop: 4, background: isSelected ? 'rgba(255,255,255,0.2)' : '#f0fdf4', color: isSelected ? '#fff' : '#16a34a', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{kisiSayisi} kişi</span>}
            </button>
          )
        })}
      </div>

      {/* HİYERARŞİ ALANI */}
      {seciliGun && (
        <div style={{ marginTop: 24, padding: 20, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', borderRadius: 16, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#1D9596', fontWeight: 700, borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: 12 }}>{tarihGoster(seciliGun)} Detayları</h3>
          
          <div style={{ display: 'flex', gap: 20, flexDirection: 'column', paddingBottom: 10 }}>
            {/* Şantiyeler */}
            <div>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Şantiye Seçin</p>
              {gununSantiyeleri.map(sId => {
                const sAd = santiyeler.find(s => s.id === sId)?.ad || 'Bilinmeyen Şantiye'
                const secili = seciliSantiye === sId
                return (
                  <button key={sId} onClick={() => { setSeciliSantiye(sId); setSeciliTaseron(null) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, background: secili ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff', color: secili ? '#fff' : '#333', border: secili ? 'none' : '1px solid rgba(0,0,0,0.05)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 700 : 500, boxShadow: secili ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                    {sAd}
                  </button>
                )
              })}
              {gununSantiyeleri.length === 0 && <p className="bos-mesaj">Kayıt yok</p>}
            </div>

            {/* Taşeronlar */}
            {seciliSantiye && (
              <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Taşeron Seçin</p>
                {gununTaseronlari.map(tId => {
                  const tAd = taseronIsimleri[tId] || 'Bilinmeyen Taşeron'
                  const secili = seciliTaseron === tId
                  return (
                    <button key={tId} onClick={() => setSeciliTaseron(tId)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, background: secili ? '#1e293b' : '#fff', color: secili ? '#fff' : '#333', border: secili ? 'none' : '1px solid rgba(0,0,0,0.05)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: secili ? 700 : 500, boxShadow: secili ? '0 4px 12px rgba(30, 41, 59, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
                      {tAd}
                    </button>
                  )
                })}
              </div>
            )}

            {/* İşçiler */}
            {seciliTaseron && (
              <div style={{ borderTop: '1px dashed rgba(0,0,0,0.1)', paddingTop: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. İşe Gelenler</p>
                <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  {gununCalisanlari.map((cId, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.03)', fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 500 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, border: '1px solid #bbf7d0' }}>✓</div> 
                      {calisanIsimleri[cId] || 'Bilinmeyen'}
                    </div>
                  ))}
                  {gununCalisanlari.length === 0 && <div style={{ padding: '14px', fontSize: 13, color: '#888780', fontStyle: 'italic' }}>Kimse işaretlenmemiş.</div>}
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
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
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

  const pdfIndir = () => {
    const doc = new jsPDF()
    doc.addFileToVFS('Roboto-Regular.ttf', RobotoBase64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
    doc.setFont('Roboto')

    doc.setFontSize(16)
    doc.text('Şantiye Dönem Raporu (Genel Puantaj)', 14, 15)
    
    let tarihBilgisi = ''
    if (donem === 'gunluk') tarihBilgisi = tarihGoster(tarih)
    else if (donem === 'aylik') tarihBilgisi = new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    else if (donem === 'aralik') tarihBilgisi = `${tarihGoster(basTarih)} - ${tarihGoster(bitTarih)}`
    
    doc.setFontSize(11)
    doc.text(`Dönem: ${tarihBilgisi || 'Tümü'}`, 14, 23)
    doc.text(`Genel Toplam Yevmiye: ${genelToplam}`, 14, 29)

    let yPos = 35

    if (filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Şantiye Adı', 'Toplam Yevmiye']],
        body: Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]),
        theme: 'grid',
        headStyles: { fillColor: [29, 149, 150] },
        styles: { font: 'Roboto' }
      })
      yPos = doc.lastAutoTable.finalY + 10
    }

    if (filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Taşeron Adı', 'Toplam Yevmiye']],
        body: Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]),
        theme: 'grid',
        headStyles: { fillColor: [29, 149, 150] },
        styles: { font: 'Roboto' }
      })
    }

    doc.save(`Donem_Raporu_${bugun()}.pdf`)
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)} style={{ flex: 1, padding: '12px', background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, fontWeight: 700, color: '#555', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          {filtreAcik ? 'Filtreleri Gizle ⌃' : 'Filtreleri Göster ⌄'}
        </button>
        <button onClick={pdfIndir} style={{ padding: '12px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          📄 PDF İndir
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 16, background: '#fdfdfd', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şantiye Filtresi</p>
          <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
            <option value="hepsi">Tüm Şantiyeler</option>
            {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taşeron Filtresi</p>
          <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 6, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
            <option value="hepsi">Tüm Taşeronlar</option>
            {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
          </select>
        </div>
      )}

      <div className="gorunum-secici" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setDonem('gunluk')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'gunluk' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'gunluk' ? '#fff' : '#fcfcf9', color: donem === 'gunluk' ? '#1D9596' : '#555', boxShadow: donem === 'gunluk' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Günlük</button>
        <button onClick={() => setDonem('aylik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aylik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aylik' ? '#fff' : '#fcfcf9', color: donem === 'aylik' ? '#1D9596' : '#555', boxShadow: donem === 'aylik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Aylık</button>
        <button onClick={() => setDonem('aralik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aralik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aralik' ? '#fff' : '#fcfcf9', color: donem === 'aralik' ? '#1D9596' : '#555', boxShadow: donem === 'aralik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tarih Aralığı</button>
        <button onClick={() => setDonem('tum')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'tum' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'tum' ? '#fff' : '#fcfcf9', color: donem === 'tum' ? '#1D9596' : '#555', boxShadow: donem === 'tum' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
          <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 12, marginBottom: 16, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Başlangıç Tarihi:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bitiş Tarihi:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
      )}

      <div className="ozet-kart" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #1D9596, #117575)', padding: 24, borderRadius: 16, color: '#fff', boxShadow: '0 4px 16px rgba(29, 149, 150, 0.3)' }}>
        <p className="ozet-etiket" style={{ fontSize: 13, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8, fontWeight: 600, color: '#fff' }}>Genel toplam (İşçi yevmiyesi)</p>
        <p className="ozet-tutar" style={{ fontSize: 36, fontWeight: 800, margin: 0, color: '#fff' }}>{yukleniyor ? '...' : genelToplam}</p>
      </div>

      {filtreSantiye === 'hepsi' && Object.keys(santiyeBazinda).length > 0 && (
        <>
          <p className="alt-baslik" style={{ fontSize: 14, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Şantiye bazında</p>
          <div className="liste" style={{ marginBottom: 24 }}>
            {Object.entries(santiyeBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1D9596' }}>{sayi} yevmiye</span>
              </div>
            ))}
          </div>
        </>
      )}

      {filtreTaseron === 'hepsi' && Object.keys(taseronBazinda).length > 0 && (
        <>
          <p className="alt-baslik" style={{ fontSize: 14, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Taşeron bazında</p>
          <div className="liste" style={{ marginBottom: 24 }}>
            {Object.entries(taseronBazinda).sort((a, b) => b[1] - a[1]).map(([ad, sayi]) => (
              <div key={ad} className="kart" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{ad}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1D9596' }}>{sayi} yevmiye</span>
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
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
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
      <div className="ekleme-kutusu" style={{ marginBottom: 16, background: '#fdfdfd', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taşeron Filtresi</p>
        <select value={filtreTaseron} onChange={(e) => setFiltreTaseron(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 12, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="hepsi">Tüm Taşeronlar</option>
          {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Şantiye Filtresi</p>
        <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="hepsi">Tüm Şantiyeler</option>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button onClick={() => setDonem('gunluk')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'gunluk' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'gunluk' ? '#fff' : '#fcfcf9', color: donem === 'gunluk' ? '#1D9596' : '#555', boxShadow: donem === 'gunluk' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Günlük</button>
        <button onClick={() => setDonem('aylik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aylik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aylik' ? '#fff' : '#fcfcf9', color: donem === 'aylik' ? '#1D9596' : '#555', boxShadow: donem === 'aylik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Aylık</button>
        <button onClick={() => setDonem('aralik')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'aralik' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'aralik' ? '#fff' : '#fcfcf9', color: donem === 'aralik' ? '#1D9596' : '#555', boxShadow: donem === 'aralik' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tarih Aralığı</button>
        <button onClick={() => setDonem('tum')} style={{ flex: '1 1 calc(25% - 8px)', minWidth: '90px', padding: '10px 12px', borderRadius: 12, fontWeight: 600, fontSize: 13, border: donem === 'tum' ? 'none' : '1px solid rgba(0,0,0,0.06)', background: donem === 'tum' ? '#fff' : '#fcfcf9', color: donem === 'tum' ? '#1D9596' : '#555', boxShadow: donem === 'tum' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>Tümü</button>
      </div>

      {(donem === 'gunluk' || donem === 'aylik') && (
        <div className="tarih-gezici" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 20 }}>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? -1 : -30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>‹</button>
          <span style={{ textTransform: 'capitalize', fontSize: 16, fontWeight: 700, color: '#333' }}>
            {donem === 'gunluk' ? tarihGoster(tarih) : new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setTarih((t) => gunEkle(t, donem === 'gunluk' ? 1 : 30))} style={{ border: 'none', background: '#f4f3ed', borderRadius: 8, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#555' }}>›</button>
        </div>
      )}

      {donem === 'aralik' && (
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 12, marginBottom: 16, background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', padding: 16, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Başlangıç:</span>
            <input type="date" value={basTarih} onChange={(e) => setBasTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5F5E5A', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bitiş:</span>
            <input type="date" value={bitTarih} onChange={(e) => setBitTarih(e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <p className="alt-baslik" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rapor Çıktısı</p>
        <div style={{ display: 'flex', gap: 10, flex: '1 1 auto', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="İsim ara..." 
            value={aramaIsim} 
            onChange={(e) => setAramaIsim(e.target.value)} 
            style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, minWidth: '150px', flex: '1 1 150px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', outline: 'none' }}
          />
          <button onClick={() => {
            const doc = new jsPDF()
            doc.addFileToVFS('Roboto-Regular.ttf', RobotoBase64)
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
            doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
            doc.setFont('Roboto')

            doc.setFontSize(16)
            doc.text('Çalışan Puantaj Detay Raporu', 14, 15)
            
            let tarihBilgisi = ''
            if (donem === 'gunluk') tarihBilgisi = tarihGoster(tarih)
            else if (donem === 'aylik') tarihBilgisi = new Date(tarih).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
            else if (donem === 'aralik') tarihBilgisi = `${tarihGoster(basTarih)} - ${tarihGoster(bitTarih)}`
            
            doc.setFontSize(11)
            doc.text(`Dönem: ${tarihBilgisi || 'Tümü'}`, 14, 23)

            const tabloVerisi = filtrelenmis.map(c => [
              c.ad,
              santiyeler.find(s => s.id === c.santiye_id)?.ad || '—',
              taseronlar.find(t => t.id === c.taseron_id)?.ad || '—',
              c.sayi
            ])

            autoTable(doc, {
              startY: 30,
              head: [['İsim Soyisim', 'Şantiye', 'Taşeron', 'Toplam Yevmiye']],
              body: tabloVerisi,
              theme: 'grid',
              headStyles: { fillColor: [29, 149, 150] },
              styles: { font: 'Roboto' }
            })

            doc.save(`Calisan_Raporu_${bugun()}.pdf`)
          }} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)' }}>
            📄 PDF İndir
          </button>
          <button onClick={raporuPaylas} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)' }}>
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
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', background: '#1D9596', padding: '14px 16px', fontSize: 11, fontWeight: 800, color: '#fff', borderBottom: '2px solid rgba(0,0,0,0.05)', letterSpacing: '0.5px', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
              <span>İSİM SOYİSİM</span>
              <span>ŞANTİYE & TAŞERON</span>
              <span style={{ textAlign: 'right' }}>GÜN</span>
            </div>
            {filtrelenmis.map((c, idx) => {
              const sAd = santiyeler.find(s => s.id === c.santiye_id)?.ad || '—'
              const tAd = taseronlar.find(t => t.id === c.taseron_id)?.ad || '—'
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1fr', padding: '16px', fontSize: 13, borderBottom: idx === filtrelenmis.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.03)', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#333' }}>{c.ad}</span>
                  <span style={{ color: '#888780', fontSize: 12 }}>{sAd} <br/><span style={{ opacity: 0.7, fontWeight: 500 }}>({tAd})</span></span>
                  <span style={{ textAlign: 'right', fontWeight: 800, color: '#10b981', fontSize: 16 }}>{c.sayi}</span>
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
  const [yeniSifat, setYeniSifat] = useState('')

  useEffect(() => {
    supabase.from('taseronlar').select('*').neq('puantajda_goster', false).order('ad').then(({ data }) => setTaseronlar(data || []))
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
    const sifat = yeniSifat.trim().toLocaleUpperCase('tr-TR')
    if (!ad) return
    const tamAd = sifat ? `${ad} (${sifat})` : ad
    const { data, error } = await supabase.from('taseron_calisanlari').insert({ taseron_id: taseronId, santiye_id: santiyeId, ad_soyad: tamAd }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniAd('')
    setYeniSifat('')
    calisanlariYukle()
  }

  const calisanSil = async (id) => {
    if (!window.confirm('Bu çalışanı kayıtlardan çıkarmak istediğinize emin misiniz? (geçmiş puantaj kayıtları etkilenmez)')) return
    await supabase.from('taseron_calisanlari').delete().eq('id', id)
    calisanlariYukle()
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#166534', marginTop: 0, marginBottom: 20, background: '#f0fdf4', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(22, 163, 74, 0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <div>
          <span style={{ fontWeight: 700, display: 'block', marginBottom: 4, fontSize: 14 }}>Bilgilendirme</span>
          Buradan sisteme tanımlayacağınız işçiler <strong>Kayıt Ekleme</strong> bölümünde karşınıza çıkacaktır. İsimler zorunlu olarak <strong>BÜYÜK HARFLE</strong> kaydedilir.
        </div>
      </div>

      <div className="ekleme-kutusu" style={{ marginBottom: 24, background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: 20, borderRadius: 16, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Şantiye Seçin</p>
        <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          {santiyeler.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>
        
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Taşeron Seçin</p>
        <select value={taseronId} onChange={(e) => setTaseronId(e.target.value)} style={{ width: '100%', padding: '12px 14px', marginBottom: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }}>
          <option value="">Seçiniz...</option>
          {taseronlar.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>

        {taseronId && (
          <>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. İsim ve Meslek Ekleyin</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="text" placeholder="Ad Soyad..." value={yeniAd} onChange={(e) => setYeniAd(e.target.value.toLocaleUpperCase('tr-TR'))} onKeyDown={(e) => e.key === 'Enter' && calisanEkle()} style={{ flex: 2, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, textTransform: 'uppercase', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
              <input type="text" placeholder="Sıfat/Görev..." value={yeniSifat} onChange={(e) => setYeniSifat(e.target.value.toLocaleUpperCase('tr-TR'))} onKeyDown={(e) => e.key === 'Enter' && calisanEkle()} style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', fontSize: 13, textTransform: 'uppercase', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
              <button onClick={calisanEkle} style={{ width: 'auto', padding: '12px 24px', background: 'linear-gradient(135deg, #1D9596, #117575)', color: '#fff', borderRadius: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', whiteSpace: 'nowrap' }}>Listeye Ekle</button>
            </div>
          </>
        )}
      </div>

      {taseronId && (
        <div className="liste">
          <p className="alt-baslik" style={{ fontSize: 15, fontWeight: 700, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Kayıtlı Çalışanlar ({calisanlar.length})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {calisanlar.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{c.ad_soyad}</span>
                <button onClick={() => calisanSil(c.id)} style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title="Sil">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))}
          </div>
          {calisanlar.length === 0 && <p className="bos-mesaj">Bu şantiye ve taşerona ait işçi kaydı yok.</p>}
        </div>
      )}
    </div>
  )
}
