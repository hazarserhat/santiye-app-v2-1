import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

export default function CariKartlar() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'

  const [taseronlar, setTaseronlar] = useState([])
  const [seciliId, setSeciliId] = useState(null)
  const [arama, setArama] = useState('')

  const [notlar, setNotlar] = useState([])
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])

  const [yeniNot, setYeniNot] = useState('')
  const [yeniTaseronAcik, setYeniTaseronAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniFirma, setYeniFirma] = useState('')
  const [yeniTelefon, setYeniTelefon] = useState('')
  const [yeniAdres, setYeniAdres] = useState('')

  const [hkDonem, setHkDonem] = useState('')
  const [hkTutar, setHkTutar] = useState('')
  const [hkKesinti, setHkKesinti] = useState('')
  const [hkDurum, setHkDurum] = useState('bekliyor')
  const [hkAciklama, setHkAciklama] = useState('')

  useEffect(() => {
    if (aktifSantiye) taseronlariYukle()
  }, [aktifSantiye])

  const taseronlariYukle = async () => {
    const { data } = await supabase
      .from('taseron_santiyeler')
      .select('taseronlar(*)')
      .eq('santiye_id', aktifSantiye.id)
    setTaseronlar((data || []).map((r) => r.taseronlar).filter(Boolean))
  }

  const detayYukle = async (id) => {
    setSeciliId(id)

    const { data: notData } = await supabase
      .from('taseron_notlari')
      .select('*, profiles(ad_soyad)')
      .eq('taseron_id', id)
      .order('created_at', { ascending: false })
    setNotlar(notData || [])

    const { data: santiyeData } = await supabase
      .from('taseron_santiyeler')
      .select('santiyeler(ad)')
      .eq('taseron_id', id)
    setIliskiliSantiyeler((santiyeData || []).map((r) => r.santiyeler?.ad).filter(Boolean))

    if (yonetici) {
      const { data: hkData } = await supabase
        .from('hakedisler')
        .select('*')
        .eq('taseron_id', id)
        .order('donem', { ascending: false })
      setHakedisler(hkData || [])
    }
  }

  const taseronEkle = async () => {
    if (!yeniAd.trim()) return
    const { data, error } = await supabase
      .from('taseronlar')
      .insert({ ad: yeniAd, firma: yeniFirma, telefon: yeniTelefon, adres: yeniAdres })
      .select()
      .single()
    if (!error && data) {
      await supabase.from('taseron_santiyeler').insert({ taseron_id: data.id, santiye_id: aktifSantiye.id })
      setYeniAd(''); setYeniFirma(''); setYeniTelefon(''); setYeniAdres('')
      setYeniTaseronAcik(false)
      taseronlariYukle()
    }
  }

  const notEkle = async () => {
    if (!yeniNot.trim()) return
    await supabase.from('taseron_notlari').insert({
      taseron_id: seciliId,
      icerik: yeniNot,
      ekleyen: profile?.id,
    })
    setYeniNot('')
    detayYukle(seciliId)
  }

  const hakedisEkle = async () => {
    if (!hkDonem.trim() || !hkTutar) return
    await supabase.from('hakedisler').insert({
      taseron_id: seciliId,
      donem: hkDonem,
      tutar: Number(hkTutar),
      kesinti_avans: Number(hkKesinti) || 0,
      odeme_durumu: hkDurum,
      aciklama: hkAciklama,
      ekleyen: profile?.id,
    })
    setHkDonem(''); setHkTutar(''); setHkKesinti(''); setHkDurum('bekliyor'); setHkAciklama('')
    detayYukle(seciliId)
  }

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  const seciliTaseron = taseronlar.find((t) => t.id === seciliId)
  const filtreliListe = taseronlar.filter((t) => t.ad.toLowerCase().includes(arama.toLowerCase()))

  // ---- DETAY GÖRÜNÜMÜ ----
  if (seciliId && seciliTaseron) {
    return (
      <div className="sayfa">
        <button className="geri-buton" onClick={() => setSeciliId(null)}>← Listeye dön</button>

        <div className="taseron-baslik-satiri">
          <div className="avatar-daire">{seciliTaseron.ad.slice(0, 2).toUpperCase()}</div>
          <div>
            <p className="taseron-ad">{seciliTaseron.ad}</p>
            <p className="taseron-firma">{seciliTaseron.firma}</p>
          </div>
        </div>

        <div className="bilgi-kutusu">
          <div className="bilgi-satiri"><span>Telefon</span><span>{seciliTaseron.telefon || '—'}</span></div>
          <div className="bilgi-satiri"><span>Adres</span><span>{seciliTaseron.adres || '—'}</span></div>
          <div className="bilgi-satiri"><span>Çalıştığı şantiyeler</span><span>{iliskiliSantiyeler.join(', ') || '—'}</span></div>
        </div>

        <p className="alt-baslik">Notlar</p>
        <div className="liste">
          {notlar.map((n) => (
            <div key={n.id} className="kart">
              <p className="not-icerik">{n.icerik}</p>
              <span className="not-alt">{n.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
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
      <h2>Cari kartlar · {aktifSantiye.ad}</h2>

      <input type="text" placeholder="Taşeron ara..." value={arama} onChange={(e) => setArama(e.target.value)} style={{ marginBottom: 12 }} />

      <div className="liste">
        {filtreliListe.map((t) => (
          <div key={t.id} className="kart taseron-satir" onClick={() => detayYukle(t.id)}>
            <div className="avatar-daire">{t.ad.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="taseron-ad">{t.ad}</p>
              <p className="taseron-firma">{t.telefon || t.firma || ''}</p>
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
          <input type="text" placeholder="Firma" value={yeniFirma} onChange={(e) => setYeniFirma(e.target.value)} />
          <input type="text" placeholder="Telefon" value={yeniTelefon} onChange={(e) => setYeniTelefon(e.target.value)} />
          <input type="text" placeholder="Adres" value={yeniAdres} onChange={(e) => setYeniAdres(e.target.value)} />
          <button className="ekle-buton-genis" onClick={taseronEkle}>Taşeronu kaydet</button>
        </div>
      )}
    </div>
  )
}
