import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, formatInputTutar, temizleTutar } from '../lib/format'
import {
  uploadToGoogleDrive,
  moveToSilinenler,
  getGoogleDriveViewUrl,
  isGoogleDriveUrl
} from '../lib/googleDrive'
import * as XLSX from 'xlsx'
import {
  YASIN_CICEN_PROJE,
  YASIN_CICEN_CARI_SEED,
  YASIN_CICEN_IMALAT_SEED,
  YASIN_CICEN_NOTLAR_SEED
} from '../data/yasinCicenSeed'

const STORAGE_KEY = 'danismanlik_verileri_v1'
const bugun = () => new Date().toISOString().slice(0, 10)

const VARSAYILAN_VERI = {
  aktifProjeId: 'yasin-cicen',
  projeler: [YASIN_CICEN_PROJE],
  cariKayitlar: {
    'yasin-cicen': YASIN_CICEN_CARI_SEED
  },
  imalatKayitlar: {
    'yasin-cicen': YASIN_CICEN_IMALAT_SEED
  },
  calismaNotlari: {
    'yasin-cicen': YASIN_CICEN_NOTLAR_SEED
  }
}

const ORTAK_INPUT_STIL = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  color: '#0F172A',
  fontSize: 13,
  fontWeight: 500,
  margin: 0,
  boxSizing: 'border-box',
  outline: 'none'
}

