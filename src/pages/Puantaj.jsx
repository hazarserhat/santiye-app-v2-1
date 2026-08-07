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
  const { aktifSantiye, santiyeler } = useSite()
  const [gorunum, setGorunum] = useState('gunluk')
  const [tarih, setTarih] = useState(bugun())
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')

  const [taseronlar, setTaseronlar] = useState([])
  const [kayitlar, setKayitlar] = useState([])
  const [ayKayitlari, setAyKayitlari] = useState([])

  const [yeniTaseronId, setYeniTaseronId] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')

  useEffect(() => {
    supabase.from('taseronlar').select('*').order('ad').then(({ data }) => setTaseronlar(data || []))
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
    const { data } = await sorgu
    setKayitlar(data || [])
  }

  const ayKayitlariniYukle = async () => {
    const ilkGun = tarih.slice(0, 8) + '01'
    const sonrakiAy = gunEkle(ilkGun, 32).slice(0, 8) + '01'
    let sorgu = supabase.from('puantaj_kayitlari').select('tarih, kisi_sayisi').gte('tarih', ilkGun).lt('tarih', sonrakiAy)
    if (filtreSantiye !== 'hepsi') sorgu = sorgu.eq('santiye_id', filtreSantiye)
    const { data } = await sorgu
    setAyKayitlari(data || [])
  }

  const satirEkle = async () => {
    if (!yeniTaseronId || !yeniSantiyeId) return
    const varMi = kayitlar.find((k) => k.taseron_id === yeniTaseronId && k.santiye_id === yeniSantiyeId)
    if (varMi) { alert('Bu taşeron için bugün zaten bir kayıt var.'); return }
    await supabase.from('puantaj_kayitlari').insert({
      santiye_id: yeniSantiyeId,
      taseron_id: yeniTaseronId,
      tarih,
      kisi_sayisi: 1,
    })
    setYeniTaseronId('')
    kayitlariYukle()
  }

  const sayiGuncelle = async (kayit, delta) => {
    const yeniSayi = Math.max(0, kayit.kisi_sayisi + delta)
    setKayitlar((onceki) => onceki.map((k) => (k.id === kayit.id ? { ...k, kisi_sayisi: yeniSayi } : k)))
    await supabase.from('puantaj_kayitlari').update({ kisi_sayisi: yeniSayi }).eq('id', kayit.id)
  }

  const notGuncelle = async (kayit, metin) => {
    setKayitlar((onceki) => onceki.map((k) => (k.id === kayit.id ? { ...k, not_metni: metin } : k)))
    await supabase.from('puantaj_kayitlari').update({ not_metni: metin }).eq('id', kayit.id)
  }

  const satirSil = async (id) => {
    if (!window.confirm('Bu puantaj kaydını silmek istediğinize emin misiniz?')) return
    await supabase.from('puantaj_kayitlari').delete().eq('id', id)
    kayitlariYukle()
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  const gunlukToplam = kayitlar.reduce((t, k) => t + k.kisi_sayisi, 0)
  const eklenebilirTaseronlar = taseronlar.filter((t) => !kayitlar.find((k) => k.taseron_id === t.id && k.santiye_id === yeniSantiyeId))

  const gunToplamHaritasi = {}
  ayKayitlari.forEach((k) => { gunToplamHaritasi[k.tarih] = (gunToplamHaritasi[k.tarih] || 0) + k.kisi_sayisi })

  const ilkGunTarih = new Date(tarih.slice(0, 8) + '01')
  const ayAdi = ilkGunTarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const ayinGunSayisi = new Date(ilkGunTarih.getFullYear(), ilkGunTarih.getMonth() + 1, 0).getDate()
  const ilkGunHaftaIndeksi = (ilkGunTarih.getDay() + 6) % 7

  return (
    <div className="sayfa">
      <h2>Puantaj</h2>

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
            {kayitlar.map((k) => (
              <div key={k.id} className="kart">
                <div className="kart-ust">
                  <div>
                    <span className="kart-baslik">{k.taseronlar?.ad}</span>
                    {filtreSantiye === 'hepsi' && <span className="etiket etiket-vurgu" style={{ marginLeft: 8 }}>{k.santiyeler?.ad}</span>}
                  </div>
                  <button className="sil-buton" onClick={() => satirSil(k.id)} aria-label="Kaydı sil">🗑</button>
                </div>
                <div className="stepper-satiri">
                  <button className="stepper-buton" onClick={() => sayiGuncelle(k, -1)}>−</button>
                  <span className="stepper-sayi">{k.kisi_sayisi}</span>
                  <button className="stepper-buton" onClick={() => sayiGuncelle(k, 1)}>+</button>
                </div>
                <input
                  type="text"
                  placeholder="Not (opsiyonel)"
                  defaultValue={k.not_metni || ''}
                  onBlur={(e) => notGuncelle(k, e.target.value)}
                  style={{ marginTop: 8, fontSize: 12 }}
                />
              </div>
            ))}
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
    </div>
  )
}
