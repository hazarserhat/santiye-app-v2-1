import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'
import { generateAndSharePDF } from '../../lib/pdfGenerator'

const ayFormatla = (yilAy) => {
  if (!yilAy || typeof yilAy !== 'string') return ''
  const parcalar = yilAy.split('-')
  if (parcalar.length !== 2) return yilAy
  const [yil, ay] = parcalar
  const aylarTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const idx = parseInt(ay, 10) - 1
  if (idx >= 0 && idx < 12) {
    return `${aylarTr[idx]} - ${yil}`
  }
  return yilAy
}

// Mükerrer çek seri numaraları için Soft Pastel Renk Paleti
const SOFT_PASTEL_RENKLER = [
  { bg: '#FFF7ED', border: '#FDBA74', badgeBg: '#FFEDD5', text: '#9A3412', ad: 'Soft Kehribar' },
  { bg: '#FEF2F2', border: '#FCA5A5', badgeBg: '#FEE2E2', text: '#991B1B', ad: 'Soft Gül' },
  { bg: '#FAF5FF', border: '#D8B4FE', badgeBg: '#F3E8FF', text: '#6B21A8', ad: 'Soft Mor' },
  { bg: '#F0F9FF', border: '#7DD3FC', badgeBg: '#E0F2FE', text: '#0369A1', ad: 'Soft Gök Mavisi' },
  { bg: '#ECFDF5', border: '#6EE7B7', badgeBg: '#D1FAE5', text: '#065F46', ad: 'Soft Zümrüt' },
  { bg: '#FDF4FF', border: '#F0ABFC', badgeBg: '#FAE8FF', text: '#86198F', ad: 'Soft Fuşya' },
  { bg: '#FEFCE8', border: '#FDE047', badgeBg: '#FEF9C3', text: '#854D0E', ad: 'Soft Sarı' },
  { bg: '#F0FDFA', border: '#5EEAD4', badgeBg: '#CCFBF1', text: '#115E59', ad: 'Soft Turkuaz' },
  { bg: '#F5F3FF', border: '#C4B5FD', badgeBg: '#EDE9FE', text: '#5B21B6', ad: 'Soft Leylak' },
  { bg: '#FFFBEB', border: '#FCD34D', badgeBg: '#FEF3C7', text: '#78350F', ad: 'Soft Bal' }
]

const getMukerrerRenk = (seriNo) => {
  if (!seriNo) return null
  let hash = 0
  const s = String(seriNo).trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 37 + s.charCodeAt(i)) >>> 0
  }
  return SOFT_PASTEL_RENKLER[hash % SOFT_PASTEL_RENKLER.length]
}

