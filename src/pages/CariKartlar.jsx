import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const paraFormatla = (tutar) => {
  if (tutar === undefined || tuttarih => tutar === null) return '0,00'
  return Number(tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CariKartlar() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici'

  const [taseronlar, setTaseronlar] = useState([])
  const [seciliTaseron, setSeciliTaseron] = useState(null)
  const [aramaMetni, setAramaMetni] = useState('')
  const [yeniAd, setYeniAd] = useState('')
  const [yeniTip, setYeniTip] = useState('Tedarikçi')

  // Detay state'leri
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [cekler, setCekler] = useState([])

  const [duzenleModu, setDuzenleModu] = useState(false)
  const [duzAd, setDuzAd] = useState('')
  const [duzTip, setDuzTip] = useState('')

  // Yeni Hakediş/Ödeme Formu State'leri
  const [hakedisTuru, setHakedisTuru] = useState('hakedis')
  const [hakedisTutar, setHakedisTutar] = useState('')
  const [hakedisTarih, setHakedisTarih] = useState(new Date().toISOString().slice(0, 10))
  const [hakedisAciklama, setHakedisAciklama] = useState('')
  const [hakedisSantiyeId, setHakedisSantiyeId] = useState('')

  // Not State'leri
  const [notlar, setNotlar] = useState([])
  const [yeniNot, setYeniNot] = useState('')

  useEffect(() => {
    taseronlariYukle()
  }, [aktifSantiye])

  useEffect(() => {
    if (aktifSantiye) setHakedisSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*').order('ad')
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data } = await query
    setTaseronlar(data || [])
  }

  const gorunurlukDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase.from('taseronlar').update({ sef_gorunur: !mevcutDurum }).eq('id', id)
    if (error) {
      alert('Güncellenemedi: ' + error.message)
    } else {
      taseronlariYukle()
      if (seciliTaseron?.id === id) {
        setSeciliTaseron((prev) => ({ ...prev, sef_gorunur: !mevcutDurum }))
      }
    }
  }

  const taseronSil = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Bu cari hesap kaydını ve tüm ilişkili verilerini silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('taseronlar').delete().eq('id', id)
    if (error) {
      alert('Silinemedi: ' + error.message)
    } else {
      setSeciliTaseron(null)
      taseronlariYukle()
    }
  }

  const taseronSec = async (t) => {
    setSeciliTaseron(t)
    setDuzAd(t.ad)
    setDuzTip(t.tip || 'Tedarikçi')
    setDuzenleModu(false)

    // Şantiye ilişkilerini çek
    const { data: santiyeData, error: santiyeHata } = await supabase
      .from('taseron_santiyeler')
      .select('*, santiyeler(ad)')
      .eq('taseron_id', t.id)
    if (santiyeHata) { alert('Şantiye ilişkileri yüklenemedi: ' + santiyeHata.message); return }
    setIliskiliSantiyeler(santiyeData || [])

    // Masrafları çek
    const { data: masrafData } = await supabase
      .from('masraflar')
      .select('*, santiyeler(ad), masraf_kategorileri(ad)')
      .eq('cari_id', t.id)
      .order('harcama_tarihi', { ascending: false })
    setMasraflar(masrafData || [])

    // Çekleri çek
    const { data: cekData } = await supabase
      .from('cekler')
      .select('*, santiyeler(ad)')
      .eq('cari_id', t.id)
    setCekler(cekData || [])

    // Bilgi kartlarını çek
    const { data: hkData } = await supabase
      .from('hakedisler')
      .select('*, santiyeler(ad)')
      .eq('taseron_id', t.id)
      .order('tarih', { ascending: false })
    setHakedisler(hkData || [])

    // Notları çek
    const { data: notData } = await supabase
      .from('taseron_notlar')
      .select('*, profiles(ad_soyad)')
      .eq('taseron_id', t.id)
      .order('created_at', { ascending: false })
    setNotlar(notData || [])
  }

  const taseronEkle = async () => {
    if (!yeniAd.trim()) return
    const { error } = await supabase.from('taseronlar').insert({
      ad: yeniAd,
      tip: yeniTip,
      sef_gorunur: true,
    })
    if (error) {
      alert('Cari eklenemedi: ' + error.message)
    } else {
      setYeniAd('')
      taseronlariYukle()
    }
  }

  const bilgiKartiEkle = async () => {
    if (!hakedisTutar || isNaN(hakedisTutar)) { alert('Lütfen geçerli bir tutar girin.'); return }
    if (!hakedisSantiyeId) { alert('Lütfen bir şantiye seçin.'); return }

    const { error } = await supabase.from('hakedisler').insert({
      taseron_id: seciliTaseron.id,
      santiye_id: hakedisSantiyeId,
      tur: hakedisTuru,
      tutar: parseFloat(hakedisTutar),
      tarih: hakedisTarih,
      aciklama: hakedisAciklama,
      olusturan: profile?.id,
    })

    if (error) {
      alert('Kayıt eklenemedi: ' + error.message)
    } else {
      setHakedisTutar('')
      setHakedisAciklama('')
      taseronSec(seciliTaseron)
    }
  }

  const bilgiKartiSil = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    await supabase.from('hakedisler').delete().eq('id', id)
    taseronSec(seciliTaseron)
  }

  const notEkle = async () => {
    if (!yeniNot.trim()) return
    const { error } = await supabase.from('taseron_notlar').insert({
      taseron_id: seciliTaseron.id,
      not_metni: yeniNot,
      olusturan: profile?.id,
    })
    if (error) {
      alert('Not eklenemedi: ' + error.message)
    } else {
      setYeniNot('')
      taseronSec(seciliTaseron)
    }
  }

  const notSil = async (id) => {
    if (!window.confirm('Notu silmek istediğinize emin misiniz?')) return
    await supabase.from('taseron_notlar').delete().eq('id', id)
    taseronSec(seciliTaseron)
  }

  const cariGuncelle = async () => {
    if (!duzAd.trim()) return
    const { error } = await supabase.from('taseronlar').update({ ad: duzAd, tip: duzTip }).eq('id', seciliTaseron.id)
    if (error) {
      alert('Güncellenemedi: ' + error.message)
    } else {
      setSeciliTaseron((prev) => ({ ...prev, ad: duzAd, tip: duzTip }))
      setDuzenleModu(false)
      taseronlariYukle()
    }
  }

  const eklenebilirSantiyeler = santiyeler.filter((s) => !iliskiliSantiyeler.find((r) => r.santiye_id === s.id))

  // ---- KRONOLOJİK TİMELİNE SIRALAMASI ----
  const timelineOlaylari = [
    ...hakedisler.map((h) => ({
      tip: 'hakedis',
      tarih: h.tarih,
      created_at: h.created_at,
      veri: h,
    })),
    ...masraflar.map((m) => ({
      tip: 'masraf',
      tarih: m.harcama_tarihi,
      created_at: m.created_at,
      veri: m,
    })),
    ...cekler.map((c) => ({
      tip: 'cek',
      tarih: c.vade_tarihi || c.verilis_tarihi || c.created_at?.slice(0, 10),
      created_at: c.created_at,
      veri: c,
    })),
  ].sort((a, b) => {
    const tarihA = new Date(a.tarih || a.created_at || 0)
    const tarihB = new Date(b.tarih || b.created_at || 0)
    if (tarihB - tarihA !== 0) return tarihB - tarihA
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  })

  // Hesaplama Özetleri
  const toplamHakedis = hakedisler.filter((h) => h.tur === 'hakedis').reduce((acc, h) => acc + Number(h.tutar || 0), 0)
  const toplamAvans = hakedisler.filter((h) => h.tur === 'avans').reduce((acc, h) => acc + Number(h.tutar || 0), 0)
  const toplamOdeme = hakedisler.filter((h) => h.tur === 'odeme').reduce((acc, h) => acc + Number(h.tutar || 0), 0)
  const toplamIskonto = hakedisler.filter((h) => h.tur === 'iskonto').reduce((acc, h) => acc + Number(h.tutar || 0), 0)
  const toplamMasraf = masraflar.reduce((acc, m) => acc + Number(m.tutar || 0), 0)
  const toplamCek = cekler.reduce((acc, c) => acc + Number(c.tutar || 0), 0)

  const filtrelenmisTaseronlar = taseronlar.filter((t) => t.ad.toLowerCase().includes(aramaMetni.toLowerCase()))

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  if (seciliTaseron) {
    return (
      <div className="sayfa">
        <button className="geri-buton" onClick={() => setSeciliTaseron(null)}>← Cari Listesine Dön</button>
        
        <div className="kart" style={{ marginTop: 10, borderLeft: '4px solid #1D9596' }}>
          {duzenleModu ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="text" value={duzAd} onChange={(e) => setDuzAd(e.target.value)} />
              <select value={duzTip} onChange={(e) => setDuzTip(e.target.value)}>
                <option value="Tedarikçi">Tedarikçi</option>
                <option value="Taşeron">Taşeron</option>
                <option value="Müşteri">Müşteri</option>
                <option value="Personel">Personel</option>
                <option value="Diğer">Diğer</option>
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ekle-buton-genis" onClick={cariGuncelle}>Kaydet</button>
                <button className="sil-buton" onClick={() => setDuzenleModu(false)}>İptal</button>
              </div>
            </div>
          ) : (
            <div className="kart-ust">
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{seciliTaseron.ad}</h2>
                <span className="etiket etiket-vurgu" style={{ marginTop: 4, display: 'inline-block' }}>{seciliTaseron.tip || 'Tedarikçi'}</span>
              </div>
              {yonetici && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="sil-buton" onClick={() => setDuzenleModu(true)}>✎ Düzenle</button>
                  <button className="sil-buton" onClick={(e) => taseronSil(seciliTaseron.id, e)}>🗑 Sil</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ÖZET FİNANS DURUMU */}
        <div className="ekleme-kutusu" style={{ marginTop: 12, background: '#f4f4f0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Finansal Özet</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div>Hakedişler: <b>{paraFormatla(toplamHakedis)} ₺</b></div>
            <div>Ödemeler: <b>{paraFormatla(toplamOdeme)} ₺</b></div>
            <div>Avanslar: <b>{paraFormatla(toplamAvans)} ₺</b></div>
            <div>İskontolar: <b>{paraFormatla(toplamIskonto)} ₺</b></div>
            <div>Masraflar: <b>{paraFormatla(toplamMasraf)} ₺</b></div>
            <div>Çekler: <b>{paraFormatla(toplamCek)} ₺</b></div>
          </div>
        </div>

        {/* BİLGİ KARTI / ÖDEME EKLEME FORMU */}
        <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Finansal İşlem Ekle</p>
          
          <select value={hakedisTuru} onChange={(e) => setHakedisTuru(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="hakedis">Hakediş (Alacak)</option>
            <option value="odeme">Ödeme (Borç Kapatma)</option>
            <option value="avans">Avans</option>
            <option value="iskonto">İskonto</option>
          </select>

          <select value={hakedisSantiyeId} onChange={(e) => setHakedisSantiyeId(e.target.value)} style={{ marginBottom: 8 }}>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <div className="ekleme-satiri-2" style={{ marginBottom: 8 }}>
            <input type="number" placeholder="Tutar (₺)" value={hakedisTutar} onChange={(e) => setHakedisTutar(e.target.value)} />
            <input type="date" value={hakedisTarih} onChange={(e) => setHakedisTarih(e.target.value)} />
          </div>

          <textarea
            placeholder="Açıklama / Detay (opsiyonel)..."
            value={hakedisAciklama}
            onChange={(e) => setHakedisAciklama(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d3d1c7', fontSize: 13, marginBottom: 8 }}
          />

          <button className="ekle-buton-genis" onClick={bilgiKartiEkle}>İşlemi Kaydet</button>
        </div>

        {/* TİMELİNE AKIŞI */}
        <p className="alt-baslik" style={{ marginTop: 20 }}>Finansal Akış & İşlem Geçmişi</p>
        <div className="liste">
          {timelineOlaylari.map((olay, index) => {
            if (olay.tip === 'hakedis') {
              const h = olay.veri
              return (
                <div key={`hk-${h.id}`} className="kart" style={{ borderLeft: `4px solid ${h.tur === 'hakedis' ? '#1D9596' : '#E08A2E'}` }}>
                  <div className="kart-ust">
                    <span className="kart-baslik" style={{ textTransform: 'uppercase' }}>{h.tur}: {h.aciklama || 'Açıklama yok'}</span>
                    <span style={{ fontWeight: 700 }}>{paraFormatla(h.tutar)} ₺</span>
                    <button className="sil-buton" onClick={() => bilgiKartiSil(h.id)}>🗑</button>
                  </div>
                  <div className="etiket-satiri">
                    <span className="etiket etiket-vurgu">{h.santiyeler?.ad || 'Şantiye'}</span>
                    <span className="etiket">Tarih: {h.tarih ? new Date(h.tarih).toLocaleDateString('tr-TR') : '—'}</span>
                  </div>
                </div>
              )
            } else if (olay.tip === 'masraf') {
              const m = olay.veri
              return (
                <div key={`msf-${m.id}`} className="kart" style={{ borderLeft: '4px solid #D64545' }}>
                  <div className="kart-ust">
                    <span className="kart-baslik">Masraf: {m.aciklama || m.masraf_kategorileri?.ad || 'Masraf'}</span>
                    <span style={{ fontWeight: 700, color: '#D64545' }}>{paraFormatla(m.tutar)} ₺</span>
                  </div>
                  <div className="etiket-satiri">
                    <span className="etiket etiket-vurgu">{m.santiyeler?.ad || 'Şantiye'}</span>
                    <span className="etiket">Tarih: {m.harcama_tarihi ? new Date(m.harcama_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
                  </div>
                </div>
              )
            } else if (olay.tip === 'cek') {
              const c = olay.veri
              return (
                <div key={`cek-${c.id || index}`} className="kart" style={{ borderLeft: '4px solid #6366F1' }}>
                  <div className="kart-ust">
                    <span className="kart-baslik">Çek: No: {c.cek_no || '—'} ({c.banka || 'Banka'})</span>
                    <span style={{ fontWeight: 700, color: '#6366F1' }}>{paraFormatla(c.tutar)} ₺</span>
                  </div>
                  <div className="etiket-satiri">
                    <span className="etiket">Vade: {c.vade_tarihi ? new Date(c.vade_tarihi).toLocaleDateString('tr-TR') : '—'}</span>
                    <span className="etiket etiket-vurgu">{c.odenen || seciliTaseron?.ad || 'Cari'}</span>
                  </div>
                  {c.aciklama && <p className="not-icerik" style={{ marginTop: 6 }}>{c.aciklama}</p>}
                </div>
              )
            }
            return null
          })}
          {timelineOlaylari.length === 0 && <p className="bos-mesaj">Henüz bir finansal hareket bulunmuyor.</p>}
        </div>

        {/* NOTLAR */}
        <p className="alt-baslik" style={{ marginTop: 20 }}>Cari Notları</p>
        <div className="ekleme-kutusu" style={{ marginBottom: 12 }}>
          <textarea
            placeholder="Cari hakkında not yazın..."
            value={yeniNot}
            onChange={(e) => setYeniNot(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #d3d1c7', fontSize: 13, marginBottom: 8 }}
          />
          <button className="ekle-buton-genis" onClick={notEkle}>Notu Ekle</button>
        </div>

        <div className="liste">
          {notlar.map((n) => (
            <div key={n.id} className="kart">
              <div className="kart-ust">
                <span className="kart-baslik" style={{ fontSize: 12, color: '#555' }}>{n.profiles?.ad_soyad || 'Kullanıcı'}</span>
                <button className="sil-buton" onClick={() => notSil(n.id)}>🗑</button>
              </div>
              <p className="not-icerik" style={{ marginTop: 4 }}>{n.not_metni}</p>
              <span className="not-alt" style={{ display: 'block', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="sayfa">
      <h2>REHBER / CARİ KARTLAR</h2>

      <input
        type="text"
        placeholder="Cari ara..."
        value={aramaMetni}
        onChange={(e) => setAramaMetni(e.target.value)}
        style={{ marginBottom: 12, width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d3d1c7' }}
      />

      <div className="liste">
        {filtrelenmisTaseronlar.map((t) => (
          <div key={t.id} className="kart" onClick={() => taseronSec(t)} style={{ cursor: 'pointer' }}>
            <div className="kart-ust">
              <span className="kart-baslik">{t.ad}</span>
              {yonetici && (
                <button
                  className={`filtre-chip ${t.sef_gorunur ? 'secili' : ''}`}
                  onClick={(e) => gorunurlukDegistir(t.id, t.sef_gorunur, e)}
                  style={{ fontSize: 11, padding: '2px 6px' }}
                >
                  {t.sef_gorunur ? 'Şef Görebilir' : 'Gizli'}
                </button>
              )}
            </div>
            <span className="etiket etiket-vurgu" style={{ marginTop: 6, display: 'inline-block' }}>{t.tip || 'Tedarikçi'}</span>
          </div>
        ))}
        {filtrelenmisTaseronlar.length === 0 && <p className="bos-mesaj">Kayıtlı cari bulunamadı.</p>}
      </div>

      {yonetici && (
        <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Yeni Cari Hesap Ekle</p>
          <input
            type="text"
            placeholder="Cari / Firma Adı"
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <select value={yeniTip} onChange={(e) => setYeniTip(e.target.value)} style={{ marginBottom: 8 }}>
            <option value="Tedarikçi">Tedarikçi</option>
            <option value="Taşeron">Taşeron</option>
            <option value="Müşteri">Müşteri</option>
            <option value="Personel">Personel</option>
            <option value="Diğer">Diğer</option>
          </select>
          <button className="ekle-buton-genis" onClick={taseronEkle}>Cari Ekle</button>
        </div>
      )}
    </div>
  )
}