export default function Danismanliklar() {
  const { profile } = useAuth()
  const excelInputRef = useRef(null)

  const [veri, setVeri] = useState(() => {
    try {
      const kayitli = localStorage.getItem(STORAGE_KEY)
      if (kayitli) {
        const parsed = JSON.parse(kayitli)
        if (parsed && parsed.projeler && parsed.projeler.length > 0) {
          return parsed
        }
      }
    } catch (err) {
      console.warn('Local danışmanlık verisi okunamadı:', err)
    }
    return VARSAYILAN_VERI
  })

  const [aktifSekme, setAktifSekme] = useState('cari') // 'cari' | 'mutabakat' | 'imalat' | 'notlar'
  const [kayitDurumu, setKayitDurumu] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)

  // Cari Filtre & Arama State'leri
  const [aramaMetni, setAramaMetni] = useState('')
  const [turFiltre, setTurFiltre] = useState('hepsi') // 'hepsi' | 'resmi_gider' | 'gayriresmi_gider' | 'resmi_tahsilat' | 'gayriresmi_tahsilat' | 'karsilikli' | 'mutabakat' | 'notlu'
  const [baslangicTarih, setBaslangicTarih] = useState('')
  const [bitisTarih, setBitisTarih] = useState('')
  const [siralamaYon, setSiralamaYon] = useState('eskiden_yeniye') // 'eskiden_yeniye' | 'yeniden_eskiye'
  const [seciliSatirIdleri, setSeciliSatirIdleri] = useState([]) // Satır çoklu seçim desteği

  // Yeni Cari İşlem Formu State'leri
  const [formAcik, setFormAcik] = useState(false)
  // 'resmi_harcama' | 'gayriresmi_harcama' | 'tahsilat_resmi' | 'tahsilat_gayriresmi' | 'mutabakat'
  const [islemKategori, setIslemKategori] = useState('resmi_harcama')
  // Gayriresmi Harcama alt türü: 'ruha_yapti' (Yasin Çiçen borçlandı) | 'yasin_odedi' (Aynı anda gayriresmi gelire de yazılır)
  const [gayriresmiGiderAltTur, setGayriresmiGiderAltTur] = useState('ruha_yapti')
  // Tahsilat & Gayri Resmi Ödeme alt türü: 'nakit_getirdi' (Bize nakit getirdi) | 'direkt_odedi' (Kendisi direkt ödeme yaptı -> harcamaya da yazılır)
  const [gayriresmiTahsilatAltTur, setGayriresmiTahsilatAltTur] = useState('nakit_getirdi')

  const [yeniTarih, setYeniTarih] = useState(bugun())
  const [yeniEvrakNo, setYeniEvrakNo] = useState('')
  const [yeniAciklama, setYeniAciklama] = useState('')
  const [yeniTutar, setYeniTutar] = useState('')
  const [yeniNot, setYeniNot] = useState('')
  const [yeniBelge, setYeniBelge] = useState(null)

  // Düzenleme State'i (Cari)
  const [duzenlenenCariId, setDuzenlenenCariId] = useState(null)
  const [duzCari, setDuzCari] = useState({})

  // Yeni İmalat Formu State'leri
  const [yeniIsKalemi, setYeniIsKalemi] = useState('')
  const [yeniBirimFiyat, setYeniBirimFiyat] = useState('')
  const [yeniFirmaKisi, setYeniFirmaKisi] = useState('')
  const [yeniImalatDurum, setYeniImalatDurum] = useState('anlasildi')
  const [yeniImalatNot, setYeniImalatNot] = useState('')
  const [duzenlenenImalatId, setDuzenlenenImalatId] = useState(null)
  const [duzImalat, setDuzImalat] = useState({})

  // Yeni Not Formu State'leri
  const [yeniNotKategori, setYeniNotKategori] = useState('Genel')
  const [yeniNotBaslik, setYeniNotBaslik] = useState('')
  const [yeniNotDetay, setYeniNotDetay] = useState('')
  const [notFiltreKategori, setNotFiltreKategori] = useState('hepsi')

  // Yeni Proje Ekleme Modalı
  const [projeModalAcik, setProjeModalAcik] = useState(false)
  const [yeniProjeAd, setYeniProjeAd] = useState('')
  const [yeniMusteriAd, setYeniMusteriAd] = useState('')
  const [yeniKarOrani, setYeniKarOrani] = useState('15')
  const [yeniProjeAciklama, setYeniProjeAciklama] = useState('')

  // Mutabakat Simülatör State'leri
  const [mutabakatDonemSecimi, setMutabakatDonemSecimi] = useState('tumu') // 'tumu' | '08_08_sonrasi' | '02_10_sonrasi' | 'ozel'
  const [mutabakatBaslangic, setMutabakatBaslangic] = useState('')
  const [mutabakatBitis, setMutabakatBitis] = useState(bugun())
  const [wpKopyalandi, setWpKopyalandi] = useState(false)

  // Supabase sistem_ayarlari'ndan ilk yükleme
  useEffect(() => {
    const uzakVeriYukle = async () => {
      try {
        const { data } = await supabase
          .from('sistem_ayarlari')
          .select('deger')
          .eq('anahtar', STORAGE_KEY)
          .maybeSingle()

        if (data?.deger) {
          const parsed = JSON.parse(data.deger)
          if (parsed && parsed.projeler && parsed.projeler.length > 0) {
            setVeri(parsed)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          }
        }
      } catch (err) {
        console.warn('Supabase danışmanlık verisi okunamadı (Local veri kullanılıyor):', err)
      }
    }
    uzakVeriYukle()
  }, [])

  // Veri değiştiğinde hem localStorage'a hem Supabase sistem_ayarlari'na kaydet
  const veriyiKaydet = async (yeniVeri) => {
    setVeri(yeniVeri)
    const jsonStr = JSON.stringify(yeniVeri)
    localStorage.setItem(STORAGE_KEY, jsonStr)
    setKayitDurumu('Kaydediliyor...')
    try {
      const { data: mevcut } = await supabase
        .from('sistem_ayarlari')
        .select('id')
        .eq('anahtar', STORAGE_KEY)
        .maybeSingle()

      if (mevcut) {
        await supabase.from('sistem_ayarlari').update({ deger: jsonStr }).eq('anahtar', STORAGE_KEY)
      } else {
        await supabase.from('sistem_ayarlari').insert({ anahtar: STORAGE_KEY, deger: jsonStr })
      }
      setKayitDurumu('✓ Kaydedildi')
      setTimeout(() => setKayitDurumu(''), 2000)
    } catch (err) {
      setKayitDurumu('✓ Localde Kaydedildi')
      setTimeout(() => setKayitDurumu(''), 2000)
    }
  }

  const aktifProje = useMemo(() => {
    return veri.projeler.find((p) => p.id === veri.aktifProjeId) || veri.projeler[0] || YASIN_CICEN_PROJE
  }, [veri])

  const aktifCariListesi = useMemo(() => {
    return veri.cariKayitlar?.[aktifProje.id] || []
  }, [veri, aktifProje.id])

  const aktifImalatListesi = useMemo(() => {
    return veri.imalatKayitlar?.[aktifProje.id] || []
  }, [veri, aktifProje.id])

  const aktifNotListesi = useMemo(() => {
    return veri.calismaNotlari?.[aktifProje.id] || []
  }, [veri, aktifProje.id])

  const karOrani = Number(aktifProje.kar_payi_orani ?? 15)

  // Kümülatif hesaplamalı Cari Satırlar
  const hesaplanmisCariSatirlar = useMemo(() => {
    let kumHarcama = 0
    let kumTahsilat = 0
    return aktifCariListesi.map((satir, idx) => {
      const resmiGider = Number(satir.resmi_harcama) || 0
      const gayriresmiGider = Number(satir.gayriresmi_harcama) || 0
      const satirGiderToplam = resmiGider + gayriresmiGider
      kumHarcama += satirGiderToplam

      const resmiGelir = Number(satir.tahsilat_resmi) || 0
      const eldenGelir = Number(satir.tahsilat_elden) || 0
      const satirGelirToplam = resmiGelir + eldenGelir
      kumTahsilat += satirGelirToplam

      const bakiyeKarsiz = kumTahsilat - kumHarcama

      return {
        ...satir,
        satirNo: idx + 1,
        satirGiderToplam,
        kumHarcama,
        satirGelirToplam,
        kumTahsilat,
        bakiyeKarsiz
      }
    })
  }, [aktifCariListesi])

  // Genel Özet Hesaplamaları
  const genelOzet = useMemo(() => {
    let toplamResmiHarcama = 0
    let toplamGayriresmiHarcama = 0
    let toplamTahsilatResmi = 0
    let toplamTahsilatElden = 0

    aktifCariListesi.forEach((r) => {
      toplamResmiHarcama += Number(r.resmi_harcama) || 0
      toplamGayriresmiHarcama += Number(r.gayriresmi_harcama) || 0
      toplamTahsilatResmi += Number(r.tahsilat_resmi) || 0
      toplamTahsilatElden += Number(r.tahsilat_elden) || 0
    })

    const genelToplamHarcama = toplamResmiHarcama + toplamGayriresmiHarcama
    const genelToplamTahsilat = toplamTahsilatResmi + toplamTahsilatElden

    const karMatrahi = genelToplamHarcama
    const hesaplananKarPayi = karMatrahi * (karOrani / 100)
    const karDahilToplamHakEdis = genelToplamHarcama + hesaplananKarPayi

    // Negatif değer = Yasin Çiçen'in borcu (Ruha'nın alacağı)
    // Pozitif değer = Yasin Çiçen'in fazla ödemesi (Alacağı)
    const netBakiyeKarsiz = genelToplamTahsilat - genelToplamHarcama
    const netBakiyeKarDahil = genelToplamTahsilat - karDahilToplamHakEdis

    return {
      toplamResmiHarcama,
      toplamGayriresmiHarcama,
      genelToplamHarcama,
      toplamTahsilatResmi,
      toplamTahsilatElden,
      genelToplamTahsilat,
      karMatrahi,
      hesaplananKarPayi,
      karDahilToplamHakEdis,
      netBakiyeKarsiz,
      netBakiyeKarDahil
    }
  }, [aktifCariListesi, karOrani])

  // Filtrelenmiş Cari Liste
  const filtrelenmisCariSatirlar = useMemo(() => {
    let liste = [...hesaplanmisCariSatirlar]

    if (aramaMetni.trim()) {
      const q = aramaMetni.toLocaleLowerCase('tr-TR')
      liste = liste.filter(
        (r) =>
          (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (r.gelir_aciklama || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (r.not_metni || '').toLocaleLowerCase('tr-TR').includes(q) ||
          (r.evrak_no || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    }

    if (turFiltre === 'resmi_gider') {
      liste = liste.filter((r) => Number(r.resmi_harcama) > 0)
    } else if (turFiltre === 'gayriresmi_gider') {
      liste = liste.filter((r) => Number(r.gayriresmi_harcama) > 0)
    } else if (turFiltre === 'resmi_tahsilat') {
      liste = liste.filter((r) => Number(r.tahsilat_resmi) > 0)
    } else if (turFiltre === 'gayriresmi_tahsilat') {
      liste = liste.filter((r) => Number(r.tahsilat_elden) > 0)
    } else if (turFiltre === 'karsilikli') {
      liste = liste.filter((r) => Number(r.gayriresmi_harcama) > 0 && Number(r.tahsilat_elden) > 0)
    } else if (turFiltre === 'mutabakat') {
      liste = liste.filter(
        (r) =>
          r.islem_turu === 'mutabakat' ||
          (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes('mutabakat') ||
          (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes('mutabakat') ||
          (r.not_metni || '').toLocaleLowerCase('tr-TR').includes('mutabakat')
      )
    } else if (turFiltre === 'notlu') {
      liste = liste.filter((r) => (r.not_metni || '').trim() !== '')
    }

    if (baslangicTarih) {
      liste = liste.filter((r) => (r.tarih || '') >= baslangicTarih)
    }
    if (bitisTarih) {
      liste = liste.filter((r) => (r.tarih || '') <= bitisTarih)
    }

    if (siralamaYon === 'yeniden_eskiye') {
      liste.reverse()
    }

    return liste
  }, [hesaplanmisCariSatirlar, aramaMetni, turFiltre, baslangicTarih, bitisTarih, siralamaYon])

  // Seçili Satırların Toplamları
  const seciliOzet = useMemo(() => {
    if (!seciliSatirIdleri || seciliSatirIdleri.length === 0) return null

    const seciliSet = new Set(seciliSatirIdleri)
    const secilenler = hesaplanmisCariSatirlar.filter((r) => seciliSet.has(r.id))
    if (secilenler.length === 0) return null

    let toplamResmiHarcama = 0
    let toplamGayriresmiHarcama = 0
    let toplamTahsilatResmi = 0
    let toplamTahsilatElden = 0

    secilenler.forEach((r) => {
      toplamResmiHarcama += Number(r.resmi_harcama) || 0
      toplamGayriresmiHarcama += Number(r.gayriresmi_harcama) || 0
      toplamTahsilatResmi += Number(r.tahsilat_resmi) || 0
      toplamTahsilatElden += Number(r.tahsilat_elden) || 0
    })

    const toplamHarcama = toplamResmiHarcama + toplamGayriresmiHarcama
    const toplamTahsilat = toplamTahsilatResmi + toplamTahsilatElden
    const bakiyeKarsiz = toplamTahsilat - toplamHarcama
    const karTutari = toplamHarcama * (karOrani / 100)
    const bakiyeKarDahil = toplamTahsilat - (toplamHarcama + karTutari)

    return {
      adet: secilenler.length,
      toplamResmiHarcama,
      toplamGayriresmiHarcama,
      toplamHarcama,
      toplamTahsilatResmi,
      toplamTahsilatElden,
      toplamTahsilat,
      bakiyeKarsiz,
      karTutari,
      bakiyeKarDahil
    }
  }, [seciliSatirIdleri, hesaplanmisCariSatirlar, karOrani])

  // Tekil Satır Seçimi Değiştir
  const toggleSatirSecim = (id) => {
    setSeciliSatirIdleri((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Görüntülenen Tümünü Seç / Kaldır
  const toggleGoruntulenenTumu = () => {
    const goruntulenenIdler = filtrelenmisCariSatirlar.map((r) => r.id)
    const hepsiSeciliMi =
      goruntulenenIdler.length > 0 &&
      goruntulenenIdler.every((id) => seciliSatirIdleri.includes(id))

    if (hepsiSeciliMi) {
      setSeciliSatirIdleri((prev) => prev.filter((id) => !goruntulenenIdler.includes(id)))
    } else {
      setSeciliSatirIdleri((prev) => Array.from(new Set([...prev, ...goruntulenenIdler])))
    }
  }

  // Yeni Cari İşlem Ekle
  const cariIslemEkle = async (e) => {
    e.preventDefault()

    const tutarSayi = temizleTutar(yeniTutar)
    const aciklamaTemiz = yeniAciklama.trim()

    if (islemKategori !== 'mutabakat' && tutarSayi <= 0) {
      alert('Lütfen geçerli bir işlem tutarı giriniz.')
      return
    }
    if (islemKategori !== 'mutabakat' && !aciklamaTemiz) {
      alert('Lütfen işlem açıklamasını giriniz.')
      return
    }

    let rHarcama = 0
    let gHarcama = 0
    let rTahsilat = 0
    let eTahsilat = 0
    let gAciklama = ''
    let tAciklama = ''

    if (islemKategori === 'resmi_harcama') {
      // Resmi Harcama: Ruha tarafından yapılmış
      rHarcama = tutarSayi
      gAciklama = aciklamaTemiz
    } else if (islemKategori === 'gayriresmi_harcama') {
      // Gayri Resmi & Yasin Çiçen:
      // 1) Ruha yaptı ve Yasin Çiçen borçlandı
      // 2) Yasin Çiçen ödedi ve aynı anda gayri resmi gelir kısmına da yazılacak
      gHarcama = tutarSayi
      gAciklama = aciklamaTemiz
      if (gayriresmiGiderAltTur === 'yasin_odedi') {
        eTahsilat = tutarSayi
        tAciklama = `${aciklamaTemiz} (${aktifProje.musteri_adi} Kendisi Ödedi)`
      }
    } else if (islemKategori === 'tahsilat_resmi') {
      // Tahsilat Resmi: Banka hesabına atılan veya çek ile gönderilenler
      rTahsilat = tutarSayi
      tAciklama = aciklamaTemiz
    } else if (islemKategori === 'tahsilat_gayriresmi') {
      // Tahsilat & Gayri Resmi Ödeme:
      // 1) Bize nakit getirmiş
      // 2) Kendisi direkt olarak ödeme yapmıştır (aynı anda Gayri Resmi & Yasin Çiçen harcamasına da yazılır)
      eTahsilat = tutarSayi
      tAciklama = aciklamaTemiz
      if (gayriresmiTahsilatAltTur === 'direkt_odedi') {
        gHarcama = tutarSayi
        gAciklama = aciklamaTemiz
      }
    } else if (islemKategori === 'mutabakat') {
      const tarihTr = new Date(yeniTarih || bugun()).toLocaleDateString('tr-TR')
      gAciklama = aciklamaTemiz || `Mutabakat Tarihi ${tarihTr}`
      tAciklama = aciklamaTemiz || `Mutabakat Tarihi ${tarihTr}`
    }

    setYukleniyor(true)
    let belgeUrl = ''
    if (yeniBelge) {
      try {
        const driveRes = await uploadToGoogleDrive({
          file: yeniBelge,
          folderName: `Danismanliklar/${aktifProje.ad}`,
          adSoyad: profile?.ad_soyad || aktifProje.musteri_adi || 'DANISMANLIK',
          date: yeniTarih || bugun()
        })
        belgeUrl = driveRes.url
      } catch (err) {
        alert("Belge Google Drive'a yüklenemedi: " + err.message)
        setYukleniyor(false)
        return
      }
    }

    const yeniKayit = {
      id: `yc-cari-${Date.now()}`,
      sira: aktifCariListesi.length + 1,
      tarih: yeniTarih || bugun(),
      islem_turu: islemKategori,
      evrak_no: yeniEvrakNo.trim(),
      gider_aciklama: gAciklama,
      resmi_harcama: rHarcama,
      gayriresmi_harcama: gHarcama,
      tarih_tahsilat: yeniTarih || bugun(),
      gelir_aciklama: tAciklama,
      tahsilat_resmi: rTahsilat,
      tahsilat_elden: eTahsilat,
      not_metni: yeniNot.trim(),
      belge_url: belgeUrl
    }

    const guncelListe = [...aktifCariListesi, yeniKayit]
    await veriyiKaydet({
      ...veri,
      cariKayitlar: {
        ...veri.cariKayitlar,
        [aktifProje.id]: guncelListe
      }
    })

    // Formu temizle
    setYeniEvrakNo('')
    setYeniAciklama('')
    setYeniTutar('')
    setYeniNot('')
    setYeniBelge(null)
    setYukleniyor(false)
    setFormAcik(false)
  }

  const cariDuzenlemeyiAc = (satir) => {
    setDuzenlenenCariId(satir.id)
    setDuzCari({
      tarih: satir.tarih || '',
      evrak_no: satir.evrak_no || '',
      gider_aciklama: satir.gider_aciklama || '',
      resmi_harcama: satir.resmi_harcama ? formatInputTutar(satir.resmi_harcama) : '',
      gayriresmi_harcama: satir.gayriresmi_harcama ? formatInputTutar(satir.gayriresmi_harcama) : '',
      gelir_aciklama: satir.gelir_aciklama || '',
      tahsilat_resmi: satir.tahsilat_resmi ? formatInputTutar(satir.tahsilat_resmi) : '',
      tahsilat_elden: satir.tahsilat_elden ? formatInputTutar(satir.tahsilat_elden) : '',
      not_metni: satir.not_metni || ''
    })
  }

  const cariDuzenlemeKaydet = async (id) => {
    const guncelListe = aktifCariListesi.map((item) => {
      if (item.id !== id) return item
      return {
        ...item,
        tarih: duzCari.tarih,
        tarih_tahsilat: duzCari.tarih,
        evrak_no: duzCari.evrak_no,
        gider_aciklama: duzCari.gider_aciklama,
        resmi_harcama: temizleTutar(duzCari.resmi_harcama),
        gayriresmi_harcama: temizleTutar(duzCari.gayriresmi_harcama),
        gelir_aciklama: duzCari.gelir_aciklama,
        tahsilat_resmi: temizleTutar(duzCari.tahsilat_resmi),
        tahsilat_elden: temizleTutar(duzCari.tahsilat_elden),
        not_metni: duzCari.not_metni
      }
    })

    await veriyiKaydet({
      ...veri,
      cariKayitlar: {
        ...veri.cariKayitlar,
        [aktifProje.id]: guncelListe
      }
    })
    setDuzenlenenCariId(null)
  }

  const cariSatirSil = async (satir) => {
    if (!window.confirm('Bu işlem satırını silmek istediğinize emin misiniz?')) return
    if (satir.belge_url && isGoogleDriveUrl(satir.belge_url)) {
      try {
        await moveToSilinenler(satir.belge_url, `Danismanliklar/${aktifProje.ad}`)
      } catch (err) {
        console.warn('Silinen belge taşınamadı:', err)
      }
    }
    const guncelListe = aktifCariListesi.filter((x) => x.id !== satir.id)
    await veriyiKaydet({
      ...veri,
      cariKayitlar: {
        ...veri.cariKayitlar,
        [aktifProje.id]: guncelListe
      }
    })
  }

  // İmalat İşlemleri
  const imalatEkle = async (e) => {
    e.preventDefault()
    if (!yeniIsKalemi.trim()) return
    const yeni = {
      id: `yc-imalat-${Date.now()}`,
      sira: aktifImalatListesi.length + 1,
      is_kalemi: yeniIsKalemi.trim(),
      birim_fiyat: yeniBirimFiyat.trim(),
      firma_kisi: yeniFirmaKisi.trim(),
      durum: yeniImalatDurum,
      not_metni: yeniImalatNot.trim()
    }
    await veriyiKaydet({
      ...veri,
      imalatKayitlar: {
        ...veri.imalatKayitlar,
        [aktifProje.id]: [...aktifImalatListesi, yeni]
      }
    })
    setYeniIsKalemi('')
    setYeniBirimFiyat('')
    setYeniFirmaKisi('')
    setYeniImalatNot('')
  }

  const imalatDuzenlemeKaydet = async (id) => {
    const guncel = aktifImalatListesi.map((x) => (x.id === id ? { ...x, ...duzImalat } : x))
    await veriyiKaydet({
      ...veri,
      imalatKayitlar: {
        ...veri.imalatKayitlar,
        [aktifProje.id]: guncel
      }
    })
    setDuzenlenenImalatId(null)
  }

  const imalatSil = async (id) => {
    if (!window.confirm('Bu imalat kalemini silmek istediğinize emin misiniz?')) return
    const guncel = aktifImalatListesi.filter((x) => x.id !== id)
    await veriyiKaydet({
      ...veri,
      imalatKayitlar: {
        ...veri.imalatKayitlar,
        [aktifProje.id]: guncel
      }
    })
  }

  // Çalışma Notu İşlemleri
  const calismaNotuEkle = async (e) => {
    e.preventDefault()
    if (!yeniNotBaslik.trim()) return
    const yeni = {
      id: `yc-not-${Date.now()}`,
      kategori: yeniNotKategori,
      baslik: yeniNotBaslik.trim(),
      detay: yeniNotDetay.trim(),
      tamamlandi: false,
      tarih: bugun()
    }
    await veriyiKaydet({
      ...veri,
      calismaNotlari: {
        ...veri.calismaNotlari,
        [aktifProje.id]: [yeni, ...aktifNotListesi]
      }
    })
    setYeniNotBaslik('')
    setYeniNotDetay('')
  }

  const notDurumDegistir = async (id) => {
    const guncel = aktifNotListesi.map((n) => (n.id === id ? { ...n, tamamlandi: !n.tamamlandi } : n))
    await veriyiKaydet({
      ...veri,
      calismaNotlari: {
        ...veri.calismaNotlari,
        [aktifProje.id]: guncel
      }
    })
  }

  const notSil = async (id) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return
    const guncel = aktifNotListesi.filter((n) => n.id !== id)
    await veriyiKaydet({
      ...veri,
      calismaNotlari: {
        ...veri.calismaNotlari,
        [aktifProje.id]: guncel
      }
    })
  }

  // Yeni Danışmanlık Projesi Ekle
  const yeniProjeOlustur = async (e) => {
    e.preventDefault()
    if (!yeniProjeAd.trim()) return
    const yeniId = `proje-${Date.now()}`
    const yeniProj = {
      id: yeniId,
      ad: yeniProjeAd.trim(),
      musteri_adi: yeniMusteriAd.trim() || yeniProjeAd.trim(),
      kar_payi_orani: Number(yeniKarOrani) || 15,
      aciklama: yeniProjeAciklama.trim(),
      olusturma_tarihi: bugun()
    }
    await veriyiKaydet({
      ...veri,
      aktifProjeId: yeniId,
      projeler: [...veri.projeler, yeniProj],
      cariKayitlar: { ...veri.cariKayitlar, [yeniId]: [] },
      imalatKayitlar: { ...veri.imalatKayitlar, [yeniId]: [] },
      calismaNotlari: { ...veri.calismaNotlari, [yeniId]: [] }
    })
    setYeniProjeAd('')
    setYeniMusteriAd('')
    setYeniProjeAciklama('')
    setProjeModalAcik(false)
  }

  // Kar Oranı Güncelleme
  const karOraniGuncelle = async (yeniOran) => {
    const oran = Math.max(0, Math.min(100, Number(yeniOran) || 0))
    const guncelProjeler = veri.projeler.map((p) =>
      p.id === aktifProje.id ? { ...p, kar_payi_orani: oran } : p
    )
    await veriyiKaydet({
      ...veri,
      projeler: guncelProjeler
    })
  }

  // Mutabakat Dönem Hesaplaması
  const mutabakatHesap = useMemo(() => {
    let basTarih = ''
    let bitTarih = mutabakatBitis || bugun()
    let donemBaslik = 'Tüm Dönem (Başlangıçtan Bugüne)'

    if (mutabakatDonemSecimi === '08_08_sonrasi') {
      basTarih = '2026-08-08'
      donemBaslik = '08.08.2026 Mutabakatı Sonrası Dönem'
    } else if (mutabakatDonemSecimi === '02_10_sonrasi') {
      basTarih = '2026-10-02'
      donemBaslik = '02.10.2026 Mutabakatı Sonrası Dönem'
    } else if (mutabakatDonemSecimi === 'ozel') {
      basTarih = mutabakatBaslangic
      donemBaslik = `${basTarih ? new Date(basTarih).toLocaleDateString('tr-TR') : 'Başlangıç'} - ${
        bitTarih ? new Date(bitTarih).toLocaleDateString('tr-TR') : 'Bugün'
      } Arası`
    }

    const satirlariFiltrele = aktifCariListesi.filter((r) => {
      if (basTarih && (r.tarih || '') < basTarih) return false
      if (bitTarih && (r.tarih || '') > bitTarih) return false
      return true
    })

    let resmiGider = 0
    let gayriresmiGider = 0
    let resmiTahsilat = 0
    let eldenTahsilat = 0

    satirlariFiltrele.forEach((r) => {
      resmiGider += Number(r.resmi_harcama) || 0
      gayriresmiGider += Number(r.gayriresmi_harcama) || 0
      resmiTahsilat += Number(r.tahsilat_resmi) || 0
      eldenTahsilat += Number(r.tahsilat_elden) || 0
    })

    const toplamGider = resmiGider + gayriresmiGider
    const toplamTahsilat = resmiTahsilat + eldenTahsilat
    const karTutari = toplamGider * (karOrani / 100)
    const karDahilMaliyet = toplamGider + karTutari
    const karsizBakiye = toplamTahsilat - toplamGider
    const karDahilBakiye = toplamTahsilat - karDahilMaliyet

    return {
      donemBaslik,
      islemSayisi: satirlariFiltrele.length,
      resmiGider,
      gayriresmiGider,
      toplamGider,
      resmiTahsilat,
      eldenTahsilat,
      toplamTahsilat,
      karTutari,
      karDahilMaliyet,
      karsizBakiye,
      karDahilBakiye,
      satirlar: satirlariFiltrele
    }
  }, [aktifCariListesi, mutabakatDonemSecimi, mutabakatBaslangic, mutabakatBitis, karOrani])

  // WhatsApp Mutabakat Metni Üret
  const mutabakatWpMetniUret = () => {
    const tarihStr = new Date().toLocaleDateString('tr-TR')
    const karsizDurum =
      mutabakatHesap.karsizBakiye < 0
        ? `${paraFormatla(Math.abs(mutabakatHesap.karsizBakiye))} ₺ (${aktifProje.musteri_adi} Borçlu / Ruha Alacaklı)`
        : `${paraFormatla(mutabakatHesap.karsizBakiye)} ₺ (Fazla Ödeme / Alacak)`

    const karDahilDurum =
      mutabakatHesap.karDahilBakiye < 0
        ? `${paraFormatla(Math.abs(mutabakatHesap.karDahilBakiye))} ₺ (Kâr Payı Dahil Net Ödenecek Bakiye)`
        : `${paraFormatla(mutabakatHesap.karDahilBakiye)} ₺ (Fazla Ödeme / Alacak)`

    let metin = `🤝 *${aktifProje.ad.toLocaleUpperCase('tr-TR')} - HESAP MUTABAKAT ÖZETİ*\n`
    metin += `👤 *Sayın:* ${aktifProje.musteri_adi}\n`
    metin += `📅 *Rapor Tarihi:* ${tarihStr}\n`
    metin += `📌 *Kapsam:* ${mutabakatHesap.donemBaslik}\n\n`

    metin += `📉 *1. YAPILAN HARCAMALAR (GİDERLER):*\n`
    metin += `• Resmi Harcamalar (Ruha): *${paraFormatla(mutabakatHesap.resmiGider)} ₺*\n`
    metin += `• Gayri Resmi & ${aktifProje.musteri_adi}: *${paraFormatla(mutabakatHesap.gayriresmiGider)} ₺*\n`
    metin += `• *Genel Toplam Harcama:* *${paraFormatla(mutabakatHesap.toplamGider)} ₺*\n\n`

    metin += `📈 *2. YAPILAN ÖDEMELER (TAHSİLATLAR):*\n`
    metin += `• Tahsilat Resmi (Banka / Çek): *${paraFormatla(mutabakatHesap.resmiTahsilat)} ₺*\n`
    metin += `• Tahsilat & Gayri Resmi Ödeme: *${paraFormatla(mutabakatHesap.eldenTahsilat)} ₺*\n`
    metin += `• *Genel Toplam Tahsilat:* *${paraFormatla(mutabakatHesap.toplamTahsilat)} ₺*\n\n`

    metin += `💼 *3. BORÇ / ALACAK & DANIŞMANLIK ÖZETİ:*\n`
    metin += `• Borç / Alacak Durumu (Ana Para): *${karsizDurum}*\n`
    metin += `• Danışmanlık Hizmet Bedeli (%${karOrani} Kâr Payı): *${paraFormatla(mutabakatHesap.karTutari)} ₺*\n`
    metin += `• Kâr Dahil Toplam Maliyet: *${paraFormatla(mutabakatHesap.karDahilMaliyet)} ₺*\n`
    metin += `• *NET MUTABAKAT BAKİYESİ (%${karOrani} Kâr Dahil):* *${karDahilDurum}*\n`

    return metin
  }

  // Excel İndir (.xlsx) - 4 Sekmeli Birebir Format
  const excelIndir = () => {
    const wb = XLSX.utils.book_new()

    // 1. ANA SAYFA
    const anaSayfaRows = [
      [`YAPILAN HARCAMALARIN %${karOrani} KAR ALINACAK`],
      [],
      ['PROJE / MÜŞTERİ ADI:', aktifProje.musteri_adi],
      ['RAPOR TARİHİ:', new Date().toLocaleDateString('tr-TR')],
      [],
      ['GELİR / GİDER HESAP CETVELİ ÖZETİ'],
      ['Kalem', 'Tutar (TL)'],
      ['Resmi Harcamalar (Ruha Tarafından Yapılan)', genelOzet.toplamResmiHarcama],
      [`Gayri Resmi & ${aktifProje.musteri_adi}`, genelOzet.toplamGayriresmiHarcama],
      ['GENEL TOPLAM HARCAMA (ANA PARA)', genelOzet.genelToplamHarcama],
      [`Danışmanlık Hizmet Kâr Payı (%${karOrani})`, genelOzet.hesaplananKarPayi],
      ['KÂR PAYI DAHİL TOPLAM MALİYET', genelOzet.karDahilToplamHakEdis],
      [],
      ['Tahsilat Resmi (Banka / Çek)', genelOzet.toplamTahsilatResmi],
      ['Tahsilat & Gayri Resmi Ödeme (Nakit / Direkt Ödeme)', genelOzet.toplamTahsilatElden],
      ['GENEL TOPLAM TAHSİLAT', genelOzet.genelToplamTahsilat],
      [],
      ['BORÇ / ALACAK DURUMU (ANA PARA)', genelOzet.netBakiyeKarsiz],
      [`NET HESAP BAKİYESİ (%${karOrani} KÂR PAYI DAHİL)`, genelOzet.netBakiyeKarDahil]
    ]
    const wsAna = XLSX.utils.aoa_to_sheet(anaSayfaRows)
    XLSX.utils.book_append_sheet(wb, wsAna, 'ANA SAYFA')

    // 2. CARİ
    const cariHeader = [
      'TARİH',
      'İŞLEM TÜRÜ',
      'EVRAK NO',
      'GİDER AÇIKLAMA',
      'Resmi Harcamalar (Ruha)',
      `Gayri Resmi & ${aktifProje.musteri_adi}`,
      'Toplam Harcama',
      'TARİH 2',
      'GELİR AÇIKLAMA',
      'Tahsilat Resmi (Banka / Çek)',
      'Tahsilat & Gayri Resmi Ödeme',
      'Tahsilat Toplamı',
      'ALACAK / BORÇ',
      'Notlar'
    ]
    const cariBody = hesaplanmisCariSatirlar.map((r) => [
      r.tarih || '',
      r.islem_turu || '',
      r.evrak_no || '',
      r.gider_aciklama || '',
      r.resmi_harcama || 0,
      r.gayriresmi_harcama || 0,
      r.kumHarcama || 0,
      r.tarih_tahsilat || r.tarih || '',
      r.gelir_aciklama || '',
      r.tahsilat_resmi || 0,
      r.tahsilat_elden || 0,
      r.kumTahsilat || 0,
      r.bakiyeKarsiz || 0,
      r.not_metni || ''
    ])
    cariBody.push([
      'TOPLAM',
      '',
      '',
      '',
      genelOzet.toplamResmiHarcama,
      genelOzet.toplamGayriresmiHarcama,
      genelOzet.genelToplamHarcama,
      'TOPLAM',
      '',
      genelOzet.toplamTahsilatResmi,
      genelOzet.toplamTahsilatElden,
      genelOzet.genelToplamTahsilat,
      genelOzet.netBakiyeKarsiz,
      ''
    ])
    const wsCari = XLSX.utils.aoa_to_sheet([cariHeader, ...cariBody])
    XLSX.utils.book_append_sheet(wb, wsCari, 'CARİ')

    // 3. İMALAT DETAY FİYAT VE NOTLARI
    const imalatHeader = ['NO', 'İŞ', 'FİYAT', 'FİRMA / KİŞİ', 'DURUM', 'NOT']
    const imalatBody = aktifImalatListesi.map((im, i) => [
      i + 1,
      im.is_kalemi || '',
      im.birim_fiyat || '',
      im.firma_kisi || '',
      im.durum === 'anlasildi' ? 'Anlaşıldı' : 'Bekliyor / Anlaşılmadı',
      im.not_metni || ''
    ])
    const wsImalat = XLSX.utils.aoa_to_sheet([imalatHeader, ...imalatBody])
    XLSX.utils.book_append_sheet(wb, wsImalat, 'İMALAT DETAY FİYAT VE NOTLARI')

    // 4. ÇALIŞMA NOTLARIMIZ
    const notHeader = ['KATEGORİ', 'ÇALIŞMA NOTU / KARAR', 'DETAY', 'DURUM', 'TARİH']
    const notBody = aktifNotListesi.map((n) => [
      n.kategori || 'Genel',
      n.baslik || '',
      n.detay || '',
      n.tamamlandi ? 'Tamamlandı' : 'Aktif',
      n.tarih || ''
    ])
    const wsNot = XLSX.utils.aoa_to_sheet([notHeader, ...notBody])
    XLSX.utils.book_append_sheet(wb, wsNot, 'ÇALIŞMA NOTLARIMIZ')

    const dosyaAd = `${aktifProje.musteri_adi.replace(/\s+/g, '_')}_Hesap_Mutabakat_${bugun()}.xlsx`
    XLSX.writeFile(wb, dosyaAd)
  }

  // Excel Yükle (.xlsx)
  const excelIceAktar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const wsCari = wb.Sheets['CARİ'] || wb.Sheets[wb.SheetNames[0]]
        if (!wsCari) {
          alert('CARİ sayfası bulunamadı.')
          return
        }
        const rows = XLSX.utils.sheet_to_json(wsCari, { header: 1, defval: '' })
        const yeniCari = []
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i]
          if (String(r[0]).includes('TOPLAM') || String(r[3]).includes('GENEL TOPLAM')) continue
          const resmiH = Number(r[4]) || 0
          const gayriH = Number(r[5]) || 0
          const resmiT = Number(r[9]) || 0
          const eldenT = Number(r[10]) || 0
          const gAcik = String(r[3] || '').trim()
          const tAcik = String(r[8] || '').trim()
          const notStr = String(r[13] || '').trim()
          if (!gAcik && !tAcik && resmiH === 0 && gayriH === 0 && resmiT === 0 && eldenT === 0 && !notStr) continue

          let tarihIso = bugun()
          if (typeof r[0] === 'number' && r[0] > 40000) {
            const d = new Date(Math.floor(r[0] - 25569) * 86400 * 1000)
            tarihIso = d.toISOString().slice(0, 10)
          } else if (typeof r[0] === 'string' && r[0].trim()) {
            tarihIso = r[0].trim()
          }

          yeniCari.push({
            id: `yc-imp-${Date.now()}-${i}`,
            sira: yeniCari.length + 1,
            tarih: tarihIso,
            islem_turu: String(r[1] || '').trim(),
            evrak_no: String(r[2] || '').trim(),
            gider_aciklama: gAcik,
            resmi_harcama: resmiH,
            gayriresmi_harcama: gayriH,
            tarih_tahsilat: tarihIso,
            gelir_aciklama: tAcik,
            tahsilat_resmi: resmiT,
            tahsilat_elden: eldenT,
            not_metni: notStr,
            belge_url: ''
          })
        }

        if (yeniCari.length > 0) {
          if (
            window.confirm(
              `Excel dosyasından ${yeniCari.length} adet cari işlem okundu. Mevcut listeyi bu verilerle güncellemek ister misiniz?`
            )
          ) {
            await veriyiKaydet({
              ...veri,
              cariKayitlar: {
                ...veri.cariKayitlar,
                [aktifProje.id]: yeniCari
              }
            })
          }
        }
      } catch (err) {
        alert('Excel dosyası okunurken hata oluştu: ' + err.message)
      }
      e.target.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  // Bugünkü tarih ile hızlı Mutabakat Şerhi ekleme
  const hizliMutabakatSatiriEkle = async () => {
    const notCevap = window.prompt(
      'Mutabakat satırı için özel bir not / şerh girmek ister misiniz?',
      `Ana Para Bakiyesi: ${paraFormatla(genelOzet.netBakiyeKarsiz)} ₺ | %${karOrani} Kâr Dahil Net Bakiye: ${paraFormatla(genelOzet.netBakiyeKarDahil)} ₺`
    )
    if (notCevap === null) return

    const tarihStr = new Date().toLocaleDateString('tr-TR')
    const yeniKayit = {
      id: `yc-mut-${Date.now()}`,
      sira: aktifCariListesi.length + 1,
      tarih: bugun(),
      islem_turu: 'mutabakat',
      evrak_no: '',
      gider_aciklama: `Mutabakat Tarihi ${tarihStr}`,
      resmi_harcama: 0,
      gayriresmi_harcama: 0,
      tarih_tahsilat: bugun(),
      gelir_aciklama: `Mutabakat Tarihi ${tarihStr}`,
      tahsilat_resmi: 0,
      tahsilat_elden: 0,
      not_metni: notCevap,
      belge_url: ''
    }

    await veriyiKaydet({
      ...veri,
      cariKayitlar: {
        ...veri.cariKayitlar,
        [aktifProje.id]: [...aktifCariListesi, yeniKayit]
      }
    })
  }

  return (
    <div className="sayfa" style={{ maxWidth: 1460, margin: '0 auto', paddingBottom: 110 }}>
      {/* ÜST GLASS BAŞLIK VE PROJE SEÇİCİ */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 20,
          padding: '18px 22px',
          marginBottom: 18,
          border: '1px solid #E2E8F0',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 6px 16px rgba(79, 70, 229, 0.22)'
            }}
          >
            💼
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.4px' }}>
                Danışmanlık & Mutabakat Yönetimi
              </h1>
              <span
                style={{
                  background: '#F3E8FF',
                  color: '#6B21A8',
                  border: '1px solid #D8B4FE',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                %{karOrani} Kâr Payı Danışmanlığı
              </span>
              {kayitDurumu && (
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>{kayitDurumu}</span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748B' }}>
              {aktifProje.aciklama || 'Ruha & Müşteri harcamaları, tahsilatlar, imalat birim fiyatları ve anlık mutabakat cetveli'}
            </p>
          </div>
        </div>

        {/* Sağ Aksiyonlar & Proje Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFormAcik(true)}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 6px 16px rgba(79, 70, 229, 0.28)'
            }}
          >
            <span>➕</span> Yeni İşlem Kaydet
          </button>

          <select
            value={aktifProje.id}
            onChange={(e) => veriyiKaydet({ ...veri, aktifProjeId: e.target.value })}
            style={{
              width: 'auto',
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              fontWeight: 700,
              fontSize: 13,
              background: '#fff',
              color: '#0F172A',
              cursor: 'pointer',
              margin: 0
            }}
          >
            {veri.projeler.map((p) => (
              <option key={p.id} value={p.id}>
                🏗️ {p.ad} (%{p.kar_payi_orani} Kâr)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setProjeModalAcik(true)}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Yeni Danışmanlık Projesi Ekle"
          >
            + Yeni Proje
          </button>

          <button
            type="button"
            onClick={excelIndir}
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              border: 'none',
              background: '#10B981',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
            }}
          >
            <span>📊</span> Excel İndir
          </button>

          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={excelIceAktar}
          />
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #CBD5E1',
              background: '#fff',
              color: '#475569',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Excel dosyasından içe aktar"
          >
            📥 Excel Yükle
          </button>
        </div>
      </div>

      {/* ÜST ÖZET KARTLARI:
          EN SOLDA: MOR (%15 Danışmanlık Kâr Payı & Kâr Dahil Maliyet/Bakiye Kartı)
          YANINDA 3 CARİ INFO BOX:
            1. KIRMIZI (Başta): Toplam Yapılan Harcama
            2. YEŞİL (İkinci): Toplam Tahsilat
            3. INFO BOX (Üçüncü): Borç / Alacak Durumu
      */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 14,
          marginBottom: 18
        }}
      >
        {/* EN SOLDA: MOR KART (%15 Danışmanlık Kâr Payı & Kâr Dahil Özet) */}
        <div
          style={{
            background: 'linear-gradient(145deg, #FAF5FF 0%, #FFFFFF 100%)',
            borderRadius: 18,
            padding: '18px 20px',
            border: '1.5px solid #D8B4FE',
            boxShadow: '0 8px 24px rgba(126, 34, 206, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                %{karOrani} DANIŞMANLIK KÂR PAYI
              </span>
              <span
                style={{
                  background: '#F3E8FF',
                  color: '#7E22CE',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999
                }}
              >
                Hizmet Bedeli
              </span>
            </div>

            <div style={{ fontSize: 23, fontWeight: 900, color: '#7E22CE', marginBottom: 10, letterSpacing: '-0.5px' }}>
              +{paraFormatla(genelOzet.hesaplananKarPayi)} ₺
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', borderTop: '1px solid #E9D5FF', paddingTop: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Kâr Dahil Toplam Maliyet:</span>
              <strong style={{ color: '#581C87' }}>{paraFormatla(genelOzet.karDahilToplamHakEdis)} ₺</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>%{karOrani} Kâr Dahil Net Bakiye:</span>
              <strong style={{ color: '#6B21A8', fontWeight: 800 }}>{paraFormatla(genelOzet.netBakiyeKarDahil)} ₺</strong>
            </div>
          </div>
        </div>

        {/* 1. KIRMIZI KART (BAŞTA): TOPLAM YAPILAN HARCAMA */}
        <div
          style={{
            background: 'linear-gradient(145deg, #FFF1F2 0%, #FFFFFF 100%)',
            borderRadius: 18,
            padding: '18px 20px',
            border: '1.5px solid #FECDD3',
            boxShadow: '0 8px 24px rgba(225, 29, 72, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#BE123C', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                1. TOPLAM YAPILAN HARCAMA
              </span>
              <span
                style={{
                  background: '#FFE4E6',
                  color: '#E11D48',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999
                }}
              >
                Giderler
              </span>
            </div>
            <div style={{ fontSize: 23, fontWeight: 900, color: '#E11D48', marginBottom: 10, letterSpacing: '-0.5px' }}>
              {paraFormatla(genelOzet.genelToplamHarcama)} ₺
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', borderTop: '1px solid #FFE4E6', paddingTop: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Resmi Harcamalar (Ruha):</span>
              <strong style={{ color: '#0F172A' }}>{paraFormatla(genelOzet.toplamResmiHarcama)} ₺</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gayri Resmi & {aktifProje.musteri_adi}:</span>
              <strong style={{ color: '#0F172A' }}>{paraFormatla(genelOzet.toplamGayriresmiHarcama)} ₺</strong>
            </div>
          </div>
        </div>

        {/* 2. YEŞİL KART (İKİNCİ): TOPLAM TAHSİLAT */}
        <div
          style={{
            background: 'linear-gradient(145deg, #ECFDF5 0%, #FFFFFF 100%)',
            borderRadius: 18,
            padding: '18px 20px',
            border: '1.5px solid #A7F3D0',
            boxShadow: '0 8px 24px rgba(5, 150, 105, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                2. TOPLAM TAHSİLAT ({aktifProje.musteri_adi})
              </span>
              <span
                style={{
                  background: '#D1FAE5',
                  color: '#059669',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999
                }}
              >
                Gelirler
              </span>
            </div>
            <div style={{ fontSize: 23, fontWeight: 900, color: '#059669', marginBottom: 10, letterSpacing: '-0.5px' }}>
              {paraFormatla(genelOzet.genelToplamTahsilat)} ₺
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', borderTop: '1px solid #D1FAE5', paddingTop: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tahsilat Resmi (Banka / Çek):</span>
              <strong style={{ color: '#0F172A' }}>{paraFormatla(genelOzet.toplamTahsilatResmi)} ₺</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tahsilat & Gayri Resmi Ödeme:</span>
              <strong style={{ color: '#0F172A' }}>{paraFormatla(genelOzet.toplamTahsilatElden)} ₺</strong>
            </div>
          </div>
        </div>

        {/* 3. INFO BOX (ÜÇÜNCÜ): BORÇ / ALACAK DURUMU */}
        <div
          style={{
            background: 'linear-gradient(145deg, #EFF6FF 0%, #FFFFFF 100%)',
            borderRadius: 18,
            padding: '18px 20px',
            border: '1.5px solid #BFDBFE',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                3. BORÇ / ALACAK DURUMU
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: genelOzet.netBakiyeKarsiz < 0 ? '#FEE2E2' : '#DCFCE7',
                  color: genelOzet.netBakiyeKarsiz < 0 ? '#B91C1C' : '#15803D',
                  fontWeight: 800
                }}
              >
                {genelOzet.netBakiyeKarsiz < 0 ? 'RUHA ALACAKLI' : 'FAZLA TAHSİLAT'}
              </span>
            </div>

            <div
              style={{
                fontSize: 23,
                fontWeight: 900,
                color: genelOzet.netBakiyeKarsiz < 0 ? '#DC2626' : '#059669',
                marginBottom: 10,
                letterSpacing: '-0.5px'
              }}
            >
              {paraFormatla(genelOzet.netBakiyeKarsiz)} ₺
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#475569', borderTop: '1px solid #DBEAFE', paddingTop: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Durum ({aktifProje.musteri_adi}):</span>
              <strong style={{ color: '#1E293B' }}>
                {genelOzet.netBakiyeKarsiz < 0
                  ? `${paraFormatla(Math.abs(genelOzet.netBakiyeKarsiz))} ₺ Borçlu`
                  : `${paraFormatla(genelOzet.netBakiyeKarsiz)} ₺ Alacaklı`}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>%{karOrani} Kâr Dahil Toplam Alacak:</span>
              <strong style={{ color: '#1D4ED8', fontWeight: 800 }}>
                {paraFormatla(Math.abs(genelOzet.netBakiyeKarDahil))} ₺
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* SEKME (TAB) MENÜSÜ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 8,
          background: '#FFFFFF',
          padding: 6,
          borderRadius: 14,
          marginBottom: 18,
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
        }}
      >
        {[
          { id: 'cari', etiket: `📒 Cari Hesap & Harcamalar (${aktifCariListesi.length})` },
          { id: 'mutabakat', etiket: '🤝 Mutabakat Merkezi & WhatsApp Raporu' },
          { id: 'imalat', etiket: `🏗️ İmalat Detay & Birim Fiyatlar (${aktifImalatListesi.length})` },
          { id: 'notlar', etiket: `📝 Çalışma Notlarımız (${aktifNotListesi.length})` }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAktifSekme(t.id)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: aktifSekme === t.id ? '1px solid #C7D2FE' : '1px solid transparent',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              background: aktifSekme === t.id ? '#EEF2FF' : 'transparent',
              color: aktifSekme === t.id ? '#4338CA' : '#475569'
            }}
          >
            {t.etiket}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* SEKME 1: CARİ HESAP & HARCAMA / TAHSİLAT CETVELİ */}
      {/* ========================================================= */}
      {aktifSekme === 'cari' && (
        <div>
          {/* SİMETRİK TARİH, FİLTRE VE SIRALAMA KONTROL BARI */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                alignItems: 'end'
              }}
            >
              {/* 1. Arama Kutusu */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase' }}>
                  🔍 İşlem / Firma / Evrak Ara
                </label>
                <input
                  type="text"
                  placeholder="Taşeron, açıklama, evrak no..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  style={ORTAK_INPUT_STIL}
                />
              </div>

              {/* 2. Kategori Filtresi */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase' }}>
                  📂 Sütun / İşlem Filtresi
                </label>
                <select
                  value={turFiltre}
                  onChange={(e) => setTurFiltre(e.target.value)}
                  style={{ ...ORTAK_INPUT_STIL, fontWeight: 600, cursor: 'pointer' }}
                >
                  <option value="hepsi">Tüm İşlemler ({hesaplanmisCariSatirlar.length})</option>
                  <option value="resmi_gider">Resmi Harcamalar (Ruha)</option>
                  <option value="gayriresmi_gider">Gayri Resmi & {aktifProje.musteri_adi}</option>
                  <option value="resmi_tahsilat">Tahsilat Resmi (Banka / Çek)</option>
                  <option value="gayriresmi_tahsilat">Tahsilat & Gayri Resmi Ödeme</option>
                  <option value="karsilikli">Karşılıklı ({aktifProje.musteri_adi} Direkt Ödedi)</option>
                  <option value="mutabakat">Mutabakat Satırları</option>
                  <option value="notlu">Notu Olan Satırlar</option>
                </select>
              </div>

              {/* 3. Başlangıç Tarihi */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase' }}>
                  📅 Başlangıç Tarihi
                </label>
                <input
                  type="date"
                  value={baslangicTarih}
                  onChange={(e) => setBaslangicTarih(e.target.value)}
                  style={ORTAK_INPUT_STIL}
                />
              </div>

              {/* 4. Bitiş Tarihi */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase' }}>
                  📅 Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={bitisTarih}
                  onChange={(e) => setBitisTarih(e.target.value)}
                  style={ORTAK_INPUT_STIL}
                />
              </div>

              {/* 5. Tarih Sıralaması */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 5, textTransform: 'uppercase' }}>
                  🔃 Tarih Sıralaması
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSiralamaYon((prev) => (prev === 'eskiden_yeniye' ? 'yeniden_eskiye' : 'eskiden_yeniye'))
                  }
                  style={{
                    ...ORTAK_INPUT_STIL,
                    background: '#F8FAFC',
                    color: '#334155',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  title="Tarih Sıralamasını Değiştir"
                >
                  {siralamaYon === 'eskiden_yeniye' ? '⬆️ Eskiden Yeniye' : '⬇️ Yeniden Eskiye'}
                </button>
              </div>
            </div>

            {/* Aktif Filtre Temizleme & Hızlı Mutabakat Şerhi Alt Satırı */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid #F1F5F9',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>
                  Gösterilen: <strong style={{ color: '#0F172A' }}>{filtrelenmisCariSatirlar.length}</strong> / {hesaplanmisCariSatirlar.length} kayıt
                </span>
                {filtrelenmisCariSatirlar.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleGoruntulenenTumu}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#334155',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {filtrelenmisCariSatirlar.every((r) => seciliSatirIdleri.includes(r.id))
                      ? '☑️ Listelenenlerin Seçimini Kaldır'
                      : '☑️ Listelenen Tümünü Seç'}
                  </button>
                )}
                {seciliSatirIdleri.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSeciliSatirIdleri([])}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#F1F5F9',
                      color: '#64748B',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Tüm Seçimleri Sıfırla ({seciliSatirIdleri.length})
                  </button>
                )}
                {(aramaMetni || turFiltre !== 'hepsi' || baslangicTarih || bitisTarih) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAramaMetni('')
                      setTurFiltre('hepsi')
                      setBaslangicTarih('')
                      setBitisTarih('')
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#FEE2E2',
                      color: '#B91C1C',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Filtreleri Temizle
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={hizliMutabakatSatiriEkle}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #FDE68A',
                  background: '#FFFBEB',
                  color: '#B45309',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🤝 Bugünün Tarihiyle Ara Mutabakat Şerhi Ekle
              </button>
            </div>
          </div>

          {/* SEÇİLEN SATIRLAR TOPLAMLAR BARI (FİLTRELENEN YA DA SEÇİLENLERİN TOPLAMI) */}
          {seciliOzet && (
            <div
              style={{
                background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
                borderRadius: 16,
                padding: '14px 18px',
                marginBottom: 16,
                color: '#FFFFFF',
                boxShadow: '0 8px 24px rgba(49, 46, 129, 0.22)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: '#4F46E5',
                    color: '#EEF2FF',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800
                  }}
                >
                  ✓ {seciliOzet.adet} SATIR SEÇİLDİ
                </span>
                <span style={{ fontSize: 13, color: '#C7D2FE', fontWeight: 600 }}>
                  Seçilen Kalemlerin Anlık Toplamı:
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
                <div>
                  <span style={{ color: '#FCA5A5', display: 'block', fontSize: 11, fontWeight: 600 }}>
                    Seçili Harcama (Gider):
                  </span>
                  <strong style={{ fontSize: 15, color: '#FEE2E2', fontWeight: 800 }}>
                    {paraFormatla(seciliOzet.toplamHarcama)} ₺
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#86EFAC', display: 'block', fontSize: 11, fontWeight: 600 }}>
                    Seçili Tahsilat (Gelir):
                  </span>
                  <strong style={{ fontSize: 15, color: '#DCFCE7', fontWeight: 800 }}>
                    {paraFormatla(seciliOzet.toplamTahsilat)} ₺
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#93C5FD', display: 'block', fontSize: 11, fontWeight: 600 }}>
                    Net Fark (Ana Para):
                  </span>
                  <strong
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: seciliOzet.bakiyeKarsiz < 0 ? '#FCA5A5' : '#86EFAC'
                    }}
                  >
                    {paraFormatla(seciliOzet.bakiyeKarsiz)} ₺
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#D8B4FE', display: 'block', fontSize: 11, fontWeight: 600 }}>
                    %{karOrani} Kâr Dahil:
                  </span>
                  <strong style={{ fontSize: 15, color: '#F5D0FE', fontWeight: 800 }}>
                    {paraFormatla(seciliOzet.bakiyeKarDahil)} ₺
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => setSeciliSatirIdleri([])}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ✕ Seçimi Temizle
                </button>
              </div>
            </div>
          )}

          {/* POP-UP MODAL: YENİ İŞLEM & ÖDEME KAYIT PANELİ */}
          {formAcik && (
            <div
              className="modal-arka-plan"
              onClick={() => setFormAcik(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: 16
              }}
            >
              <form
                onSubmit={cariIslemEkle}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 22,
                  padding: '24px 26px',
                  width: '100%',
                  maxWidth: 720,
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)'
                }}
              >
                {/* Pop-up Üst Başlık */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                      ➕ Yeni Harcama veya Tahsilat Kaydı
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748B' }}>
                      İşlemin kaydedileceği sütunu seçiniz; açıklamalar ve karşı kayıtlar otomatik ayarlanır.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIslemKategori('mutabakat')}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: islemKategori === 'mutabakat' ? '2px solid #D97706' : '1px solid #FDE68A',
                        background: islemKategori === 'mutabakat' ? '#FEF3C7' : '#FFFBEB',
                        color: '#B45309',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🤝 Mutabakat Satırı
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAcik(false)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#475569',
                        fontSize: 16,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Kapat"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* 4 SÜTUNA BİREBİR KARŞILIK GELEN SİMETRİK 2x2 SEÇİM KARTLARI */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 10,
                    marginBottom: 16
                  }}
                >
                  {/* 1. Resmi Harcamalar (Ruha) */}
                  <div
                    onClick={() => setIslemKategori('resmi_harcama')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: islemKategori === 'resmi_harcama' ? '2px solid #E11D48' : '1px solid #E2E8F0',
                      background: islemKategori === 'resmi_harcama' ? '#FFF1F2' : '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#BE123C', marginBottom: 3 }}>
                      1. Resmi Harcamalar (Ruha)
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                      Ruha tarafından yapılan resmi (faturalı/banka) harcamalar.
                    </div>
                  </div>

                  {/* 2. Gayri Resmi & Yasin Çiçen */}
                  <div
                    onClick={() => setIslemKategori('gayriresmi_harcama')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: islemKategori === 'gayriresmi_harcama' ? '2px solid #EA580C' : '1px solid #E2E8F0',
                      background: islemKategori === 'gayriresmi_harcama' ? '#FFF7ED' : '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#C2410C', marginBottom: 3 }}>
                      2. Gayri Resmi & {aktifProje.musteri_adi}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                      Ruha yaptı ({aktifProje.musteri_adi} borçlandı) veya {aktifProje.musteri_adi} kendisi ödedi.
                    </div>
                  </div>

                  {/* 3. Tahsilat Resmi */}
                  <div
                    onClick={() => setIslemKategori('tahsilat_resmi')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: islemKategori === 'tahsilat_resmi' ? '2px solid #059669' : '1px solid #E2E8F0',
                      background: islemKategori === 'tahsilat_resmi' ? '#ECFDF5' : '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#047857', marginBottom: 3 }}>
                      3. Tahsilat Resmi (Banka / Çek)
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                      Banka hesabına atılan EFT/Havale veya çek ile gönderilenler.
                    </div>
                  </div>

                  {/* 4. Tahsilat & Gayri Resmi Ödeme */}
                  <div
                    onClick={() => setIslemKategori('tahsilat_gayriresmi')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: islemKategori === 'tahsilat_gayriresmi' ? '2px solid #0D9488' : '1px solid #E2E8F0',
                      background: islemKategori === 'tahsilat_gayriresmi' ? '#F0FDFA' : '#F8FAFC',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0F766E', marginBottom: 3 }}>
                      4. Tahsilat & Gayri Resmi Ödeme
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.35 }}>
                      Bize elden nakit getirilen veya kendisinin direkt yaptığı ödeme.
                    </div>
                  </div>
                </div>

                {/* ALT İHTİMAL SEÇİCİLERİ (Gayri Resmi & Yasin Çiçen VEYA Tahsilat & Gayri Resmi Ödeme seçildiğinde) */}
                {islemKategori === 'gayriresmi_harcama' && (
                  <div
                    style={{
                      background: '#FFF7ED',
                      border: '1px solid #FED7AA',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 10
                    }}
                  >
                    <label
                      onClick={() => setGayriresmiGiderAltTur('ruha_yapti')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: gayriresmiGiderAltTur === 'ruha_yapti' ? '#FFFFFF' : 'transparent',
                        border: gayriresmiGiderAltTur === 'ruha_yapti' ? '2px solid #EA580C' : '1px solid #FDBA74',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      <input
                        type="radio"
                        name="gayriresmiGiderAltTur"
                        checked={gayriresmiGiderAltTur === 'ruha_yapti'}
                        onChange={() => setGayriresmiGiderAltTur('ruha_yapti')}
                        style={{ width: 16, height: 16, margin: 0, accentColor: '#EA580C' }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>
                          İhtimal 1: Ruha Yaptı ({aktifProje.musteri_adi} Borçlandı)
                        </div>
                        <div style={{ fontSize: 11, color: '#7C2D12' }}>
                          Sadece Gayri Resmi & {aktifProje.musteri_adi} harcama sütununa yazılır.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setGayriresmiGiderAltTur('yasin_odedi')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: gayriresmiGiderAltTur === 'yasin_odedi' ? '#FFFFFF' : 'transparent',
                        border: gayriresmiGiderAltTur === 'yasin_odedi' ? '2px solid #EA580C' : '1px solid #FDBA74',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      <input
                        type="radio"
                        name="gayriresmiGiderAltTur"
                        checked={gayriresmiGiderAltTur === 'yasin_odedi'}
                        onChange={() => setGayriresmiGiderAltTur('yasin_odedi')}
                        style={{ width: 16, height: 16, margin: 0, accentColor: '#EA580C' }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#9A3412' }}>
                          İhtimal 2: {aktifProje.musteri_adi} Ödedi (Aynı Anda Gelire Yazılır)
                        </div>
                        <div style={{ fontSize: 11, color: '#7C2D12' }}>
                          Hem Gayri Resmi Harcamaya hem de Tahsilat & Gayri Resmi Ödeme sütununa yazılır.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {islemKategori === 'tahsilat_gayriresmi' && (
                  <div
                    style={{
                      background: '#F0FDFA',
                      border: '1px solid #99F6E4',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 10
                    }}
                  >
                    <label
                      onClick={() => setGayriresmiTahsilatAltTur('nakit_getirdi')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: gayriresmiTahsilatAltTur === 'nakit_getirdi' ? '#FFFFFF' : 'transparent',
                        border: gayriresmiTahsilatAltTur === 'nakit_getirdi' ? '2px solid #0D9488' : '1px solid #5EEAD4',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      <input
                        type="radio"
                        name="gayriresmiTahsilatAltTur"
                        checked={gayriresmiTahsilatAltTur === 'nakit_getirdi'}
                        onChange={() => setGayriresmiTahsilatAltTur('nakit_getirdi')}
                        style={{ width: 16, height: 16, margin: 0, accentColor: '#0D9488' }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#115E59' }}>
                          İhtimal 1: Bize Nakit Getirdi (Elden Tahsilat)
                        </div>
                        <div style={{ fontSize: 11, color: '#0F766E' }}>
                          Sadece Tahsilat & Gayri Resmi Ödeme sütununa yazılır, borcundan düşer.
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setGayriresmiTahsilatAltTur('direkt_odedi')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: gayriresmiTahsilatAltTur === 'direkt_odedi' ? '#FFFFFF' : 'transparent',
                        border: gayriresmiTahsilatAltTur === 'direkt_odedi' ? '2px solid #0D9488' : '1px solid #5EEAD4',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      <input
                        type="radio"
                        name="gayriresmiTahsilatAltTur"
                        checked={gayriresmiTahsilatAltTur === 'direkt_odedi'}
                        onChange={() => setGayriresmiTahsilatAltTur('direkt_odedi')}
                        style={{ width: 16, height: 16, margin: 0, accentColor: '#0D9488' }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#115E59' }}>
                          İhtimal 2: Kendisi Direkt Ödeme Yaptı (Harcamaya da Yazılır)
                        </div>
                        <div style={{ fontSize: 11, color: '#0F766E' }}>
                          Hem Tahsilat & Gayri Resmi Ödeme hem de Gayri Resmi & {aktifProje.musteri_adi} harcamasına yazılır.
                        </div>
                      </div>
                    </label>
                  </div>
                )}

                {/* SİMETRİK POP-UP GİRİŞ ALANLARI */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12
                  }}
                >
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                      📅 İşlem Tarihi
                    </label>
                    <input
                      type="date"
                      value={yeniTarih}
                      onChange={(e) => setYeniTarih(e.target.value)}
                      style={ORTAK_INPUT_STIL}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                      🧾 Evrak / Çek / Fiş No
                    </label>
                    <input
                      type="text"
                      placeholder="Opsiyonel (Fatura/Çek No)"
                      value={yeniEvrakNo}
                      onChange={(e) => setYeniEvrakNo(e.target.value)}
                      style={ORTAK_INPUT_STIL}
                    />
                  </div>

                  {islemKategori !== 'mutabakat' && (
                    <div>
                      <label style={{ fontSize: 11.5, fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: 5 }}>
                        💰 İşlem Tutarı (₺)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={yeniTutar}
                        onChange={(e) => setYeniTutar(formatInputTutar(e.target.value))}
                        style={{
                          ...ORTAK_INPUT_STIL,
                          fontWeight: 800,
                          fontSize: 14,
                          borderColor: '#94A3B8',
                          background: '#F8FAFC'
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                      📎 Dekont / Belge (Drive)
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setYeniBelge(e.target.files?.[0] || null)}
                      style={{ ...ORTAK_INPUT_STIL, paddingTop: 7, fontSize: 11.5 }}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                      📝 {islemKategori.startsWith('tahsilat') ? 'Tahsilat / Ödeme Açıklaması' : 'Harcama / Gider Açıklaması'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        islemKategori === 'resmi_harcama'
                          ? 'Örn: BETONS KOLAÇOĞLU / DEMİR ÖDEMESİ (Ruha Resmi)'
                          : islemKategori === 'gayriresmi_harcama'
                          ? 'Örn: [MF] KALIP İŞÇİLİK / İSKİ HARÇLARI'
                          : islemKategori === 'tahsilat_resmi'
                          ? 'Örn: BANKA HESABINA GELEN EFT / ÇEK TAHSİLATI'
                          : 'Örn: ELDEN NAKİT TAHSİLAT / DOĞRUDAN ÖDEME'
                      }
                      value={yeniAciklama}
                      onChange={(e) => setYeniAciklama(e.target.value)}
                      style={ORTAK_INPUT_STIL}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 5 }}>
                      📌 Not / Şerh (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ek bilgi veya kontrol notu..."
                      value={yeniNot}
                      onChange={(e) => setYeniNot(e.target.value)}
                      style={ORTAK_INPUT_STIL}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => setFormAcik(false)}
                    style={{
                      height: 40,
                      padding: '0 18px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      background: '#F8FAFC',
                      color: '#475569',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    style={{
                      height: 40,
                      padding: '0 24px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#4F46E5',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
                    }}
                  >
                    {yukleniyor ? 'Kaydediliyor...' : '✓ Cetvele Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* CARİ HESAP TABLOSU (FERAH APPLE RENK PALETİ - KAHVE/LACİVERT YOK, %15 KÂR SÜTUNU YOK) */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 28px rgba(15, 23, 42, 0.04)',
              overflow: 'hidden'
            }}
          >
            <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12.5,
                  minWidth: 1180
                }}
              >
                <thead>
                  <tr
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      textAlign: 'left',
                      fontSize: 11.5,
                      letterSpacing: '0.2px',
                      borderBottom: '2px solid #CBD5E1'
                    }}
                  >
                    <th style={{ padding: '12px 10px', background: '#F8FAFC', color: '#475569', borderRight: '1px solid #E2E8F0', textAlign: 'center', width: 44 }}>
                      <input
                        type="checkbox"
                        checked={
                          filtrelenmisCariSatirlar.length > 0 &&
                          filtrelenmisCariSatirlar.every((r) => seciliSatirIdleri.includes(r.id))
                        }
                        onChange={toggleGoruntulenenTumu}
                        style={{ width: 16, height: 16, cursor: 'pointer', margin: 0, accentColor: '#4F46E5' }}
                        title="Görüntülenen tüm satırları seç / kaldır"
                      />
                    </th>
                    <th style={{ padding: '12px 10px', background: '#F8FAFC', color: '#475569', borderRight: '1px solid #E2E8F0' }}>
                      #
                    </th>
                    <th style={{ padding: '12px 10px', background: '#F8FAFC', color: '#334155', borderRight: '1px solid #E2E8F0' }}>
                      TARİH
                    </th>
                    <th style={{ padding: '12px 12px', background: '#F8FAFC', color: '#1E293B', borderRight: '1px solid #E2E8F0', minWidth: 215 }}>
                      HARCAMA / GİDER AÇIKLAMA
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#FFF1F2', color: '#BE123C', borderRight: '1px solid #FECDD3' }}>
                      <div>Resmi Harcamalar</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#E11D48', opacity: 0.85 }}>(Ruha Tarafından)</div>
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#FFF7ED', color: '#C2410C', borderRight: '1px solid #FED7AA' }}>
                      <div>Gayri Resmi & {aktifProje.musteri_adi}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#EA580C', opacity: 0.85 }}>(Ruha veya {aktifProje.musteri_adi})</div>
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#FFE4E6', color: '#9F1239', borderRight: '2px solid #CBD5E1' }}>
                      <div>Toplam Harcama</div>
                      <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>(Kümülatif)</div>
                    </th>
                    <th style={{ padding: '12px 12px', background: '#F8FAFC', color: '#1E293B', borderRight: '1px solid #E2E8F0', minWidth: 185 }}>
                      TAHSİLAT / ÖDEME AÇIKLAMA
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#ECFDF5', color: '#047857', borderRight: '1px solid #A7F3D0' }}>
                      <div>Tahsilat Resmi</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#059669', opacity: 0.85 }}>(Banka / Çek)</div>
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#F0FDFA', color: '#0F766E', borderRight: '1px solid #99F6E4' }}>
                      <div>Tahsilat & Gayri Resmi Ödeme</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#0D9488', opacity: 0.85 }}>(Nakit / Direkt Ödeme)</div>
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#D1FAE5', color: '#065F46', borderRight: '2px solid #CBD5E1' }}>
                      <div>Tahsilat Toplamı</div>
                      <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>(Kümülatif)</div>
                    </th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', background: '#EFF6FF', color: '#1D4ED8', borderRight: '1px solid #BFDBFE' }}>
                      <div>ALACAK / BORÇ</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#2563EB', opacity: 0.85 }}>(Ana Para Bakiye)</div>
                    </th>
                    <th style={{ padding: '12px 12px', background: '#F8FAFC', color: '#334155', minWidth: 170 }}>
                      NOTLAR & BELGE
                    </th>
                    <th style={{ padding: '12px 10px', background: '#F8FAFC', color: '#334155', textAlign: 'center' }}>
                      İŞLEM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtrelenmisCariSatirlar.map((r) => {
                    const isMutabakat =
                      r.islem_turu === 'mutabakat' ||
                      (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes('mutabakat') ||
                      (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes('mutabakat')

                    const isDuzenleniyor = duzenlenenCariId === r.id

                    const satirArkaPlan = isMutabakat
                      ? '#FEF3C7'
                      : r.satirGelirToplam > 0 && r.satirGiderToplam === 0
                      ? '#F0FDF4'
                      : '#FFFFFF'

                    if (isDuzenleniyor) {
                      return (
                        <tr key={r.id} style={{ background: '#EEF2FF', borderBottom: '2px solid #6366F1' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={seciliSatirIdleri.includes(r.id)}
                              onChange={() => toggleSatirSecim(r.id)}
                              style={{ width: 16, height: 16, cursor: 'pointer', margin: 0, accentColor: '#4F46E5' }}
                            />
                          </td>
                          <td style={{ padding: 8, fontWeight: 700 }}>{r.satirNo}</td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="date"
                              value={duzCari.tarih}
                              onChange={(e) => setDuzCari({ ...duzCari, tarih: e.target.value })}
                              style={{ padding: 4, fontSize: 12, margin: 0, width: 115 }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.gider_aciklama}
                              onChange={(e) => setDuzCari({ ...duzCari, gider_aciklama: e.target.value })}
                              style={{ padding: 4, fontSize: 12, margin: 0, width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.resmi_harcama}
                              onChange={(e) =>
                                setDuzCari({ ...duzCari, resmi_harcama: formatInputTutar(e.target.value) })
                              }
                              style={{ padding: 4, fontSize: 12, margin: 0, width: 100, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.gayriresmi_harcama}
                              onChange={(e) =>
                                setDuzCari({ ...duzCari, gayriresmi_harcama: formatInputTutar(e.target.value) })
                              }
                              style={{ padding: 4, fontSize: 12, margin: 0, width: 100, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: 6, textAlign: 'right', color: '#64748B' }}>-</td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.gelir_aciklama}
                              onChange={(e) => setDuzCari({ ...duzCari, gelir_aciklama: e.target.value })}
                              style={{ padding: 4, fontSize: 12, margin: 0, width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.tahsilat_resmi}
                              onChange={(e) =>
                                setDuzCari({ ...duzCari, tahsilat_resmi: formatInputTutar(e.target.value) })
                              }
                              style={{ padding: 4, fontSize: 12, margin: 0, width: 100, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.tahsilat_elden}
                              onChange={(e) =>
                                setDuzCari({ ...duzCari, tahsilat_elden: formatInputTutar(e.target.value) })
                              }
                              style={{ padding: 4, fontSize: 12, margin: 0, width: 100, textAlign: 'right' }}
                            />
                          </td>
                          <td colSpan={2} style={{ padding: 6, textAlign: 'center', color: '#64748B' }}>
                            Otomatik Hesaplanır
                          </td>
                          <td style={{ padding: 6 }}>
                            <input
                              type="text"
                              value={duzCari.not_metni}
                              onChange={(e) => setDuzCari({ ...duzCari, not_metni: e.target.value })}
                              placeholder="Not..."
                              style={{ padding: 4, fontSize: 12, margin: 0, width: '100%' }}
                            />
                          </td>
                          <td style={{ padding: 6, whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => cariDuzenlemeKaydet(r.id)}
                              style={{
                                padding: '4px 8px',
                                background: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                marginRight: 4,
                                fontSize: 11,
                                fontWeight: 700
                              }}
                            >
                              ✓ Kaydet
                            </button>
                            <button
                              type="button"
                              onClick={() => setDuzenlenenCariId(null)}
                              style={{
                                padding: '4px 8px',
                                background: '#E2E8F0',
                                color: '#334155',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 11
                              }}
                            >
                              İptal
                            </button>
                          </td>
                        </tr>
                      )
                    }

                    const isSecili = seciliSatirIdleri.includes(r.id)

                    return (
                      <tr
                        key={r.id}
                        style={{
                          background: isSecili
                            ? '#EDE9FE'
                            : satirArkaPlan,
                          borderBottom: '1px solid #F1F5F9',
                          fontWeight: isMutabakat ? 800 : 500,
                          transition: 'background 0.15s'
                        }}
                      >
                        <td style={{ padding: '9px 10px', textAlign: 'center', borderRight: '1px solid #F1F5F9' }}>
                          <input
                            type="checkbox"
                            checked={isSecili}
                            onChange={() => toggleSatirSecim(r.id)}
                            style={{ width: 16, height: 16, cursor: 'pointer', margin: 0, accentColor: '#4F46E5' }}
                          />
                        </td>
                        <td style={{ padding: '9px 10px', color: '#64748B', borderRight: '1px solid #F1F5F9', fontWeight: 700 }}>
                          {r.satirNo}
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #F1F5F9', color: '#334155' }}>
                          {r.tarih ? new Date(r.tarih).toLocaleDateString('tr-TR') : '-'}
                        </td>
                        <td style={{ padding: '9px 12px', borderRight: '1px solid #F1F5F9', color: isMutabakat ? '#B45309' : '#0F172A', fontWeight: r.gider_aciklama ? 700 : 400 }}>
                          {isMutabakat && <span style={{ marginRight: 6 }}>🤝</span>}
                          {r.gider_aciklama || '-'}
                          {r.evrak_no && (
                            <span style={{ display: 'block', fontSize: 10, color: '#64748B' }}>
                              Evrak: {r.evrak_no}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '1px solid #F1F5F9',
                            color: r.resmi_harcama > 0 ? '#E11D48' : '#CBD5E1',
                            fontWeight: r.resmi_harcama > 0 ? 700 : 400
                          }}
                        >
                          {r.resmi_harcama > 0 ? `${paraFormatla(r.resmi_harcama)} ₺` : '-'}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '1px solid #F1F5F9',
                            color: r.gayriresmi_harcama > 0 ? '#EA580C' : '#CBD5E1',
                            fontWeight: r.gayriresmi_harcama > 0 ? 700 : 400
                          }}
                        >
                          {r.gayriresmi_harcama > 0 ? `${paraFormatla(r.gayriresmi_harcama)} ₺` : '-'}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '2px solid #E2E8F0',
                            background: 'rgba(255, 241, 242, 0.55)',
                            color: '#BE123C',
                            fontWeight: 700
                          }}
                        >
                          {paraFormatla(r.kumHarcama)} ₺
                        </td>
                        <td style={{ padding: '9px 12px', borderRight: '1px solid #F1F5F9', color: '#047857', fontWeight: r.gelir_aciklama ? 700 : 400 }}>
                          {r.gelir_aciklama || '-'}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '1px solid #F1F5F9',
                            color: r.tahsilat_resmi > 0 ? '#059669' : '#CBD5E1',
                            fontWeight: r.tahsilat_resmi > 0 ? 700 : 400
                          }}
                        >
                          {r.tahsilat_resmi > 0 ? `${paraFormatla(r.tahsilat_resmi)} ₺` : '-'}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '1px solid #F1F5F9',
                            color: r.tahsilat_elden > 0 ? '#0D9488' : '#CBD5E1',
                            fontWeight: r.tahsilat_elden > 0 ? 700 : 400
                          }}
                        >
                          {r.tahsilat_elden > 0 ? `${paraFormatla(r.tahsilat_elden)} ₺` : '-'}
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '2px solid #E2E8F0',
                            background: 'rgba(236, 253, 245, 0.55)',
                            color: '#047857',
                            fontWeight: 700
                          }}
                        >
                          {paraFormatla(r.kumTahsilat)} ₺
                        </td>
                        <td
                          style={{
                            padding: '9px 10px',
                            textAlign: 'right',
                            borderRight: '1px solid #F1F5F9',
                            background: 'rgba(239, 246, 255, 0.45)',
                            color: r.bakiyeKarsiz < 0 ? '#DC2626' : '#059669',
                            fontWeight: 800
                          }}
                        >
                          {paraFormatla(r.bakiyeKarsiz)} ₺
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 11.5, color: '#475569', whiteSpace: 'pre-line' }}>
                          {r.not_metni && (
                            <div
                              style={{
                                background: isMutabakat ? '#FDE68A' : '#F8FAFC',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid #E2E8F0',
                                color: '#1E293B'
                              }}
                            >
                              {r.not_metni}
                            </div>
                          )}
                          {r.belge_url && (
                            <a
                              href={getGoogleDriveViewUrl(r.belge_url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-block',
                                marginTop: 4,
                                fontSize: 11,
                                color: '#2563EB',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              📎 Belgeyi Gör
                            </a>
                          )}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => cariDuzenlemeyiAc(r)}
                            className="sil-buton"
                            title="Düzenle"
                            style={{ marginRight: 4 }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            onClick={() => cariSatirSil(r)}
                            className="sil-buton"
                            title="Sil"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* ALT TOPLAM SATIRI (FERAH TEMİZ GÖRÜNÜM) */}
                <tfoot>
                  <tr
                    style={{
                      background: '#F8FAFC',
                      color: '#0F172A',
                      fontWeight: 800,
                      fontSize: 12.5,
                      position: 'sticky',
                      bottom: 0,
                      borderTop: '2px solid #CBD5E1',
                      boxShadow: '0 -4px 12px rgba(15, 23, 42, 0.04)'
                    }}
                  >
                    <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'right', color: '#334155' }}>
                      GENEL TOPLAMLAR ({aktifCariListesi.length} İşlem):
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#BE123C', background: '#FFF1F2' }}>
                      {paraFormatla(genelOzet.toplamResmiHarcama)} ₺
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#C2410C', background: '#FFF7ED' }}>
                      {paraFormatla(genelOzet.toplamGayriresmiHarcama)} ₺
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#9F1239', background: '#FFE4E6', borderRight: '2px solid #CBD5E1' }}>
                      {paraFormatla(genelOzet.genelToplamHarcama)} ₺
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', color: '#334155' }}>TAHSİLAT TOPLAMI:</td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#047857', background: '#ECFDF5' }}>
                      {paraFormatla(genelOzet.toplamTahsilatResmi)} ₺
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#0F766E', background: '#F0FDFA' }}>
                      {paraFormatla(genelOzet.toplamTahsilatElden)} ₺
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: '#065F46', background: '#D1FAE5', borderRight: '2px solid #CBD5E1' }}>
                      {paraFormatla(genelOzet.genelToplamTahsilat)} ₺
                    </td>
                    <td style={{ padding: '14px 10px', textAlign: 'right', color: genelOzet.netBakiyeKarsiz < 0 ? '#DC2626' : '#059669', background: '#EFF6FF' }}>
                      {paraFormatla(genelOzet.netBakiyeKarsiz)} ₺
                    </td>
                    <td colSpan={2} style={{ background: '#F8FAFC' }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 2: MUTABAKAT MERKEZİ & WHATSAPP PAYLAŞIM RAPORU */}
      {/* ========================================================= */}
      {aktifSekme === 'mutabakat' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Sol: Mutabakat Simülatörü ve Hesap Cetveli */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                🤝 Anlık Mutabakat Hesap Cetveli
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Kâr Payı %:</span>
                <input
                  type="number"
                  value={karOrani}
                  onChange={(e) => karOraniGuncelle(e.target.value)}
                  style={{ width: 64, padding: '5px 8px', borderRadius: 8, border: '1px solid #CBD5E1', fontWeight: 800, margin: 0 }}
                />
              </div>
            </div>

            {/* Dönem Seçici */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>
                Mutabakat Dönemi / Kapsamı:
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'tumu', label: '📌 Başlangıçtan Bugüne (Tümü)' },
                  { id: '08_08_sonrasi', label: '📅 08.08.2026 Mutabakatı Sonrası' },
                  { id: '02_10_sonrasi', label: '📅 02.10.2026 Mutabakatı Sonrası' },
                  { id: 'ozel', label: '🗓️ Özel Tarih Aralığı' }
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setMutabakatDonemSecimi(d.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: mutabakatDonemSecimi === d.id ? '2px solid #4F46E5' : '1px solid #CBD5E1',
                      background: mutabakatDonemSecimi === d.id ? '#EEF2FF' : '#F8FAFC',
                      color: mutabakatDonemSecimi === d.id ? '#4338CA' : '#475569',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {mutabakatDonemSecimi === 'ozel' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <input
                    type="date"
                    value={mutabakatBaslangic}
                    onChange={(e) => setMutabakatBaslangic(e.target.value)}
                    style={{ ...ORTAK_INPUT_STIL, flex: 1 }}
                  />
                  <input
                    type="date"
                    value={mutabakatBitis}
                    onChange={(e) => setMutabakatBitis(e.target.value)}
                    style={{ ...ORTAK_INPUT_STIL, flex: 1 }}
                  />
                </div>
              )}
            </div>

            {/* Özet Tablo */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <tbody>
                  <tr style={{ background: '#FFF1F2', borderBottom: '1px solid #FECDD3' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#9F1239' }}>
                      1. Resmi Harcamalar (Ruha Tarafından Yapılan)
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#E11D48' }}>
                      {paraFormatla(mutabakatHesap.resmiGider)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#9A3412' }}>
                      2. Gayri Resmi & {aktifProje.musteri_adi}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#EA580C' }}>
                      {paraFormatla(mutabakatHesap.gayriresmiGider)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#FFE4E6', borderBottom: '2px solid #FDA4AF' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#881337' }}>
                      GENEL TOPLAM HARCAMA (ANA PARA)
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, fontSize: 15, color: '#BE123C' }}>
                      {paraFormatla(mutabakatHesap.toplamGider)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#ECFDF5', borderBottom: '1px solid #A7F3D0' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#065F46' }}>
                      3. Tahsilat Resmi (Banka / Çek)
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                      {paraFormatla(mutabakatHesap.resmiTahsilat)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#F0FDFA', borderBottom: '1px solid #99F6E4' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#115E59' }}>
                      4. Tahsilat & Gayri Resmi Ödeme (Nakit / Direkt Ödeme)
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#0D9488' }}>
                      {paraFormatla(mutabakatHesap.eldenTahsilat)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#D1FAE5', borderBottom: '2px solid #6EE7B7' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#064E3B' }}>
                      GENEL TOPLAM TAHSİLAT (YAPILAN ÖDEMELER)
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, fontSize: 15, color: '#047857' }}>
                      {paraFormatla(mutabakatHesap.toplamTahsilat)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#EFF6FF', borderBottom: '1px solid #BFDBFE' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#1E40AF' }}>
                      BORÇ / ALACAK DURUMU (Ana Para Farkı)
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#1D4ED8', fontSize: 15 }}>
                      {paraFormatla(mutabakatHesap.karsizBakiye)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#FAF5FF', borderBottom: '1px solid #E9D5FF' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#6B21A8' }}>
                      5. Danışmanlık Hizmet Bedeli (+%{karOrani} Kâr Payı)
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, color: '#7E22CE' }}>
                      +{paraFormatla(mutabakatHesap.karTutari)} ₺
                    </td>
                  </tr>
                  <tr style={{ background: '#F3E8FF' }}>
                    <td style={{ padding: '14px 14px', fontWeight: 900, fontSize: 14, color: '#581C87' }}>
                      NET MUTABAKAT BAKİYESİ (%{karOrani} Kâr Dahil)
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 900, color: '#6B21A8', fontSize: 17 }}>
                      {paraFormatla(mutabakatHesap.karDahilBakiye)} ₺
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Geçmiş Mutabakat Şerhleri */}
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#334155' }}>
                📌 Kayıtlı Mutabakat Dönüm Noktaları & Şerhler
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hesaplanmisCariSatirlar
                  .filter(
                    (r) =>
                      r.islem_turu === 'mutabakat' ||
                      (r.gider_aciklama || '').toLocaleLowerCase('tr-TR').includes('mutabakat') ||
                      (r.not_metni || '').toLocaleLowerCase('tr-TR').includes('mutabakat')
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: 12,
                        padding: '10px 14px',
                        fontSize: 12.5
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#B45309', marginBottom: 4 }}>
                        <span>🤝 {m.gider_aciklama || 'Mutabakat Kaydı'}</span>
                        <span>{m.tarih ? new Date(m.tarih).toLocaleDateString('tr-TR') : ''}</span>
                      </div>
                      {m.not_metni && (
                        <div style={{ color: '#92400E', whiteSpace: 'pre-line', fontSize: 12 }}>{m.not_metni}</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Sağ: WhatsApp Mutabakat Paylaşım Kartı */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
              📲 Müşteri WhatsApp Mutabakat Özeti
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#64748B' }}>
              Danışanınız ({aktifProje.musteri_adi}) ile paylaşmaya hazır güncel hesap cetveli metni:
            </p>

            <pre
              style={{
                flex: 1,
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 14,
                padding: 16,
                fontSize: 12.5,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                color: '#1E293B',
                marginBottom: 16
              }}
            >
              {mutabakatWpMetniUret()}
            </pre>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mutabakatWpMetniUret())
                  setWpKopyalandi(true)
                  setTimeout(() => setWpKopyalandi(false), 2500)
                }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: wpKopyalandi ? '#059669' : '#4F46E5',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: 'pointer'
                }}
              >
                {wpKopyalandi ? '✓ Panoya Kopyalandı!' : '📋 Mutabakat Metnini Kopyala'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(mutabakatWpMetniUret())}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#25D366',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 13.5,
                  textDecoration: 'none',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <span>💬</span> WhatsApp&apos;ta Gönder
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 3: İMALAT DETAY FİYAT VE NOTLARI */}
      {/* ========================================================= */}
      {aktifSekme === 'imalat' && (
        <div>
          {/* Yeni İmalat Kalemi Ekleme Formu */}
          <form
            onSubmit={imalatEkle}
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              padding: 18,
              marginBottom: 18,
              border: '1px solid #E2E8F0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10,
              alignItems: 'end'
            }}
          >
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                İmalat / İş Kalemi
              </label>
              <input
                type="text"
                placeholder="Örn: MERMER / KARA SIVA"
                value={yeniIsKalemi}
                onChange={(e) => setYeniIsKalemi(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Birim Fiyat / Teklif
              </label>
              <input
                type="text"
                placeholder="Örn: 700 TL / M2 veya 160+KDV"
                value={yeniBirimFiyat}
                onChange={(e) => setYeniBirimFiyat(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Firma / Taşeron / Kişi
              </label>
              <input
                type="text"
                placeholder="Örn: Ozan Beyaztaş"
                value={yeniFirmaKisi}
                onChange={(e) => setYeniFirmaKisi(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Anlaşma Durumu
              </label>
              <select
                value={yeniImalatDurum}
                onChange={(e) => setYeniImalatDurum(e.target.value)}
                style={ORTAK_INPUT_STIL}
              >
                <option value="anlasildi">🟢 Anlaşıldı</option>
                <option value="bekliyor">🟠 Anlaşılmadı / Fiyat Bekleniyor</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Not
              </label>
              <input
                type="text"
                placeholder="Ek şart / not..."
                value={yeniImalatNot}
                onChange={(e) => setYeniImalatNot(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>
            <button
              type="submit"
              style={{
                height: 40,
                padding: '0 16px',
                borderRadius: 10,
                border: 'none',
                background: '#4F46E5',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + İmalat Kalemi Ekle
            </button>
          </form>

          {/* İmalat Tablosu */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#334155', textAlign: 'left', borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 14px', width: 50 }}>NO</th>
                  <th style={{ padding: '12px 14px' }}>İŞ / İMALAT KALEMİ</th>
                  <th style={{ padding: '12px 14px' }}>ANLAŞILAN FİYAT / BİRİM</th>
                  <th style={{ padding: '12px 14px' }}>FİRMA / KİŞİ</th>
                  <th style={{ padding: '12px 14px' }}>DURUM</th>
                  <th style={{ padding: '12px 14px' }}>NOTLAR</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                {aktifImalatListesi.map((im, idx) => {
                  const isEdit = duzenlenenImalatId === im.id
                  if (isEdit) {
                    return (
                      <tr key={im.id} style={{ background: '#EEF2FF', borderBottom: '1px solid #CBD5E1' }}>
                        <td style={{ padding: 10, fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={duzImalat.is_kalemi}
                            onChange={(e) => setDuzImalat({ ...duzImalat, is_kalemi: e.target.value })}
                            style={{ margin: 0, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={duzImalat.birim_fiyat}
                            onChange={(e) => setDuzImalat({ ...duzImalat, birim_fiyat: e.target.value })}
                            style={{ margin: 0, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={duzImalat.firma_kisi}
                            onChange={(e) => setDuzImalat({ ...duzImalat, firma_kisi: e.target.value })}
                            style={{ margin: 0, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: 8 }}>
                          <select
                            value={duzImalat.durum}
                            onChange={(e) => setDuzImalat({ ...duzImalat, durum: e.target.value })}
                            style={{ margin: 0 }}
                          >
                            <option value="anlasildi">🟢 Anlaşıldı</option>
                            <option value="bekliyor">🟠 Bekliyor</option>
                          </select>
                        </td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="text"
                            value={duzImalat.not_metni}
                            onChange={(e) => setDuzImalat({ ...duzImalat, not_metni: e.target.value })}
                            style={{ margin: 0, width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: 8, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => imalatDuzenlemeKaydet(im.id)}
                            style={{
                              padding: '5px 10px',
                              background: '#059669',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              marginRight: 4,
                              fontWeight: 700
                            }}
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuzenlenenImalatId(null)}
                            style={{
                              padding: '5px 10px',
                              background: '#E2E8F0',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            İptal
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={im.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0F172A' }}>{im.is_kalemi}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#059669' }}>
                        {im.birim_fiyat || '-'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                        {im.firma_kisi || '-'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: im.durum === 'anlasildi' ? '#DCFCE7' : '#FEF3C7',
                            color: im.durum === 'anlasildi' ? '#166534' : '#B45309'
                          }}
                        >
                          {im.durum === 'anlasildi' ? '🟢 Anlaşıldı' : '🟠 Anlaşılmadı / Bekliyor'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#475569' }}>{im.not_metni || '-'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="sil-buton"
                          onClick={() => {
                            setDuzenlenenImalatId(im.id)
                            setDuzImalat({ ...im })
                          }}
                          style={{ marginRight: 6 }}
                        >
                          ✎
                        </button>
                        <button type="button" className="sil-buton" onClick={() => imalatSil(im.id)}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 4: ÇALIŞMA NOTLARIMIZ & SAHA KARARLARI */}
      {/* ========================================================= */}
      {aktifSekme === 'notlar' && (
        <div>
          {/* Yeni Çalışma Notu Ekleme */}
          <form
            onSubmit={calismaNotuEkle}
            style={{
              background: '#FFFFFF',
              borderRadius: 18,
              padding: 18,
              marginBottom: 18,
              border: '1px solid #E2E8F0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              alignItems: 'end'
            }}
          >
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Kategori
              </label>
              <select
                value={yeniNotKategori}
                onChange={(e) => setYeniNotKategori(e.target.value)}
                style={ORTAK_INPUT_STIL}
              >
                <option value="Genel">📌 Genel Not</option>
                <option value="Beton & Tedarik">🧪 Beton & Tedarik</option>
                <option value="Fiyat & Anlaşma Şartları">💰 Fiyat & Anlaşma Şartları</option>
                <option value="Demir & Malzeme">🧱 Demir & Malzeme</option>
                <option value="Yapılacaklar / Takip">✅ Yapılacaklar / Takip</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Çalışma Notu / Anlaşma Detayı
              </label>
              <input
                type="text"
                placeholder="Örn: C35 3950 TL 90-105 Gün Vade / Çatıcı ile anlaşılacak..."
                value={yeniNotBaslik}
                onChange={(e) => setYeniNotBaslik(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                Ek Açıklama (Opsiyonel)
              </label>
              <input
                type="text"
                placeholder="Detay..."
                value={yeniNotDetay}
                onChange={(e) => setYeniNotDetay(e.target.value)}
                style={ORTAK_INPUT_STIL}
              />
            </div>

            <button
              type="submit"
              style={{
                height: 40,
                padding: '0 20px',
                borderRadius: 10,
                border: 'none',
                background: '#4F46E5',
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              + Not Ekle
            </button>
          </form>

          {/* Kategori Filtresi */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {['hepsi', 'Fiyat & Anlaşma Şartları', 'Beton & Tedarik', 'Demir & Malzeme', 'Yapılacaklar / Takip', 'Genel'].map(
              (kat) => (
                <button
                  key={kat}
                  type="button"
                  onClick={() => setNotFiltreKategori(kat)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: notFiltreKategori === kat ? '1px solid #C7D2FE' : '1px solid #CBD5E1',
                    background: notFiltreKategori === kat ? '#EEF2FF' : '#FFFFFF',
                    color: notFiltreKategori === kat ? '#4338CA' : '#475569',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {kat === 'hepsi' ? 'Tüm Notlar' : kat}
                </button>
              )
            )}
          </div>

          {/* Not Kartları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {aktifNotListesi
              .filter((n) => notFiltreKategori === 'hepsi' || n.kategori === notFiltreKategori)
              .map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.tamamlandi ? '#F8FAFC' : '#FFFFFF',
                    borderRadius: 14,
                    padding: '14px 16px',
                    border: n.tamamlandi ? '1px solid #E2E8F0' : '1px solid #CBD5E1',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    opacity: n.tamamlandi ? 0.65 : 1
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={!!n.tamamlandi}
                      onChange={() => notDurumDegistir(n.id)}
                      style={{ width: 17, height: 17, marginTop: 2, cursor: 'pointer', accentColor: '#4F46E5' }}
                    />
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#EEF2FF',
                          color: '#4338CA',
                          marginBottom: 4
                        }}
                      >
                        {n.kategori}
                      </span>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: '#0F172A',
                          textDecoration: n.tamamlandi ? 'line-through' : 'none'
                        }}
                      >
                        {n.baslik}
                      </div>
                      {n.detay && (
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{n.detay}</div>
                      )}
                    </div>
                  </div>
                  <button type="button" className="sil-buton" onClick={() => notSil(n.id)} title="Notu Sil">
                    🗑
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* YENİ DANIŞMANLIK PROJESİ MODALI */}
      {projeModalAcik && (
        <div className="modal-arka-plan" style={{ zIndex: 9999 }}>
          <div className="modal-kutu" style={{ maxWidth: 460, width: '92%', padding: 24 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 800 }}>
              🏗️ Yeni Danışmanlık Projesi Ekle
            </h3>
            <form onSubmit={yeniProjeOlustur}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Proje / Şantiye Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz Şantiyesi"
                value={yeniProjeAd}
                onChange={(e) => setYeniProjeAd(e.target.value)}
                required
                style={{ width: '100%' }}
              />

              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Danışan / Müşteri Adı Soyadı
              </label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz"
                value={yeniMusteriAd}
                onChange={(e) => setYeniMusteriAd(e.target.value)}
                style={{ width: '100%' }}
              />

              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Danışmanlık Kâr Payı Oranı (%)
              </label>
              <input
                type="number"
                value={yeniKarOrani}
                onChange={(e) => setYeniKarOrani(e.target.value)}
                style={{ width: '100%' }}
              />

              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                Açıklama
              </label>
              <input
                type="text"
                placeholder="Örn: Yapılan harcamaların %15 kâr payı ile danışmanlık projesi"
                value={yeniProjeAciklama}
                onChange={(e) => setYeniProjeAciklama(e.target.value)}
                style={{ width: '100%' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setProjeModalAcik(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#4F46E5',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                >
                  Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
