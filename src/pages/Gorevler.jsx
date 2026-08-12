import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import HizliSantiyeEkle from '../components/HizliSantiyeEkle'

const DURUMLAR = [
  { deger: 'hepsi', etiket: 'Tümü' },
  { deger: 'bekliyor', etiket: 'Bekliyor' },
  { deger: 'devam_ediyor', etiket: 'Devam ediyor' },
  { deger: 'tamamlandi', etiket: 'Tamamlandı' },
  { deger: 'gecikti', etiket: 'Geciken' },
]

const ONCELIKLER = [
  { deger: 'kirmizi', etiket: 'Kritik', renk: '#D64545' },
  { deger: 'turuncu', etiket: 'Yüksek', renk: '#E08A2E' },
  { deger: 'sari', etiket: 'Orta', renk: '#D9B429' },
  { deger: 'yesil', etiket: 'Düşük', renk: '#3F9E5C' },
]

function oncelikBul(deger) {
  return ONCELIKLER.find((o) => o.deger === deger)
}

// GorevKarti, ana bileşenin DIŞINDA tanımlanıyor — her tuş vuruşunda yeniden
// oluşturulmasını (ve input'ların odağını kaybetmesini) önlemek için.
function GorevKarti({ gorev, seviye, ctx }) {
  const {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir,
  } = ctx

  const oncelikEtiketi = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
  const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
  const kisiEtiketleri = gorev.gorev_etiketleri?.filter((e) => e.etiket_turu === 'kisi') || []
  const altlar = altGorevleriBul(gorev.id)
  const genisletildi = genisletilmis[gorev.id]
  const gosterilecekAltlar = genisletildi ? altlar : altlar.slice(0, 2)

  return (
    <div style={{ marginLeft: seviye * 16 }}>
      <div className="kart" style={{ borderLeft: oncelik ? `4px solid ${oncelik.renk}` : undefined }}>
        <div className="kart-ust">
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <input
              type="checkbox"
              checked={seciliGorevler.includes(gorev.id)}
              onChange={() => setSeciliGorevler((onceki) =>
                onceki.includes(gorev.id) ? onceki.filter((x) => x !== gorev.id) : [...onceki, gorev.id]
              )}
              style={{ flexShrink: 0, width: 16, height: 16 }}
            />
            {numaraHaritasi[gorev.id] && <span className="gorev-numara-rozet">{numaraHaritasi[gorev.id]}</span>}
            {duzenlenenId === gorev.id ? (
              <input
                type="text"
                value={duzenlenenBaslik}
                onChange={(e) => setDuzenlenenBaslik(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && basligiKaydet(gorev.id)}
                autoFocus
                style={{ flex: 1 }}
              />
            ) : (
              <span className="kart-baslik" style={{ textAlign: 'left' }}>{gorev.baslik}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {duzenlenenId === gorev.id ? (
              <button className="sil-buton" onClick={() => basligiKaydet(gorev.id)} aria-label="Kaydet">✓</button>
            ) : (
              <button className="sil-buton" onClick={() => { setDuzenlenenId(gorev.id); setDuzenlenenBaslik(gorev.baslik) }} aria-label="Düzenle">✎</button>
            )}
            <button className="sil-buton" onClick={() => gorevSil(gorev.id)} aria-label="Görevi sil">🗑</button>
          </div>
        </div>

        <div className="etiket-satiri">
          {seviye === 0 && filtreSantiye === 'hepsi' && <span className="etiket etiket-vurgu">{gorev.santiyeler?.ad}</span>}
          {oncelik ? (
            <span
              className="etiket"
              style={{ background: oncelik.renk, color: 'white', cursor: 'pointer' }}
              onClick={() => setOncelikSeciciAcikId(oncelikSeciciAcikId === gorev.id ? null : gorev.id)}
            >
              {oncelik.etiket} ✎
            </span>
          ) : (
            <span
              className="etiket"
              style={{ cursor: 'pointer' }}
              onClick={() => setOncelikSeciciAcikId(oncelikSeciciAcikId === gorev.id ? null : gorev.id)}
            >
              Öncelik ata
            </span>
          )}
          {kisiEtiketleri.map((e) => {
            const kisi = kullanicilar.find((k) => k.id === e.deger)
            return <span key={e.id} className="etiket">@{kisi?.ad_soyad || '—'}</span>
          })}
        </div>

        {oncelikSeciciAcikId === gorev.id && (
          <div className="oncelik-secici-satiri" style={{ marginBottom: 8 }}>
            {ONCELIKLER.map((o) => (
              <button
                key={o.deger}
                className={`oncelik-nokta ${oncelik?.deger === o.deger ? 'secili' : ''}`}
                style={{ background: o.renk }}
                onClick={() => oncelikDegistir(gorev, o.deger)}
                aria-label={o.etiket}
                title={o.etiket}
              />
            ))}
          </div>
        )}

        <select value={gorev.durum} onChange={(ev) => durumGuncelle(gorev.id, ev.target.value)} className="durum-secici">
          {DURUMLAR.filter((d) => d.deger !== 'hepsi').map((d) => (
            <option key={d.deger} value={d.deger}>{d.etiket}</option>
          ))}
        </select>

        <div className="gorev-alt-bilgi">
          {gorev.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(gorev.created_at).toLocaleDateString('tr-TR')}
        </div>

        {seviye < 2 && (
          <button className="alt-gorev-ekle-buton" onClick={() => { setAltGorevAcikId(altGorevAcikId === gorev.id ? null : gorev.id); setAltGorevMetni('') }}>
            + Alt görev ekle
          </button>
        )}

        {altGorevAcikId === gorev.id && (
          <div className="ekleme-satiri-2" style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Alt görev yaz..."
              value={altGorevMetni}
              onChange={(e) => setAltGorevMetni(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && altGorevEkle(gorev.id, gorev.santiye_id)}
              autoFocus
            />
            <button onClick={() => altGorevEkle(gorev.id, gorev.santiye_id)}>Ekle</button>
          </div>
        )}
      </div>

      {gosterilecekAltlar.map((alt) => <GorevKarti key={alt.id} gorev={alt} seviye={seviye + 1} ctx={ctx} />)}

      {altlar.length > 2 && (
        <button
          className="daha-fazla-buton"
          style={{ marginLeft: (seviye + 1) * 16 }}
          onClick={() => setGenisletilmis((onceki) => ({ ...onceki, [gorev.id]: !onceki[gorev.id] }))}
        >
          {genisletildi ? '▲ Daralt' : `▼ ${altlar.length - 2} tane daha göster`}
        </button>
      )}
    </div>
  )
}

export default function Gorevler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const [gorevler, setGorevler] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [filtreDurum, setFiltreDurum] = useState('hepsi')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreKisi, setFiltreKisi] = useState('hepsi')
  const yonetici = profile?.rol === 'yonetici'

  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniOncelik, setYeniOncelik] = useState('sari')
  const [yeniEtiketliler, setYeniEtiketliler] = useState([])
  const [dinliyor, setDinliyor] = useState(false)

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzenlenenBaslik, setDuzenlenenBaslik] = useState('')

  const [genisletilmis, setGenisletilmis] = useState({})
  const [altGorevAcikId, setAltGorevAcikId] = useState(null)
  const [altGorevMetni, setAltGorevMetni] = useState('')
  const [seciliGorevler, setSeciliGorevler] = useState([])
  const [oncelikSeciciAcikId, setOncelikSeciciAcikId] = useState(null)
  const [siralamaYonu, setSiralamaYonu] = useState('yeni') // 'yeni' | 'eski'
  const [gosterilenSayisi, setGosterilenSayisi] = useState(10)

  useEffect(() => {
    if (aktifSantiye) setYeniSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    gorevleriYukle()
    supabase.from('profiles').select('*').order('ad_soyad').then(({ data }) => setKullanicilar(data || []))
  }, [])

  const gorevleriYukle = async () => {
    const { data, error } = await supabase
      .from('gorevler')
      .select('*, gorev_etiketleri(*), santiyeler(ad), profiles!olusturan(ad_soyad)')
      .order('created_at', { ascending: false })
    if (error) {
      alert('Görevler yüklenemedi: ' + error.message)
      return
    }
    setGorevler(data || [])
  }

  const gorevEkle = async () => {
    if (!yeniBaslik.trim()) return
    if (!yeniSantiyeId) { alert('Lütfen önce bir şantiye seçin.'); return }

    const { data, error } = await supabase.from('gorevler').insert({
      santiye_id: yeniSantiyeId,
      baslik: yeniBaslik,
      olusturan: profile?.id,
    }).select().single()

    if (error) {
      alert('Görev eklenemedi: ' + error.message)
      return
    }

    if (data) {
      const { error: etiketHatasi } = await supabase.from('gorev_etiketleri').insert({ gorev_id: data.id, etiket_turu: 'oncelik', deger: yeniOncelik })
      if (etiketHatasi) console.error('Öncelik etiketi eklenemedi:', etiketHatasi.message)

      for (const kullaniciId of yeniEtiketliler) {
        const { error: kisiEtiketHata } = await supabase.from('gorev_etiketleri').insert({ gorev_id: data.id, etiket_turu: 'kisi', deger: kullaniciId })
        if (kisiEtiketHata) console.error('Kişi etiketi eklenemedi:', kisiEtiketHata.message)

        const kendiniEtiketledi = kullaniciId === profile?.id
        const { error: bildirimHata } = await supabase.from('bildirimler').insert({
          kullanici_id: kullaniciId,
          mesaj: kendiniEtiketledi
            ? `Kendinizi bir görevde etiketlediniz: "${yeniBaslik}"`
            : `${profile?.ad_soyad || 'Bir kullanıcı'} sizi bir görevde etiketledi: "${yeniBaslik}"`,
          gorev_id: data.id,
          olusturan: profile?.id,
        })
        if (bildirimHata) { alert('Bildirim gönderilemedi: ' + bildirimHata.message) }
      }
    }

    setYeniBaslik('')
    setYeniOncelik('sari')
    const etiketlenenSayisi = yeniEtiketliler.length
    setYeniEtiketliler([])
    gorevleriYukle()
    if (etiketlenenSayisi > 0) {
      alert(`Görev kaydedildi. ${etiketlenenSayisi} kişiye Uyarı sayfasında bildirim gönderildi.`)
    }
  }

  const altGorevEkle = async (ustId, santiyeId) => {
    if (!altGorevMetni.trim()) return
    const { error } = await supabase.from('gorevler').insert({
      santiye_id: santiyeId,
      baslik: altGorevMetni,
      olusturan: profile?.id,
      ust_gorev_id: ustId,
    })
    if (error) { alert('Alt görev eklenemedi: ' + error.message); return }
    setAltGorevMetni('')
    setAltGorevAcikId(null)
    gorevleriYukle()
  }

  const durumGuncelle = async (id, yeniDurum) => {
    await supabase.from('gorevler').update({ durum: yeniDurum }).eq('id', id)
    gorevleriYukle()
  }

  const oncelikDegistir = async (gorev, yeniDeger) => {
    const mevcutEtiket = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
    if (mevcutEtiket) {
      await supabase.from('gorev_etiketleri').update({ deger: yeniDeger }).eq('id', mevcutEtiket.id)
    } else {
      await supabase.from('gorev_etiketleri').insert({ gorev_id: gorev.id, etiket_turu: 'oncelik', deger: yeniDeger })
    }
    setOncelikSeciciAcikId(null)
    gorevleriYukle()
  }

  const basligiKaydet = async (id) => {
    if (!duzenlenenBaslik.trim()) return
    await supabase.from('gorevler').update({ baslik: duzenlenenBaslik }).eq('id', id)
    setDuzenlenenId(null)
    gorevleriYukle()
  }

  const gorevSil = async (id) => {
    if (!window.confirm('Bu görevi (ve varsa alt görevlerini) silmek istediğinize emin misiniz?')) return
    await supabase.from('gorevler').delete().eq('id', id)
    gorevleriYukle()
  }

  const sesleYaz = () => {
    const Tanima = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Tanima) { alert('Tarayıcınız sesli girişi desteklemiyor.'); return }
    const tanima = new Tanima()
    tanima.lang = 'tr-TR'
    tanima.onresult = (e) => setYeniBaslik((onceki) => onceki + e.results[0][0].transcript)
    tanima.onstart = () => setDinliyor(true)
    tanima.onend = () => setDinliyor(false)
    tanima.start()
  }

  const etiketliKisiToggle = (id) => {
    setYeniEtiketliler((onceki) => onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id])
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  const numaraHaritasi = {}
  const kokTumTarihSirali = gorevler.filter((g) => !g.ust_gorev_id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const numarala = (gorev, prefix) => {
    numaraHaritasi[gorev.id] = prefix
    const altlar = gorevler.filter((g) => g.ust_gorev_id === gorev.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    altlar.forEach((alt, i) => numarala(alt, `${prefix}.${i + 1}`))
  }
  kokTumTarihSirali.forEach((kok, i) => numarala(kok, String(i + 1)))

  const kisiListesiMetni = (gorev) => {
    const kisiler = (gorev.gorev_etiketleri || [])
      .filter((e) => e.etiket_turu === 'kisi')
      .map((e) => kullanicilar.find((k) => k.id === e.deger)?.ad_soyad)
      .filter(Boolean)
    return kisiler.length ? kisiler.join(', ') : 'Atanmamış'
  }

  const paylasMetniOlustur = (hepsi) => {
    const bolumler = [
      { durum: 'bekliyor', baslik: '🟡 BEKLEYEN GÖREVLER' },
      { durum: 'devam_ediyor', baslik: '🔵 DEVAM EDEN GÖREVLER' },
      { durum: 'gecikti', baslik: '🔴 GECİKEN GÖREVLER' },
      { durum: 'tamamlandi', baslik: '🟢 TAMAMLANAN GÖREVLER' },
    ]
    let metin = `📋 GÖREV RAPORU — ${new Date().toLocaleDateString('tr-TR')}\n\n`
    const kaynakListe = (!hepsi && seciliGorevler.length > 0) ? gorevler.filter((g) => seciliGorevler.includes(g.id)) : gorevler
    bolumler.forEach((b) => {
      const liste = kaynakListe
        .filter((g) => g.durum === b.durum)
        .sort((a, c) => (numaraHaritasi[a.id] || '').localeCompare(numaraHaritasi[c.id] || '', undefined, { numeric: true }))
      if (liste.length === 0) return
      metin += `${b.baslik}\n`
      liste.forEach((g) => {
        metin += `${numaraHaritasi[g.id] || '?'}. ${g.baslik}\n`
        metin += `   Şantiye: ${g.santiyeler?.ad || '—'}\n`
        metin += `   Kişi: ${kisiListesiMetni(g)}\n`
        metin += `   Ekleyen: ${g.profiles?.ad_soyad || 'Bilinmiyor'}, ${new Date(g.created_at).toLocaleDateString('tr-TR')}\n\n`
      })
    })
    return metin
  }

  const paylas = async (hepsi) => {
    const metin = paylasMetniOlustur(hepsi)
    if (navigator.share) {
      try { await navigator.share({ text: metin, title: 'Görev Raporu' }) } catch { /* kullanıcı iptal etti */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  const santiyeyeGoreFiltreli = filtreSantiye === 'hepsi' ? gorevler : gorevler.filter((g) => g.santiye_id === filtreSantiye)
  const kisiyeGoreFiltreli = filtreKisi === 'hepsi'
    ? santiyeyeGoreFiltreli
    : santiyeyeGoreFiltreli.filter((g) => g.gorev_etiketleri?.some((e) => e.etiket_turu === 'kisi' && e.deger === filtreKisi))
  const durumaGoreFiltreli = filtreDurum === 'hepsi' ? kisiyeGoreFiltreli : kisiyeGoreFiltreli.filter((g) => g.durum === filtreDurum)
  const kokGorevler = durumaGoreFiltreli
    .filter((g) => !g.ust_gorev_id)
    .sort((a, b) => siralamaYonu === 'yeni' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at))
  const gosterilenKokGorevler = kokGorevler.slice(0, gosterilenSayisi)

  const altGorevleriBul = (ustId) => durumaGoreFiltreli.filter((g) => g.ust_gorev_id === ustId)

  const ctx = {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir,
  }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Görevler</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => paylas(true)} style={{ fontSize: 12, padding: '6px 10px' }}>📤 Tümünü paylaş</button>
          {seciliGorevler.length > 0 && (
            <button onClick={() => paylas(false)} style={{ fontSize: 12, padding: '6px 10px' }}>
              📤 Seçilenleri paylaş ({seciliGorevler.length})
            </button>
          )}
        </div>
      </div>
      {seciliGorevler.length > 0 && (
        <button
          onClick={() => setSeciliGorevler([])}
          style={{ fontSize: 11, padding: '4px 8px', marginBottom: 12, background: 'none', border: 'none', color: '#0F6E56' }}
        >
          Seçimi temizle ({seciliGorevler.length} görev seçili)
        </button>
      )}

      <div className="ekleme-kutusu" style={{ marginTop: 0, marginBottom: 16 }}>
        <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Görev ekle..."
            value={yeniBaslik}
            onChange={(e) => setYeniBaslik(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && gorevEkle()}
            style={{ flex: 1 }}
          />
          <button className="mikrofon-buton" onClick={sesleYaz} aria-label="Sesle yaz">{dinliyor ? '●' : '🎤'}</button>
        </div>

        <div className="oncelik-secici-satiri">
          {ONCELIKLER.map((o) => (
            <button
              key={o.deger}
              className={`oncelik-nokta ${yeniOncelik === o.deger ? 'secili' : ''}`}
              style={{ background: o.renk }}
              onClick={() => setYeniOncelik(o.deger)}
              aria-label={o.etiket}
              title={o.etiket}
            />
          ))}
        </div>
        <div className="renk-anlam-tablosu">
          {ONCELIKLER.map((o) => (
            <div key={o.deger} className="renk-anlam-satiri">
              <span className="renk-anlam-nokta" style={{ background: o.renk }} />
              <span>{o.etiket}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#5F5E5A', margin: '4px 0 2px' }}>Etiketlenecek kişiler:</p>
        <p style={{ fontSize: 11, color: '#888780', margin: '0 0 6px' }}>
          🔔 Etiketlenen kişiye Uyarı sayfasında bildirim düşer, tıklayınca doğrudan bu göreve yönlendirilir.
        </p>
        <div className="kisi-etiket-secici">
          {kullanicilar.map((k) => (
            <button
              key={k.id}
              className={`filtre-chip ${yeniEtiketliler.includes(k.id) ? 'secili' : ''}`}
              onClick={() => etiketliKisiToggle(k.id)}
            >
              {k.ad_soyad}
            </button>
          ))}
        </div>

        <button className="ekle-buton-genis" onClick={gorevEkle}>Görevi kaydet</button>
      </div>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
        <HizliSantiyeEkle />
      </div>

      <div className="filtre-satiri">
        {DURUMLAR.map((d) => (
          <button key={d.deger} className={`filtre-chip ${filtreDurum === d.deger ? 'secili' : ''}`} onClick={() => setFiltreDurum(d.deger)}>{d.etiket}</button>
        ))}
      </div>

      {yonetici && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreKisi === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKisi('hepsi')}>Tüm kişiler</button>
          {kullanicilar.map((k) => (
            <button key={k.id} className={`filtre-chip ${filtreKisi === k.id ? 'secili' : ''}`} onClick={() => setFiltreKisi(k.id)}>{k.ad_soyad}</button>
          ))}
        </div>
      )}

      <div className="gorunum-secici" style={{ marginBottom: 12 }}>
        <button className={siralamaYonu === 'yeni' ? 'secili-tab' : ''} onClick={() => setSiralamaYonu('yeni')}>Yeniden eskiye</button>
        <button className={siralamaYonu === 'eski' ? 'secili-tab' : ''} onClick={() => setSiralamaYonu('eski')}>Eskiden yeniye</button>
      </div>

      <div className="liste">
        {gosterilenKokGorevler.map((g) => <GorevKarti key={g.id} gorev={g} seviye={0} ctx={ctx} />)}
        {kokGorevler.length === 0 && <p className="bos-mesaj">Bu filtrede görev yok.</p>}
      </div>

      {kokGorevler.length > gosterilenSayisi && (
        <button className="daha-fazla-buton" style={{ marginTop: 8 }} onClick={() => setGosterilenSayisi((n) => n + 10)}>
          ▼ Daha fazla göster ({kokGorevler.length - gosterilenSayisi} tane daha)
        </button>
      )}
    </div>
  )
}
