import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function Gorevler() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  
  const [gorevler, setGorevler] = useState([])
  const [kullanicilar, setKullanicilar] = useState([])
  const [etiketler, setEtiketler] = useState([])
  
  // Filtre State'leri
  const [filtreKimden, setFiltreKimden] = useState('hepsi') // 'hepsi' | 'benim' | 'digerleri'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreEtiket, setFiltreEtiket] = useState('hepsi')
  
  const [yukleniyor, setYukleniyor] = useState(false)
  const [baslik, setBaslik] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [atananId, setAtananId] = useState('')
  const [etiketId, setEtiketId] = useState('')
  const [sonTarih, setSonTarih] = useState(bugun())
  const [secilenSantiyeId, setSecilenSantiyeId] = useState('')

  useEffect(() => {
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) => setKullanicilar(data || []))
    supabase.from('gorev_etiketleri').select('*').order('ad').then(({ data }) => {
      setEtiketler(data || [])
      if (data?.length) setEtiketId(data[0].id)
    })
    gorevleriYukle()
  }, [])

  const gorevleriYukle = async () => {
    const { data } = await supabase
      .from('gorevler')
      .select('*, santiyeler(ad), gorev_etiketleri(ad, renk), ekleyen_profil:profiles!gorevler_ekleyen_fkey(ad_soyad), atanan_profil:profiles!gorevler_atanan_id_fkey(ad_soyad)')
      .order('kayit_tarihi', { ascending: false })
    setGorevler(data || [])
  }

  const gorevEkle = async () => {
    if (!baslik.trim()) return
    setYukleniyor(true)

    const { error } = await supabase.from('gorevler').insert({
      baslik,
      aciklama,
      santiye_id: secilenSantiyeId === 'genel' ? null : secilenSantiyeId,
      atanan_id: atananId || null,
      etiket_id: etiketId || null,
      son_tarih: sonTarih || null,
      ekleyen: profile?.id,
      durum: 'bekliyor',
      kayit_tarihi: new Date().toISOString(),
    })

    if (error) {
      alert('Görev eklenemedi: ' + error.message)
      setYukleniyor(false)
      return
    }

    setBaslik('')
    setAciklama('')
    setAtananId('')
    setSonTarih(bugun())
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
    setYukleniyor(false)
    gorevleriYukle()
  }

  const durumGuncelle = async (id, yeniDurum) => {
    await supabase.from('gorevler').update({ durum: yeniDurum }).eq('id', id)
    gorevleriYukle()
  }

  const gorevSil = async (id) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return
    await supabase.from('gorevler').delete().eq('id', id)
    gorevleriYukle()
  }

  // Filtreleme Mantığı
  let filtrelenmisListe = gorevler.filter((g) => {
    // Şantiye filtresi
    const santiyeUygun = filtreSantiye === 'hepsi' || (filtreSantiye === 'genel' ? !g.santiye_id : g.santiye_id === filtreSantiye)
    // Etiket filtresi
    const etiketUygun = filtreEtiket === 'hepsi' || g.etiket_id === filtreEtiket
    // Kimden eklendiği filtresi (Benim eklediklerim / Diğerleri)
    let kimdenUygun = true
    if (filtreKimden === 'benim') {
      kimdenUygun = g.ekleyen === profile?.id
    } else if (filtreKimden === 'digerleri') {
      kimdenUygun = g.ekleyen !== profile?.id
    }

    return santiyeUygun && etiketUygun && kimdenUygun
  })

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  return (
    <div className="sayfa">
      <h2>GÖREVLER</h2>

      {/* Şantiye Filtreleri */}
      <div className="filtre-satiri" style={{ marginBottom: 8 }}>
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm Şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>
            {s.ad}
          </button>
        ))}
        <button className={`filtre-chip ${filtreSantiye === 'genel' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('genel')}>Genel</button>
      </div>

      {/* Kim Tarafından Eklendiğine Göre Filtre Butonları (Aynı sayfa içinde) */}
      <div className="filtre-satiri" style={{ marginBottom: 8 }}>
        <button className={`filtre-chip ${filtreKimden === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreKimden('hepsi')}>Tüm Görevler</button>
        <button className={`filtre-chip ${filtreKimden === 'benim' ? 'secili' : ''}`} onClick={() => setFiltreKimden('benim')}>Benim Eklediklerim</button>
        <button className={`filtre-chip ${filtreKimden === 'digerleri' ? 'secili' : ''}`} onClick={() => setFiltreKimden('digerleri')}>Diğerleri Tarafından Eklenenler</button>
      </div>

      {/* Etiket Filtreleri */}
      <div className="filtre-satiri" style={{ marginBottom: 14 }}>
        <button className={`filtre-chip ${filtreEtiket === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreEtiket('hepsi')}>Tüm Etiketler</button>
        {etiketler.map((e) => (
          <button key={e.id} className={`filtre-chip ${filtreEtiket === e.id ? 'secili' : ''}`} onClick={() => setFiltreEtiket(e.id)}>
            {e.ad}
          </button>
        ))}
      </div>

      {/* Görev Listesi */}
      <div className="liste">
        {filtrelenmisListe.map((g) => (
          <div key={g.id} className="kart" style={{ borderLeft: `4px solid ${g.gorev_etiketleri?.renk || '#1D9596'}` }}>
            <div className="kart-ust">
              <span className="kart-baslik" style={{ textDecoration: g.durum === 'tamamlandi' ? 'line-through' : 'none' }}>
                {g.baslik}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select
                  value={g.durum || 'bekliyor'}
                  onChange={(e) => durumGuncelle(g.id, e.target.value)}
                  style={{ padding: '2px 6px', fontSize: 12, borderRadius: 4 }}
                >
                  <option value="bekliyor">Bekliyor</option>
                  <option value="devam">Devam Ediyor</option>
                  <option value="tamamlandi">Tamamlandı</option>
                </select>
                <button className="sil-buton" onClick={() => gorevSil(g.id)} aria-label="Görevi sil">🗑</button>
              </div>
            </div>

            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">
                {g.santiye_id ? (santiyeler.find((s) => s.id === g.santiye_id)?.ad || 'Şantiye') : 'Genel'}
              </span>
              {g.gorev_etiketleri && (
                <span className="etiket" style={{ background: g.gorev_etiketleri.renk ? `${g.gorev_etiketleri.renk}22` : undefined, color: g.gorev_etiketleri.renk }}>
                  {g.gorev_etiketleri.ad}
                </span>
              )}
              <span className="etiket">Ekleyen: {g.ekleyen_profil?.ad_soyad || 'Bilinmiyor'}</span>
              {g.atanan_profil && <span className="etiket">Atanan: {g.atanan_profil.ad_soyad}</span>}
            </div>

            <div className="kart-alt-tarih">
              <span>Son Tarih: {g.son_tarih ? new Date(g.son_tarih).toLocaleDateString('tr-TR') : '—'}</span>
              <span>Kayıt: {g.kayit_tarihi ? new Date(g.kayit_tarihi).toLocaleString('tr-TR') : '—'}</span>
            </div>

            {g.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{g.aciklama}</p>}
          </div>
        ))}
        {filtrelenmisListe.length === 0 && <p className="bos-mesaj">Kriterlere uygun görev bulunmuyor.</p>}
      </div>

      {/* Yeni Görev Ekleme Formu */}
      <div className="ekleme-kutusu">
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Yeni Görev Oluştur</p>
        <select value={secilenSantiyeId} onChange={(e) => setSecilenSantiyeId(e.target.value)} className="santiye-secici-form" style={{ marginBottom: 8 }}>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          <option value="genel">Genel (Şantiyeye bağlı değil)</option>
        </select>
        
        <input type="text" placeholder="Görev başlığı..." value={baslik} onChange={(e) => setBaslik(e.target.value)} style={{ marginBottom: 8 }} />
        
        <textarea
          placeholder="Görev açıklaması / detaylar (opsiyonel)..."
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
        />

        <div className="ekleme-satiri-2" style={{ marginBottom: 8 }}>
          <select value={atananId} onChange={(e) => setAtananId(e.target.value)}>
            <option value="">Kişiye ata (opsiyonel)</option>
            {kullanicilar.map((k) => <option key={k.id} value={k.id}>{k.ad_soyad}</option>)}
          </select>
          <select value={etiketId} onChange={(e) => setEtiketId(e.target.value)}>
            {etiketler.map((e) => <option key={e.id} value={e.id}>{e.ad}</option>)}
          </select>
        </div>

        <div className="ekleme-satiri-2" style={{ marginBottom: 8 }}>
          <input type="date" value={sonTarih} onChange={(e) => setSonTarih(e.target.value)} />
        </div>

        <button className="ekle-buton-genis" onClick={gorevEkle} disabled={yukleniyor}>
          {yukleniyor ? 'Ekleniyor...' : 'Görevi kaydet'}
        </button>
      </div>
    </div>
  )
}