export default function CekTakip() {
  const { santiyeler } = useSite()
  const [cekler, setCekler] = useState([])
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtreTur, setFiltreTur] = useState('hepsi') // 'hepsi' | 'ciro' | 'kendi_cekimiz' | 'portfoy'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtreAy, setFiltreAy] = useState('hepsi')
  const [siralamaAlani, setSiralamaAlani] = useState('cek_vadesi')
  const [siralamaYonu, setSiralamaYonu] = useState('asc')
  const [seciliCekler, setSeciliCekler] = useState([])

  // Manuel tür geçersiz kılmaları (Kullanıcı dilerse rozete tıklayarak türü Kendi / Ciro olarak anında değiştirebilir)
  const [turOverrides, setTurOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cek_turu_overrides') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    Promise.all([
      supabase.from('cekler').select('*, santiyeler(ad)'),
      supabase.from('malikler').select('id, ad_soyad')
    ]).then(([{ data: cekData, error: cekError }, { data: malikData }]) => {
      if (cekError) { alert('Çekler yüklenemedi: ' + cekError.message); return }

      const tumCekler = cekData || []
      const maliklerListesi = malikData || []
      const malikIsimleri = new Set(maliklerListesi.map(m => m.ad_soyad?.trim().toLowerCase()).filter(Boolean))

      // 1. Alınan ve Verilen Çekleri Grupla
      const alinanlar = tumCekler.filter(c => c.yon === 'alinan')
      const verilenler = tumCekler.filter(c => c.yon === 'verilen' || !c.yon)

      const eslesenAlinanIdleri = new Set()
      const eslesenVerilenIdleri = new Set()
      const ciroBirlestirilmis = []

      // 2. Eşleşen Alınan & Verilen Çekleri TEK SATIRDA Birleştir
      verilenler.forEach(ver => {
        const verSeri = ver.cek_seri_no ? String(ver.cek_seri_no).trim().toLowerCase() : ''

        // Eşleşen bir alınan çek var mı? (Sadece geçerli seri numarası olanlar eşleşebilir)
        let eslesenAlinan = null
        if (verSeri) {
          eslesenAlinan = alinanlar.find(al => {
            if (eslesenAlinanIdleri.has(al.id)) return false
            const alSeri = al.cek_seri_no ? String(al.cek_seri_no).trim().toLowerCase() : ''
            return alSeri && alSeri === verSeri
          })
        }

        // Eğer eşleşen bir alınan çek VARSA bu ikisi aynı fiziki çektir; birleştir!
        if (eslesenAlinan) {
          eslesenVerilenIdleri.add(ver.id)
          eslesenAlinanIdleri.add(eslesenAlinan.id)

          const alinanOdeyen = eslesenAlinan.odeyen ? eslesenAlinan.odeyen.trim() : ''
          const alinanOdeyenLower = alinanOdeyen.toLowerCase()

          // Gerçekten Malik'ten / Dış Müşteriden mi alınmış?
          // Eğer ödeyen firma, ortak, şirket veya bizim tarafımız ise, bu çek malik çeki DEĞİL, firmanın/ortağın kendi çekidir.
          const isFirmaVeyaOrtak = alinanOdeyenLower.includes('ortak') ||
                                   alinanOdeyenLower.includes('firma') ||
                                   alinanOdeyenLower.includes('şirket') ||
                                   alinanOdeyenLower.includes('biz') ||
                                   alinanOdeyenLower.includes('kendi')

          const isGercekMalik = malikIsimleri.has(alinanOdeyenLower) || (!isFirmaVeyaOrtak && Boolean(alinanOdeyen))

          // Varsayılan Tür Tespiti:
          let varsayilanTur = isGercekMalik && !isFirmaVeyaOrtak ? 'ciro' : 'kendi_cekimiz'

          // Kullanıcı bu çekin türünü manuel değiştirmişse onu uygula
          const overrideTur = turOverrides[ver.id] || turOverrides[eslesenAlinan.id]
          const nihaiTur = overrideTur || varsayilanTur

          const kesideci = alinanOdeyen || ver.odeyen || (nihaiTur === 'ciro' ? 'Malik / Keşideci' : 'Biz (Firma)')
          const odenen = ver.odenen || eslesenAlinan.odenen || '—'

          ciroBirlestirilmis.push({
            id: ver.id,
            verilen_id: ver.id,
            alinan_id: eslesenAlinan.id,
            tum_idler: [ver.id, eslesenAlinan.id],
            cek_turu: nihaiTur,
            isCiroEdildi: nihaiTur === 'ciro',
            banka: ver.banka || eslesenAlinan.banka || '',
            cek_seri_no: ver.cek_seri_no || eslesenAlinan.cek_seri_no || '',
            verilis_tarihi: ver.verilis_tarihi || eslesenAlinan.verilis_tarihi || null,
            alinma_tarihi: eslesenAlinan.verilis_tarihi || null,
            cek_vadesi: ver.cek_vadesi || eslesenAlinan.cek_vadesi || null,
            tutar: Number(ver.tutar || eslesenAlinan.tutar || 0),
            odeyen: kesideci,
            kesideci: kesideci,
            odenen: odenen,
            aciklama: ver.aciklama || eslesenAlinan.aciklama || '',
            santiye_id: ver.santiye_id || eslesenAlinan.santiye_id || null,
            santiyeler: ver.santiyeler || eslesenAlinan.santiyeler || null,
            belge_url: ver.belge_url || eslesenAlinan.belge_url || null,
            created_at: ver.created_at || eslesenAlinan.created_at
          })
        }
      })

      // 3. Eşleşmeyen Verilenler -> Firmanın Kendi Keşide Ettiği Çekler (Müslüm'e verilen çekler gibi)
      // Açıklamasında 'ciro' yazsa bile, alınan bir malik çeki yoksa bu çek FİRMANIN/ORTAĞIN KENDİ ÇEKİDİR.
      const kendiCeklerimiz = verilenler
        .filter(ver => !eslesenVerilenIdleri.has(ver.id))
        .map(ver => {
          const overrideTur = turOverrides[ver.id]
          const nihaiTur = overrideTur || 'kendi_cekimiz'

          return {
            ...ver,
            verilen_id: ver.id,
            alinan_id: null,
            tum_idler: [ver.id],
            cek_turu: nihaiTur,
            isCiroEdildi: nihaiTur === 'ciro',
            kesideci: ver.odeyen || 'Biz (Firma / Ortak)',
            odeyen: ver.odeyen || 'Firma',
            odenen: ver.odenen || '—',
            tutar: Number(ver.tutar || 0)
          }
        })

      // 4. Eşleşmeyen Alınanlar -> Henüz Cirolanmamış / Kasadaki Portföy Çekleri
      const portfoydekiCekler = alinanlar
        .filter(al => !eslesenAlinanIdleri.has(al.id))
        .map(al => {
          const overrideTur = turOverrides[al.id]
          const nihaiTur = overrideTur || 'portfoy'

          return {
            ...al,
            alinan_id: al.id,
            verilen_id: null,
            tum_idler: [al.id],
            cek_turu: nihaiTur,
            isCiroEdildi: false,
            kesideci: al.odeyen || 'Malik / Keşideci',
            odeyen: al.odeyen || 'Malik / Keşideci',
            odenen: '— (Portföyde / Kasada)',
            tutar: Number(al.tutar || 0)
          }
        })

      // Tekilleştirilmiş Fiziksel Çek Listesi
      const nihaiListe = [...ciroBirlestirilmis, ...kendiCeklerimiz, ...portfoydekiCekler]
      setCekler(nihaiListe)
    })
  }, [turOverrides])

  // Tekil Fiziksel Çekler Arasında Seri Numarası Tekrar Edenleri Say (Gerçek Mükerrer Kontrolü)
  const seriNoSayilari = useMemo(() => {
    const sayilar = {}
    cekler.forEach(c => {
      const s = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
      if (s) {
        sayilar[s] = (sayilar[s] || 0) + 1
      }
    })
    return sayilar
  }, [cekler])

  // Çek Türünü Anında Değiştir (Kendi Çekimiz ⇄ Cirolu Çek)
  const turDegistir = (c) => {
    const yeniTur = c.cek_turu === 'ciro' ? 'kendi_cekimiz' : 'ciro'
    const yeniOverrides = { ...turOverrides, [c.id]: yeniTur }
    if (c.alinan_id) yeniOverrides[c.alinan_id] = yeniTur
    if (c.verilen_id) yeniOverrides[c.verilen_id] = yeniTur

    setTurOverrides(yeniOverrides)
    try {
      localStorage.setItem('cek_turu_overrides', JSON.stringify(yeniOverrides))
    } catch (e) {
      console.error('Tür kaydedilemedi', e)
    }

    setCekler(prev => prev.map(item => {
      if (item.id === c.id || (item.verilen_id && item.verilen_id === c.verilen_id)) {
        return {
          ...item,
          cek_turu: yeniTur,
          isCiroEdildi: yeniTur === 'ciro',
          kesideci: yeniTur === 'ciro' ? (item.kesideci === 'Biz (Firma)' ? 'Malik / Keşideci' : item.kesideci) : 'Biz (Firma / Ortak)'
        }
      }
      return item
    }))
  }

  // Çek Silme (Ciro edilmişse hem alınan hem verilen ciro kaydını temizler)
  const cekSil = async (c) => {
    const kisi = c.odenen || c.odeyen || 'İsimsiz'
    const seriNo = c.cek_seri_no ? `(Seri No: ${c.cek_seri_no})` : ''
    const ciroEk = c.cek_turu === 'ciro'
      ? '\n\nℹ️ Bu işlem malikten alınan ve taşerona cirolanan ilgili çek kayıtlarını birlikte temizleyecektir.'
      : ''
    const onayMetni = `"${kisi}" adına kayıtlı ${seriNo} çek kaydını silmek istediğinize emin misiniz?${ciroEk}`
    if (!window.confirm(onayMetni)) return

    const idler = c.tum_idler && c.tum_idler.length > 0 ? c.tum_idler : [c.id]
    const { error } = await supabase.from('cekler').delete().in('id', idler)
    if (error) {
      alert('Çek silinemedi: ' + error.message)
      return
    }
    setCekler(prev => prev.filter(item => item.id !== c.id && !idler.includes(item.id)))
    setSeciliCekler(prev => prev.filter(x => !idler.includes(x)))
  }

  const siralamaTikla = (alan) => {
    if (siralamaAlani === alan) setSiralamaYonu((y) => (y === 'asc' ? 'desc' : 'asc'))
    else { setSiralamaAlani(alan); setSiralamaYonu('asc') }
  }

  const ok = (alan) => (siralamaAlani === alan ? (siralamaYonu === 'asc' ? ' ▲' : ' ▼') : '')

  const bankalar = [...new Set(cekler.map((c) => c.banka).filter(Boolean))].sort()
  const aylar = [...new Set(cekler.map((c) => c.cek_vadesi?.slice(0, 7)).filter(Boolean))].sort()

  let liste = cekler
    .filter((c) => filtreTur === 'hepsi' || c.cek_turu === filtreTur)
    .filter((c) => filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye)
    .filter((c) => filtreBanka === 'hepsi' || c.banka === filtreBanka)
    .filter((c) => filtreAy === 'hepsi' || c.cek_vadesi?.slice(0, 7) === filtreAy)
    .filter((c) => {
      if (!aramaMetni.trim()) return true
      const aranan = aramaMetni.toLowerCase().trim()
      const odenen = (c.odenen || '').toLowerCase()
      const odeyen = (c.odeyen || '').toLowerCase()
      const kesideci = (c.kesideci || '').toLowerCase()
      const banka = (c.banka || '').toLowerCase()
      const seriNo = (c.cek_seri_no || '').toLowerCase()
      const aciklama = (c.aciklama || '').toLowerCase()
      const santiye = (c.santiyeler?.ad || '').toLowerCase()
      const tutarStr = String(c.tutar || '')
      const turStr = c.cek_turu === 'ciro' ? 'ciro cirolu cirolanan malik' : (c.cek_turu === 'portfoy' ? 'portföy kasada alinan' : 'kendi verilen firma ortak')
      return odenen.includes(aranan) || odeyen.includes(aranan) || kesideci.includes(aranan) ||
             banka.includes(aranan) || seriNo.includes(aranan) || aciklama.includes(aranan) ||
             santiye.includes(aranan) || tutarStr.includes(aranan) || turStr.includes(aranan)
    })

  liste = [...liste].sort((a, b) => {
    let av = a[siralamaAlani], bv = b[siralamaAlani]
    if (siralamaAlani === 'santiyeler') { av = a.santiyeler?.ad || ''; bv = b.santiyeler?.ad || '' }
    if (siralamaAlani === 'kisi') { av = a.odenen || a.odeyen || ''; bv = b.odenen || b.odeyen || '' }
    if (av == null) av = ''
    if (bv == null) bv = ''
    if (siralamaAlani === 'tutar') { av = Number(av); bv = Number(bv) }
    if (av < bv) return siralamaYonu === 'asc' ? -1 : 1
    if (av > bv) return siralamaYonu === 'asc' ? 1 : -1
    return 0
  })

  const filtreliToplam = liste.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const tumunuSecToggle = () => {
    if (seciliCekler.length === liste.length) {
      setSeciliCekler([])
    } else {
      setSeciliCekler(liste.map(c => c.id))
    }
  }

  const cekSecToggle = (id) => {
    setSeciliCekler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const bugun = new Date().toISOString().slice(0, 10)

  // Tür Dağılım İstatistikleri
  const ciroCekler = cekler.filter(c => c.cek_turu === 'ciro')
  const kendiCekler = cekler.filter(c => c.cek_turu === 'kendi_cekimiz')
  const portfoyCekler = cekler.filter(c => c.cek_turu === 'portfoy')

  // Finansal Özet İstatistikleri (Tekilleştirilmiş fiziksel çekler üzerinden hesaplanır)
  const vadesiGelmemis = cekler.filter((c) => c.cek_vadesi && c.cek_vadesi >= bugun)
  const vadesiGelmemisTutar = vadesiGelmemis.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const odenenCekler = cekler.filter((c) => c.cek_vadesi && c.cek_vadesi < bugun)
  const odenenTutar = odenenCekler.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const tumZamanlarToplam = cekler.reduce((t, c) => t + Number(c.tutar || 0), 0)

  const pdfPaylas = async (sadeceSecilenler = false) => {
    const dataListesi = sadeceSecilenler ? liste.filter(c => seciliCekler.includes(c.id)) : liste
    if (dataListesi.length === 0) return alert('PDF için seçili veya filtrelenmiş kayıt bulunamadı.')

    const basliklar = ['Banka', 'Çek No', 'Tür', 'Veriliş', 'Vade', 'İlgili Kişi / Taşeron (Keşideci)', 'Tutar', 'Açıklama', 'Şantiye', 'Durum']
    const satirVerileri = dataListesi.map(c => {
      const turEtiketi = c.cek_turu === 'ciro' ? 'Cirolu (Malik)' : (c.cek_turu === 'portfoy' ? 'Portföy (Alınan)' : 'Kendi Çekimiz')
      const kisiMetni = c.cek_turu === 'ciro'
        ? `${c.odenen || '-'} (Keşideci: ${c.kesideci || '-'})`
        : (c.cek_turu === 'portfoy' ? `${c.odeyen || '-'} (Keşideci)` : `${c.odenen || '-'} (Kendi Çekimiz)`)
      const durumMetni = c.cek_turu === 'ciro'
        ? (c.cek_vadesi && c.cek_vadesi < bugun ? 'Cirolandı (Vadesi Geçti)' : 'Cirolandı (Vade Bekliyor)')
        : (c.cek_vadesi && c.cek_vadesi < bugun ? 'Ödendi' : 'Bekliyor')

      return [
        c.banka || '-',
        c.cek_seri_no || '-',
        turEtiketi,
        c.verilis_tarihi ? new Date(c.verilis_tarihi).toLocaleDateString('tr-TR') : '-',
        c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '-',
        kisiMetni,
        `${paraFormatla(c.tutar)} TL`,
        c.aciklama || '-',
        c.santiyeler?.ad || '-',
        durumMetni
      ]
    })

    satirVerileri.push(['', '', '', '', '', 'TOPLAM:', `${paraFormatla(filtreliToplam)} TL`, '', '', ''])

    await generateAndSharePDF({
      title: sadeceSecilenler ? 'Seçilen Çeklerin Ekstresi' : 'Çek Takip Ekstresi',
      filename: 'cek-ekstresi.pdf',
      columns: basliklar,
      data: satirVerileri
    })
  }

  const baslikStil = { cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#5F5E5A', borderBottom: '1px solid #D3D1C7' }
  const hucreStil = { padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
          <h2>Çek Takip Sayfası</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seciliCekler.length > 0 && (
            <button
              onClick={() => pdfPaylas(true)}
              style={{ background: '#F57F17', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📄 Seçilenleri Paylaş ({seciliCekler.length})
            </button>
          )}
          <button
            onClick={() => pdfPaylas(false)}
            style={{ background: '#2C3E50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Tüm Tabloyu Paylaş (PDF)
          </button>
        </div>
      </div>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş çek sayısı</p>
          <p className="ozet-tutar">{vadesiGelmemis.length}</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş toplam</p>
          <p className="ozet-tutar">{paraFormatla(vadesiGelmemisTutar)} ₺</p>
        </div>
      </div>
      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Ödenen / Vadesi dolan toplamı</p>
          <p className="ozet-tutar">{paraFormatla(odenenTutar)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Toplam Çek Hacmi (Tekil)</p>
          <p className="ozet-tutar">{paraFormatla(tumZamanlarToplam)} ₺</p>
        </div>
      </div>

      {/* ARAMA ÇUBUĞU */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1.5px solid #CBD5E1',
        padding: '2px 14px',
        marginBottom: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <span style={{ fontSize: 15, marginRight: 8, color: '#64748B' }}>🔍</span>
        <input
          type="text"
          placeholder="Çek takipte ara (Kişi, malik, banka, çek no, açıklama, şantiye, tutar)..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '9px 0',
            fontSize: 13.5,
            background: 'transparent',
            color: '#1E293B'
          }}
        />
        {aramaMetni && (
          <button
            type="button"
            onClick={() => setAramaMetni('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 6px',
              fontWeight: 'bold'
            }}
            title="Aramayı Temizle"
          >
            ✕
          </button>
        )}
      </div>

      {/* ÇEK TÜRÜ FİLTRESİ */}
      <div className="filtre-satiri" style={{ marginBottom: 6 }}>
        <button
          className={`filtre-chip ${filtreTur === 'hepsi' ? 'secili' : ''}`}
          onClick={() => setFiltreTur('hepsi')}
        >
          Tüm Çekler ({cekler.length})
        </button>
        <button
          className={`filtre-chip ${filtreTur === 'kendi_cekimiz' ? 'secili' : ''}`}
          onClick={() => setFiltreTur('kendi_cekimiz')}
          style={{
            borderColor: filtreTur === 'kendi_cekimiz' ? '#059669' : undefined,
            background: filtreTur === 'kendi_cekimiz' ? '#ECFDF5' : undefined,
            color: filtreTur === 'kendi_cekimiz' ? '#047857' : undefined
          }}
        >
          🏢 Kendi Çeklerimiz ({kendiCekler.length})
        </button>
        <button
          className={`filtre-chip ${filtreTur === 'ciro' ? 'secili' : ''}`}
          onClick={() => setFiltreTur('ciro')}
          style={{
            borderColor: filtreTur === 'ciro' ? '#2563EB' : undefined,
            background: filtreTur === 'ciro' ? '#EFF6FF' : undefined,
            color: filtreTur === 'ciro' ? '#1D4ED8' : undefined
          }}
        >
          🔄 Cirolu Malik Çekleri ({ciroCekler.length})
        </button>
        <button
          className={`filtre-chip ${filtreTur === 'portfoy' ? 'secili' : ''}`}
          onClick={() => setFiltreTur('portfoy')}
          style={{
            borderColor: filtreTur === 'portfoy' ? '#D97706' : undefined,
            background: filtreTur === 'portfoy' ? '#FFFBEB' : undefined,
            color: filtreTur === 'portfoy' ? '#B45309' : undefined
          }}
        >
          💼 Portföy (Alınan/Kasada) ({portfoyCekler.length})
        </button>
      </div>

      {/* ŞANTİYE FİLTRESİ */}
      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      {/* BANKA FİLTRESİ */}
      {bankalar.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreBanka === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreBanka('hepsi')}>Tüm bankalar</button>
          {bankalar.map((b) => (
            <button key={b} className={`filtre-chip ${filtreBanka === b ? 'secili' : ''}`} onClick={() => setFiltreBanka(b)}>{b}</button>
          ))}
        </div>
      )}

      {/* AY FİLTRESİ */}
      {aylar.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreAy === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreAy('hepsi')}>Tüm aylar</button>
          {aylar.map((a) => (
            <button key={a} className={`filtre-chip ${filtreAy === a ? 'secili' : ''}`} onClick={() => setFiltreAy(a)}>
              {ayFormatla(a)}
            </button>
          ))}
        </div>
      )}

      {/* GERÇEK MÜKERRER ÇEK UYARISI */}
      {Object.values(seriNoSayilari).some(sayi => sayi > 1) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          marginTop: 12,
          borderRadius: 10,
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          color: '#92400E',
          fontSize: 12.5,
          fontWeight: 600
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            Tabloda aynı seri numarasına sahip <strong>mükerrer çek kayıtları</strong> tespit edildi (Eşleşen kayıtlar tekilleştirilmiştir). Ayırt edilebilmeleri için eşleşen <strong>soft pastel renklerle</strong> vurgulanmıştır. Fazla kayıtları sağdaki 🗑️ butonuyla silebilirsiniz.
          </span>
        </div>
      )}

      {/* ÇEK TABLOSU */}
      <div style={{ overflowX: 'auto', marginTop: 12, background: 'white', borderRadius: 12, border: '1px solid #D3D1C7' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, width: 40, textAlign: 'center' }}>
                <input type="checkbox" checked={liste.length > 0 && seciliCekler.length === liste.length} onChange={tumunuSecToggle} />
              </th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_turu')}>Tür{ok('cek_turu')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('banka')}>Banka{ok('banka')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_seri_no')}>Çek No{ok('cek_seri_no')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('verilis_tarihi')}>Veriliş T.{ok('verilis_tarihi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_vadesi')}>Vade T.{ok('cek_vadesi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('kisi')}>Verilen / İlgili Kişi{ok('kisi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('tutar')}>Tutar{ok('tutar')}</th>
              <th style={{ ...baslikStil, maxWidth: 150 }}>Açıklama</th>
              <th style={baslikStil} onClick={() => siralamaTikla('santiyeler')}>Şantiye{ok('santiyeler')}</th>
              <th style={baslikStil}>Durum</th>
              <th style={{ ...baslikStil, width: 48, textAlign: 'center' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => {
              const seriNoTemiz = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
              const mukerrerSayisi = seriNoTemiz ? (seriNoSayilari[seriNoTemiz] || 0) : 0
              const isMukerrer = mukerrerSayisi > 1
              const softRenk = isMukerrer ? getMukerrerRenk(seriNoTemiz) : null

              return (
                <tr
                  key={c.id}
                  style={{
                    backgroundColor: seciliCekler.includes(c.id)
                      ? '#E0F2FE'
                      : (isMukerrer ? softRenk.bg : 'transparent'),
                    borderLeft: isMukerrer ? `5px solid ${softRenk.border}` : '5px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <input type="checkbox" checked={seciliCekler.includes(c.id)} onChange={() => cekSecToggle(c.id)} />
                  </td>

                  {/* TÜR ROZETİ (TIKLANARAK ANINDA KENDİ ÇEKİMİZ ⇄ CİRO DEĞİŞTİRİLEBİLİR) */}
                  <td style={hucreStil}>
                    {c.cek_turu === 'ciro' && (
                      <button
                        type="button"
                        onClick={() => turDegistir(c)}
                        title="Tıklayarak türü 'Kendi Çekimiz' olarak değiştir"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          border: '1px solid #BFDBFE',
                          cursor: 'pointer'
                        }}
                      >
                        🔄 Cirolu (Malik) <span style={{ fontSize: 9, opacity: 0.6 }}>⇄</span>
                      </button>
                    )}
                    {c.cek_turu === 'kendi_cekimiz' && (
                      <button
                        type="button"
                        onClick={() => turDegistir(c)}
                        title="Tıklayarak türü 'Cirolu Malik Çeki' olarak değiştir"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#ECFDF5',
                          color: '#065F46',
                          border: '1px solid #A7F3D0',
                          cursor: 'pointer'
                        }}
                      >
                        🏢 Kendi Çekimiz <span style={{ fontSize: 9, opacity: 0.6 }}>⇄</span>
                      </button>
                    )}
                    {c.cek_turu === 'portfoy' && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#FFFBEB',
                        color: '#92400E',
                        border: '1px solid #FDE68A'
                      }}>
                        💼 Portföy
                      </span>
                    )}
                  </td>

                  <td style={hucreStil}>{c.banka || '—'}</td>

                  <td style={hucreStil}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: isMukerrer ? 700 : 500 }}>{c.cek_seri_no || '—'}</span>
                      {isMukerrer && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            background: softRenk.badgeBg,
                            color: softRenk.text,
                            border: `1px solid ${softRenk.border}`,
                            whiteSpace: 'nowrap'
                          }}
                          title={`Bu seri numarası (${c.cek_seri_no}) sistemde ${mukerrerSayisi} kez kayıtlı!`}
                        >
                          ⚠️ Tekrar ({mukerrerSayisi})
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={hucreStil}>
                    {c.verilis_tarihi ? (
                      <div>
                        <div>{new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>{ayFormatla(c.verilis_tarihi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>

                  <td style={hucreStil}>
                    {c.cek_vadesi ? (
                      <div>
                        <div>{new Date(c.cek_vadesi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#1D9596', fontWeight: 600 }}>{ayFormatla(c.cek_vadesi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>

                  {/* VERİLEN / İLGİLİ KİŞİ (KENDİ ÇEKİMİZ / MALİK CİROSU AYRINTISI) */}
                  <td style={hucreStil}>
                    {c.cek_turu === 'ciro' ? (
                      <div>
                        <div style={{ fontWeight: 600, color: '#0F172A' }}>
                          {c.odenen || '—'}
                        </div>
                        {c.kesideci && c.kesideci !== '—' && (
                          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <span>↩️ Malik / Keşideci:</span>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{c.kesideci}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      c.cek_turu === 'portfoy' ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.odeyen || '—'}</div>
                          <div style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>💼 Malik / Keşideci</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.odenen || '—'}</div>
                          <div style={{ fontSize: 10, color: '#059669', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>🏢 Firma / Ortak Keşidesi</span>
                            {c.odeyen && c.odeyen !== 'Firma' && c.odeyen !== 'Biz' && c.odeyen !== 'Biz (Firma / Ortak)' && (
                              <span style={{ color: '#64748B' }}>({c.odeyen})</span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </td>

                  <td style={{ ...hucreStil, fontWeight: 700 }}>{paraFormatla(c.tutar)} ₺</td>
                  <td style={{ ...hucreStil, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.aciklama}>{c.aciklama || '—'}</td>
                  <td style={hucreStil}>{c.santiyeler?.ad || '—'}</td>

                  {/* DURUM SÜTUNU */}
                  <td style={hucreStil}>
                    {c.cek_turu === 'ciro' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="durum-rozet" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                          Ciro Edildi
                        </span>
                        {c.cek_vadesi && (
                          <span style={{ fontSize: 10, color: c.cek_vadesi < bugun ? '#059669' : '#D97706', fontWeight: 600 }}>
                            {c.cek_vadesi < bugun ? '✓ Vadesi Geçti' : '⏳ Vade Bekliyor'}
                          </span>
                        )}
                      </div>
                    ) : (
                      c.cek_turu === 'portfoy' ? (
                        c.cek_vadesi && c.cek_vadesi < bugun
                          ? <span className="durum-rozet rozet-yesil">Tahsil Edildi</span>
                          : <span className="durum-rozet rozet-mavi" style={{ background: '#FEF3C7', color: '#B45309' }}>Kasada (Bekliyor)</span>
                      ) : (
                        c.cek_vadesi && c.cek_vadesi < bugun
                          ? <span className="durum-rozet rozet-yesil">Ödendi</span>
                          : <span className="durum-rozet rozet-sari">Bekliyor</span>
                      )
                    )}
                  </td>

                  {/* İŞLEM (SİL) */}
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => cekSil(c)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      title="Bu çek kaydını sil"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {liste.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="7" style={{ ...hucreStil, fontWeight: 'bold', textAlign: 'right' }}>Filtrelenen Toplam:</td>
                <td style={{ ...hucreStil, fontWeight: 'bold' }}>{paraFormatla(filtreliToplam)} ₺</td>
                <td colSpan="4" style={hucreStil}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {liste.length === 0 && <p className="bos-mesaj">Bu filtrede çek yok.</p>}
      </div>
      <p style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
        💡 <strong>Tür Rozetine (🏢/🔄)</strong> tıklayarak dilediğiniz çekin türünü anında 'Kendi Çekimiz' veya 'Cirolu' olarak değiştirebilirsiniz. Maliklerden alınmayan, firmanın/ortağın kendi banka hesabından keşide ettiği tüm çekler 'Kendi Çekimiz' olarak listelenir.
      </p>
    </div>
  )
}
