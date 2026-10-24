import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'

export default function CariKartlar() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'

  const [taseronlar, setTaseronlar] = useState([])
  const [taseronSantiyeHaritasi, setTaseronSantiyeHaritasi] = useState({})
  const [siralama, setSiralama] = useState('alfabetik')
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [seciliId, setSeciliId] = useState(null)
  const [arama, setArama] = useState('')
  const [aktifSekme, setAktifSekme] = useState('tumu')

  const [notlar, setNotlar] = useState([])
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [cekler, setCekler] = useState([])
  const [gelirler, setGelirler] = useState([])

  const [duzenleModu, setDuzenleModu] = useState(false)
  const [duzAd, setDuzAd] = useState('')
  const [duzSifat, setDuzSifat] = useState('')
  const [duzFirma, setDuzFirma] = useState('')
  const [duzTelefon, setDuzTelefon] = useState('')
  const [duzAdres, setDuzAdres] = useState('')
  const [duzKategori, setDuzKategori] = useState('')

  const [yeniNot, setYeniNot] = useState('')
  const [duzenlenenNotId, setDuzenlenenNotId] = useState(null)
  const [duzenlenenNotMetni, setDuzenlenenNotMetni] = useState('')
  const [yeniTaseronAcik, setYeniTaseronAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSifat, setYeniSifat] = useState('')
  const [yeniFirma, setYeniFirma] = useState('')
  const [yeniTelefon, setYeniTelefon] = useState('')
  const [yeniAdres, setYeniAdres] = useState('')
  const [yeniKategori, setYeniKategori] = useState('')
  const [acikMenuId, setAcikMenuId] = useState(null)

  // --- HİZMET KATEGORİSİ OTOMATİK TAMAMLAMA & ÖNERİ STATE'LERİ ---
  const [yeniSifatOneriAcik, setYeniSifatOneriAcik] = useState(false)
  const [duzSifatOneriAcik, setDuzSifatOneriAcik] = useState(false)

  // --- BİLGİ KARTI FORM STATE'LERİ ---
  const [hkDonem, setHkDonem] = useState('')
  const [hkTutar, setHkTutar] = useState('')
  const [hkKesinti, setHkKesinti] = useState('')
  const [hkAciklama, setHkAciklama] = useState('')

  // --- DÜZENLEME STATE'LERİ ---
  const [duzenlenenHakedisId, setDuzenlenenHakedisId] = useState(null)
  const [duzHkDonem, setDuzHkDonem] = useState('')
  const [duzHkTutar, setDuzHkTutar] = useState('')
  const [duzHkKesinti, setDuzHkKesinti] = useState('')
  const [duzHkAciklama, setDuzHkAciklama] = useState('')

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*')
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data, error: taseronHata } = await query
    if (taseronHata) { alert('Taşeronlar yüklenemedi: ' + taseronHata.message); return }
    setTaseronlar(data || [])

    const { data: iliskiler, error: iliskiHata } = await supabase.from('taseron_santiyeler').select('id, taseron_id, santiye_id')
    if (iliskiHata) { alert('Şantiye ilişkileri yüklenemedi: ' + iliskiHata.message); return }
    const harita = {}
      ; (iliskiler || []).forEach((r) => {
        if (!harita[r.taseron_id]) harita[r.taseron_id] = []
        harita[r.taseron_id].push(r.santiye_id)
      })
    setTaseronSantiyeHaritasi(harita)
  }

  // MEVCUT HİZMET KATEGORİLERİNİN DERLENMESİ (Autocomplete & Hızlı Seçim)
  const mevcutHizmetKategorileri = useMemo(() => {
    const set = new Set()
    taseronlar.forEach(t => {
      const s = t.sifat?.trim()
      if (s) set.add(s)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR'))
  }, [taseronlar])

  const kategoriKullanimSayilari = useMemo(() => {
    const sayac = {}
    taseronlar.forEach(t => {
      const s = t.sifat?.trim()
      if (s) {
        sayac[s] = (sayac[s] || 0) + 1
      }
    })
    return sayac
  }, [taseronlar])

  const yeniSifatOnerileri = useMemo(() => {
    if (!yeniSifat.trim()) return mevcutHizmetKategorileri.slice(0, 10)
    const q = yeniSifat.trim().toLocaleLowerCase('tr-TR')
    return mevcutHizmetKategorileri.filter(k => k.toLocaleLowerCase('tr-TR').includes(q))
  }, [yeniSifat, mevcutHizmetKategorileri])

  const duzSifatOnerileri = useMemo(() => {
    if (!duzSifat.trim()) return mevcutHizmetKategorileri.slice(0, 10)
    const q = duzSifat.trim().toLocaleLowerCase('tr-TR')
    return mevcutHizmetKategorileri.filter(k => k.toLocaleLowerCase('tr-TR').includes(q))
  }, [duzSifat, mevcutHizmetKategorileri])

  const gorunurlukDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ sef_gorunur: !mevcutDurum })
      .eq('id', id)

    if (error) {
      alert('Hata oluştu: ' + error.message)
    } else {
      taseronlariYukle()
    }
  }

  const puantajGorunurlukDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ puantajda_goster: !mevcutDurum })
      .eq('id', id)

    if (error) {
      alert('Hata oluştu: ' + error.message)
    } else {
      taseronlariYukle()
    }
  }

  const ikincilDurumDegistir = async (id, mevcutDurum, e) => {
    e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase
      .from('taseronlar')
      .update({ ikincil: !mevcutDurum })
      .eq('id', id)

    if (error) {
      alert('Hata oluştu: ' + error.message)
    } else {
      taseronlariYukle()
    }
  }

  const taseronSil = async (id, e) => {
    e.stopPropagation()
    if (!yonetici) return

    const { data: hk } = await supabase.from('hakedisler').select('id').eq('taseron_id', id).limit(1)
    const { data: ms } = await supabase.from('masraflar').select('id').eq('cari_id', id).limit(1)
    const { data: ck } = await supabase.from('cekler').select('id').eq('cari_id', id).limit(1)
    const { data: gl } = await supabase.from('gelirler').select('id').eq('cari_id', id).limit(1)

    const hasFinans = (hk && hk.length > 0) || (ms && ms.length > 0) || (ck && ck.length > 0) || (gl && gl.length > 0)

    if (hasFinans) {
      const uretilenKod = Math.random().toString(36).substring(2, 14).toUpperCase()
      const girilen = window.prompt(`DİKKAT: Bu cariye ait finansal akış veya bilgi kartı bulunuyor.\nSilmek istiyorsanız aşağıdaki teyit kodunu yazın:\n\n${uretilenKod}`)
      
      if (girilen !== uretilenKod) {
        alert('Girdiğiniz kod hatalı veya işlem iptal edildi.')
        return
      }
    } else {
      if (!window.confirm('Bu cari hesabı, bağlı tüm puantaj kayıtlarını, çalışanları ve şantiye atamalarını silmek istediğinize emin misiniz?')) return
    }

    try {
      // 1. Puantaj ve çalışan bağımlılıklarını temizle (Foreign key hatasını önler)
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('taseron_id', id)
      await supabase.from('puantaj_kayitlari').delete().eq('taseron_id', id)
      await supabase.from('taseron_calisanlari').delete().eq('taseron_id', id)

      // 2. Şantiye atamaları ve notları temizle
      await supabase.from('taseron_santiyeler').delete().eq('taseron_id', id)
      await supabase.from('taseron_notlari').delete().eq('taseron_id', id)

      // 3. Varsa hakediş ve finansal ilişkileri temizle
      if (hasFinans) {
        await supabase.from('hakedisler').delete().eq('taseron_id', id)
        await supabase.from('masraflar').update({ cari_id: null }).eq('cari_id', id)
        await supabase.from('cekler').update({ cari_id: null }).eq('cari_id', id)
        await supabase.from('gelirler').update({ cari_id: null }).eq('cari_id', id)
      }

      // 4. Ana cari kaydını sil
      const { error } = await supabase.from('taseronlar').delete().eq('id', id)
      if (error) {
        alert('Silme başarısız: ' + error.message)
      } else {
        taseronlariYukle()
        if (seciliId === id) setSeciliId(null)
      }
    } catch (err) {
      alert('Silme işlemi sırasında hata oluştu: ' + (err.message || err))
    }
  }

  const detayYukle = async (id) => {
    setSeciliId(id)
    setDuzenleModu(false)
    setDuzenlenenHakedisId(null)
    setDuzSifatOneriAcik(false)

    const taseron = taseronlar.find((t) => t.id === id)
    if (taseron) {
      setDuzAd(taseron.ad); setDuzSifat(taseron.sifat || ''); setDuzFirma(taseron.firma || '')
      setDuzTelefon(taseron.telefon || ''); setDuzAdres(taseron.adres || ''); setDuzKategori(taseron.kategori || '')
    }

    const { data: notData, error: notHata } = await supabase
      .from('taseron_notlari').select('*, profiles(ad_soyad)').eq('taseron_id', id).order('created_at', { ascending: false })
    if (notHata) console.error('Notlar yüklenemedi:', notHata.message)
    setNotlar(notData || [])

    const { data: santiyeData, error: santiyeHata } = await supabase.from('taseron_santiyeler').select('id, santiye_id').eq('taseron_id', id)
    if (santiyeHata) { alert('Şantiye ilişkileri yüklenemedi: ' + santiyeHata.message); return }
    setIliskiliSantiyeler(santiyeData || [])

    const { data: masrafData } = await supabase
      .from('masraflar')
      .select('*, santiyeler(ad), masraf_kategorileri(ad)')
      .eq('cari_id', id)
      .order('harcama_tarihi', { ascending: false })
    setMasraflar(masrafData || [])

    const { data: cekData } = await supabase
      .from('cekler')
      .select('*, santiyeler(ad)')
      .eq('cari_id', id)
    setCekler(cekData || [])

    const { data: gelirData } = await supabase
      .from('gelirler')
      .select('*, santiyeler(ad)')
      .eq('cari_id', id)
      .order('tarih', { ascending: false })
    setGelirler(gelirData || [])

    const { data: hkData } = await supabase
      .from('hakedisler')
      .select('*')
      .eq('taseron_id', id)
      .order('created_at', { ascending: false })
    setHakedisler(hkData || [])
  }

  const taseronEkle = async () => {
    if (!yeniAd.trim()) return
    const { data, error } = await supabase
      .from('taseronlar')
      .insert({ ad: yeniAd, sifat: yeniSifat, firma: yeniFirma, telefon: yeniTelefon, adres: yeniAdres, kategori: yeniKategori, sef_gorunur: true, puantajda_goster: true })
      .select().single()
    if (error) { alert('Taşeron eklenemedi: ' + error.message); return }
    if (data) {
      setYeniAd(''); setYeniSifat(''); setYeniFirma(''); setYeniTelefon(''); setYeniAdres(''); setYeniKategori('')
      setYeniTaseronAcik(false)
      taseronlariYukle()
    }
  }

  const taseronGuncelle = async () => {
    if (!duzAd.trim()) return
    const { error } = await supabase.from('taseronlar').update({
      ad: duzAd, sifat: duzSifat, firma: duzFirma, telefon: duzTelefon, adres: duzAdres, kategori: duzKategori
    }).eq('id', seciliId)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenleModu(false)
    taseronlariYukle()
  }

  // TEK TIKLA ŞANTİYE ATAMA / KALDIRMA (Checkbox toggle)
  const handleSantiyeToggle = async (santiyeId) => {
    if (!seciliId) return
    const mevcutIliski = iliskiliSantiyeler.find((r) => r.santiye_id === santiyeId)
    if (mevcutIliski) {
      // Şantiyeden çıkar
      setIliskiliSantiyeler(prev => prev.filter(r => r.id !== mevcutIliski.id))
      setTaseronSantiyeHaritasi(prev => {
        const yeni = { ...prev }
        if (yeni[seciliId]) {
          yeni[seciliId] = yeni[seciliId].filter(sid => sid !== santiyeId)
        }
        return yeni
      })
      const { error } = await supabase.from('taseron_santiyeler').delete().eq('id', mevcutIliski.id)
      if (error) {
        alert('Şantiye ilişkisi kaldırılamadı: ' + error.message)
        detayYukle(seciliId)
      }
    } else {
      // Şantiyeye dahil et
      const tempId = 'temp-' + Date.now()
      setIliskiliSantiyeler(prev => [...prev, { id: tempId, santiye_id: santiyeId, taseron_id: seciliId }])
      setTaseronSantiyeHaritasi(prev => {
        const yeni = { ...prev }
        if (!yeni[seciliId]) yeni[seciliId] = []
        if (!yeni[seciliId].includes(santiyeId)) {
          yeni[seciliId] = [...yeni[seciliId], santiyeId]
        }
        return yeni
      })
      const { data, error } = await supabase.from('taseron_santiyeler').insert({ taseron_id: seciliId, santiye_id: santiyeId }).select().single()
      if (error) {
        alert('Şantiye eklenemedi: ' + error.message)
        detayYukle(seciliId)
      } else if (data) {
        setIliskiliSantiyeler(prev => prev.map(r => r.id === tempId ? data : r))
      }
    }
  }

  // TEK TIKLA HIZLI HİZMET KATEGORİSİ ATA
  const handleHizliKategoriAta = async (yeniKat) => {
    if (!seciliId || !yeniKat) return
    const { error } = await supabase.from('taseronlar').update({ sifat: yeniKat }).eq('id', seciliId)
    if (error) {
      alert('Hizmet kategorisi atanamadı: ' + error.message)
      return
    }
    setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, sifat: yeniKat } : t))
    setDuzSifat(yeniKat)
  }

  const notEkle = async () => {
    if (!yeniNot.trim()) return
    await supabase.from('taseron_notlari').insert({ taseron_id: seciliId, icerik: yeniNot, ekleyen: profile?.id })
    setYeniNot('')
    detayYukle(seciliId)
  }

  const notGuncelle = async (notId) => {
    if (!duzenlenenNotMetni.trim()) return
    const { error } = await supabase.from('taseron_notlari').update({ icerik: duzenlenenNotMetni }).eq('id', notId)
    if (error) { alert('Not güncellenemedi: ' + error.message); return }
    setDuzenlenenNotId(null)
    detayYukle(seciliId)
  }

  const notSil = async (notId) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('taseron_notlari').delete().eq('id', notId)
    if (error) { alert('Not silinemedi: ' + error.message); return }
    detayYukle(seciliId)
  }

  const hakedisEkle = async () => {
    if (!hkDonem.trim() || !hkTutar) return
    const { error } = await supabase.from('hakedisler').insert({
      taseron_id: seciliId,
      donem: hkDonem,
      tutar: Number(hkTutar),
      kesinti_avans: Number(hkKesinti) || 0,
      aciklama: hkAciklama,
      ekleyen: profile?.id,
    })
    if (error) { alert('Bilgi kartı eklenemedi: ' + error.message); return }
    setHkDonem(''); setHkTutar(''); setHkKesinti(''); setHkAciklama('')
    detayYukle(seciliId)
  }

  const hakedisGuncelle = async (hakedisId) => {
    if (!duzHkDonem.trim() || !duzHkTutar) return
    const { error } = await supabase.from('hakedisler').update({
      donem: duzHkDonem,
      tutar: Number(duzHkTutar),
      kesinti_avans: Number(duzHkKesinti) || 0,
      aciklama: duzHkAciklama,
    }).eq('id', hakedisId)

    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenHakedisId(null)
    detayYukle(seciliId)
  }

  const hakedisSil = async (hakedisId) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('hakedisler').delete().eq('id', hakedisId)
    if (error) { alert('Silinemedi: ' + error.message); return }
    detayYukle(seciliId)
  }

  const hakedisPaylas = (h) => {
    const netTutar = Number(h.tutar) - Number(h.kesinti_avans || 0)
    const metin =
      `📋 *BİLGİ KARTI: ${h.donem}*\n` +
      `*Taşeron/Cari* : ${seciliTaseron?.ad || '—'}\n` +
      `*Tutar* : ${paraFormatla(h.tutar)} ₺\n` +
      `*Kesinti/Avans* : -${paraFormatla(h.kesinti_avans || 0)} ₺\n` +
      `*Net Tutar* : ${paraFormatla(netTutar)} ₺\n` +
      `*Açıklama* : ${h.aciklama || '—'}`

    if (navigator.share) {
      try { navigator.share({ text: metin }) } catch { /* kullanıcı iptal etti */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(metin), '_blank')
    }
  }

  const seciliTaseron = taseronlar.find((t) => t.id === seciliId)

  const filtreliListe = taseronlar
    .filter((t) => {
      const aramaMetni = arama.toLowerCase()
      const eslesiyorMu = t.ad.toLowerCase().includes(aramaMetni) || (t.sifat || '').toLowerCase().includes(aramaMetni)
      const santiyeyeUyuyorMu = filtreSantiye === 'hepsi' || (taseronSantiyeHaritasi[t.id] || []).includes(filtreSantiye)
      return eslesiyorMu && santiyeyeUyuyorMu
    })
    .sort((a, b) => siralama === 'alfabetik' ? a.ad.localeCompare(b.ad) : new Date(b.created_at) - new Date(a.created_at))

  const eklenebilirSantiyeler = santiyeler.filter((s) => !iliskiliSantiyeler.find((r) => r.santiye_id === s.id))

  // ---- KRONOLOJİK TİMELİNE SIRALAMASI ----
  const timelineOlaylari = [
    ...hakedisler.map((h) => ({
      tip: 'hakedis',
      sortKey: new Date(h.created_at || Date.now()).getTime(),
      veri: h,
    })),
    ...masraflar.map((m) => ({
      tip: 'masraf',
      sortKey: new Date(m.kayit_tarihi || m.harcama_tarihi || Date.now()).getTime(),
      veri: m,
    })),
    ...cekler.map((c) => ({
      tip: 'cek',
      sortKey: new Date(c.created_at || c.vade_tarihi || Date.now()).getTime(),
      veri: c,
    })),
    ...gelirler.map((g) => ({
      tip: 'gelir',
      sortKey: new Date(g.tarih || g.created_at || Date.now()).getTime(),
      veri: g,
    })),
  ].sort((a, b) => b.sortKey - a.sortKey)

  // ---- DETAY GÖRÜNÜMÜ ----
  if (seciliId && seciliTaseron) {
    return (
      <div className="sayfa">
        <button 
          onClick={() => setSeciliId(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, cursor: 'pointer', color: '#555', fontWeight: 600, fontSize: 13, marginBottom: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Listeye Dön
        </button>

        <div style={{ background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', border: '1px solid rgba(0,0,0,0.03)', borderRadius: 16, padding: '16px', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1D9596, #117575)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0, boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}>
            {seciliTaseron.ad.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#333', letterSpacing: '-0.3px' }}>{seciliTaseron.ad}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {seciliTaseron.sifat ? (
                <span style={{ padding: '3px 10px', background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1', borderRadius: 8, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  🏷️ {seciliTaseron.sifat}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                  Hizmet kategorisi henüz eklenmemiş
                </span>
              )}
              {seciliTaseron.firma && (
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  · {seciliTaseron.firma}
                </span>
              )}
              {seciliTaseron.kategori && (
                <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                  {seciliTaseron.kategori}
                </span>
              )}
            </div>

            {/* HİZMET KATEGORİSİ EKLENMEMİŞSE HIZLI TEK TIKLA ATAMA PANELİ */}
            {!seciliTaseron.sifat && mevcutHizmetKategorileri.length > 0 && yonetici && !duzenleModu && (
              <div style={{ marginTop: 10, background: '#fefce8', padding: '10px 12px', borderRadius: 10, border: '1px dashed #fde047' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#854d0e', display: 'block', marginBottom: 6 }}>
                  ⚡ Mevcut Hizmet Kategorilerinden Hızlıca Ata:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mevcutHizmetKategorileri.map((kat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleHizliKategoriAta(kat)}
                      style={{
                        padding: '4px 10px',
                        background: '#ffffff',
                        border: '1px solid #fde047',
                        borderRadius: 8,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: '#a16207',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                      title={`Bu cariye "${kat}" kategorisini ata`}
                    >
                      + {kat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDuzenleModu(true)}
                    style={{
                      padding: '4px 10px',
                      background: '#fffbeb',
                      border: '1px dashed #d97706',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#b45309',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Yeni Kategori Yaz
                  </button>
                </div>
              </div>
            )}
          </div>
          {yonetici && !duzenleModu && (
            <button 
              onClick={() => setDuzenleModu(true)} 
              aria-label="Düzenle"
              style={{ padding: '8px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, cursor: 'pointer', color: '#1D9596', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
          )}
        </div>

        {duzenleModu ? (
          <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Ad Soyad" value={duzAd} onChange={(e) => setDuzAd(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
                <select value={duzKategori} onChange={(e) => setDuzKategori(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  <option value="" disabled>Kategori Seçin</option>
                  <option value="Ortaklar">Ortaklar</option>
                  <option value="Taşeronlar">Taşeronlar</option>
                  <option value="Tedarikçiler">Tedarikçiler</option>
                  <option value="Kurumlar">Kurumlar</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              {/* HİZMET KATEGORİSİ INPUTU & AUTOCOMPLETE */}
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Hizmet Kategorisi (örn. Asansör, Kalıp, Elektrik...)" 
                  value={duzSifat} 
                  onChange={(e) => {
                    setDuzSifat(e.target.value)
                    setDuzSifatOneriAcik(true)
                  }}
                  onFocus={() => setDuzSifatOneriAcik(true)}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} 
                />

                {/* Autocomplete Açılır Menüsü */}
                {duzSifatOneriAcik && duzSifatOnerileri.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    border: '1px solid #e2e8f0',
                    zIndex: 50,
                    maxHeight: 180,
                    overflowY: 'auto',
                    marginTop: 4,
                    padding: 4
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase' }}>
                      Önerilen Hizmet Kategorileri
                    </div>
                    {duzSifatOnerileri.map((kat, idx) => (
                      <div
                        key={idx}
                        onMouseDown={() => {
                          setDuzSifat(kat)
                          setDuzSifatOneriAcik(false)
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: duzSifat.toLowerCase() === kat.toLowerCase() ? '#f0fdfa' : 'transparent',
                          color: duzSifat.toLowerCase() === kat.toLowerCase() ? '#0f766e' : '#334155'
                        }}
                      >
                        <span>🏷️ {kat}</span>
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                          {kategoriKullanimSayilari[kat] ? `${kategoriKullanimSayilari[kat]} cari` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hızlı Kategori Seçim Hapları */}
              {mevcutHizmetKategorileri.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Kayıtlı Kategoriler:</span>
                  {mevcutHizmetKategorileri.slice(0, 10).map((kat, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDuzSifat(kat)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: duzSifat === kat ? '1.5px solid #1D9596' : '1px solid #e2e8f0',
                        background: duzSifat === kat ? '#f0fdfa' : '#fff',
                        color: duzSifat === kat ? '#0f766e' : '#475569',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {kat}
                    </button>
                  ))}
                </div>
              )}

              <input type="text" placeholder="Firma" value={duzFirma} onChange={(e) => setDuzFirma(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
              <input type="text" placeholder="Telefon" value={duzTelefon} onChange={(e) => setDuzTelefon(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
              <input type="text" placeholder="Adres" value={duzAdres} onChange={(e) => setDuzAdres(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDuzenleModu(false)} style={{ flex: 1, padding: '10px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 10, color: '#555', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>Vazgeç</button>
                <button onClick={taseronGuncelle} style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}>Kaydet</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8f7f2', padding: 16, borderRadius: 16, boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.03)', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: 13, color: '#888780', fontWeight: 600 }}>Telefon</span>
              {seciliTaseron.telefon ? (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a href={`tel:${seciliTaseron.telefon}`} style={{ color: '#0F6E56', fontWeight: 600, fontSize: 14 }}>{seciliTaseron.telefon}</a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(seciliTaseron.telefon); alert('Telefon numarası kopyalandı.') }}
                    aria-label="Telefonu kopyala"
                    style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, cursor: 'pointer', color: '#1D9596', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </span>
              ) : <span style={{ fontSize: 14, color: '#444' }}>—</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
              <span style={{ fontSize: 13, color: '#888780', fontWeight: 600 }}>Adres</span>
              <span style={{ fontSize: 14, color: '#444', textAlign: 'right', flex: 1, marginLeft: 16 }}>{seciliTaseron.adres || '—'}</span>
            </div>
          </div>
        )}

        {/* TANIMLI ŞANTİYELER CHECKBOX IZGARASI (HIZLI SEÇİM) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
              🏗️ Tanımlı Şantiyeler ({iliskiliSantiyeler.length} / {santiyeler.length})
            </p>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
              Hızlı atama için kutucuklara tıklayın
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8
          }}>
            {santiyeler.map((s) => {
              const secili = iliskiliSantiyeler.some((r) => r.santiye_id === s.id)
              return (
                <label
                  key={s.id}
                  onClick={(e) => {
                    e.preventDefault()
                    handleSantiyeToggle(s.id)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: secili ? '2px solid #1D9596' : '1px solid #CBD5E1',
                    background: secili ? '#F0FDFA' : '#FFFFFF',
                    color: secili ? '#0F766E' : '#334155',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                    boxShadow: secili ? '0 2px 6px rgba(29, 149, 150, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={secili}
                    onChange={() => {}}
                    style={{
                      width: 18,
                      height: 18,
                      accentColor: '#1D9596',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  <span style={{
                    fontSize: 13,
                    fontWeight: secili ? 800 : 600,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {s.ad}
                  </span>
                  {secili && (
                    <span style={{ fontSize: 10, background: '#CCFBF1', color: '#0F766E', padding: '1px 6px', borderRadius: 4, fontWeight: 800, flexShrink: 0 }}>
                      ✓ Tanımlı
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#333' }}>Notlar</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {notlar.map((n) => (
            <div key={n.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
              {duzenlenenNotId === n.id ? (
                <>
                  <input
                    type="text"
                    value={duzenlenenNotMetni}
                    onChange={(e) => setDuzenlenenNotMetni(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && notGuncelle(n.id)}
                    autoFocus
                    style={{ width: '100%', marginBottom: 8, padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', fontSize: 13, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setDuzenlenenNotId(null)} style={{ flex: 1, padding: '8px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, color: '#555', fontWeight: 600, cursor: 'pointer' }}>Vazgeç</button>
                    <button onClick={() => notGuncelle(n.id)} style={{ flex: 2, padding: '8px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#444', lineHeight: 1.4, flex: 1 }}>{n.icerik}</p>
                    {yonetici && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => { setDuzenlenenNotId(n.id); setDuzenlenenNotMetni(n.icerik) }} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1D9596', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} title="Düzenle">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button onClick={() => notSil(n.id)} style={{ background: '#fff', border: '1px solid rgba(214, 69, 69, 0.2)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#D64545', boxShadow: '0 2px 4px rgba(214, 69, 69, 0.05)' }} title="Sil">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <span style={{ display: 'block', marginTop: 8, fontSize: 10, color: '#888780', fontWeight: 500 }}>
                    {n.profiles?.ad_soyad || 'Bilinmiyor'} · {new Date(n.created_at).toLocaleDateString('tr-TR')} {new Date(n.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          ))}
          {notlar.length === 0 && <p className="bos-mesaj">Henüz not yok.</p>}
        </div>
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 8, padding: 12 }}>
          <input type="text" placeholder="Yeni not yaz..." value={yeniNot} onChange={(e) => setYeniNot(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)', fontSize: 13, outline: 'none' }} />
          <button onClick={notEkle} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}>Ekle</button>
        </div>

        <p style={{ margin: '24px 0 10px', fontSize: 15, fontWeight: 700, color: '#333' }}>Finansal Akış & Bilgi Kartları</p>

        {!yonetici && (
          <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
            <span style={{ display: 'flex', color: '#ffb300' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </span>
            <p style={{ margin: 0, fontSize: 13, color: '#555', fontWeight: 500 }}>Finansal bilgiler sadece yöneticiler tarafından görülebilir.</p>
          </div>
        )}

        {yonetici && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {timelineOlaylari.map((olay, index) => {
                if (olay.tip === 'hakedis') {
                  const h = olay.veri
                  const duzenlekte = duzenlenenHakedisId === h.id
                  const netTutar = Number(h.tutar) - Number(h.kesinti_avans || 0)

                  const isPozitif = netTutar > 0
                  const hakedisKenarRengi = isPozitif ? '#DC2626' : '#059669' 
                  const hakedisGölge = isPozitif ? 'rgba(220, 38, 38, 0.08)' : 'rgba(5, 150, 105, 0.08)'

                  return (
                    <div
                      key={`hk-${h.id || index}`}
                      style={{
                        background: '#fff',
                        borderLeft: `5px solid ${hakedisKenarRengi}`,
                        borderRadius: '0 12px 12px 0',
                        padding: '14px',
                        boxShadow: `0 4px 12px ${hakedisGölge}, inset 0 2px 4px rgba(255,255,255,0.8)`,
                        borderTop: '1px solid rgba(0,0,0,0.03)',
                        borderRight: '1px solid rgba(0,0,0,0.03)',
                        borderBottom: '1px solid rgba(0,0,0,0.03)',
                      }}
                    >
                      {duzenlekte ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input type="text" placeholder="Başlık" value={duzHkDonem} onChange={(e) => setDuzHkDonem(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input type="number" placeholder="Tutar" value={duzHkTutar} onChange={(e) => setDuzHkTutar(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                            <input type="number" placeholder="Kesinti/Avans" value={duzHkKesinti} onChange={(e) => setDuzHkKesinti(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                          </div>
                          <input type="text" placeholder="Açıklama" value={duzHkAciklama} onChange={(e) => setDuzHkAciklama(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <button onClick={() => setDuzenlenenHakedisId(null)} style={{ flex: 1, padding: '8px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8, color: '#555', fontWeight: 600, cursor: 'pointer' }}>Vazgeç</button>
                            <button onClick={() => hakedisGuncelle(h.id)} style={{ flex: 2, padding: '8px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888780', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {new Date(h.created_at).toLocaleDateString('tr-TR')} · Hakediş
                          </p>
                          <span style={{ color: hakedisKenarRengi, fontWeight: 700, fontSize: 15 }}>
                            {paraFormatla(netTutar)} ₺
                          </span>
                          {h.aciklama && <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#555', fontStyle: 'italic' }}>{h.aciklama}</p>}
                        </>
                      )}
                    </div>
                  )
                }

                if (olay.tip === 'cek' || olay.tip === 'gelir' || olay.tip === 'masraf') {
                  const m = olay.veri
                  
                  let baslik = ''
                  let belge = m.belge_url || m.cek_foto
                  let tutarGosterim = paraFormatla(Math.abs(m.tutar))
                  let tipRengi = '#333'
                  let tipGölge = 'rgba(0,0,0,0.05)'
                  let isaret = ''
                  let ekstraMetin = ''
                  
                  if (olay.tip === 'masraf') {
                    baslik = `Ödeme / Masraf: ${m.baslik || 'Ödeme'}`
                    tipRengi = '#059669' // Yeşil
                    tipGölge = 'rgba(5, 150, 105, 0.08)'
                    isaret = '+'
                  } else if (olay.tip === 'cek') {
                    baslik = `Çek Girdisi (${m.odeme_konusu || 'Çek'})`
                    tipRengi = '#059669' // Yeşil
                    tipGölge = 'rgba(5, 150, 105, 0.08)'
                    isaret = '+'
                  } else if (olay.tip === 'gelir') {
                    baslik = `Yatırım / Gelir: ${m.odeme_yapan_adi || 'Ortak'}`
                    tipRengi = '#3B82F6' // Mavi
                    tipGölge = 'rgba(59, 130, 246, 0.08)'
                    isaret = '-'
                    ekstraMetin = ' (Firmaya Nakit Girişi)'
                  }

                  return (
                    <div key={`${olay.tip}-${m.id}`} style={{ background: '#fff', borderLeft: `5px solid ${tipRengi}`, borderRadius: '0 12px 12px 0', padding: '14px', boxShadow: `0 4px 12px ${tipGölge}, inset 0 2px 4px rgba(255,255,255,0.8)`, borderTop: '1px solid rgba(0,0,0,0.03)', borderRight: '1px solid rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888780', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {new Date(olay.sortKey).toLocaleDateString('tr-TR')} · {baslik}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: tipRengi }}>
                        {isaret}{tutarGosterim} ₺<span style={{ fontSize: 12, fontWeight: 500, color: '#666' }}>{ekstraMetin}</span>
                      </p>
                      {m.santiye_id && <span style={{ display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#f0efeb', color: '#555', fontWeight: 600, border: '1px solid rgba(0,0,0,0.03)' }}>{m.santiyeler?.ad || 'Şantiye'}</span>}
                      {m.masraf_kategorileri?.ad && <span style={{ display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#e0f2fe', color: '#0369a1', fontWeight: 600, border: '1px solid rgba(3, 105, 161, 0.1)', marginLeft: 6 }}>{m.masraf_kategorileri.ad}</span>}
                      {olay.tip === 'cek' && <span style={{ display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#b45309', fontWeight: 600, border: '1px solid rgba(180, 83, 9, 0.1)', marginLeft: 6 }}>{m.banka} / {m.cek_seri_no}</span>}
                      
                      {m.not_metni && <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#555', fontStyle: 'italic' }}>{m.not_metni}</p>}
                      {m.aciklama && <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#555', fontStyle: 'italic' }}>{m.aciklama}</p>}
                      {belge && (
                        <a href={belge} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: '#3B82F6', fontWeight: 600, textDecoration: 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          Belgeyi Gör
                        </a>
                      )}
                    </div>
                  )
                }
              })}
              {timelineOlaylari.length === 0 && <p className="bos-mesaj">Henüz finansal hareket kaydı yok.</p>}
            </div>

            <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#333' }}>Yeni Bilgi Kartı Ekle</p>
                <input type="text" placeholder="Başlık (örn. Temel İşçiliği Anlaşması)" value={hkDonem} onChange={(e) => setHkDonem(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="Tutar (₺)" value={hkTutar} onChange={(e) => setHkTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
                  <input type="number" placeholder="Kesinti/Avans (₺)" value={hkKesinti} onChange={(e) => setHkKesinti(e.target.value)} onKeyDown={sadeceSayiTuslari} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
                </div>
                <input type="text" placeholder="Açıklama (opsiyonel)" value={hkAciklama} onChange={(e) => setHkAciklama(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', fontSize: 13, outline: 'none' }} />
                <button 
                  onClick={hakedisEkle}
                  style={{ padding: '12px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', marginTop: 4 }}
                >
                  Bilgi kartı kaydı ekle
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }


  const KATEGORILER = [
    { id: 'tumu', ad: 'Tümü' },
    { id: 'ortaklar', ad: 'Ortaklar' },
    { id: 'taseronlar', ad: 'Taşeronlar' },
    { id: 'tedarikciler', ad: 'Tedarikçiler' },
    { id: 'kurumlar', ad: 'Kurumlar' },
    { id: 'diger', ad: 'Diğer' },
    { id: 'ikincil', ad: 'İkincil / Arşiv' }
  ]

  const ORTAKLAR_ISIMLERI = ['Fuat Hazar', 'Fırat Tekstil Diyarbakır', 'Abdullah Tufan']

  let gosterilenCariler = filtreliListe;
  if (aktifSekme === 'ikincil') {
    gosterilenCariler = filtreliListe.filter(t => t.ikincil)
  } else {
    const anaListe = filtreliListe.filter(t => !t.ikincil)
    if (aktifSekme === 'tumu') {
      gosterilenCariler = anaListe
    } else if (aktifSekme === 'ortaklar') {
      gosterilenCariler = anaListe.filter(t => t.kategori === 'Ortaklar' || (!t.kategori && ORTAKLAR_ISIMLERI.includes(t.ad)))
    } else if (aktifSekme === 'diger') {
      gosterilenCariler = anaListe.filter(t => t.kategori === 'Diğer')
    } else {
      const secilenKategori = KATEGORILER.find(k => k.id === aktifSekme)?.ad;
      gosterilenCariler = anaListe.filter(t => t.kategori === secilenKategori)
    }
  }

  const renderCariCard = (t) => (
    <div key={t.id} onClick={() => detayYukle(t.id)} style={{ background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', border: '1px solid rgba(0,0,0,0.03)', borderRadius: 16, padding: '12px 14px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03), inset 0 2px 4px rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #1D9596, #117575)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0, boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)' }}>
          {t.ad.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#333', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span>{t.ad}</span>
            {t.sifat ? (
              <span style={{ background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1', padding: '1px 6px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                🏷️ {t.sifat}
              </span>
            ) : null}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {(taseronSantiyeHaritasi[t.id] || []).map((sid) => santiyeler.find((s) => s.id === sid)?.ad).filter(Boolean).join(', ') || 'Şantiye ataması yok'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, flexShrink: 0 }}>
        {yonetici && (
          <>

            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setAcikMenuId(acikMenuId === t.id ? null : t.id); }} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
              </button>
              
              {acikMenuId === t.id && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)', zIndex: 100, minWidth: 160, display: 'flex', flexDirection: 'column', padding: 6, gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, cursor: 'pointer', background: '#f8f7f2', border: '1px solid rgba(0,0,0,0.04)' }}>
                    <input type="checkbox" checked={t.sef_gorunur || false} onChange={(e) => gorunurlukDegistir(t.id, t.sef_gorunur, e)} style={{ accentColor: '#1D9596' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Şef Görsün</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, cursor: 'pointer', background: '#f0fdf4', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
                    <input type="checkbox" checked={t.puantajda_goster !== false} onChange={(e) => puantajGorunurlukDegistir(t.id, t.puantajda_goster !== false, e)} style={{ accentColor: '#16a34a' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Puantaj</span>
                  </label>
                  <button onClick={(e) => { ikincilDurumDegistir(t.id, t.ikincil, e); setAcikMenuId(null); }} style={{ background: 'transparent', border: 'none', padding: '8px', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    {t.ikincil ? "Ana Listeye Al" : "Arşive Al"}
                  </button>
                  <button onClick={(e) => { taseronSil(t.id, e); setAcikMenuId(null); }} style={{ background: 'transparent', border: 'none', padding: '8px', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#D64545', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Sil
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        <span style={{ color: '#aaa', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      </div>
    </div>
  )

  // ---- LİSTE GÖRÜNÜMÜ ----
  return (
    <div className="sayfa" onClick={() => { setAcikMenuId(null); setYeniSifatOneriAcik(false); setDuzSifatOneriAcik(false); }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#1D9596', letterSpacing: '-0.2px' }}>Cari Hesaplar (Rehber)</h2>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input 
          type="text" 
          placeholder="Taşeron veya cari hesap ara (örn. Ad veya Hizmet Kategorisi)..." 
          value={arama} 
          onChange={(e) => setArama(e.target.value)} 
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.04)', fontSize: 13, outline: 'none' }}
        />
      </div>

      <div className="ekleme-kutusu" style={{ marginBottom: 16, border: '1px solid rgba(36, 184, 185, 0.2)', boxShadow: '0 4px 12px rgba(29, 149, 150, 0.05)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1D9596' }}>Hızlı Kayıt Ekle</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" placeholder="Ad Soyad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
            <select value={yeniKategori} onChange={(e) => setYeniKategori(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="" disabled>Kategori Seçin</option>
              <option value="Ortaklar">Ortaklar</option>
              <option value="Taşeronlar">Taşeronlar</option>
              <option value="Tedarikçiler">Tedarikçiler</option>
              <option value="Kurumlar">Kurumlar</option>
              <option value="Diğer">Diğer</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="text" placeholder="Firma Adı" value={yeniFirma} onChange={(e) => setYeniFirma(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
            
            {/* HİZMET KATEGORİSİ AUTOCOMPLETE INPUTU */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Hizmet Kategorisi (örn. Asansör, Kalıp, Elektrik)" 
                value={yeniSifat} 
                onChange={(e) => {
                  setYeniSifat(e.target.value)
                  setYeniSifatOneriAcik(true)
                }}
                onFocus={() => setYeniSifatOneriAcik(true)}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} 
              />
              
              {/* Autocomplete Açılır Menüsü */}
              {yeniSifatOneriAcik && yeniSifatOnerileri.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  border: '1px solid #e2e8f0',
                  zIndex: 50,
                  maxHeight: 180,
                  overflowY: 'auto',
                  marginTop: 4,
                  padding: 4
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', padding: '4px 8px', textTransform: 'uppercase' }}>
                    Kayıtlı Hizmet Kategorileri
                  </div>
                  {yeniSifatOnerileri.map((kat, idx) => (
                    <div
                      key={idx}
                      onMouseDown={() => {
                        setYeniSifat(kat)
                        setYeniSifatOneriAcik(false)
                      }}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: yeniSifat.toLowerCase() === kat.toLowerCase() ? '#f0fdfa' : 'transparent',
                        color: yeniSifat.toLowerCase() === kat.toLowerCase() ? '#0f766e' : '#334155'
                      }}
                    >
                      <span>🏷️ {kat}</span>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {kategoriKullanimSayilari[kat] ? `${kategoriKullanimSayilari[kat]} cari` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Hızlı Kategori Seçim Hapları */}
          {mevcutHizmetKategorileri.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: -2, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Örnek Hizmetler:</span>
              {mevcutHizmetKategorileri.slice(0, 10).map((kat, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setYeniSifat(kat)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: yeniSifat === kat ? '1.5px solid #1D9596' : '1px solid #e2e8f0',
                    background: yeniSifat === kat ? '#f0fdfa' : '#fff',
                    color: yeniSifat === kat ? '#0f766e' : '#475569',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {kat}
                </button>
              ))}
            </div>
          )}

          <input type="text" placeholder="Telefon Numarası" value={yeniTelefon} onChange={(e) => setYeniTelefon(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          <input type="text" placeholder="Açık Adres" value={yeniAdres} onChange={(e) => setYeniAdres(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          <button 
            className="ekle-buton-genis" 
            onClick={taseronEkle}
            style={{ padding: '12px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)', marginTop: 4 }}
          >
            Kişiyi Kaydet
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: '14px', borderRadius: 16, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#1D9596', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Şantiye Filtresi
          </label>
          <select 
            value={filtreSantiye} 
            onChange={(e) => setFiltreSantiye(e.target.value)} 
            style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', background: '#fcfcf9', outline: 'none', cursor: 'pointer', color: '#333', fontWeight: 500 }}
          >
            <option value="hepsi">Tüm şantiyeler</option>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {KATEGORILER.map(k => (
          <button 
            key={k.id} 
            onClick={() => setAktifSekme(k.id)} 
            style={{ 
              flex: '1 1 calc(33.33% - 8px)',
              minWidth: '100px',
              padding: '10px 12px', 
              borderRadius: 12, 
              fontWeight: 600, 
              fontSize: 13,
              border: aktifSekme === k.id ? 'none' : '1px solid rgba(0,0,0,0.06)', 
              background: aktifSekme === k.id ? 'linear-gradient(135deg, #1D9596, #117575)' : '#fff',
              color: aktifSekme === k.id ? '#fff' : '#555',
              boxShadow: aktifSekme === k.id ? '0 4px 10px rgba(29, 149, 150, 0.3)' : '0 2px 4px rgba(0,0,0,0.02)',
              cursor: 'pointer', 
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
          >
            {k.ad}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', background: '#f4f3ed', padding: 4, borderRadius: 10, marginBottom: 16, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)' }}>
        <button 
          onClick={() => setSiralama('alfabetik')}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: siralama === 'alfabetik' ? '#fff' : 'transparent', color: siralama === 'alfabetik' ? '#1D9596' : '#5F5E5A', fontWeight: siralama === 'alfabetik' ? 700 : 500, boxShadow: siralama === 'alfabetik' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 12 }}
        >
          Alfabetik
        </button>
        <button 
          onClick={() => setSiralama('tarih')}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: siralama === 'tarih' ? '#fff' : 'transparent', color: siralama === 'tarih' ? '#1D9596' : '#5F5E5A', fontWeight: siralama === 'tarih' ? 700 : 500, boxShadow: siralama === 'tarih' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', transition: 'all 0.2s', fontSize: 12 }}
        >
          Eklenme Tarihi
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gosterilenCariler.map((t) => renderCariCard(t))}
        {gosterilenCariler.length === 0 && <p className="bos-mesaj">Bu kategoride kayıt bulunamadı.</p>}
      </div>
    </div>
  )
}