import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari } from '../lib/format'
import KategoriCokluSecici from '../components/KategoriCokluSecici'
import { parseContacts, serializeContacts, whatsappBaglantisi } from '../lib/contacts'

// --- YARDIMCI: KATEGORİLERİ DİZİ VE VİRGÜLLÜ METİN ARASINDA DÖNÜŞTÜRME ---
function parseKategoriler(sifatStr) {
  if (!sifatStr || typeof sifatStr !== 'string') return []
  const unique = []
  const seen = new Set()
  sifatStr
    .split(/[,/]/)
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(item => {
      const lower = item.toLocaleLowerCase('tr-TR')
      if (!seen.has(lower)) {
        seen.add(lower)
        unique.push(item)
      }
    })
  return unique
}

function serializeKategoriler(kategoriler) {
  if (!Array.isArray(kategoriler)) return ''
  const unique = []
  const seen = new Set()
  kategoriler
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .forEach(item => {
      const lower = item.toLocaleLowerCase('tr-TR')
      if (!seen.has(lower)) {
        seen.add(lower)
        unique.push(item)
      }
    })
  return unique.join(', ')
}

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

  const [arsivGoster, setArsivGoster] = useState(false)

  // --- SERHAT HAZAR YÖNETİM & DÜZENLEME MODU ---
  const [yonetimModu, setYonetimModu] = useState(false)

  // --- GENİŞLETİLMİŞ POP-UP MODAL STATE'LERİ ---
  const [modalAcik, setModalAcik] = useState(false)
  const [modalMod, setModalMod] = useState('ekle') // 'ekle' | 'duzenle'
  const [modalFirmaId, setModalFirmaId] = useState(null)
  const [formFirmaAdi, setFormFirmaAdi] = useState('')
  const [formKategori, setFormKategori] = useState('Taşeronlar')
  const [formKategoriler, setFormKategoriler] = useState([])
  const [formAdres, setFormAdres] = useState('')
  const [formSefGorunur, setFormSefGorunur] = useState(true)
  const [formPuantajdaGoster, setFormPuantajdaGoster] = useState(true)
  const [formSantiyeler, setFormSantiyeler] = useState([])
  const [formKisiler, setFormKisiler] = useState([
    { id: '1', ad: '', rol: 'Firma Sahibi', telefon: '', not: '' }
  ])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  // --- BİLGİ KARTI VE DETAY STATE'LERİ ---
  const [notlar, setNotlar] = useState([])
  const [iliskiliSantiyeler, setIliskiliSantiyeler] = useState([])
  const [hakedisler, setHakedisler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [cekler, setCekler] = useState([])
  const [gelirler, setGelirler] = useState([])

  const [duzenleModu, setDuzenleModu] = useState(false)
  const [duzAd, setDuzAd] = useState('')
  const [duzKategoriler, setDuzKategoriler] = useState([])
  const [duzFirma, setDuzFirma] = useState('')
  const [duzTelefon, setDuzTelefon] = useState('')
  const [duzAdres, setDuzAdres] = useState('')
  const [duzKategori, setDuzKategori] = useState('')

  const [yeniNot, setYeniNot] = useState('')
  const [duzenlenenNotId, setDuzenlenenNotId] = useState(null)
  const [duzenlenenNotMetni, setDuzenlenenNotMetni] = useState('')

  // Finansal Bilgi Kartı form state'leri
  const [hkDonem, setHkDonem] = useState('')
  const [hkTutar, setHkTutar] = useState('')
  const [hkKesinti, setHkKesinti] = useState('')
  const [hkAciklama, setHkAciklama] = useState('')
  const [duzenlenenHakedisId, setDuzenlenenHakedisId] = useState(null)
  const [duzHkDonem, setDuzHkDonem] = useState('')
  const [duzHkTutar, setDuzHkTutar] = useState('')
  const [duzHkKesinti, setDuzHkKesinti] = useState('')
  const [duzHkAciklama, setDuzHkAciklama] = useState('')

  // Hızlı Temsilci Ekleme State'leri (Detay Görünümü İçin)
  const [temsilciModalAcik, setTemsilciModalAcik] = useState(false)
  const [yeniTemsilciAd, setYeniTemsilciAd] = useState('')
  const [yeniTemsilciRol, setYeniTemsilciRol] = useState('Firma Yetkilisi')
  const [yeniTemsilciTel, setYeniTemsilciTel] = useState('')
  const [yeniTemsilciNot, setYeniTemsilciNot] = useState('')

  const temsilciEkleHizli = async () => {
    if (!yeniTemsilciAd.trim() && !yeniTemsilciTel.trim()) {
      alert('Lütfen temsilcinin adını veya telefon numarasını giriniz.')
      return
    }
    const mevcut = parseContacts(seciliTaseron)
    const temizMevcut = mevcut.filter(k => k.telefon || (k.ad && k.ad !== 'Yetkili'))
    const yeniKisi = {
      id: `k-${Date.now()}`,
      ad: yeniTemsilciAd.trim() || seciliTaseron?.ad || 'Temsilci',
      rol: yeniTemsilciRol.trim() || 'Yetkili',
      telefon: yeniTemsilciTel.trim(),
      not: yeniTemsilciNot.trim()
    }
    const yeniListe = [...temizMevcut, yeniKisi]
    const serialized = serializeContacts(yeniListe)
    const { error } = await supabase.from('taseronlar').update({ telefon: serialized }).eq('id', seciliId)
    if (error) {
      alert('Temsilci eklenirken hata: ' + error.message)
      return
    }
    setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, telefon: serialized } : t))
    setYeniTemsilciAd('')
    setYeniTemsilciRol('Firma Yetkilisi')
    setYeniTemsilciTel('')
    setYeniTemsilciNot('')
    setTemsilciModalAcik(false)
  }

  const temsilciSilHizli = async (idx) => {
    if (!window.confirm('Bu iletişim kişisini silmek istediğinize emin misiniz?')) return
    const mevcut = parseContacts(seciliTaseron)
    const yeniListe = mevcut.filter((_, i) => i !== idx)
    const serialized = serializeContacts(yeniListe)
    const { error } = await supabase.from('taseronlar').update({ telefon: serialized }).eq('id', seciliId)
    if (error) {
      alert('Silinirken hata: ' + error.message)
      return
    }
    setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, telefon: serialized } : t))
  }

  useEffect(() => {
    taseronlariYukle()
  }, [])

  const taseronlariYukle = async () => {
    let query = supabase.from('taseronlar').select('*')
    // Şantiye şefleri sadece şef_gorunur olanları görür
    if (!yonetici) {
      query = query.eq('sef_gorunur', true)
    }
    const { data, error: taseronHata } = await query
    if (taseronHata) {
      alert('Taşeronlar yüklenemedi: ' + taseronHata.message)
      return
    }
    setTaseronlar(data || [])

    const { data: iliskiler, error: iliskiHata } = await supabase
      .from('taseron_santiyeler')
      .select('id, taseron_id, santiye_id')
    if (iliskiHata) {
      alert('Şantiye ilişkileri yüklenemedi: ' + iliskiHata.message)
      return
    }
    const harita = {}
    ;(iliskiler || []).forEach((r) => {
      if (!harita[r.taseron_id]) harita[r.taseron_id] = []
      harita[r.taseron_id].push(r.santiye_id)
    })
    setTaseronSantiyeHaritasi(harita)
  }

  // Mevcut Hizmet Kategorileri (Otomatik tamamlama için)
  const mevcutHizmetKategorileri = useMemo(() => {
    const map = new Map()
    taseronlar.forEach(t => {
      parseKategoriler(t.sifat).forEach(kat => {
        const kTr = kat.trim()
        if (kTr) {
          const lower = kTr.toLocaleLowerCase('tr-TR')
          if (!map.has(lower)) {
            map.set(lower, kTr)
          }
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'tr-TR'))
  }, [taseronlar])

  // --- ÇEKİRDEK: FİRMALARI VE ÇALIŞANLARI ARKA PLANDA GRUPLAMA (NESTED ARCHITECTURE) ---
  const firmalarGruplanmis = useMemo(() => {
    const gruplar = {}

    taseronlar.forEach(t => {
      const firmaAdi = (t.firma && t.firma.trim()) ? t.firma.trim() : (t.ad || '').trim()
      if (!firmaAdi) return
      const anahtar = firmaAdi.toLocaleLowerCase('tr-TR')

      if (!gruplar[anahtar]) {
        gruplar[anahtar] = {
          anahtar,
          firmaAdi,
          anaKayit: t,
          kayitlar: [],
          kategori: t.kategori || 'Taşeronlar',
          sifat: t.sifat || '',
          adres: t.adres || '',
          sef_gorunur: t.sef_gorunur,
          puantajda_goster: t.puantajda_goster,
          ikincil: t.ikincil,
          santiyeler: new Set(),
          kisiler: []
        }
      }

      const grup = gruplar[anahtar]
      grup.kayitlar.push(t)

      // Şantiye ilişkilerini topla
      const sIds = taseronSantiyeHaritasi[t.id] || []
      sIds.forEach(sid => grup.santiyeler.add(sid))

      // İletişim kişilerini topla
      const parsed = parseContacts(t)
      parsed.forEach(p => {
        const varMi = grup.kisiler.some(k => k.telefon === p.telefon && k.ad === p.ad)
        if (!varMi && (p.ad || p.telefon)) {
          grup.kisiler.push(p)
        }
      })

      if (t.sef_gorunur) grup.sef_gorunur = true
      if (t.puantajda_goster) grup.puantajda_goster = true
      if (!grup.sifat && t.sifat) grup.sifat = t.sifat
      if (!grup.adres && t.adres) grup.adres = t.adres
    })

    return Object.values(gruplar)
  }, [taseronlar, taseronSantiyeHaritasi])

  // --- FİLTRELENMİŞ FİRMA LİSTESİ ---
  const filtreliFirmalar = useMemo(() => {
    let list = firmalarGruplanmis

    // 1. İkincil / Arşiv Filtresi
    if (arsivGoster) {
      list = list.filter(g => g.ikincil)
    } else {
      list = list.filter(g => !g.ikincil)
    }

    // 2. Şantiye Filtresi
    if (filtreSantiye !== 'hepsi') {
      list = list.filter(g => g.santiyeler.has(filtreSantiye))
    }

    // 3. Arama Filtresi (Firma adı, kişi adı, telefon, hizmet kategorisi / sifat, adres)
    if (arama.trim()) {
      const q = arama.trim().toLocaleLowerCase('tr-TR')
      list = list.filter(g => {
        const adEslesti = g.firmaAdi.toLocaleLowerCase('tr-TR').includes(q)
        const sifatEslesti = (g.sifat || '').toLocaleLowerCase('tr-TR').includes(q)
        const adresEslesti = (g.adres || '').toLocaleLowerCase('tr-TR').includes(q)
        const kisiEslesti = g.kisiler.some(k =>
          (k.ad || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (k.telefon || '').includes(q) ||
          (k.rol || '').toLocaleLowerCase('tr-TR').includes(q)
        )
        return adEslesti || sifatEslesti || adresEslesti || kisiEslesti
      })
    }

    // 4. Sıralama
    return list.sort((a, b) => {
      if (siralama === 'alfabetik') return a.firmaAdi.localeCompare(b.firmaAdi, 'tr-TR')
      return new Date(b.anaKayit.created_at || 0) - new Date(a.anaKayit.created_at || 0)
    })
  }, [firmalarGruplanmis, arsivGoster, filtreSantiye, arama, siralama])

  // --- MODAL İŞLEMLERİ: YENİ KAYIT EKLE VEYA DÜZENLE ---
  const yeniKayitModaliAc = () => {
    setModalMod('ekle')
    setModalFirmaId(null)
    setFormFirmaAdi('')
    setFormKategori('Taşeronlar')
    setFormKategoriler([])
    setFormAdres('')
    setFormSefGorunur(true)
    setFormPuantajdaGoster(true)
    setFormSantiyeler(santiyeler.length > 0 ? [santiyeler[0].id] : [])
    setFormKisiler([
      { id: '1', ad: '', rol: 'Firma Sahibi', telefon: '', not: '' }
    ])
    setModalAcik(true)
  }

  const duzenleModaliAc = (grup, e) => {
    if (e) e.stopPropagation()
    setModalMod('duzenle')
    setModalFirmaId(grup.anaKayit.id)
    setFormFirmaAdi(grup.firmaAdi)
    setFormKategori(grup.kategori || 'Taşeronlar')
    setFormKategoriler(parseKategoriler(grup.sifat))
    setFormAdres(grup.adres || '')
    setFormSefGorunur(grup.sef_gorunur !== false)
    setFormPuantajdaGoster(grup.puantajda_goster !== false)
    setFormSantiyeler(Array.from(grup.santiyeler))
    setFormKisiler(
      grup.kisiler.length > 0
        ? grup.kisiler.map((k, i) => ({ ...k, id: k.id || `k-${i}` }))
        : [{ id: '1', ad: grup.firmaAdi, rol: 'Firma Sahibi', telefon: '', not: '' }]
    )
    setModalAcik(true)
  }

  const formKisiEkle = () => {
    setFormKisiler(prev => [
      ...prev,
      { id: `k-${Date.now()}`, ad: '', rol: 'Usta Başı', telefon: '', not: '' }
    ])
  }

  const formKisiSil = (index) => {
    if (formKisiler.length === 1) {
      alert('En az bir iletişim kişisi kalmalıdır.')
      return
    }
    setFormKisiler(prev => prev.filter((_, i) => i !== index))
  }

  const formKisiGuncelle = (index, alan, deger) => {
    setFormKisiler(prev => prev.map((k, i) => i === index ? { ...k, [alan]: deger } : k))
  }

  const modalKaydet = async (e) => {
    if (e) e.preventDefault()
    if (!formFirmaAdi.trim()) {
      alert('Lütfen Firma / Cari adını giriniz.')
      return
    }
    setKaydediliyor(true)
    try {
      const serializedTel = serializeContacts(formKisiler)
      const serializedSifat = serializeKategoriler(formKategoriler)

      if (modalMod === 'ekle') {
        const { data: yeniCari, error: cariHata } = await supabase
          .from('taseronlar')
          .insert({
            ad: formFirmaAdi.trim(),
            firma: formFirmaAdi.trim(),
            sifat: serializedSifat,
            kategori: formKategoriler[0] || 'Taşeronlar',
            telefon: serializedTel,
            adres: formAdres.trim(),
            sef_gorunur: formSefGorunur,
            puantajda_goster: formPuantajdaGoster,
            ikincil: false
          })
          .select()
          .single()

        if (cariHata) throw cariHata

        if (formSantiyeler.length > 0 && yeniCari) {
          const insertPayload = formSantiyeler.map(sid => ({
            taseron_id: yeniCari.id,
            santiye_id: sid
          }))
          await supabase.from('taseron_santiyeler').insert(insertPayload)
        }
      } else {
        const { error: guncelleHata } = await supabase
          .from('taseronlar')
          .update({
            ad: formFirmaAdi.trim(),
            firma: formFirmaAdi.trim(),
            sifat: serializedSifat,
            kategori: formKategoriler[0] || formKategori || 'Taşeronlar',
            telefon: serializedTel,
            adres: formAdres.trim(),
            sef_gorunur: formSefGorunur,
            puantajda_goster: formPuantajdaGoster
          })
          .eq('id', modalFirmaId)

        if (guncelleHata) throw guncelleHata

        await supabase.from('taseron_santiyeler').delete().eq('taseron_id', modalFirmaId)
        if (formSantiyeler.length > 0) {
          const insertPayload = formSantiyeler.map(sid => ({
            taseron_id: modalFirmaId,
            santiye_id: sid
          }))
          await supabase.from('taseron_santiyeler').insert(insertPayload)
        }
      }

      setModalAcik(false)
      await taseronlariYukle()
    } catch (err) {
      alert('Kayıt başarısız: ' + (err.message || err))
    } finally {
      setKaydediliyor(false)
    }
  }

  // --- HIZLI YÖNETİM AKSİYONLARI ---
  const gorunurlukDegistir = async (id, mevcutDurum, e) => {
    if (e) e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase.from('taseronlar').update({ sef_gorunur: !mevcutDurum }).eq('id', id)
    if (error) alert('Hata oluştu: ' + error.message)
    else taseronlariYukle()
  }

  const puantajGorunurlukDegistir = async (id, mevcutDurum, e) => {
    if (e) e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase.from('taseronlar').update({ puantajda_goster: !mevcutDurum }).eq('id', id)
    if (error) alert('Hata oluştu: ' + error.message)
    else taseronlariYukle()
  }

  const ikincilDurumDegistir = async (id, mevcutDurum, e) => {
    if (e) e.stopPropagation()
    if (!yonetici) return
    const { error } = await supabase.from('taseronlar').update({ ikincil: !mevcutDurum }).eq('id', id)
    if (error) alert('Hata oluştu: ' + error.message)
    else taseronlariYukle()
  }

  const hizliKategoriDegistir = async (id, yeniKat, e) => {
    if (e) e.stopPropagation()
    const { error } = await supabase.from('taseronlar').update({ kategori: yeniKat }).eq('id', id)
    if (error) alert('Kategori güncellenemedi: ' + error.message)
    else taseronlariYukle()
  }

  const taseronSil = async (id, e) => {
    if (e) e.stopPropagation()
    if (!yonetici) return

    const { data: hk } = await supabase.from('hakedisler').select('id').eq('taseron_id', id).limit(1)
    const { data: ms } = await supabase.from('masraflar').select('id').eq('cari_id', id).limit(1)
    const { data: ck } = await supabase.from('cekler').select('id').eq('cari_id', id).limit(1)
    const { data: gl } = await supabase.from('gelirler').select('id').eq('cari_id', id).limit(1)
    const hasFinans = (hk && hk.length > 0) || (ms && ms.length > 0) || (ck && ck.length > 0) || (gl && gl.length > 0)

    if (hasFinans) {
      const uretilenKod = Math.random().toString(36).substring(2, 10).toUpperCase()
      const girilen = window.prompt(`DİKKAT: Bu cariye ait finansal hareketler bulunmaktadır.\nSilmek istiyorsanız aşağıdaki onay kodunu yazınız:\n\n${uretilenKod}`)
      if (girilen !== uretilenKod) {
        alert('Onay kodu eşleşmedi veya iptal edildi.')
        return
      }
    } else {
      if (!window.confirm('Bu cariyi, çalışanlarını ve şantiye atamalarını kalıcı olarak silmek istiyor musunuz?')) return
    }

    try {
      await supabase.from('puantaj_calisan_kayitlari').delete().eq('taseron_id', id)
      await supabase.from('puantaj_kayitlari').delete().eq('taseron_id', id)
      await supabase.from('taseron_calisanlari').delete().eq('taseron_id', id)
      await supabase.from('taseron_santiyeler').delete().eq('taseron_id', id)
      await supabase.from('taseron_notlari').delete().eq('taseron_id', id)

      if (hasFinans) {
        await supabase.from('hakedisler').delete().eq('taseron_id', id)
        await supabase.from('masraflar').update({ cari_id: null }).eq('cari_id', id)
        await supabase.from('cekler').update({ cari_id: null }).eq('cari_id', id)
        await supabase.from('gelirler').update({ cari_id: null }).eq('cari_id', id)
      }

      const { error } = await supabase.from('taseronlar').delete().eq('id', id)
      if (error) {
        alert('Silme başarısız: ' + error.message)
      } else {
        if (seciliId === id) setSeciliId(null)
        taseronlariYukle()
      }
    } catch (err) {
      alert('Silme işlemi sırasında hata: ' + (err.message || err))
    }
  }

  // --- CARİ DETAY / FİNANSAL AKIŞ GÖRÜNÜMÜ ---
  const detayYukle = async (id) => {
    setSeciliId(id)
    setDuzenleModu(false)
    setDuzenlenenHakedisId(null)

    const taseron = taseronlar.find((t) => t.id === id)
    if (taseron) {
      setDuzAd(taseron.ad)
      setDuzKategoriler(parseKategoriler(taseron.sifat))
      setDuzFirma(taseron.firma || '')
      setDuzTelefon(taseron.telefon || '')
      setDuzAdres(taseron.adres || '')
      setDuzKategori(taseron.kategori || '')
    }

    const { data: notData } = await supabase
      .from('taseron_notlari').select('*, profiles(ad_soyad)').eq('taseron_id', id).order('created_at', { ascending: false })
    setNotlar(notData || [])

    const { data: santiyeData } = await supabase.from('taseron_santiyeler').select('id, santiye_id').eq('taseron_id', id)
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

  const handleSantiyeToggle = async (santiyeId) => {
    if (!seciliId) return
    const mevcutIliski = iliskiliSantiyeler.find((r) => r.santiye_id === santiyeId)
    if (mevcutIliski) {
      setIliskiliSantiyeler(prev => prev.filter(r => r.id !== mevcutIliski.id))
      setTaseronSantiyeHaritasi(prev => {
        const yeni = { ...prev }
        if (yeni[seciliId]) {
          yeni[seciliId] = yeni[seciliId].filter(sid => sid !== santiyeId)
        }
        return yeni
      })
      await supabase.from('taseron_santiyeler').delete().eq('id', mevcutIliski.id)
    } else {
      const tempId = 'temp-' + Date.now()
      setIliskiliSantiyeler(prev => [...prev, { id: tempId, santiye_id: santiyeId, taseron_id: seciliId }])
      setTaseronSantiyeHaritasi(prev => {
        const yeni = { ...prev }
        if (!yeni[seciliId]) yeni[seciliId] = []
        if (!yeni[seciliId].includes(santiyeId)) yeni[seciliId] = [...yeni[seciliId], santiyeId]
        return yeni
      })
      const { data } = await supabase.from('taseron_santiyeler').insert({ taseron_id: seciliId, santiye_id: santiyeId }).select().single()
      if (data) {
        setIliskiliSantiyeler(prev => prev.map(r => r.id === tempId ? data : r))
      }
    }
  }

  const handleKategoriEkle = async (yeniKat) => {
    if (!seciliId || !yeniKat) return
    const seciliT = taseronlar.find(t => t.id === seciliId)
    const mevcutlar = parseKategoriler(seciliT?.sifat)
    const duzgun = (yeniKat || '').trim()
    if (!duzgun) return
    if (mevcutlar.some(k => k.toLocaleLowerCase('tr-TR') === duzgun.toLocaleLowerCase('tr-TR'))) return
    const guncel = [...mevcutlar, duzgun]
    const serialized = serializeKategoriler(guncel)
    const { error } = await supabase.from('taseronlar').update({ sifat: serialized }).eq('id', seciliId)
    if (error) {
      alert('Kategori eklenemedi: ' + error.message)
      return
    }
    setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, sifat: serialized } : t))
    setDuzKategoriler(guncel)
  }

  const handleKategoriSil = async (silinecekKat) => {
    if (!seciliId || !silinecekKat) return
    const seciliT = taseronlar.find(t => t.id === seciliId)
    const mevcutlar = parseKategoriler(seciliT?.sifat)
    const guncel = mevcutlar.filter(k => k !== silinecekKat)
    const serialized = serializeKategoriler(guncel)
    const { error } = await supabase.from('taseronlar').update({ sifat: serialized }).eq('id', seciliId)
    if (error) {
      alert('Kategori silinemedi: ' + error.message)
      return
    }
    setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, sifat: serialized } : t))
    setDuzKategoriler(guncel)
  }

  const taseronGuncelle = async () => {
    if (!duzAd.trim()) return
    const serializedSifat = serializeKategoriler(duzKategoriler)
    const { error } = await supabase.from('taseronlar').update({
      ad: duzAd, sifat: serializedSifat, firma: duzFirma, telefon: duzTelefon, adres: duzAdres, kategori: duzKategoriler[0] || duzKategori || 'Taşeronlar'
    }).eq('id', seciliId)
    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenleModu(false)
    taseronlariYukle()
  }

  const notEkle = async () => {
    if (!yeniNot.trim()) return
    await supabase.from('taseron_notlari').insert({ taseron_id: seciliId, icerik: yeniNot, ekleyen: profile?.id })
    setYeniNot('')
    detayYukle(seciliId)
  }

  const notGuncelle = async (notId) => {
    if (!duzenlenenNotMetni.trim()) return
    await supabase.from('taseron_notlari').update({ icerik: duzenlenenNotMetni }).eq('id', notId)
    setDuzenlenenNotId(null)
    detayYukle(seciliId)
  }

  const notSil = async (notId) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return
    await supabase.from('taseron_notlari').delete().eq('id', notId)
    detayYukle(seciliId)
  }

  const hakedisEkle = async () => {
    if (!hkDonem.trim() || !hkTutar) return
    await supabase.from('hakedisler').insert({
      taseron_id: seciliId,
      donem: hkDonem,
      tutar: Number(hkTutar),
      kesinti_avans: Number(hkKesinti) || 0,
      aciklama: hkAciklama,
      ekleyen: profile?.id,
    })
    setHkDonem(''); setHkTutar(''); setHkKesinti(''); setHkAciklama('')
    detayYukle(seciliId)
  }

  const hakedisGuncelle = async (hakedisId) => {
    if (!duzHkDonem.trim() || !duzHkTutar) return
    await supabase.from('hakedisler').update({
      donem: duzHkDonem,
      tutar: Number(duzHkTutar),
      kesinti_avans: Number(duzHkKesinti) || 0,
      aciklama: duzHkAciklama,
    }).eq('id', hakedisId)
    setDuzenlenenHakedisId(null)
    detayYukle(seciliId)
  }

  const hakedisSil = async (hakedisId) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    await supabase.from('hakedisler').delete().eq('id', hakedisId)
    detayYukle(seciliId)
  }

  const seciliTaseron = taseronlar.find((t) => t.id === seciliId)

  // Timeline Olayları
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

  // =========================================================================
  // GÖRÜNÜM 1: BİLGİ KARTI & DETAY SAYFASI (CARİ HESAP EKSTRESİ)
  // =========================================================================
  if (seciliId && seciliTaseron) {
    return (
      <div className="sayfa">
        <button 
          onClick={() => setSeciliId(null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, cursor: 'pointer', color: '#555', fontWeight: 600, fontSize: 13, marginBottom: 16, boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Rehber Listesine Dön
        </button>

        <div style={{ background: 'linear-gradient(to bottom, #ffffff, #fcfcf9)', border: '1px solid rgba(0,0,0,0.03)', borderRadius: 16, padding: '16px', boxShadow: '0 6px 16px rgba(0, 0, 0, 0.04), inset 0 2px 4px rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #1D9596, #117575)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0, boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}>
            {seciliTaseron.ad.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#333', letterSpacing: '-0.3px' }}>
              {seciliTaseron.firma || seciliTaseron.ad}
            </p>
            {/* Kategoriler ve Yönetici Hızlı Ekleme / Kaldırma */}
            <div style={{ marginTop: 6, maxWidth: 420 }}>
              <KategoriCokluSecici
                seciliKategoriler={parseKategoriler(seciliTaseron.sifat)}
                onDegisti={(yeniDizi) => {
                  const serialized = serializeKategoriler(yeniDizi)
                  supabase.from('taseronlar').update({ sifat: serialized }).eq('id', seciliId).then(({ error }) => {
                    if (error) alert('Güncellenemedi: ' + error.message)
                    else {
                      setTaseronlar(prev => prev.map(t => t.id === seciliId ? { ...t, sifat: serialized } : t))
                      setDuzKategoriler(yeniDizi)
                    }
                  })
                }}
                mevcutKategoriler={mevcutHizmetKategorileri}
                placeholder="+ Kategori ekle (3 harf yazın: örn. Parke, Kapı)..."
                disabled={!yonetici || duzenleModu}
              />
            </div>
          </div>

          {yonetici && !duzenleModu && (
            <button 
              onClick={() => setDuzenleModu(true)} 
              title="Düzenle"
              style={{ padding: '8px 12px', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, cursor: 'pointer', color: '#1D9596', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontWeight: 700, fontSize: 12 }}
            >
              ✏️ Düzenle
            </button>
          )}
        </div>

        {duzenleModu ? (
          <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" placeholder="Firma / Kişi Adı" value={duzAd} onChange={(e) => setDuzAd(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />

              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Hizmet Kategorileri (Örn: Parke, Kapı, Doğrama)
                </label>
                <KategoriCokluSecici
                  seciliKategoriler={duzKategoriler}
                  onDegisti={setDuzKategoriler}
                  mevcutKategoriler={mevcutHizmetKategorileri}
                  placeholder="Kategori ekle (3 harf yazın)..."
                />
              </div>

              <input type="text" placeholder="Firma Adı" value={duzFirma} onChange={(e) => setDuzFirma(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
              <input type="text" placeholder="Açık Adres" value={duzAdres} onChange={(e) => setDuzAdres(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDuzenleModu(false)} style={{ flex: 1, padding: '10px', background: '#f4f3ed', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 10, color: '#555', fontWeight: 600, cursor: 'pointer' }}>Vazgeç</button>
                <button onClick={taseronGuncelle} style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Kaydet</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#f8f7f2', padding: 16, borderRadius: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: '#888780', fontWeight: 600 }}>Adres / Konum</span>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#334155', fontWeight: 600 }}>{seciliTaseron.adres || 'Adres bilgisi eklenmemiş'}</p>
          </div>
        )}

        {/* İLETİŞİM KİŞİLERİ VE TEMSİLCİLER (DETAY KARTI) */}
        <div style={{ background: '#ffffff', border: '1px solid #CBD5E1', borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👥</span> İletişim Kişileri & Temsilciler ({parseContacts(seciliTaseron).length})
              </p>
              <span style={{ fontSize: 11.5, color: '#64748B' }}>Firma sahibi, ortak, ustabaşı ve diğer yetkili personeller</span>
            </div>
            {yonetici && (
              <button
                type="button"
                onClick={() => setTemsilciModalAcik(!temsilciModalAcik)}
                style={{
                  padding: '7px 14px',
                  background: temsilciModalAcik ? '#E2E8F0' : 'linear-gradient(135deg, #1D9596, #117575)',
                  color: temsilciModalAcik ? '#334155' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: temsilciModalAcik ? 'none' : '0 2px 6px rgba(29, 149, 150, 0.3)'
                }}
              >
                {temsilciModalAcik ? '✕ Vazgeç' : '➕ Temsilci Ekle'}
              </button>
            )}
          </div>

          {/* Hızlı Temsilci Ekleme Formu */}
          {temsilciModalAcik && (
            <div style={{ background: '#F8FAFC', border: '1.5px solid #1D9596', borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0F766E' }}>Yeni Temsilci / Numara Ekle</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Temsilci Ad Soyad *</label>
                  <input
                    type="text"
                    placeholder="Örn: Ahmet Akın"
                    value={yeniTemsilciAd}
                    onChange={(e) => setYeniTemsilciAd(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Ünvan / Rol</label>
                  <input
                    type="text"
                    placeholder="Örn: Kardeşi, Şantiye Sorumlusu, Usta"
                    value={yeniTemsilciRol}
                    onChange={(e) => setYeniTemsilciRol(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Telefon Numarası *</label>
                  <input
                    type="text"
                    placeholder="Örn: 0532 123 45 67"
                    value={yeniTemsilciTel}
                    onChange={(e) => setYeniTemsilciTel(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Özel Not / Dahili (Opsiyonel)</label>
                  <input
                    type="text"
                    placeholder="Örn: Muhasebe dahili 12, Pazar aranmaz"
                    value={yeniTemsilciNot}
                    onChange={(e) => setYeniTemsilciNot(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setTemsilciModalAcik(false)}
                  style={{ flex: 1, padding: '9px', background: '#E2E8F0', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={temsilciEkleHizli}
                  style={{ flex: 2, padding: '9px', background: 'linear-gradient(135deg, #1D9596, #117575)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(29, 149, 150, 0.3)' }}
                >
                  ✓ Temsilciyi Kaydet
                </button>
              </div>
            </div>
          )}

          {/* Temsilciler Listesi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parseContacts(seciliTaseron).map((kisi, idx) => (
              <div
                key={kisi.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#F8FAFC',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)', color: '#0369A1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {(kisi.ad || 'Y').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{kisi.ad || seciliTaseron.ad}</span>
                      {kisi.rol && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#E6FFFA', color: '#0F766E', border: '1px solid #99F6E4' }}>
                          {kisi.rol}
                        </span>
                      )}
                    </div>
                    {kisi.telefon ? (
                      <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>{kisi.telefon}</span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Telefon girilmedi</span>
                    )}
                    {kisi.not && (
                      <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 1 }}>{kisi.not}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                  {kisi.telefon && (
                    <>
                      <a
                        href={`tel:${kisi.telefon.replace(/[^0-9+]/g, '')}`}
                        style={{ padding: '5px 10px', borderRadius: 6, background: '#E0F2FE', color: '#0369A1', textDecoration: 'none', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        📞 Ara
                      </a>
                      <a
                        href={whatsappBaglantisi(kisi.telefon)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '5px 10px', borderRadius: 6, background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        💬 WhatsApp
                      </a>
                    </>
                  )}
                  {yonetici && (
                    <button
                      type="button"
                      onClick={() => temsilciSilHizli(idx)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#DC2626', fontSize: 14, padding: '4px' }}
                      title="Temsilciyi Kaldır"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tanımlı Şantiyeler Checkbox Grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
              🏗️ Tanımlı Şantiyeler ({iliskiliSantiyeler.length} / {santiyeler.length})
            </p>
            <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Tıklayarak ekle / çıkar</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {santiyeler.map((s) => {
              const secili = iliskiliSantiyeler.some((r) => r.santiye_id === s.id)
              return (
                <label
                  key={s.id}
                  onClick={(e) => { e.preventDefault(); handleSantiyeToggle(s.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                    border: secili ? '2px solid #1D9596' : '1px solid #CBD5E1',
                    background: secili ? '#F0FDFA' : '#FFFFFF',
                    color: secili ? '#0F766E' : '#334155',
                    cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s ease'
                  }}
                >
                  <input type="checkbox" checked={secili} onChange={() => {}} style={{ width: 18, height: 18, accentColor: '#1D9596' }} />
                  <span style={{ fontSize: 13, fontWeight: secili ? 800 : 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ad}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Notlar */}
        <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#333' }}>Notlar</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {notlar.map((n) => (
            <div key={n.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#444' }}>{n.icerik}</p>
                {yonetici && (
                  <button onClick={() => notSil(n.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#D64545', fontSize: 12 }}>✕</button>
                )}
              </div>
            </div>
          ))}
          {notlar.length === 0 && <p className="bos-mesaj">Henüz not eklenmemiş.</p>}
        </div>
        <div className="ekleme-kutusu" style={{ display: 'flex', gap: 8, padding: 12 }}>
          <input type="text" placeholder="Yeni not yaz..." value={yeniNot} onChange={(e) => setYeniNot(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
          <button onClick={notEkle} style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Ekle</button>
        </div>

        {/* Finansal Akış */}
        {yonetici && (
          <div style={{ marginTop: 24 }}>
            <p style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#333' }}>Finansal Akış & Bilgi Kartları</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {timelineOlaylari.map((olay, index) => {
                const netTutar = olay.tip === 'hakedis' ? (Number(olay.veri.tutar) - Number(olay.veri.kesinti_avans || 0)) : olay.veri.tutar
                return (
                  <div key={index} style={{ background: '#fff', borderLeft: '5px solid #1D9596', padding: 12, borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>{olay.tip}</span>
                    <p style={{ margin: '4px 0', fontSize: 14, fontWeight: 800 }}>{paraFormatla(netTutar)} ₺</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{olay.veri.donem || olay.veri.baslik || olay.veri.aciklama || '—'}</p>
                  </div>
                )
              })}
              {timelineOlaylari.length === 0 && <p className="bos-mesaj">Finansal hareket kaydı bulunmuyor.</p>}
            </div>

            <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#333' }}>Yeni Bilgi Kartı / Hakediş Ekle</p>
                <input type="text" placeholder="Başlık / Dönem (örn. Temel İşçiliği Sözleşmesi)" value={hkDonem} onChange={(e) => setHkDonem(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" placeholder="Tutar (₺)" value={hkTutar} onChange={(e) => setHkTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                  <input type="number" placeholder="Kesinti / Avans (₺)" value={hkKesinti} onChange={(e) => setHkKesinti(e.target.value)} onKeyDown={sadeceSayiTuslari} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                </div>
                <input type="text" placeholder="Açıklama (opsiyonel)" value={hkAciklama} onChange={(e) => setHkAciklama(e.target.value)} style={{ padding: '12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.05)', background: '#fcfcf9', fontSize: 13, outline: 'none' }} />
                <button onClick={hakedisEkle} style={{ padding: '12px', background: 'linear-gradient(135deg, #24b8b9, #1D9596)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Bilgi Kartı Kaydı Ekle</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // GÖRÜNÜM 2: YENİ REHBER ANA SAYFASI (NESTED FIRMA & ÇALIŞAN KARTLARI)
  // =========================================================================
  return (
    <div className="sayfa" onClick={() => { setFormSifatOneriAcik(false); setDuzSifatOneriAcik(false) }}>
      
      {/* ÜST BAŞLIK VE AKSİYON BUTONLARI BARI */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1D9596', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏢</span> Rehber & Cari Hesaplar
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B', fontWeight: 600 }}>
            {filtreliFirmalar.length} Firma / Cari · {firmalarGruplanmis.reduce((top, g) => top + g.kisiler.length, 0)} İletişim Kişisi
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Yönetim / Düzenleme Modu Butonu */}
          {yonetici && (
            <button
              type="button"
              onClick={() => setYonetimModu(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 10,
                border: yonetimModu ? '2px solid #1D9596' : '1px solid #CBD5E1',
                background: yonetimModu ? '#F0FDFA' : '#FFFFFF',
                color: yonetimModu ? '#0F766E' : '#475569',
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                boxShadow: yonetimModu ? '0 0 0 3px rgba(29, 149, 150, 0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
              title="Kategori değiştirme, silme ve yetkilendirme araçlarını aç/kapat"
            >
              <span>{yonetimModu ? '🛠️' : '⚙️'}</span>
              <span>{yonetimModu ? 'Yönetim Modu: AÇIK' : 'Yönetim Modu'}</span>
            </button>
          )}

          {/* Tekil "Kayıt Ekle" Butonu */}
          {yonetici && (
            <button
              type="button"
              onClick={yeniKayitModaliAc}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #24b8b9 0%, #1D9596 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(29, 149, 150, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: 16 }}>➕</span>
              <span>Kayıt Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* ARAMA VE ŞANTİYE FİLTRESİ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 240, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8' }}>🔍</span>
          <input 
            type="text" 
            placeholder="Firma, kişi adı, telefon veya hizmet alanı ile arayın..." 
            value={arama} 
            onChange={(e) => setArama(e.target.value)} 
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              fontSize: 13,
              outline: 'none',
              fontWeight: 600,
              color: '#1E293B'
            }}
          />
          {arama && (
            <button 
              type="button"
              onClick={() => setArama('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', fontWeight: 800 }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <select 
            value={filtreSantiye} 
            onChange={(e) => setFiltreSantiye(e.target.value)} 
            style={{
              width: '100%',
              padding: '11px 14px',
              fontSize: 13,
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              outline: 'none',
              cursor: 'pointer',
              color: '#334155',
              fontWeight: 700
            }}
          >
            <option value="hepsi">🏗️ Tüm Şantiyeler</option>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
        </div>
      </div>

      {/* SIRALAMA VE ARŞİV SEÇİCİ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
            Toplam {filtreliFirmalar.length} kayıt listeleniyor
          </span>
          <button
            type="button"
            onClick={() => setArsivGoster(!arsivGoster)}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              border: arsivGoster ? '1.5px solid #F59E0B' : '1px solid #E2E8F0',
              background: arsivGoster ? '#FEF3C7' : '#FFFFFF',
              color: arsivGoster ? '#B45309' : '#64748B',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📦 {arsivGoster ? 'Arşivdekiler Gösteriliyor' : 'Arşivdekileri Göster'}
          </button>
        </div>

        <div style={{ display: 'inline-flex', background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
          <button 
            type="button"
            onClick={() => setSiralama('alfabetik')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: siralama === 'alfabetik' ? '#FFFFFF' : 'transparent',
              color: siralama === 'alfabetik' ? '#1D9596' : '#64748B',
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            A-Z Alfabetik
          </button>
          <button 
            type="button"
            onClick={() => setSiralama('tarih')}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              background: siralama === 'tarih' ? '#FFFFFF' : 'transparent',
              color: siralama === 'tarih' ? '#1D9596' : '#64748B',
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Son Eklenenler
          </button>
        </div>
      </div>

      {/* FİRMA VE KİŞİ KARTLARI LİSTESİ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtreliFirmalar.map((grup) => {
          const kategoriIkon = 
            grup.kategori?.includes('Hafriyat') || grup.kategori?.includes('Makine') ? '🚜' :
            grup.kategori?.includes('Tedarik') ? '🧱' :
            grup.kategori?.includes('Kurum') ? '🏛️' :
            grup.kategori?.includes('Ortak') ? '👥' :
            grup.kategori?.includes('Personel') || grup.kategori?.includes('Bekçi') ? '🛡️' : '🏗️'

          const cokluKisiVarMi = grup.kisiler.length > 1
          const tekKisi = grup.kisiler[0] || {}
          const tekTel = (tekKisi.telefon || '').trim()
          const tekWa = whatsappBaglantisi(tekTel)

          // -------------------------------------------------------------
          // DURUM A: TEK KİŞİLİK / STANDART CARİ (KOMPAKT & DOĞRUDAN SATIR)
          // Her firma için nested mimarisine gerek yok; tek bakışta tüm bilgiler ve arama
          // -------------------------------------------------------------
          if (!cokluKisiVarMi) {
            return (
              <div 
                key={grup.anahtar} 
                style={{
                  background: '#FFFFFF',
                  borderRadius: 14,
                  border: '1px solid #E2E8F0',
                  padding: '12px 14px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Sol: İkon ve Bilgiler */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #1D9596, #0F766E)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 800,
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(29, 149, 150, 0.2)'
                  }}>
                    {kategoriIkon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                        {grup.firmaAdi}
                      </span>
                      {tekKisi.rol && tekKisi.rol !== 'Yetkili' && !parseKategoriler(grup.sifat).some(k => k.toLocaleLowerCase('tr-TR') === tekKisi.rol.toLocaleLowerCase('tr-TR')) && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4 }}>
                          {tekKisi.rol}
                        </span>
                      )}
                      {parseKategoriler(grup.sifat).map((kat, ki) => (
                        <span key={ki} style={{ fontSize: 11, fontWeight: 700, background: '#F0FDFA', color: '#0F766E', border: '1px solid #CCFBF1', padding: '1px 7px', borderRadius: 6 }}>
                          🏷️ {kat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sağ: İletişim Butonları & Yönetim Aksiyonları */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {tekTel ? (
                    <>
                      <a
                        href={`tel:${tekTel}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 11px',
                          borderRadius: 8,
                          background: '#1D9596',
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 800,
                          textDecoration: 'none',
                          boxShadow: '0 2px 6px rgba(29, 149, 150, 0.25)'
                        }}
                        title="Doğrudan Ara"
                      >
                        <span>📞</span>
                        <span>{tekTel}</span>
                      </a>

                      {tekWa && (
                        <a
                          href={tekWa}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '6px 9px',
                            borderRadius: 8,
                            background: '#25D366',
                            color: '#FFFFFF',
                            fontSize: 11.5,
                            fontWeight: 800,
                            textDecoration: 'none'
                          }}
                          title="WhatsApp İle Mesaj At"
                        >
                          <span>💬</span>
                          <span>WP</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tekTel)
                          alert(`Telefon numarası kopyalandı: ${tekTel}`)
                        }}
                        style={{
                          padding: '5px 7px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#475569',
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                        title="Numarayı Kopyala"
                      >
                        📋
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic', marginRight: 4 }}>
                      Telefon yok
                    </span>
                  )}

                  {/* Yönetim Modu Açıkken Gözüken Kontroller */}
                  {yonetimModu && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => gorunurlukDegistir(grup.anaKayit.id, grup.sef_gorunur, e)}
                        style={{
                          padding: '4px 7px',
                          borderRadius: 6,
                          border: grup.sef_gorunur ? '1px solid #86EFAC' : '1px solid #CBD5E1',
                          background: grup.sef_gorunur ? '#DCFCE7' : '#F1F5F9',
                          color: grup.sef_gorunur ? '#166534' : '#64748B',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        title="Şantiye şeflerinin rehberde görmesini aç/kapat"
                      >
                        {grup.sef_gorunur ? '✓ Şef' : '✕ Şefe Gizli'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => duzenleModaliAc(grup, e)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F766E',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Düzenle veya birden fazla kişi ekle"
                      >
                        ✏️ Düzenle
                      </button>

                      <button
                        type="button"
                        onClick={(e) => taseronSil(grup.anaKayit.id, e)}
                        style={{
                          padding: '4px 6px',
                          borderRadius: 6,
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Sil"
                      >
                        🗑️
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => detayYukle(grup.anaKayit.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#1E293B',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                    title="Cari Hesap Hakediş ve Finans Detayı"
                  >
                    Detay
                  </button>
                </div>
              </div>
            )
          }

          // -------------------------------------------------------------
          // DURUM B: ÇOK KİŞİLİ FİRMA (NESTED / ÖBEK MİMARİSİ)
          // Sadece Serhat Hazar birden fazla kişi/usta eklediyse (Örn: Öz Marmara)
          // -------------------------------------------------------------
          return (
            <div 
              key={grup.anahtar} 
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1.5px solid #CCFBF1',
                boxShadow: '0 3px 12px rgba(29, 149, 150, 0.06)',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              {/* FİRMA BAŞLIK KARTI */}
              <div style={{ padding: '12px 16px', background: '#F0FDFA', borderBottom: '1px solid #CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #1D9596, #0F766E)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {kategoriIkon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0F172A' }}>
                        {grup.firmaAdi}
                      </h3>
                      <span style={{ fontSize: 10.5, fontWeight: 800, background: '#1D9596', color: '#FFFFFF', padding: '1px 7px', borderRadius: 10 }}>
                        👥 {grup.kisiler.length} Yetkili / Usta
                      </span>
                      {parseKategoriler(grup.sifat).map((kat, ki) => (
                        <span key={ki} style={{ fontSize: 11, fontWeight: 700, background: '#FFFFFF', color: '#0F766E', border: '1px solid #CCFBF1', padding: '1px 7px', borderRadius: 6 }}>
                          🏷️ {kat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {yonetimModu && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => duzenleModaliAc(grup, e)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 6,
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          color: '#0F766E',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Düzenle
                      </button>

                      <button
                        type="button"
                        onClick={(e) => taseronSil(grup.anaKayit.id, e)}
                        style={{
                          padding: '4px 6px',
                          borderRadius: 6,
                          border: '1px solid #FECACA',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => detayYukle(grup.anaKayit.id)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#1E293B',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Detay
                  </button>
                </div>
              </div>

              {/* NESTED ÇALIŞANLAR VE NUMARALARI */}
              <div style={{ padding: '10px 14px', background: '#FFFFFF' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {grup.kisiler.map((kisi, kidx) => {
                    const telTemiz = (kisi.telefon || '').trim()
                    const waLink = whatsappBaglantisi(telTemiz)

                    return (
                      <div 
                        key={kisi.id || kidx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: '#F8FAFC',
                          border: '1px solid #EDF2F7',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
                          <span style={{ fontSize: 14 }}>👤</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>
                                {kisi.ad || grup.firmaAdi}
                              </span>
                              {kisi.rol && (
                                <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 4 }}>
                                  {kisi.rol}
                                </span>
                              )}
                            </div>
                            {kisi.not && (
                              <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#64748B', fontStyle: 'italic' }}>
                                {kisi.not}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {telTemiz ? (
                            <>
                              <a
                                href={`tel:${telTemiz}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  background: '#1D9596',
                                  color: '#FFFFFF',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  textDecoration: 'none'
                                }}
                              >
                                <span>📞</span>
                                <span>{telTemiz}</span>
                              </a>

                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    background: '#25D366',
                                    color: '#FFFFFF',
                                    fontSize: 11,
                                    fontWeight: 800,
                                    textDecoration: 'none'
                                  }}
                                >
                                  💬 WP
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(telTemiz)
                                  alert(`Telefon kopyalandı: ${telTemiz}`)
                                }}
                                style={{
                                  padding: '5px 7px',
                                  borderRadius: 6,
                                  border: '1px solid #CBD5E1',
                                  background: '#FFFFFF',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  fontSize: 11
                                }}
                              >
                                📋
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>
                              Telefon yok
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {filtreliFirmalar.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: 16, border: '1px dashed #CBD5E1' }}>
            <span style={{ fontSize: 36, display: 'block', marginBottom: 8 }}>📭</span>
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#475569' }}>
              Seçilen kriterlere uygun firma veya cari bulunamadı.
            </p>
            {yonetici && (
              <button
                type="button"
                onClick={yeniKayitModaliAc}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#1D9596',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer'
                }}
              >
                + Yeni Kayıt Ekle
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* GENİŞLETİLMİŞ POP-UP MODAL (KAYIT EKLE & DÜZENLE) */}
      {/* ========================================================================= */}
      {modalAcik && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16
          }}
          onClick={() => setModalAcik(false)}
        >
          <div 
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Başlık */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFBFD' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                  {modalMod === 'ekle' ? '➕ Yeni Firma / Cari Ekle' : '✏️ Firma & İletişim Bilgilerini Düzenle'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                  Aynı firma altına birden fazla yetkili ve ustayı kolayca ekleyebilirsiniz
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalAcik(false)}
                style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: '#94A3B8', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={modalKaydet} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* BÖLÜM 1: FİRMA VE KATEGORİ */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1D9596', display: 'block', marginBottom: 10, textTransform: 'uppercase' }}>
                  1. Firma & Hizmet Bilgileri
                </span>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Firma / Cari / Ekip Adı *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Örn. Öz Marmara, Cevher Hafriyat, İSKİ" 
                    value={formFirmaAdi} 
                    onChange={(e) => setFormFirmaAdi(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  />
                </div>

                {/* Kategoriler / Hizmet Kalemleri (Çoklu Seçici & 3 Harfli Arama) */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Hizmet Kategorileri (Birden fazla seçilebilir: örn. Parke, Kapı, Doğrama)
                  </label>
                  <KategoriCokluSecici
                    seciliKategoriler={formKategoriler}
                    onDegisti={setFormKategoriler}
                    mevcutKategoriler={mevcutHizmetKategorileri}
                    placeholder="Kategori yazın veya arayın (en az 3 harf)..."
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Açık Adres / Konum
                  </label>
                  <input 
                    type="text" 
                    placeholder="Adres, sanayi sitesi veya konum bilgisi" 
                    value={formAdres} 
                    onChange={(e) => setFormAdres(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                  />
                </div>
              </div>

              {/* BÖLÜM 2: TANIMLI ŞANTİYELER */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1D9596', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
                  2. Tanımlı Şantiyeler ({formSantiyeler.length} Seçili)
                </span>
                <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748B' }}>
                  Şantiye şeflerinin görebilmesi ve puantaj listesinde çıkması için ilgili şantiyeleri işaretleyin:
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {santiyeler.map((s) => {
                    const secili = formSantiyeler.includes(s.id)
                    return (
                      <label 
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: secili ? '1.5px solid #1D9596' : '1px solid #CBD5E1',
                          background: secili ? '#F0FDFA' : '#FFFFFF',
                          color: secili ? '#0F766E' : '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={secili} 
                          onChange={() => {
                            setFormSantiyeler(prev => secili ? prev.filter(id => id !== s.id) : [...prev, s.id])
                          }}
                          style={{ accentColor: '#1D9596' }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ad}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* BÖLÜM 3: İLETİŞİM KİŞİLERİ (FİRMA SAHİBİ, ORTAK, USTA, ŞANTİYE SORUMLUSU) */}
              <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#1D9596', display: 'block', textTransform: 'uppercase' }}>
                      3. İletişim Kişileri ({formKisiler.length} Kişi)
                    </span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>
                      Firma sahibi, kardeşi, ustabaşı ve diğer personelleri ekleyin
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={formKisiEkle}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 6,
                      background: '#1D9596',
                      color: '#fff',
                      border: 'none',
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    + Kişi Ekle
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {formKisiler.map((kisi, idx) => (
                    <div 
                      key={kisi.id || idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        background: '#FFFFFF',
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid #CBD5E1',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1D9596' }}>
                          #{idx + 1} İletişim Kişisi / Temsilci
                        </span>
                        {formKisiler.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => formKisiSil(idx)}
                            style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', borderRadius: 6, cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontWeight: 600 }}
                          >
                            🗑️ Bu Kişiyi Kaldır
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Ad Soyad</label>
                          <input 
                            type="text" 
                            placeholder="Örn: Remzi Akın" 
                            value={kisi.ad} 
                            onChange={(e) => formKisiGuncelle(idx, 'ad', e.target.value)} 
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Ünvan / Rol</label>
                          <input 
                            type="text" 
                            placeholder="Örn: Firma Sahibi, Kardeşi, Usta" 
                            value={kisi.rol} 
                            onChange={(e) => formKisiGuncelle(idx, 'rol', e.target.value)} 
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Telefon Numarası</label>
                          <input 
                            type="text" 
                            placeholder="Örn: 0532 123 45 67" 
                            value={kisi.telefon} 
                            onChange={(e) => formKisiGuncelle(idx, 'telefon', e.target.value)} 
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 3 }}>Özel Not / Dahili (Opsiyonel)</label>
                          <input 
                            type="text" 
                            placeholder="Örn: Muhasebe dahili 12, Şantiye ustası" 
                            value={kisi.not} 
                            onChange={(e) => formKisiGuncelle(idx, 'not', e.target.value)} 
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BÖLÜM 4: YETKİLENDİRME & GÖRÜNÜRLÜK */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#166534' }}>
                  <input 
                    type="checkbox" 
                    checked={formSefGorunur} 
                    onChange={(e) => setFormSefGorunur(e.target.checked)}
                    style={{ accentColor: '#16a34a' }}
                  />
                  <span>✓ Şantiye Şefleri Rehberde Görebilsin</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#F0F9FF', border: '1px solid #BAE6FD', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#0369A1' }}>
                  <input 
                    type="checkbox" 
                    checked={formPuantajdaGoster} 
                    onChange={(e) => setFormPuantajdaGoster(e.target.checked)}
                    style={{ accentColor: '#0284c7' }}
                  />
                  <span>✓ Puantaj Modülünde Ekip Olarak Çıksın</span>
                </label>
              </div>

              {/* MODAL AKSİYON BUTONLARI */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button 
                  type="button" 
                  onClick={() => setModalAcik(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  disabled={kaydediliyor}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #24b8b9 0%, #1D9596 100%)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: '0 3px 10px rgba(29, 149, 150, 0.3)'
                  }}
                >
                  {kaydediliyor ? 'Kaydediliyor...' : (modalMod === 'ekle' ? 'Firma & Kişileri Kaydet' : 'Değişiklikleri Güncelle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}