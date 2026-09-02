import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

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

function guvenliTarih(tarihStr) {
  if (!tarihStr) return '—'
  const d = new Date(tarihStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

function GorevKarti({ gorev, seviye, ctx }) {
  const [baslikAcik, setBaslikAcik] = useState(false)
  const {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler, kisiSeciciAcikId, setKisiSeciciAcikId,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir, kisiEtiketiDegistir,
  } = ctx

  const oncelikEtiketi = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
  const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
  const kisiEtiketleri = gorev.gorev_etiketleri?.filter((e) => e.etiket_turu === 'kisi') || []
  const altlar = altGorevleriBul(gorev.id)
  const genisletildi = genisletilmis[gorev.id]
  const gosterilecekAltlar = genisletildi ? altlar : altlar.slice(0, 2)

  return (
    <div style={{ marginLeft: seviye > 0 ? 12 : 0, marginBottom: 6 }}>
      <div 
        className="kart" 
        style={{ 
          padding: '12px', 
          borderLeft: oncelik ? `5px solid ${oncelik.renk}` : '5px solid #e2e0d8', 
          borderRadius: 12,
          background: gorev.durum === 'tamamlandi' ? '#f8f7f2' : '#ffffff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02)',
          border: '1px solid rgba(0,0,0,0.03)',
          opacity: gorev.durum === 'tamamlandi' ? 0.85 : 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {/* ÜST SATIR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <input
              type="checkbox"
              checked={seciliGorevler.includes(gorev.id)}
              onChange={() => setSeciliGorevler((onceki) =>
                onceki.includes(gorev.id) ? onceki.filter((x) => x !== gorev.id) : [...onceki, gorev.id]
              )}
              style={{ width: 16, height: 16, margin: 0, flexShrink: 0, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}
            />
            {numaraHaritasi[gorev.id] && <span style={{ fontSize: 11, fontWeight: 800, color: '#1D9596', flexShrink: 0, textShadow: '0 1px 1px rgba(29,149,150,0.2)' }}>{numaraHaritasi[gorev.id]}</span>}
            
            {duzenlenenId === gorev.id ? (
              <input
                type="text"
                value={duzenlenenBaslik}
                onChange={(e) => setDuzenlenenBaslik(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && basligiKaydet(gorev.id)}
                autoFocus
                style={{ flex: 1, padding: '4px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #1D9596', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)', background: '#faf9f5', outline: 'none', minWidth: 0 }}
              />
            ) : (
              <span 
                onClick={() => setBaslikAcik(!baslikAcik)}
                title={gorev.baslik}
                style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  flex: 1, 
                  whiteSpace: baslikAcik ? 'normal' : 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  color: gorev.durum === 'tamamlandi' ? '#888' : '#212124', 
                  textDecoration: gorev.durum === 'tamamlandi' ? 'line-through' : 'none', 
                  textShadow: '0 1px 1px rgba(0,0,0,0.02)',
                  cursor: 'pointer'
                }}
              >
                {gorev.baslik}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, background: '#f8f7f2', padding: '3px 6px', borderRadius: 8, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)' }}>
            {duzenlenenId === gorev.id ? (
              <button className="sil-buton" onClick={() => basligiKaydet(gorev.id)} style={{ padding: '4px 8px', background: 'linear-gradient(to bottom, #24b8b9, #1D9596)', color: 'white', borderRadius: 4, boxShadow: '0 2px 4px rgba(29,149,150,0.3)' }}>✓</button>
            ) : (
              <>
                <button className="sil-buton" onClick={() => { setDuzenlenenId(gorev.id); setDuzenlenenBaslik(gorev.baslik) }} style={{ padding: '2px 4px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Düzenle">✎</button>
                {seviye < 2 && <button className="sil-buton" onClick={() => { setAltGorevAcikId(altGorevAcikId === gorev.id ? null : gorev.id); setAltGorevMetni('') }} style={{ padding: '2px 4px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Alt Görev Ekle">➕</button>}
                <button className="sil-buton" onClick={() => gorevSil(gorev.id)} style={{ padding: '2px 4px', fontSize: 13, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }} title="Sil">🗑</button>
              </>
            )}
          </div>
        </div>

        {/* ALT SATIR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div 
              onClick={() => setOncelikSeciciAcikId(oncelikSeciciAcikId === gorev.id ? null : gorev.id)}
              style={{ width: 14, height: 14, borderRadius: '50%', background: oncelik ? oncelik.renk : '#e2e0d8', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)', boxShadow: oncelik ? `0 2px 6px ${oncelik.renk}66, inset 0 2px 4px rgba(255,255,255,0.4)` : 'inset 0 2px 4px rgba(0,0,0,0.1)', flexShrink: 0 }}
              title={oncelik ? oncelik.etiket : 'Öncelik Ata'}
            />

            {seviye === 0 && filtreSantiye === 'hepsi' && gorev.santiyeler?.ad && (
              <span style={{ background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', padding: '2px 6px', fontSize: 10, borderRadius: 12, fontWeight: 700, boxShadow: '0 2px 4px rgba(29, 149, 150, 0.2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{gorev.santiyeler.ad}</span>
            )}

            <div 
              onClick={() => setKisiSeciciAcikId(kisiSeciciAcikId === gorev.id ? null : gorev.id)}
              style={{ display: 'flex', cursor: 'pointer', padding: '2px', borderRadius: 12, background: '#f8f7f2', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)', flexShrink: 0 }}
              title="Kişi Ata/Kaldır"
            >
              {kisiEtiketleri.length > 0 ? kisiEtiketleri.slice(0, 3).map((e, idx) => {
                const kisi = kullanicilar.find((k) => k.id === e.deger)
                const basHarfler = kisi?.ad_soyad.split(' ').map(n => n[0]).join('').substring(0,2) || '?'
                return (
                  <div key={e.id} style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: idx > 0 ? -6 : 0, border: '2px solid white', fontWeight: 700, boxShadow: '0 2px 4px rgba(29, 149, 150, 0.3)', zIndex: 10 - idx }}>
                    {basHarfler}
                  </div>
                )
              }) : <span style={{ fontSize: 13, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))', opacity: 0.6, padding: '0 4px' }}>👤</span>}
              {kisiEtiketleri.length > 3 && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg, #f0f0ed, #e2e0d8)', color: '#555', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', zIndex: 0 }}>
                  +{kisiEtiketleri.length - 3}
                </div>
              )}
            </div>

            <span style={{ fontSize: 10, color: '#888780', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {gorev.profiles?.ad_soyad || 'Bilinmiyor'} • {guvenliTarih(gorev.created_at)}
            </span>
          </div>

          <select 
            value={gorev.durum} 
            onChange={(ev) => durumGuncelle(gorev.id, ev.target.value)}
            style={{ flexShrink: 0, fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #d3d1c7', background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', width: 90, cursor: 'pointer', outline: 'none', fontWeight: 500 }}
          >
            {DURUMLAR.filter((d) => d.deger !== 'hepsi').map((d) => (
              <option key={d.deger} value={d.deger}>{d.etiket}</option>
            ))}
          </select>
        </div>

        {/* Seçici Paneller (İçe çökük derinlik) */}
        {kisiSeciciAcikId === gorev.id && (
          <div className="kisi-etiket-secici" style={{ marginTop: 10, padding: 10, background: '#f4f3ed', borderRadius: 8, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            {kullanicilar.map((k) => {
              const atanmis = kisiEtiketleri.some((e) => e.deger === k.id)
              return (
                <button key={k.id} className={`filtre-chip ${atanmis ? 'secili' : ''}`} onClick={() => kisiEtiketiDegistir(gorev, k.id)} style={{ padding: '6px 10px', fontSize: 11, boxShadow: atanmis ? '0 2px 4px rgba(29,149,150,0.3)' : '0 1px 2px rgba(0,0,0,0.05)' }}>
                  {atanmis ? '✓ ' : ''}{k.ad_soyad}
                </button>
              )
            })}
          </div>
        )}

        {oncelikSeciciAcikId === gorev.id && (
          <div className="oncelik-secici-satiri" style={{ marginTop: 10, padding: 10, background: '#f4f3ed', borderRadius: 8, gap: 10, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            {ONCELIKLER.map((o) => (
              <button key={o.deger} className={`oncelik-nokta ${oncelik?.deger === o.deger ? 'secili' : ''}`} style={{ background: o.renk, width: 24, height: 24, boxShadow: oncelik?.deger === o.deger ? `0 2px 8px ${o.renk}88` : '0 2px 4px rgba(0,0,0,0.1)' }} onClick={() => oncelikDegistir(gorev, o.deger)} title={o.etiket} />
            ))}
          </div>
        )}

        {altGorevAcikId === gorev.id && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: 10, background: '#f4f3ed', borderRadius: 8, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
            <input type="text" placeholder="Alt görev yaz..." value={altGorevMetni} onChange={(e) => setAltGorevMetni(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && altGorevEkle(gorev.id, gorev.santiye_id)} autoFocus style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d3d1c7', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', outline: 'none' }} />
            <button onClick={() => altGorevEkle(gorev.id, gorev.santiye_id)} style={{ padding: '8px 16px', background: 'linear-gradient(to bottom, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 6px rgba(29,149,150,0.4)', cursor: 'pointer' }}>Ekle</button>
          </div>
        )}
      </div>

      {gosterilecekAltlar.map((alt) => <GorevKarti key={alt.id} gorev={alt} seviye={seviye + 1} ctx={ctx} />)}

      {altlar.length > 2 && (
        <button className="daha-fazla-buton" style={{ marginLeft: 16, fontSize: 11, padding: '4px 8px', fontWeight: 600, color: '#1D9596', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.05))' }} onClick={() => setGenisletilmis((onceki) => ({ ...onceki, [gorev.id]: !onceki[gorev.id] }))}>
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
  const [filtreEkleyen, setFiltreEkleyen] = useState('hepsi')
  const [filtrelerAcik, setFiltrelerAcik] = useState(false)
  const [arsivAcik, setArsivAcik] = useState(false)
  
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'

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
  const [kisiSeciciAcikId, setKisiSeciciAcikId] = useState(null)
  const [siralamaYonu, setSiralamaYonu] = useState('yeni') // 'yeni' | 'eski'
  const [gosterilenSayisi, setGosterilenSayisi] = useState(10)

  const [yazdirModaliAcik, setYazdirModaliAcik] = useState(false)
  const [yazdirmaTasarimi, setYazdirmaTasarimi] = useState('tablo') // 'tablo' | 'kart'

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
    
    let gecerliGorevler = data || []
    
    // Şantiye şefleri sadece kendi oluşturdukları veya kendilerinin etiketlendiği görevleri görebilir.
    if (profile?.rol === 'santiye_sefi') {
      gecerliGorevler = gecerliGorevler.filter(g => 
        g.olusturan === profile.id || 
        (g.gorev_etiketleri && g.gorev_etiketleri.some(e => e.etiket_turu === 'kisi' && e.deger === profile.id))
      )
    }
    
    setGorevler(gecerliGorevler)
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
    
    if (yeniDurum === 'tamamlandi') {
      await supabase.from('bildirimler').update({ okundu: true }).eq('gorev_id', id)
    } else {
      await supabase.from('bildirimler').update({ okundu: false }).eq('gorev_id', id)
    }
    
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

  const kisiEtiketiDegistir = async (gorev, kullaniciId) => {
    const mevcutEtiket = gorev.gorev_etiketleri?.find((e) => e.etiket_turu === 'kisi' && e.deger === kullaniciId)
    if (mevcutEtiket) {
      await supabase.from('gorev_etiketleri').delete().eq('id', mevcutEtiket.id)
    } else {
      await supabase.from('gorev_etiketleri').insert({ gorev_id: gorev.id, etiket_turu: 'kisi', deger: kullaniciId })
      if (kullaniciId !== profile?.id) {
        await supabase.from('bildirimler').insert({
          kullanici_id: kullaniciId,
          mesaj: `${profile?.ad_soyad || 'Bir kullanıcı'} sizi bir görevde etiketledi: "${gorev.baslik}"`,
          gorev_id: gorev.id,
          olusturan: profile?.id,
        })
      }
    }
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
  const kokTumTarihSirali = gorevler.filter((g) => !g.ust_gorev_id).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  const numarala = (gorev, prefix, derinlik = 0) => {
    if (derinlik > 20) return // Sonsuz döngü koruması
    numaraHaritasi[gorev.id] = prefix
    const altlar = gorevler.filter((g) => g.ust_gorev_id === gorev.id).sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    altlar.forEach((alt, i) => numarala(alt, `${prefix}.${i + 1}`, derinlik + 1))
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
    ]
    let metin = `📋 GÖREV RAPORU — ${guvenliTarih(new Date().toISOString())}\n\n`
    const kaynakListe = (!hepsi && seciliGorevler.length > 0) ? gorevler.filter((g) => seciliGorevler.includes(g.id)) : gorevler.filter(g => g.durum !== 'tamamlandi')
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
        metin += `   Ekleyen: ${g.profiles?.ad_soyad || 'Bilinmiyor'}, ${guvenliTarih(g.created_at)}\n\n`
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

  // Timeline aktif görevler (Tamamlananlar hariç)
  const aktifGorevler = gorevler.filter((g) => g.durum !== 'tamamlandi')
  const tamamlananGorevler = gorevler.filter((g) => g.durum === 'tamamlandi')

  // Filtreleme Zinciri (Timeline için)
  const santiyeyeGoreFiltreli = filtreSantiye === 'hepsi' ? aktifGorevler : aktifGorevler.filter((g) => g.santiye_id === filtreSantiye)
  const kisiyeGoreFiltreli = filtreKisi === 'hepsi'
    ? santiyeyeGoreFiltreli
    : santiyeyeGoreFiltreli.filter((g) => g.gorev_etiketleri?.some((e) => e.etiket_turu === 'kisi' && e.deger === filtreKisi))
  const ekleyeneGoreFiltreli = filtreEkleyen === 'hepsi'
    ? kisiyeGoreFiltreli
    : kisiyeGoreFiltreli.filter((g) => g.olusturan === filtreEkleyen)
  const durumaGoreFiltreli = filtreDurum === 'hepsi' ? ekleyeneGoreFiltreli : ekleyeneGoreFiltreli.filter((g) => g.durum === filtreDurum)

  const kokGorevler = durumaGoreFiltreli
    .filter((g) => !g.ust_gorev_id)
    .sort((a, b) => siralamaYonu === 'yeni' ? new Date(b.created_at || 0) - new Date(a.created_at || 0) : new Date(a.created_at || 0) - new Date(b.created_at || 0))
  const gosterilenKokGorevler = kokGorevler.slice(0, gosterilenSayisi)

  const altGorevleriBul = (ustId) => durumaGoreFiltreli.filter((g) => g.ust_gorev_id === ustId)

  const ctx = {
    filtreSantiye, kullanicilar, numaraHaritasi, altGorevleriBul,
    genisletilmis, setGenisletilmis,
    duzenlenenId, setDuzenlenenId, duzenlenenBaslik, setDuzenlenenBaslik, basligiKaydet,
    gorevSil, durumGuncelle,
    altGorevAcikId, setAltGorevAcikId, altGorevMetni, setAltGorevMetni, altGorevEkle,
    seciliGorevler, setSeciliGorevler, kisiSeciciAcikId, setKisiSeciciAcikId,
    oncelikSeciciAcikId, setOncelikSeciciAcikId, oncelikDegistir, kisiEtiketiDegistir,
  }

  const aktifFiltreSayisi = [
    filtreSantiye !== 'hepsi',
    filtreDurum !== 'hepsi',
    filtreKisi !== 'hepsi',
    filtreEkleyen !== 'hepsi'
  ].filter(Boolean).length

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1D9596', letterSpacing: '-0.2px' }}>Görevler</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setYazdirModaliAcik(true)} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', fontWeight: 700, color: '#555', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 4 }}>
            🖨️ A4 Çıktı / Önizleme
          </button>
          <button onClick={() => paylas(true)} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(to bottom, #ffffff, #f4f3ed)', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', fontWeight: 700, color: '#555', cursor: 'pointer', transition: 'all 0.2s' }}>📤 Tümünü paylaş</button>
          {seciliGorevler.length > 0 && (
            <button onClick={() => paylas(false)} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #24b8b9, #1D9596)', border: 'none', boxShadow: '0 3px 8px rgba(29, 149, 150, 0.3)', fontWeight: 700, color: 'white', cursor: 'pointer', textShadow: '0 1px 2px rgba(0,0,0,0.1)', transition: 'all 0.2s' }}>
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

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Görev ekle..."
            value={yeniBaslik}
            onChange={(e) => setYeniBaslik(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && gorevEkle()}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 8, msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {ONCELIKLER.map((o) => (
            <button
              key={o.deger}
              onClick={() => setYeniOncelik(o.deger)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: yeniOncelik === o.deger ? 'none' : '1px solid rgba(0,0,0,0.05)',
                background: yeniOncelik === o.deger ? o.renk : '#f8f7f2',
                color: yeniOncelik === o.deger ? 'white' : '#5F5E5A',
                fontSize: 11,
                fontWeight: yeniOncelik === o.deger ? 700 : 500,
                boxShadow: yeniOncelik === o.deger ? `0 2px 6px ${o.renk}88` : 'inset 0 1px 3px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: yeniOncelik === o.deger ? 'white' : o.renk, boxShadow: yeniOncelik === o.deger ? 'none' : '0 1px 2px rgba(0,0,0,0.1)' }} />
              {o.etiket}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#888780', fontWeight: 600, marginRight: 2 }}>Kişiler:</span>
          {kullanicilar.map((k) => (
            <button
              key={k.id}
              onClick={() => etiketliKisiToggle(k.id)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: yeniEtiketliler.includes(k.id) ? 'none' : '1px solid rgba(0,0,0,0.04)',
                background: yeniEtiketliler.includes(k.id) ? 'linear-gradient(135deg, #24b8b9, #1D9596)' : '#fff',
                color: yeniEtiketliler.includes(k.id) ? 'white' : '#555',
                fontSize: 11,
                fontWeight: yeniEtiketliler.includes(k.id) ? 700 : 500,
                boxShadow: yeniEtiketliler.includes(k.id) ? '0 2px 4px rgba(29, 149, 150, 0.3)' : '0 1px 2px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {yeniEtiketliler.includes(k.id) ? '✓ ' : ''}{k.ad_soyad}
            </button>
          ))}
        </div>

        <button className="ekle-buton-genis" onClick={gorevEkle}>Görevi kaydet</button>
      </div>

      {/* FİLTRE PANELİ */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setFiltrelerAcik(!filtrelerAcik)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: filtrelerAcik ? 'linear-gradient(135deg, #24b8b9, #1D9596)' : 'linear-gradient(to bottom, #ffffff, #fcfcf9)',
            color: filtrelerAcik ? '#fff' : '#333',
            border: filtrelerAcik ? 'none' : '1px solid rgba(0,0,0,0.04)',
            boxShadow: filtrelerAcik ? '0 4px 12px rgba(29, 149, 150, 0.3)' : '0 2px 6px rgba(0,0,0,0.04)',
            borderRadius: 12,
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: 14,
            transition: 'all 0.2s'
          }}
        >
          <span style={{ textShadow: filtrelerAcik ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>🔍 Filtreler {aktifFiltreSayisi > 0 ? `(${aktifFiltreSayisi} aktif)` : ''}</span>
          <span>{filtrelerAcik ? '▲ Gizle' : '▼ Göster'}</span>
        </button>

        {filtrelerAcik && (
          <div style={{ background: '#f8f7f2', padding: '16px', borderRadius: 12, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', marginTop: 8 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Şantiye</label>
                <select 
                  value={filtreSantiye} 
                  onChange={(e) => setFiltreSantiye(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="hepsi">Tümü</option>
                  {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Durum</label>
                <select 
                  value={filtreDurum} 
                  onChange={(e) => setFiltreDurum(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="hepsi">Tümü</option>
                  {DURUMLAR.filter(d => d.deger !== 'tamamlandi').map((d) => <option key={d.deger} value={d.deger}>{d.etiket}</option>)}
                </select>
              </div>

              {yonetici && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Kişi (Etiket)</label>
                  <select 
                    value={filtreKisi} 
                    onChange={(e) => setFiltreKisi(e.target.value)} 
                    style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="hepsi">Tümü</option>
                    {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>Ekleyen</label>
                <select 
                  value={filtreEkleyen} 
                  onChange={(e) => setFiltreEkleyen(e.target.value)} 
                  style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="hepsi">Tümü</option>
                  {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
                </select>
              </div>
            </div>

            {aktifFiltreSayisi > 0 && (
              <button
                onClick={() => { setFiltreSantiye('hepsi'); setFiltreDurum('hepsi'); setFiltreKisi('hepsi'); setFiltreEkleyen('hepsi') }}
                style={{ width: '100%', padding: '10px', fontSize: 12, marginTop: 16, background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, color: '#D64545', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              >
                ✕ Filtreleri Temizle
              </button>
            )}
          </div>
        )}
      </div>

      {/* TEK BİRLEŞTİRİLMİŞ SIRALAMA BUTONU VE ARŞİV */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setSiralamaYonu((onceki) => (onceki === 'yeni' ? 'eski' : 'yeni'))}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)',
            border: '1px solid rgba(0,0,0,0.04)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'center',
            color: '#444'
          }}
        >
          {siralamaYonu === 'yeni' ? 'Sıralama (Y - E)' : 'Sıralama (E - Y)'}
        </button>

        <button
          onClick={() => setArsivAcik(true)}
          style={{
            padding: '10px 18px',
            background: 'linear-gradient(135deg, #118166, #0F6E56)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 10px rgba(15, 110, 86, 0.3)',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}
        >
          📦 Arşiv ({tamamlananGorevler.length})
        </button>
      </div>

      <div className="liste">
        {gosterilenKokGorevler.map((g) => <GorevKarti key={g.id} gorev={g} seviye={0} ctx={ctx} />)}
        {kokGorevler.length === 0 && <p className="bos-mesaj">Bu filtrede aktif görev yok.</p>}
      </div>

      {kokGorevler.length > gosterilenSayisi && (
        <button className="daha-fazla-buton" style={{ marginTop: 8 }} onClick={() => setGosterilenSayisi((n) => n + 10)}>
          ▼ Daha fazla göster ({kokGorevler.length - gosterilenSayisi} tane daha)
        </button>
      )}

      {/* ARŞİV MODALI / EKRANI */}
      {arsivAcik && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16, backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', width: '100%', maxWidth: 500, maxHeight: '80vh', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1D9596', letterSpacing: '-0.3px' }}>Tamamlanan Görevler (Arşiv)</h3>
              <button onClick={() => setArsivAcik(false)} style={{ background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
              {tamamlananGorevler.map((g) => (
                <div key={g.id} style={{ padding: 12, background: 'linear-gradient(to bottom, #ffffff, #f8f7f2)', borderRadius: 12, border: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div>
                    <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 14, color: '#333' }}>{g.baslik}</p>
                    <span style={{ fontSize: 11, color: '#888780', fontWeight: 500 }}>{g.santiyeler?.ad || 'Genel'} · {guvenliTarih(g.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => durumGuncelle(g.id, 'bekliyor')}
                      style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)', transition: 'all 0.2s' }}
                    >
                      Aktife Al
                    </button>
                    <button
                      onClick={() => gorevSil(g.id)}
                      style={{ padding: '6px 10px', background: 'linear-gradient(135deg, #e05e5e, #D64545)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(214, 69, 69, 0.2)', transition: 'all 0.2s' }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
              {tamamlananGorevler.length === 0 && <p className="bos-mesaj">Arşivde tamamlanan görev bulunmuyor.</p>}
            </div>
          </div>
        </div>
      )}

      {/* YAZDIRILACAK ALAN (A4) - Ekranda gizli, printte görünür */}
      <div id="printable-a4" className={yazdirmaTasarimi === 'tablo' ? 'print-tasarim-tablo' : 'print-tasarim-kart'}>
        <h1 style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>GÜNLÜK GÖREV ÇİZELGESİ</h1>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 30 }}>Tarih: {guvenliTarih(new Date().toISOString())}</p>
        
        {Object.entries((seciliGorevler.length > 0 ? gorevler.filter(g => seciliGorevler.includes(g.id)) : aktifGorevler)
          .sort((a, b) => (numaraHaritasi[a.id] || '').localeCompare(numaraHaritasi[b.id] || '', undefined, { numeric: true }))
          .reduce((acc, g) => {
            const sAd = g.santiyeler?.ad || 'Genel / Belirtilmemiş';
            if (!acc[sAd]) acc[sAd] = [];
            acc[sAd].push(g);
            return acc;
          }, {})
        ).map(([santiyeAd, liste]) => (
          <div key={santiyeAd} style={{ marginBottom: 40, pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: 18, borderBottom: '2px solid #333', paddingBottom: 5, marginBottom: 15 }}>🏗️ {santiyeAd}</h2>
            
            {/* TABLO TASARIMI */}
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>No</th>
                  <th style={{ width: '45%' }}>Görev Başlığı</th>
                  <th style={{ width: '20%' }}>Sorumlu Kişi</th>
                  <th style={{ width: '15%' }}>Öncelik</th>
                  <th style={{ width: '15%' }}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(g => {
                  const oncelikEtiketi = g.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
                  const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
                  return (
                    <tr key={g.id}>
                      <td>{numaraHaritasi[g.id] || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{g.baslik}</div>
                        {g.ust_gorev_id && <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>↳ Alt görev</div>}
                      </td>
                      <td>{kisiListesiMetni(g)}</td>
                      <td>
                        <span 
                          className="print-oncelik-rozet"
                          style={{ background: oncelik?.renk || '#eee', color: oncelik ? 'white' : 'black' }}
                        >
                          {oncelik?.etiket || 'Belirtilmemiş'}
                        </span>
                      </td>
                      <td>{DURUMLAR.find(d => d.deger === g.durum)?.etiket || 'Bilinmiyor'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* KART TASARIMI */}
            <div className="kart-grid">
              {liste.map(g => {
                const oncelikEtiketi = g.gorev_etiketleri?.find((e) => e.etiket_turu === 'oncelik')
                const oncelik = oncelikEtiketi ? oncelikBul(oncelikEtiketi.deger) : null
                return (
                  <div key={g.id} className="print-gorev-kart">
                    <div className="kart-baslik">
                      <span style={{ color: '#888', marginRight: 6 }}>#{numaraHaritasi[g.id] || '-'}</span>
                      {g.baslik}
                    </div>
                    {g.ust_gorev_id && <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>↳ Alt görev</div>}
                    
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="print-oncelik-rozet" style={{ background: oncelik?.renk || '#eee', color: oncelik ? 'white' : 'black' }}>
                        {oncelik?.etiket || 'Öncelik Yok'}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#e0e0e0', fontSize: 11, fontWeight: 'bold' }}>
                        {DURUMLAR.find(d => d.deger === g.durum)?.etiket || 'Bilinmiyor'}
                      </span>
                    </div>

                    <div className="kart-alt-bilgi">
                      <span>👤 {kisiListesiMetni(g)}</span>
                      <span>📅 {guvenliTarih(g.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* YAZDIRMA ÖNİZLEME MODALI */}
      {yazdirModaliAcik && (
        <div className="print-onizleme-modal">
          <div className="print-onizleme-kutu">
            <div className="print-onizleme-baslik">
              <h3 style={{ margin: 0, fontSize: 18 }}>Tasarım Seç ve Yazdır</h3>
              <button onClick={() => setYazdirModaliAcik(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>✕</button>
            </div>
            
            <div className="print-onizleme-icerik">
              {/* SOL SÜTUN - TABLO TASARIMI */}
              <div className="print-onizleme-sutun">
                <div className="print-onizleme-kontrol">
                  <button 
                    onClick={() => { setYazdirmaTasarimi('tablo'); setTimeout(() => window.print(), 100); }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}
                  >
                    🖨️ BU TASARIMI YAZDIR (Tablo)
                  </button>
                </div>
                <div className="print-onizleme-sayfa">
                  <div className="print-a4-kağıt print-tasarim-tablo" style={{ transform: 'scale(0.7)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 10 }}>GÜNLÜK GÖREV ÇİZELGESİ</h2>
                    <h3 style={{ borderBottom: '2px solid #333' }}>🏗️ Örnek Şantiye</h3>
                    <table className="print-table">
                      <thead><tr><th>No</th><th>Görev Başlığı</th><th>Kişi</th></tr></thead>
                      <tbody>
                        <tr><td>1</td><td>Malzemelerin sayımı yapılacak</td><td>Ahmet Yılmaz</td></tr>
                        <tr><td>2</td><td>Günlük rapor hazırlanacak</td><td>Mehmet Can</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SAĞ SÜTUN - KART TASARIMI */}
              <div className="print-onizleme-sutun" style={{ borderLeft: '2px solid #ccc' }}>
                <div className="print-onizleme-kontrol">
                  <button 
                    onClick={() => { setYazdirmaTasarimi('kart'); setTimeout(() => window.print(), 100); }}
                    style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #E08A2E, #C77522)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(224, 138, 46, 0.3)' }}
                  >
                    🖨️ BU TASARIMI YAZDIR (Kartlar)
                  </button>
                </div>
                <div className="print-onizleme-sayfa">
                  <div className="print-a4-kağıt print-tasarim-kart" style={{ transform: 'scale(0.7)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 10 }}>GÜNLÜK GÖREV ÇİZELGESİ</h2>
                    <h3 style={{ borderBottom: '2px solid #333' }}>🏗️ Örnek Şantiye</h3>
                    <div className="kart-grid">
                      <div className="print-gorev-kart">
                        <div className="kart-baslik">#1 Malzemelerin sayımı yapılacak</div>
                        <span className="print-oncelik-rozet" style={{ background: '#D64545', color: 'white' }}>Kritik</span>
                        <div className="kart-alt-bilgi"><span>👤 Ahmet Yılmaz</span></div>
                      </div>
                      <div className="print-gorev-kart">
                        <div className="kart-baslik">#2 Günlük rapor hazırlanacak</div>
                        <span className="print-oncelik-rozet" style={{ background: '#D9B429', color: 'white' }}>Orta</span>
                        <div className="kart-alt-bilgi"><span>👤 Mehmet Can</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}