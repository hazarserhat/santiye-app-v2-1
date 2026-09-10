import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla, sadeceSayiTuslari } from '../../lib/format'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

const tr2en = (text) => {
  if (typeof text !== 'string') return ''
  return text
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
}

export default function ProjeGelirleri() {
  const { santiyeler } = useSite()
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [siralama, setSiralama] = useState('daire_artan')
  const [malikler, setMalikler] = useState([])
  const [asamalar, setAsamalar] = useState({}) // { malikId: [asama,...] }
  const [odemeToplamlari, setOdemeToplamlari] = useState({}) // { malikId: toplam }

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [taslak, setTaslak] = useState({})
  const [taslakAsamalar, setTaslakAsamalar] = useState([])
  const [hizliDuzenleModu, setHizliDuzenleModu] = useState(false)
  const [hucreEdit, setHucreEdit] = useState(null) // { malikId, alan, deger, asamaId }
  const [sutunModalAcik, setSutunModalAcik] = useState(false)
  const [seciliSutunlarPDF, setSeciliSutunlarPDF] = useState({
    ad_soyad: true,
    telefon: true,
    santiye: true,
    mesken_turu: true,
    daire_no: true,
    toplam_alacak: true,
    devlet_destegi: true,
    kalan_bakiye: true,
    asamalar: true,
    alinan: true,
    kalan: true
  })

  const isColumnVisible = (key) => {
    if (!pdfYukleniyor) return true
    if (key === 'islemler') return false // Hide action buttons in PDF export
    return !!seciliSutunlarPDF[key]
  }

  const hucreKaydet = async (malikId, alan, yeniDeger) => {
    const isNumber = alan === 'toplam_alacak' || alan === 'devlet_destegi'
    const val = isNumber ? Number(yeniDeger) || 0 : yeniDeger
    const { error } = await supabase.from('malikler').update({ [alan]: val }).eq('id', malikId)
    if (error) alert('Hücre güncellenemedi: ' + error.message)
    setHucreEdit(null)
    yenile()
  }

  const asamaTutarKaydet = async (asamaId, yeniTutar) => {
    const { error } = await supabase.from('malik_asamalari').update({ tutar: Number(yeniTutar) || 0 }).eq('id', asamaId)
    if (error) alert('Aşama tutarı güncellenemedi: ' + error.message)
    setHucreEdit(null)
    yenile()
  }

  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniTelefon, setYeniTelefon] = useState('')
  const [yeniMeskenTuru, setYeniMeskenTuru] = useState('')
  const [yeniDaireNo, setYeniDaireNo] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')

  // Dinamik olarak tablodaki maksimum aşama sayısını buluyoruz (en az 4 olsun ki daralmasın)
  const maxStageCount = Math.max(4, ...Object.values(asamalar).map((a) => a?.length || 0))

  const yenile = async () => {
    const { data: m, error: e1 } = await supabase.from('malikler').select('*, santiyeler(ad)').order('ad_soyad')
    if (e1) { alert('Malikler yüklenemedi: ' + e1.message); return }
    setMalikler(m || [])

    const { data: a } = await supabase.from('malik_asamalari').select('*').order('sira')
    const harita = {}
    ;(a || []).forEach((r) => { if (!harita[r.malik_id]) harita[r.malik_id] = []; harita[r.malik_id].push(r) })
    setAsamalar(harita)

    const { data: g } = await supabase.from('gelirler').select('malik_id, tutar').not('malik_id', 'is', null)
    const odemeHarita = {}
    ;(g || []).forEach((r) => { odemeHarita[r.malik_id] = (odemeHarita[r.malik_id] || 0) + Number(r.tutar) })
    setOdemeToplamlari(odemeHarita)
  }

  useEffect(() => { yenile() }, [])

  useEffect(() => {
    if (santiyeler.length && !yeniSantiyeId) setYeniSantiyeId(santiyeler[0].id)
  }, [santiyeler])

  const malikEkle = async () => {
    if (!yeniAd.trim() || !yeniSantiyeId) { alert('Ad ve şantiye zorunludur.'); return }
    const { data, error } = await supabase.from('malikler').insert({ 
      ad_soyad: yeniAd, 
      telefon: yeniTelefon, 
      mesken_turu: yeniMeskenTuru,
      daire_no: yeniDaireNo,
      santiye_id: yeniSantiyeId 
    }).select().single()
    
    if (error) { alert('Eklenemedi: ' + error.message); return }
    const bosAsamalar = Array.from({ length: 4 }).map((_, i) => ({ malik_id: data.id, ad: '', tutar: 0, tamamlandi: false, sira: i + 1 }))
    await supabase.from('malik_asamalari').insert(bosAsamalar)
    setYeniAd(''); setYeniTelefon(''); setYeniMeskenTuru(''); setYeniDaireNo(''); setYeniAcik(false)
    yenile()
  }

  const malikSil = async (id) => {
    const { count, error: countError } = await supabase
      .from('gelirler')
      .select('*', { count: 'exact', head: true })
      .eq('malik_id', id)
      
    if (countError) {
      alert('Silme kontrolü sırasında bir hata oluştu: ' + countError.message)
      return
    }
    
    if (count > 0) {
      alert('Bu malike ait ödeme (tahsilat) kayıtları bulunmaktadır! Silme işlemi yapılamaz. Lütfen önce Gelirler sekmesinden ilgili ödeme kayıtlarını silin veya başka birine aktarın.')
      return
    }

    if (!window.confirm('Bu maliki ve tüm aşama kayıtlarını silmek istediğinize emin misiniz?')) return
    await supabase.from('malikler').delete().eq('id', id)
    yenile()
  }

  const duzenlemeyiAc = (m) => {
    setDuzenlenenId(m.id)
    setTaslak({ 
      ad_soyad: m.ad_soyad || '',
      toplam_alacak: m.toplam_alacak || 0, 
      devlet_destegi: m.devlet_destegi || 0,
      telefon: m.telefon || '',
      mesken_turu: m.mesken_turu || '',
      daire_no: m.daire_no || ''
    })
    const mevcut = asamalar[m.id] || []
    setTaslakAsamalar(mevcut.length ? [...mevcut] : [{ ad: '', tutar: 0, sira: 1 }])
  }

  const kaydet = async (malikId) => {
    await supabase.from('malikler').update({
      ad_soyad: taslak.ad_soyad || '',
      toplam_alacak: Number(taslak.toplam_alacak) || 0,
      devlet_destegi: Number(taslak.devlet_destegi) || 0,
      telefon: taslak.telefon || '',
      mesken_turu: taslak.mesken_turu || '',
      daire_no: taslak.daire_no || '',
    }).eq('id', malikId)

    await supabase.from('malik_asamalari').delete().eq('malik_id', malikId)
    const yeniAsamalarListesi = taslakAsamalar.map((a, i) => ({
      malik_id: malikId,
      ad: a.ad || '',
      tutar: Number(a.tutar) || 0,
      tamamlandi: !!a.tamamlandi,
      sira: i + 1
    }))
    await supabase.from('malik_asamalari').insert(yeniAsamalarListesi)

    setDuzenlenenId(null)
    yenile()
  }

  const asamaTikle = async (asama) => {
    await supabase.from('malik_asamalari').update({ tamamlandi: !asama.tamamlandi }).eq('id', asama.id)
    yenile()
  }

  const malikKopyala = async (m) => {
    if (!window.confirm(`${m.ad_soyad} şablonunu kopyalamak istediğinize emin misiniz?`)) return
    
    const { data: yeniMalik, error } = await supabase.from('malikler').insert({
      santiye_id: m.santiye_id,
      ad_soyad: m.ad_soyad + ' (Kopya)',
      telefon: m.telefon,
      mesken_turu: m.mesken_turu,
      daire_no: m.daire_no,
      toplam_alacak: m.toplam_alacak,
      devlet_destegi: m.devlet_destegi
    }).select().single()

    if (error) { alert('Kopyalama başarısız: ' + error.message); return }

    const existingStages = asamalar[m.id] || []
    if (existingStages.length > 0) {
      const yeniAsamalarListesi = existingStages.map((a) => ({
        malik_id: yeniMalik.id,
        ad: a.ad || '',
        tutar: Number(a.tutar) || 0,
        tamamlandi: false,
        sira: a.sira
      }))
      await supabase.from('malik_asamalari').insert(yeniAsamalarListesi)
    }

    yenile()
  }

  const asamaEkle = () => {
    setTaslakAsamalar((onceki) => [...onceki, { ad: '', tutar: 0, tamamlandi: false, sira: onceki.length + 1 }])
  }

  const asamaSilTaslak = (index) => {
    setTaslakAsamalar((onceki) => onceki.filter((_, i) => i !== index))
  }

  const renkHesapla = (malikId, stages) => {
    let kalan = odemeToplamlari[malikId] || 0
    return (stages || []).map((s) => {
      if (!s.tutar || s.tutar <= 0) return 'yok'
      if (kalan >= s.tutar) { kalan -= s.tutar; return 'yesil' }
      if (kalan > 0) { kalan = 0; return 'sari' }
      return 'kirmizi'
    })
  }
  const renkArkaplan = { yesil: 'rgba(63,158,92,0.25)', sari: 'rgba(217,180,41,0.3)', kirmizi: 'rgba(214,69,69,0.18)', yok: 'transparent' }

  let gorunenler = filtreSantiye === 'hepsi' ? [...malikler] : malikler.filter((m) => m.santiye_id === filtreSantiye)

  const topluAsamaGuncelle = async (stageIndex, yeniAd) => {
    if (yeniAd === undefined) return
    const trimAd = yeniAd.trim()
    
    const targetStageIds = []
    gorunenler.forEach((m) => {
      const st = (asamalar[m.id] || [])[stageIndex]
      if (st?.id) targetStageIds.push(st.id)
    })

    if (targetStageIds.length === 0) return

    const { error } = await supabase
      .from('malik_asamalari')
      .update({ ad: trimAd })
      .in('id', targetStageIds)

    if (error) {
      alert('Toplu aşama adı güncellenirken hata oluştu: ' + error.message)
      return
    }
    yenile()
  }

  const getStageHeaderDefault = (index) => {
    for (const m of gorunenler) {
      const stage = asamalar[m.id]?.[index]
      if (stage?.ad) return stage.ad
    }
    return ''
  }

  const topluAsamaTamamlandiGuncelle = async (stageIndex, yeniTamamlandi) => {
    const targetStageIds = []
    gorunenler.forEach((m) => {
      const st = (asamalar[m.id] || [])[stageIndex]
      if (st?.id) targetStageIds.push(st.id)
    })

    if (targetStageIds.length === 0) return

    // Optimistic UI Update
    setAsamalar((prev) => {
      const yeni = { ...prev }
      gorunenler.forEach((m) => {
        if (yeni[m.id] && yeni[m.id][stageIndex]) {
          const list = [...yeni[m.id]]
          list[stageIndex] = { ...list[stageIndex], tamamlandi: !!yeniTamamlandi }
          yeni[m.id] = list
        }
      })
      return yeni
    })

    const { error } = await supabase
      .from('malik_asamalari')
      .update({ tamamlandi: !!yeniTamamlandi })
      .in('id', targetStageIds)

    if (error) {
      alert('Toplu aşama tamamlama durumu güncellenirken hata oluştu: ' + error.message)
      yenile()
      return
    }
    yenile()
  }

  const isAllStageCompleted = (stageIndex) => {
    if (gorunenler.length === 0) return false
    const maliksWithStage = gorunenler.filter((m) => (asamalar[m.id] || [])[stageIndex]?.id)
    if (maliksWithStage.length === 0) return false
    return maliksWithStage.every((m) => {
      const st = (asamalar[m.id] || [])[stageIndex]
      return st ? !!st.tamamlandi : false
    })
  }

  gorunenler.sort((a, b) => {
    if (siralama === 'daire_artan') {
      return (a.daire_no || '').localeCompare(b.daire_no || '', undefined, { numeric: true })
    }
    if (siralama === 'daire_azalan') {
      return (b.daire_no || '').localeCompare(a.daire_no || '', undefined, { numeric: true })
    }
    if (siralama === 'isim_artan') {
      return (a.ad_soyad || '').localeCompare(b.ad_soyad || '')
    }
    if (siralama === 'isim_azalan') {
      return (b.ad_soyad || '').localeCompare(a.ad_soyad || '')
    }
    if (siralama === 'kalan_artan' || siralama === 'kalan_azalan') {
      const kalanA = Math.max(0, Number(a.toplam_alacak || 0) - Number(a.devlet_destegi || 0) - (odemeToplamlari[a.id] || 0))
      const kalanB = Math.max(0, Number(b.toplam_alacak || 0) - Number(b.devlet_destegi || 0) - (odemeToplamlari[b.id] || 0))
      return siralama === 'kalan_artan' ? kalanA - kalanB : kalanB - kalanA
    }
    return 0
  })

  // Genel toplamlar ve aşama toplamları
  let toplamAlacakGenel = 0, toplamDevletGenel = 0, toplamAlinanGenel = 0, toplamKalanGenel = 0
  const asamaToplamlari = Array.from({ length: maxStageCount }).map((_, i) => {
    let t = 0
    gorunenler.forEach((m) => {
      const st = (asamalar[m.id] || [])[i]
      if (st?.tutar) t += Number(st.tutar) || 0
    })
    return t
  })

  gorunenler.forEach((m) => {
    const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
    const alinan = odemeToplamlari[m.id] || 0
    toplamAlacakGenel += Number(m.toplam_alacak || 0)
    toplamDevletGenel += Number(m.devlet_destegi || 0)
    toplamAlinanGenel += alinan
    toplamKalanGenel += Math.max(0, kalanBakiye - alinan)
  })

  const hucreCiftTik = (malikId, alan, asamaId = null) => {
    if (!hizliDuzenleModu) return
    setHucreEdit({ malikId, alan, asamaId })
  }

  const tabloKapsayiciRef = useRef(null)
  const [pdfYukleniyor, setPdfYukleniyor] = useState(false)

  const excelIndir = () => {
    try {
      const data = []

      // Header Info
      const seciliSantiyeAd = filtreSantiye === 'hepsi' ? 'Tüm Şantiyeler' : (santiyeler.find(s => s.id === filtreSantiye)?.ad || '')
      data.push(['Proje Gelirleri ve Ödeme Durumları Raporu'])
      data.push([`Şantiye: ${seciliSantiyeAd}`, `Tarih: ${new Date().toLocaleDateString('tr-TR')}`])
      data.push([]) // empty row

      // Table Headers
      const headers = [
        'Malik / İsim',
        'İletişim Bilgileri',
        'Şantiye',
        'Mesken Türü',
        'Daire No',
        'Toplam Alacak (TL)',
        'Devlet Desteği (TL)',
        'Kalan Bakiye (TL)'
      ]

      for (let i = 0; i < maxStageCount; i++) {
        const stageName = getStageHeaderDefault(i) || `Aşama ${i + 1}`
        headers.push(stageName)
      }

      headers.push('Alınan (TL)', 'Kalan (TL)')
      data.push(headers)

      // Body Rows
      gorunenler.forEach((m) => {
        const stages = asamalar[m.id] || []
        const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
        const alinan = odemeToplamlari[m.id] || 0
        const kalan = Math.max(0, kalanBakiye - alinan)

        const row = [
          m.ad_soyad || '',
          m.telefon || '',
          m.santiyeler?.ad || '',
          m.mesken_turu || '',
          m.daire_no || '',
          Number(m.toplam_alacak || 0),
          Number(m.devlet_destegi || 0),
          kalanBakiye
        ]

        for (let i = 0; i < maxStageCount; i++) {
          const s = stages[i]
          if (s?.tutar) {
            const durum = s.tamamlandi ? ' (Ödendi)' : ''
            row.push(`${Number(s.tutar)} TL${durum}`)
          } else {
            row.push('—')
          }
        }

        row.push(alinan, kalan)
        data.push(row)
      })

      // Total Row
      const totalRow = [
        'TOPLAM',
        '—',
        '—',
        '—',
        '—',
        toplamAlacakGenel,
        toplamDevletGenel,
        toplamAlacakGenel - toplamDevletGenel
      ]

      for (let i = 0; i < maxStageCount; i++) {
        totalRow.push(asamaToplamlari[i])
      }

      totalRow.push(toplamAlinanGenel, toplamKalanGenel)
      data.push(totalRow)

      const ws = XLSX.utils.aoa_to_sheet(data)

      // Auto-fit column widths
      const colWidths = [
        { wch: 25 }, // Malik / İsim
        { wch: 18 }, // İletişim
        { wch: 20 }, // Şantiye
        { wch: 15 }, // Mesken Türü
        { wch: 10 }, // Daire No
        { wch: 18 }, // Toplam Alacak
        { wch: 18 }, // Devlet Desteği
        { wch: 18 }  // Kalan Bakiye
      ]
      for (let i = 0; i < maxStageCount; i++) {
        colWidths.push({ wch: 22 })
      }
      colWidths.push({ wch: 18 }, { wch: 18 })
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Proje Gelirleri')
      XLSX.writeFile(wb, `Proje_Gelirleri_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      alert('Excel oluşturulurken bir hata oluştu: ' + err.message)
    }
  }

  const pdfIndir = async () => {
    if (!tabloKapsayiciRef.current || pdfYukleniyor) return
    setPdfYukleniyor(true)
    await new Promise((resolve) => setTimeout(resolve, 50))

    try {
      const el = tabloKapsayiciRef.current
      const originalStyle = el.getAttribute('style') || ''

      const fullWidth = Math.max(el.scrollWidth, 1200)
      el.style.width = `${fullWidth}px`
      el.style.maxWidth = 'none'
      el.style.overflow = 'visible'

      const scale = 2
      const canvas = await html2canvas(el, {
        scale: scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: fullWidth + 50
      })

      el.setAttribute('style', originalStyle)

      const imgWidth = canvas.width
      const imgHeight = canvas.height

      // Standard A4 Landscape: 297mm x 210mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = 297
      const pdfHeight = 210
      const marginX = 12 // 12mm 4 bir yandan kenarlık
      const marginY = 12 // 12mm 4 bir yandan kenarlık
      const printableWidth = pdfWidth - marginX * 2 // 273mm
      const printableHeight = pdfHeight - marginY * 2 // 186mm

      const maxPageCanvasHeight = (printableHeight / printableWidth) * imgWidth

      if (imgHeight <= maxPageCanvasHeight) {
        // Fits cleanly on a single page!
        const imgData = canvas.toDataURL('image/png')
        const scaledHeight = (imgHeight * printableWidth) / imgWidth
        pdf.addImage(imgData, 'PNG', marginX, marginY, printableWidth, scaledHeight)
      } else {
        // Multi-page slicing at natural row boundaries
        const bodyRows = Array.from(el.querySelectorAll('tbody tr'))
        const tableEl = el.querySelector('table')
        const tableTopOffset = tableEl ? tableEl.offsetTop : 0

        const pageBreaks = [0]
        let pageStartY = 0

        for (let i = 0; i < bodyRows.length; i++) {
          const row = bodyRows[i]
          const rowBottomY = (tableTopOffset + row.offsetTop + row.offsetHeight) * scale

          if (rowBottomY - pageStartY > maxPageCanvasHeight && i > 0) {
            const prevRow = bodyRows[i - 1]
            const breakY = (tableTopOffset + prevRow.offsetTop + prevRow.offsetHeight) * scale
            pageBreaks.push(breakY)
            pageStartY = breakY
          }
        }

        for (let i = 0; i < pageBreaks.length; i++) {
          if (i > 0) pdf.addPage()

          const startY = pageBreaks[i]
          const endY = i + 1 < pageBreaks.length ? pageBreaks[i + 1] : imgHeight
          const sliceHeightPx = endY - startY

          const pageCanvas = document.createElement('canvas')
          pageCanvas.width = imgWidth
          pageCanvas.height = sliceHeightPx

          const ctx = pageCanvas.getContext('2d')
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, imgWidth, sliceHeightPx)
          ctx.drawImage(
            canvas,
            0, startY, imgWidth, sliceHeightPx,
            0, 0, imgWidth, sliceHeightPx
          )

          const sliceImgData = pageCanvas.toDataURL('image/png')
          const sliceScaledHeight = (sliceHeightPx * printableWidth) / imgWidth

          pdf.addImage(sliceImgData, 'PNG', marginX, marginY, printableWidth, sliceScaledHeight)
        }
      }

      pdf.save(`Proje_Gelirleri_Raporu_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      alert('PDF oluşturulurken bir hata oluştu: ' + err.message)
    } finally {
      setPdfYukleniyor(false)
    }
  }

  return (
    <div className="sayfa sayfa-genis">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Proje Gelirleri & Malik Takibi</h2>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            🔴 Ödeme alınmadı · 🟡 Kısmi ödeme alındı · 🟢 Tamamen ödendi · 💡 <i>Hücrelere çift tıklayarak hızlıca düzenleyebilirsiniz</i>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setHizliDuzenleModu(!hizliDuzenleModu)}
            style={{
              padding: '8px 14px',
              background: hizliDuzenleModu ? '#1D9596' : 'rgba(255,255,255,0.85)',
              color: hizliDuzenleModu ? '#FFFFFF' : '#1E293B',
              border: '1px solid #CBD5E0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
            }}
            title="Çift tıkla hücre düzenleme modunu aç/kapat"
          >
            ⚡ Hızlı Düzenle: {hizliDuzenleModu ? 'AÇIK' : 'KAPALI'}
          </button>
          <button
            onClick={excelIndir}
            style={{
              padding: '8px 16px',
              background: '#10B981',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
            }}
          >
            📊 Excel İndir
          </button>
          <button
            onClick={() => setSutunModalAcik(true)}
            disabled={pdfYukleniyor}
            style={{
              padding: '8px 16px',
              background: pdfYukleniyor ? '#94A3B8' : '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: pdfYukleniyor ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
            }}
          >
            📄 {pdfYukleniyor ? 'PDF Hazırlanıyor...' : 'PDF Raporu İndir'}
          </button>
        </div>
      </div>

      {/* Mobile KPI Grid & Filter Inline Styles */}
      <style>{`
        @media (max-width: 767px) {
          .kpi-grid-inline {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .kpi-card-inline {
            padding: 10px !important;
            border-radius: 12px !important;
          }
          .kpi-card-inline span:first-child {
            font-size: 8.5px !important;
            letter-spacing: 0 !important;
          }
          .kpi-card-inline span:last-child {
            font-size: 14px !important;
          }
          .santiye-butonlari { display: none !important; }
          .santiye-secici { display: block !important; width: 100%; margin-top: 5px; }
        }
        @media (min-width: 768px) {
          .santiye-secici { display: none !important; }
          .santiye-butonlari { display: flex !important; flex-wrap: wrap; gap: 10px; align-items: center; }
        }
      `}</style>

      {/* Dashboard Summary KPI Cards */}
      <div className="kpi-grid-inline" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="kpi-card-inline" style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toplam Alacak</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A' }}>{paraFormatla(toplamAlacakGenel)} ₺</span>
        </div>
        <div className="kpi-card-inline" style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Devlet Desteği</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#2563EB' }}>{paraFormatla(toplamDevletGenel)} ₺</span>
        </div>
        <div className="kpi-card-inline" style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toplam Tahsilat (Alınan)</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#1D9596' }}>{paraFormatla(toplamAlinanGenel)} ₺</span>
        </div>
        <div className="kpi-card-inline" style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.9)', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Kalan Borç</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: '#D97706' }}>{paraFormatla(toplamKalanGenel)} ₺</span>
        </div>
      </div>

      {/* Glassmorphism Filter & Sort Panel */}
      <div style={{ background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '14px 18px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.9)', boxShadow: '0 8px 32px rgba(0,0,0,0.04)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <select value={siralama} onChange={(e) => setSiralama(e.target.value)} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #CBD5E0', fontSize: '13px', background: 'white', fontWeight: 600, color: '#1E293B', outline: 'none' }}>
          <option value="daire_artan">Daire No (Küçükten Büyüğe)</option>
          <option value="daire_azalan">Daire No (Büyükten Küçüğe)</option>
          <option value="isim_artan">İsim (A-Z)</option>
          <option value="isim_azalan">İsim (Z-A)</option>
          <option value="kalan_artan">Kalan Borç (En Az)</option>
          <option value="kalan_azalan">Kalan Borç (En Çok)</option>
        </select>
        {/* MOBİL İÇİN ŞANTİYE SEÇİCİ */}
        <select 
          className="santiye-secici" 
          value={filtreSantiye} 
          onChange={(e) => setFiltreSantiye(e.target.value)} 
          style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #CBD5E0', fontSize: '13px', background: 'white', fontWeight: 600, color: '#1E293B', outline: 'none' }}
        >
          <option value="hepsi">Tüm Şantiyeler</option>
          {santiyeler.map((s) => (
            <option key={s.id} value={s.id}>{s.ad}</option>
          ))}
        </select>

        {/* BİLGİSAYAR İÇİN ŞANTİYE BUTONLARI */}
        <div className="santiye-butonlari">
          <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
          {santiyeler.map((s) => (
            <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
          ))}
        </div>
      </div>

      {/* Table Container Wrapper — viewport-pinned, bypasses all parent CSS */}
      <div
        ref={tabloKapsayiciRef}
        className="tablo-kaydirma-alani"
        style={{
          display: 'block',
          width: 'calc(100vw - 32px)',
          maxWidth: 'calc(100vw - 32px)',
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          background: pdfYukleniyor ? '#FFFFFF' : 'rgba(255, 255, 255, 0.95)',
          padding: pdfYukleniyor ? '20px' : '0px',
          boxSizing: 'border-box',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.05)',
          marginBottom: '24px',
          position: 'relative',
        }}
      >
        {/* PDF Rapor Başlık Alanı (Sadece PDF oluşturulurken görünür) */}
        <div style={{ marginBottom: '16px', borderBottom: '2px solid #1D9596', paddingBottom: '12px', display: pdfYukleniyor ? 'flex' : 'none', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '0.3px' }}>Proje Gelirleri ve Ödeme Durumları Raporu</h1>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>
              {filtreSantiye === 'hepsi' ? 'Tüm Şantiyeler' : `Şantiye: ${santiyeler.find(s => s.id === filtreSantiye)?.ad || ''}`}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            <div>Tarih: {new Date().toLocaleDateString('tr-TR')}</div>
          </div>
        </div>

        <table className="kaydirilabilir-tablo" style={{ minWidth: '1500px', width: 'max-content' }}>
          <thead>
            {(() => {
              const thStil = { background: 'linear-gradient(135deg, #1D9596 0%, #147576 100%)', color: '#FFFFFF', padding: '16px 14px', borderBottom: '3px solid #0F5859', fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
              const seciliSantiyeAd = santiyeler.find(s => s.id === filtreSantiye)?.ad
              return (
                <tr>
                  <th style={{ ...thStil, position: 'sticky', left: 0, zIndex: 11, display: isColumnVisible('ad_soyad') ? '' : 'none' }}>Malik / İsim</th>
                  <th style={{ ...thStil, display: isColumnVisible('telefon') ? '' : 'none' }}>İletişim Bilgileri</th>
                  <th style={{ ...thStil, display: isColumnVisible('santiye') ? '' : 'none' }}>Şantiye</th>
                  <th style={{ ...thStil, display: isColumnVisible('mesken_turu') ? '' : 'none' }}>Mesken Türü</th>
                  <th style={{ ...thStil, display: isColumnVisible('daire_no') ? '' : 'none' }}>Daire No</th>
                  <th style={{ ...thStil, display: isColumnVisible('toplam_alacak') ? '' : 'none' }}>Toplam Alacak</th>
                  <th style={{ ...thStil, display: isColumnVisible('devlet_destegi') ? '' : 'none' }}>Devlet Desteği</th>
                  <th style={{ ...thStil, display: isColumnVisible('kalan_bakiye') ? '' : 'none' }}>Kalan Bakiye</th>
                  {Array.from({ length: maxStageCount }).map((_, i) => (
                    <th key={i} style={{ ...thStil, minWidth: 165, display: isColumnVisible('asamalar') ? '' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span>Aşama {i + 1}</span>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: filtreSantiye === 'hepsi' ? 'not-allowed' : 'pointer',
                              fontSize: 10,
                              textTransform: 'none',
                              background: 'rgba(255,255,255,0.22)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              opacity: filtreSantiye === 'hepsi' ? 0.6 : 1
                            }}
                            title={filtreSantiye === 'hepsi' ? "Toplu işlem için lütfen önce bir şantiye seçin" : `${seciliSantiyeAd} şantiyesindeki malikler için tamamlandı işaretle / kaldır`}
                          >
                            <input
                              type="checkbox"
                              disabled={filtreSantiye === 'hepsi'}
                              style={{ width: 13, height: 13, cursor: filtreSantiye === 'hepsi' ? 'not-allowed' : 'pointer', accentColor: '#1D9596' }}
                              checked={isAllStageCompleted(i)}
                              onChange={(e) => topluAsamaTamamlandiGuncelle(i, e.target.checked)}
                            />
                            <span>Tümü</span>
                          </label>
                        </div>
                        <input
                          type="text"
                          disabled={filtreSantiye === 'hepsi'}
                          style={{
                            background: filtreSantiye === 'hepsi' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.25)',
                            border: '1px solid rgba(255, 255, 255, 0.4)',
                            color: '#FFFFFF',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: '600',
                            width: '100%',
                            outline: 'none',
                            cursor: filtreSantiye === 'hepsi' ? 'not-allowed' : 'text'
                          }}
                          placeholder={filtreSantiye === 'hepsi' ? "🔒 Önce Şantiye Seçiniz" : `${seciliSantiyeAd || ''} için yaz...`}
                          defaultValue={getStageHeaderDefault(i)}
                          key={`asama-header-${i}-${getStageHeaderDefault(i)}-${filtreSantiye}`}
                          onBlur={(e) => topluAsamaGuncelle(i, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              topluAsamaGuncelle(i, e.target.value)
                              e.target.blur()
                            }
                          }}
                          title={filtreSantiye === 'hepsi' ? "Aşama adlarını değiştirmek için önce bir şantiye seçiniz" : `${seciliSantiyeAd} şantiyesi için aşama adı kaydet`}
                        />
                      </div>
                    </th>
                  ))}
                  <th style={{ ...thStil, display: isColumnVisible('alinan') ? '' : 'none' }}>Alınan</th>
                  <th style={{ ...thStil, display: isColumnVisible('kalan') ? '' : 'none' }}>Kalan</th>
                  <th style={{ ...thStil, display: isColumnVisible('islemler') ? '' : 'none' }}>İşlemler</th>
                </tr>
              )
            })()}
          </thead>
          <tbody>
            {gorunenler.map((m, index) => {
              const stages = asamalar[m.id] || []
              const renkler = renkHesapla(m.id, stages)
              const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
              const alinan = odemeToplamlari[m.id] || 0
              const kalan = Math.max(0, kalanBakiye - alinan)
              
              const isRuha = (m.ad_soyad || '').toLowerCase().includes('ruha')
              const isKalanSifir = kalan === 0 && Number(m.toplam_alacak || 0) > 0
              const isEven = index % 2 === 0

              let cellBg = 'rgba(255, 255, 255, 0.95)'
              let stickyBg = '#FFFFFF'
              
              if (isRuha) {
                cellBg = 'rgba(29, 149, 150, 0.22)'
                stickyBg = '#B2EBF2'
              } else if (isKalanSifir) {
                cellBg = 'rgba(34, 197, 94, 0.16)'
                stickyBg = '#DCFCE7'
              } else if (!isEven) {
                cellBg = 'rgba(241, 245, 249, 0.75)'
                stickyBg = '#F1F5F9'
              }

              return (
                <tr key={m.id} className="premium-satir">
                  {/* Malik Adı */}
                  <td style={{ position: 'sticky', left: 0, background: stickyBg, fontWeight: 700, zIndex: 5, boxShadow: '2px 0 5px rgba(0,0,0,0.03)', display: isColumnVisible('ad_soyad') ? '' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'ad_soyad' ? (
                        <textarea
                          autoFocus
                          style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: '100%', resize: 'vertical', minHeight: '40px', fontFamily: 'inherit', fontSize: '13px' }}
                          defaultValue={m.ad_soyad}
                          onBlur={(e) => hucreKaydet(m.id, 'ad_soyad', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (!e.altKey && !e.shiftKey) {
                                e.preventDefault()
                                hucreKaydet(m.id, 'ad_soyad', e.target.value)
                              }
                            }
                          }}
                        />
                      ) : (
                        <span onDoubleClick={() => hucreCiftTik(m.id, 'ad_soyad')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle (Alt+Enter ile alt satır)" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default', display: 'inline-block' }}>
                          {(m.ad_soyad || '').split('\n').map((line, i, arr) => (
                            <span key={i}>
                              {line}
                              {i < arr.length - 1 && <br />}
                            </span>
                          ))}
                        </span>
                      )}
                      {isRuha && <span style={{ fontSize: 9, background: '#1D9596', color: 'white', padding: '3px 8px', borderRadius: 6, fontWeight: 900, boxShadow: '0 2px 6px rgba(29,149,150,0.3)', letterSpacing: '0.5px' }}>⭐ BİZE AİT</span>}
                    </div>
                  </td>

                  {/* Telefon */}
                  <td style={{ background: cellBg, display: isColumnVisible('telefon') ? '' : 'none' }}>
                    {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'telefon' ? (
                      <input
                        type="text"
                        autoFocus
                        style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: 110 }}
                        defaultValue={m.telefon || ''}
                        onBlur={(e) => hucreKaydet(m.id, 'telefon', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') hucreKaydet(m.id, 'telefon', e.target.value) }}
                      />
                    ) : (
                      <span onDoubleClick={() => hucreCiftTik(m.id, 'telefon')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{m.telefon || '—'}</span>
                    )}
                  </td>

                  {/* Şantiye */}
                  <td style={{ background: cellBg, display: isColumnVisible('santiye') ? '' : 'none' }}>{m.santiyeler?.ad}</td>

                  {/* Mesken Türü */}
                  <td style={{ background: cellBg, display: isColumnVisible('mesken_turu') ? '' : 'none' }}>
                    {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'mesken_turu' ? (
                      <input
                        type="text"
                        autoFocus
                        style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: 90 }}
                        defaultValue={m.mesken_turu || ''}
                        onBlur={(e) => hucreKaydet(m.id, 'mesken_turu', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') hucreKaydet(m.id, 'mesken_turu', e.target.value) }}
                      />
                    ) : (
                      <span onDoubleClick={() => hucreCiftTik(m.id, 'mesken_turu')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{m.mesken_turu || '—'}</span>
                    )}
                  </td>

                  {/* Daire No */}
                  <td style={{ background: cellBg, display: isColumnVisible('daire_no') ? '' : 'none' }}>
                    {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'daire_no' ? (
                      <input
                        type="text"
                        autoFocus
                        style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: 60 }}
                        defaultValue={m.daire_no || ''}
                        onBlur={(e) => hucreKaydet(m.id, 'daire_no', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') hucreKaydet(m.id, 'daire_no', e.target.value) }}
                      />
                    ) : (
                      <span onDoubleClick={() => hucreCiftTik(m.id, 'daire_no')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{m.daire_no || '—'}</span>
                    )}
                  </td>

                  {/* Toplam Alacak */}
                  <td style={{ background: cellBg, fontWeight: 500, display: isColumnVisible('toplam_alacak') ? '' : 'none' }}>
                    {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'toplam_alacak' ? (
                      <input
                        type="number"
                        autoFocus
                        style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: 110 }}
                        defaultValue={m.toplam_alacak ?? ''}
                        onBlur={(e) => hucreKaydet(m.id, 'toplam_alacak', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') hucreKaydet(m.id, 'toplam_alacak', e.target.value) }}
                      />
                    ) : (
                      <span onDoubleClick={() => hucreCiftTik(m.id, 'toplam_alacak')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{paraFormatla(m.toplam_alacak)} ₺</span>
                    )}
                  </td>

                  {/* Devlet Desteği */}
                  <td style={{ background: cellBg, fontWeight: 500, display: isColumnVisible('devlet_destegi') ? '' : 'none' }}>
                    {hucreEdit?.malikId === m.id && hucreEdit?.alan === 'devlet_destegi' ? (
                      <input
                        type="number"
                        autoFocus
                        style={{ padding: '3px 6px', border: '2px solid #1D9596', borderRadius: 4, width: 110 }}
                        defaultValue={m.devlet_destegi ?? ''}
                        onBlur={(e) => hucreKaydet(m.id, 'devlet_destegi', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') hucreKaydet(m.id, 'devlet_destegi', e.target.value) }}
                      />
                    ) : (
                      <span onDoubleClick={() => hucreCiftTik(m.id, 'devlet_destegi')} title={hizliDuzenleModu ? "Çift tıklayarak düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{paraFormatla(m.devlet_destegi)} ₺</span>
                    )}
                  </td>

                  {/* Kalan Bakiye */}
                  <td style={{ background: cellBg, fontWeight: 600, display: isColumnVisible('kalan_bakiye') ? '' : 'none' }}>{paraFormatla(kalanBakiye)} ₺</td>

                  {/* Aşamalar */}
                  {Array.from({ length: maxStageCount }).map((_, i) => {
                    const s = stages[i]
                    const renk = renkler[i] || 'yok'
                    const isStageChecked = !!s?.tamamlandi

                    let stageCellBg = cellBg
                    let rozetSinif = 'pill-gri'
                    let durumMetni = ''

                    if (isStageChecked) {
                      if (renk === 'yesil') {
                        stageCellBg = 'rgba(34, 197, 94, 0.22)'
                        rozetSinif = 'pill-yesil'
                        durumMetni = '🟢 ÖDENDİ'
                      } else if (renk === 'sari') {
                        stageCellBg = 'rgba(245, 158, 11, 0.22)'
                        rozetSinif = 'pill-sari'
                        durumMetni = '🟡 KISMİ'
                      } else if (renk === 'kirmizi') {
                        stageCellBg = 'rgba(239, 68, 68, 0.22)'
                        rozetSinif = 'pill-kirmizi'
                        durumMetni = '🔴 ÖDENMEDİ'
                      }
                    }

                    return (
                      <td key={i} style={{ background: stageCellBg, minWidth: 140, transition: 'background 0.2s ease', display: isColumnVisible('asamalar') ? '' : 'none' }}>
                        {s?.id && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                            <span className={`pill-rozet ${rozetSinif}`} title={isStageChecked ? `Aşama Tamamlandı (${durumMetni})` : 'Aşama Henüz Tamamlanmadı'}>
                              <input type="checkbox" style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#1D9596' }} checked={!!s.tamamlandi} onChange={() => asamaTikle(s)} title="Şantiye fiili tamamlanma tik kutusu" />
                              <span>{s.ad || '—'}</span>
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 4, paddingLeft: 2 }}>
                              {hucreEdit?.asamaId === s.id ? (
                                <input
                                  type="number"
                                  autoFocus
                                  style={{ padding: '2px 4px', border: '2px solid #1D9596', borderRadius: 4, width: 85, fontSize: 12, fontWeight: 700 }}
                                  defaultValue={s.tutar ?? ''}
                                  onBlur={(e) => asamaTutarKaydet(s.id, e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') asamaTutarKaydet(s.id, e.target.value) }}
                                />
                              ) : (
                                <span onDoubleClick={() => hucreCiftTik(null, null, s.id)} title={hizliDuzenleModu ? "Çift tıklayarak tutarı düzenle" : "Hızlı Düzenleme modunu açarak düzenleyebilirsiniz"} style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', cursor: hizliDuzenleModu ? 'pointer' : 'default' }}>{paraFormatla(s.tutar)} ₺</span>
                              )}
                              {durumMetni && <span style={{ fontSize: 9, fontWeight: 800 }}>{durumMetni}</span>}
                            </div>
                          </div>
                        )}
                      </td>
                    )
                  })}

                  {/* Alınan */}
                  <td style={{ background: cellBg, color: '#1D9596', fontWeight: 700, fontSize: 14, display: isColumnVisible('alinan') ? '' : 'none' }}>{paraFormatla(alinan)} ₺</td>

                  {/* Kalan */}
                  <td style={{ background: cellBg, fontWeight: 700, fontSize: 14, display: isColumnVisible('kalan') ? '' : 'none' }}>
                    {isKalanSifir ? <span className="pill-rozet pill-yesil" style={{ fontSize: 12, padding: '4px 10px' }}>✓ ÖDENDİ</span> : `${paraFormatla(kalan)} ₺`}
                  </td>

                  {/* İşlemler */}
                  <td style={{ background: cellBg, display: isColumnVisible('islemler') ? '' : 'none' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="sil-buton" onClick={() => malikKopyala(m)} aria-label="Kopyala" title="Şablonu Kopyala" style={{ fontSize: 16 }}>📄</button>
                      <button className="sil-buton" onClick={() => duzenlemeyiAc(m)} aria-label="Düzenle" title="Düzenle" style={{ fontSize: 16 }}>✎</button>
                      <button className="sil-buton" onClick={() => malikSil(m.id)} aria-label="Sil" title="Sil" style={{ fontSize: 16 }}>🗑</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {gorunenler.length === 0 && <tr><td colSpan={13 + maxStageCount} style={{ padding: '14px', textAlign: 'center', color: '#718096' }}>Henüz malik eklenmemiş.</td></tr>}
          </tbody>
          <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
            <tr style={{ background: 'linear-gradient(135deg, #E6F4F1 0%, #D2ECE9 100%)', color: '#0F5859', fontWeight: 800, borderTop: '3px solid #1D9596', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
              <td style={{ position: 'sticky', left: 0, background: '#D2ECE9', color: '#0F5859', zIndex: 11, padding: '14px 16px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 900, display: isColumnVisible('ad_soyad') ? '' : 'none' }}>TOPLAM</td>
              <td style={{ color: '#64748B', background: '#E6F4F1', display: isColumnVisible('telefon') ? '' : 'none' }}>—</td>
              <td style={{ color: '#64748B', background: '#E6F4F1', display: isColumnVisible('santiye') ? '' : 'none' }}>—</td>
              <td style={{ color: '#64748B', background: '#E6F4F1', display: isColumnVisible('mesken_turu') ? '' : 'none' }}>—</td>
              <td style={{ color: '#64748B', background: '#E6F4F1', display: isColumnVisible('daire_no') ? '' : 'none' }}>—</td>
              <td style={{ fontSize: 14, color: '#1E293B', background: '#E6F4F1', fontWeight: 800, display: isColumnVisible('toplam_alacak') ? '' : 'none' }}>{paraFormatla(toplamAlacakGenel)} ₺</td>
              <td style={{ fontSize: 14, color: '#1D4ED8', background: '#E6F4F1', fontWeight: 800, display: isColumnVisible('devlet_destegi') ? '' : 'none' }}>{paraFormatla(toplamDevletGenel)} ₺</td>
              <td style={{ fontSize: 14, color: '#D97706', background: '#E6F4F1', fontWeight: 800, display: isColumnVisible('kalan_bakiye') ? '' : 'none' }}>{paraFormatla(toplamAlacakGenel - toplamDevletGenel)} ₺</td>
              {Array.from({ length: maxStageCount }).map((_, i) => (
                <td key={i} style={{ background: '#E2F2F0', color: '#0F5859', fontWeight: 800, fontSize: 13, display: isColumnVisible('asamalar') ? '' : 'none' }}>
                  {paraFormatla(asamaToplamlari[i])} ₺
                </td>
              ))}
              <td style={{ color: '#059669', fontSize: 15, fontWeight: 900, background: '#E6F4F1', display: isColumnVisible('alinan') ? '' : 'none' }}>{paraFormatla(toplamAlinanGenel)} ₺</td>
              <td style={{ color: '#DC2626', fontSize: 15, fontWeight: 900, background: '#E6F4F1', display: isColumnVisible('kalan') ? '' : 'none' }}>{paraFormatla(toplamKalanGenel)} ₺</td>
              <td style={{ background: '#E6F4F1', display: isColumnVisible('islemler') ? '' : 'none' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {duzenlenenId && (
        <div className="glass-kutu form-grid" style={{ marginBottom: 24 }}>
          <p className="alt-baslik" style={{ gridColumn: '1 / -1', borderBottom: '2px solid #E2E8F0', paddingBottom: 8, color: '#2D3748', fontSize: 16 }}>Düzenle: <span style={{ color: '#1D9596' }}>{malikler.find((m) => m.id === duzenlenenId)?.ad_soyad}</span></p>
          
          <div>
            <label className="premium-label">Ad Soyad</label>
            <textarea 
              className="premium-input"
              value={taslak.ad_soyad || ''} 
              placeholder="Malik Ad Soyad (Alt+Enter ile alt satır)"
              onChange={(e) => setTaslak((o) => ({ ...o, ad_soyad: e.target.value }))} 
              style={{ minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label className="premium-label">İletişim Bilgileri (Telefon)</label>
            <input 
              type="text" 
              className="premium-input"
              value={taslak.telefon || ''} 
              placeholder="05xx xxx xx xx"
              onChange={(e) => setTaslak((o) => ({ ...o, telefon: e.target.value }))} 
            />
          </div>

          <div>
            <label className="premium-label">Mesken Türü</label>
            <input 
              type="text" 
              className="premium-input"
              value={taslak.mesken_turu || ''} 
              placeholder="Daire / Dükkan vb."
              onChange={(e) => setTaslak((o) => ({ ...o, mesken_turu: e.target.value }))} 
            />
          </div>

          <div>
            <label className="premium-label">Daire No</label>
            <input 
              type="text" 
              className="premium-input"
              value={taslak.daire_no || ''} 
              placeholder="Örn: 5"
              onChange={(e) => setTaslak((o) => ({ ...o, daire_no: e.target.value }))} 
            />
          </div>

          <div>
            <label className="premium-label">Toplam Alacak (₺)</label>
            <input type="number" className="premium-input" value={taslak.toplam_alacak ?? ''} onKeyDown={sadeceSayiTuslari}
              onChange={(e) => setTaslak((o) => ({ ...o, toplam_alacak: e.target.value }))} />
          </div>
          <div>
            <label className="premium-label">Devlet Desteği (Kredi+Hibe ₺)</label>
            <input type="number" className="premium-input" value={taslak.devlet_destegi ?? ''} onKeyDown={sadeceSayiTuslari}
              onChange={(e) => setTaslak((o) => ({ ...o, devlet_destegi: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px', gridColumn: '1 / -1', borderBottom: '2px solid #E2E8F0', paddingBottom: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#2D3748' }}>Ödeme Aşamaları <span style={{color: '#718096', fontWeight: 500, fontSize: 12}}>(Kalan bakiyenin dağılımı)</span></p>
            <button onClick={asamaEkle} style={{ fontSize: 12, padding: '6px 12px', background: '#38B2AC', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, boxShadow: '0 2px 4px rgba(56, 178, 172, 0.3)' }}>+ Aşama Ekle</button>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {taslakAsamalar.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#F7FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0' }}>
              <input
                type="text"
                className="premium-input"
                style={{ marginTop: 0 }}
                placeholder={`Aşama ${i + 1} adı (örn. İskanda)`}
                value={a.ad || ''}
                onChange={(e) => setTaslakAsamalar((o) => o.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))}
              />
              <input
                type="number"
                className="premium-input"
                style={{ marginTop: 0 }}
                placeholder="Tutar (₺)"
                value={a.tutar ?? ''}
                onKeyDown={sadeceSayiTuslari}
                onChange={(e) => setTaslakAsamalar((o) => o.map((x, j) => (j === i ? { ...x, tutar: e.target.value } : x)))}
              />
              <button onClick={() => asamaSilTaslak(i)} style={{ background: '#FC8181', color: '#fff', border: 'none', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', flexShrink: 0, fontWeight: 'bold' }} title="Aşamayı sil">✕</button>
            </div>
          ))}
          </div>

          <div className="ekleme-satiri-2" style={{ marginTop: 10, gridColumn: '1 / -1' }}>
            <button onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
            <button className="ekle-buton-genis" onClick={() => kaydet(duzenlenenId)}>Kaydet</button>
          </div>
        </div>
      )}

      {!yeniAcik ? (
        <button className="ekle-buton-genis" style={{ background: 'linear-gradient(135deg, #1D9596 0%, #2B6CB0 100%)', boxShadow: '0 4px 14px rgba(29, 149, 150, 0.4)', border: 'none', color: 'white', fontWeight: 600, padding: '14px', borderRadius: 12, fontSize: 15 }} onClick={() => setYeniAcik(true)}>+ Yeni Malik Ekle</button>
      ) : (
        <div className="glass-kutu form-grid" style={{ marginTop: 24 }}>
          <p className="alt-baslik" style={{ gridColumn: '1 / -1', borderBottom: '2px solid #E2E8F0', paddingBottom: 8, color: '#2D3748', fontSize: 16, margin: '0 0 8px 0' }}>Yeni Malik Ekle</p>
          <div>
            <label className="premium-label">Şantiye</label>
            <select className="premium-input" value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
            </select>
          </div>
          <div>
            <label className="premium-label">Malik Ad Soyad</label>
            <input className="premium-input" type="text" placeholder="Ad Soyad giriniz" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
          </div>
          <div>
            <label className="premium-label">İletişim (Telefon)</label>
            <input className="premium-input" type="text" placeholder="05xx xxx xx xx" value={yeniTelefon} onChange={(e) => setYeniTelefon(e.target.value)} />
          </div>
          <div>
            <label className="premium-label">Mesken Türü</label>
            <input className="premium-input" type="text" placeholder="Daire, Dükkan vb." value={yeniMeskenTuru} onChange={(e) => setYeniMeskenTuru(e.target.value)} />
          </div>
          <div>
            <label className="premium-label">Daire No</label>
            <input className="premium-input" type="text" placeholder="Örn: 5" value={yeniDaireNo} onChange={(e) => setYeniDaireNo(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, marginTop: 12 }}>
            <button onClick={() => setYeniAcik(false)} style={{ flex: 1, padding: 12, background: '#EDF2F7', color: '#4A5568', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Vazgeç</button>
            <button onClick={malikEkle} style={{ flex: 2, padding: 12, background: '#1D9596', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(29, 149, 150, 0.3)' }}>Kaydet</button>
          </div>
        </div>
      )}

      {sutunModalAcik && (
        <div className="modal-arka-plan" style={{ zIndex: 9999 }}>
          <div className="modal-kutu" style={{ maxWidth: '520px', borderRadius: '18px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: 800 }}>⚙️ PDF Çıktısı İçin Sütun Seçimi</h3>
              <button onClick={() => setSutunModalAcik(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 16px', lineHeight: '1.5' }}>
              💡 <i>Daha az sütun seçtiğinizde PDF'teki yazılar otomatik olarak <b>daha büyük ve okunaklı punta</b> ile basılacaktır.</i>
            </p>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSeciliSutunlarPDF({ ad_soyad: true, telefon: true, santiye: true, mesken_turu: true, daire_no: true, toplam_alacak: true, devlet_destegi: true, kalan_bakiye: true, asamalar: true, alinan: true, kalan: true })}
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #CBD5E0', background: '#F1F5F9', fontWeight: 600, cursor: 'pointer' }}
              >
                ✓ Tümünü Seç
              </button>
              <button
                onClick={() => setSeciliSutunlarPDF({ ad_soyad: true, telefon: false, santiye: false, mesken_turu: false, daire_no: true, toplam_alacak: true, devlet_destegi: true, kalan_bakiye: true, asamalar: false, alinan: true, kalan: true })}
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #CBD5E0', background: '#F1F5F9', fontWeight: 600, cursor: 'pointer' }}
              >
                📋 Özet Rapor (Büyük Yazı)
              </button>
            </div>

            {/* Checkboxes Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              {[
                { key: 'ad_soyad', label: 'Malik / İsim' },
                { key: 'telefon', label: 'İletişim Bilgileri' },
                { key: 'santiye', label: 'Şantiye' },
                { key: 'mesken_turu', label: 'Mesken Türü' },
                { key: 'daire_no', label: 'Daire No' },
                { key: 'toplam_alacak', label: 'Toplam Alacak' },
                { key: 'devlet_destegi', label: 'Devlet Desteği' },
                { key: 'kalan_bakiye', label: 'Kalan Bakiye' },
                { key: 'asamalar', label: 'Aşamalar (Aşama 1..N)' },
                { key: 'alinan', label: 'Alınan (Tahsilat)' },
                { key: 'kalan', label: 'Kalan Borç' }
              ].map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!seciliSutunlarPDF[item.key]}
                    onChange={(e) => setSeciliSutunlarPDF((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: '#1D9596', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSutunModalAcik(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E0', background: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  setSutunModalAcik(false)
                  pdfIndir()
                }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#DC2626', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.25)' }}
              >
                📄 PDF Oluştur & İndir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}