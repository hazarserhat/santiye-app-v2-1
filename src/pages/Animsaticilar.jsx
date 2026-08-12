import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const DURUMLAR = [
  { deger: 'aktif', etiket: 'Aktif' },
  { deger: 'tamamlandi', etiket: 'Tamamlandı' },
  { deger: 'ertelendi', etiket: 'Ertelendi' },
  { deger: 'iptal_edildi', etiket: 'İptal edildi' },
]

export default function Animsaticilar() {
  const navigate = useNavigate()
  const { santiyeler } = useSite()
  const { profile } = useAuth()

  const [bildirimler, setBildirimler] = useState([])
  const [animsaticilar, setAnimsaticilar] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [acikId, setAcikId] = useState(null)
  const [yorumlar, setYorumlar] = useState({})
  const [yeniYorum, setYeniYorum] = useState('')

  const [ekleAcik, setEkleAcik] = useState(false)
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [yeniAciklama, setYeniAciklama] = useState('')
  const [yeniOncelik, setYeniOncelik] = useState('bilgi_amacli')

  useEffect(() => {
    if (profile) bildirimleriYukle()
    animsaticilariYukle()
  }, [profile])

  useEffect(() => {
    if (santiyeler.length && !yeniSantiyeId) setYeniSantiyeId(santiyeler[0].id)
  }, [santiyeler])

  const bildirimleriYukle = async () => {
    const { data, error } = await supabase.from('bildirimler').select('*').eq('kullanici_id', profile.id).order('created_at', { ascending: false }).limit(20)
    if (error) { alert('Bildirimler yüklenemedi: ' + error.message); return }
    setBildirimler(data || [])
  }

  const animsaticilariYukle = async () => {
    const { data, error } = await supabase.from('animsaticilar').select('*, santiyeler(ad), profiles(ad_soyad)').order('created_at', { ascending: false })
    if (error) { alert('Anımsatıcılar yüklenemedi: ' + error.message); return }
    setAnimsaticilar(data || [])
  }

  const bildirimeTikla = async (b) => {
    await supabase.from('bildirimler').update({ okundu: true }).eq('id', b.id)
    bildirimleriYukle()
    if (b.gorev_id) navigate('/gorevler')
  }

  const yorumlariYukle = async (animsaticiId) => {
    const { data } = await supabase.from('animsatici_yorumlari').select('*, profiles(ad_soyad)').eq('animsatici_id', animsaticiId).order('created_at')
    setYorumlar((onceki) => ({ ...onceki, [animsaticiId]: data || [] }))
  }

  const detayAc = (id) => {
    setAcikId(acikId === id ? null : id)
    if (acikId !== id) yorumlariYukle(id)
  }

  const durumGuncelle = async (id, durum) => {
    await supabase.from('animsaticilar').update({ durum }).eq('id', id)
    animsaticilariYukle()
  }

  const yorumEkle = async (animsaticiId) => {
    if (!yeniYorum.trim()) return
    await supabase.from('animsatici_yorumlari').insert({ animsatici_id: animsaticiId, kullanici_id: profile.id, icerik: yeniYorum })
    setYeniYorum('')
    yorumlariYukle(animsaticiId)
  }

  const animsaticiEkle = async () => {
    if (!yeniBaslik.trim() || !yeniSantiyeId) { alert('Başlık ve şantiye zorunludur.'); return }
    const { error } = await supabase.from('animsaticilar').insert({
      santiye_id: yeniSantiyeId, baslik: yeniBaslik, aciklama: yeniAciklama, oncelik: yeniOncelik, olusturan: profile?.id,
    })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setYeniBaslik(''); setYeniAciklama(''); setYeniOncelik('bilgi_amacli'); setEkleAcik(false)
    animsaticilariYukle()
  }

  const animsaticiSil = async (id) => {
    if (!window.confirm('Bu anımsatıcıyı silmek istediğinize emin misiniz?')) return
    await supabase.from('animsaticilar').delete().eq('id', id)
    animsaticilariYukle()
  }

  const okunmamisSayisi = bildirimler.filter((b) => !b.okundu).length
  const gorunenler = filtreSantiye === 'hepsi' ? animsaticilar : animsaticilar.filter((a) => a.santiye_id === filtreSantiye)

  return (
    <div className="sayfa">
      <h2>Anımsatıcı / Uyarı</h2>

      {bildirimler.length > 0 && (
        <>
          <p className="alt-baslik">Bildirimlerim {okunmamisSayisi > 0 && <span className="etiket" style={{ background: '#D64545', color: 'white' }}>{okunmamisSayisi} yeni</span>}</p>
          <p style={{ fontSize: 11, color: '#888780', margin: '0 0 8px' }}>Bir bildirime tıklarsanız doğrudan ilgili göreve gidersiniz.</p>
          <div className="liste" style={{ marginBottom: 16 }}>
            {bildirimler.map((b) => (
              <div
                key={b.id}
                className="kart"
                onClick={() => bildirimeTikla(b)}
                style={{ cursor: 'pointer', borderLeft: b.okundu ? undefined : '4px solid #1D9596', opacity: b.okundu ? 0.7 : 1 }}
              >
                <p className="not-icerik">{b.mesaj}</p>
                <span className="not-alt">{new Date(b.created_at).toLocaleDateString('tr-TR')} {new Date(b.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p className="alt-baslik" style={{ margin: 0 }}>Anımsatıcılar</p>
        <button className="ekle-buton-genis" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => setEkleAcik(!ekleAcik)}>
          {ekleAcik ? 'Vazgeç' : '+ Ekle'}
        </button>
      </div>

      {ekleAcik && (
        <div className="ekleme-kutusu">
          <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
          <input type="text" placeholder="Başlık..." value={yeniBaslik} onChange={(e) => setYeniBaslik(e.target.value)} />
          <textarea
            placeholder="Açıklama (opsiyonel)..."
            value={yeniAciklama}
            onChange={(e) => setYeniAciklama(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <select value={yeniOncelik} onChange={(e) => setYeniOncelik(e.target.value)}>
            <option value="bilgi_amacli">Bilgi amaçlı</option>
            <option value="acil">Acil</option>
          </select>
          <button className="ekle-buton-genis" onClick={animsaticiEkle}>Kaydet</button>
        </div>
      )}

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      <div className="liste">
        {gorunenler.map((a) => (
          <div key={a.id} className="kart" style={{ borderLeft: a.oncelik === 'acil' ? '4px solid #D64545' : undefined }}>
            <div className="kart-ust" onClick={() => detayAc(a.id)} style={{ cursor: 'pointer' }}>
              <span className="kart-baslik">{acikId === a.id ? '▾' : '▸'} {a.baslik}</span>
              <button className="sil-buton" onClick={(e) => { e.stopPropagation(); animsaticiSil(a.id) }} aria-label="Sil">🗑</button>
            </div>
            <div className="etiket-satiri">
              <span className="etiket etiket-vurgu">{a.santiyeler?.ad}</span>
              {a.oncelik === 'acil' && <span className="etiket" style={{ background: '#D64545', color: 'white' }}>Acil</span>}
              <span className={`durum-rozet ${a.durum === 'tamamlandi' ? 'rozet-yesil' : a.durum === 'iptal_edildi' ? '' : 'rozet-sari'}`}>
                {DURUMLAR.find((d) => d.deger === a.durum)?.etiket}
              </span>
            </div>

            {acikId === a.id && (
              <div style={{ marginTop: 10 }}>
                {a.aciklama && <p className="not-icerik" style={{ marginBottom: 10 }}>{a.aciklama}</p>}

                <div className="filtre-satiri" style={{ marginBottom: 10 }}>
                  {DURUMLAR.map((d) => (
                    <button key={d.deger} className={`filtre-chip ${a.durum === d.deger ? 'secili' : ''}`} onClick={() => durumGuncelle(a.id, d.deger)}>{d.etiket}</button>
                  ))}
                </div>

                <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>Yorumlar</p>
                {(yorumlar[a.id] || []).map((y) => (
                  <div key={y.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{y.profiles?.ad_soyad}</span>
                      <span style={{ fontSize: 11, color: '#888780' }}>{new Date(y.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <p className="not-icerik">{y.icerik}</p>
                  </div>
                ))}
                {(yorumlar[a.id] || []).length === 0 && <p className="bos-mesaj" style={{ padding: '4px 0' }}>Henüz yorum yok.</p>}

                <div className="ekleme-satiri-2" style={{ marginTop: 8 }}>
                  <input type="text" placeholder="Yorum yaz..." value={yeniYorum} onChange={(e) => setYeniYorum(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && yorumEkle(a.id)} />
                  <button onClick={() => yorumEkle(a.id)}>Gönder</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">Bu filtrede anımsatıcı yok.</p>}
      </div>
    </div>
  )
}
