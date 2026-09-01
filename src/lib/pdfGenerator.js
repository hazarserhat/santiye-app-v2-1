import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Türkçe karakterleri İngilizce karşılıklarına dönüştürür (jsPDF standart font uyumluluğu için)
 */
const cleanTR = (val) => {
  if (val === null || val === undefined) return ''
  const str = String(val)
  return str
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
}

/**
 * Verilen tablo verisini PDF'e çevirip indirmeyi veya WhatsApp ile paylaşmayı sağlar
 * 
 * @param {Object} options
 * @param {string} options.title - PDF başlığı
 * @param {string} options.filename - İndirilecek dosya adı
 * @param {Array<string>} options.columns - Tablo başlıkları (Sütunlar)
 * @param {Array<Array<any>>} options.data - Tablo satırları
 */
export const generateAndSharePDF = async ({ title, filename = 'tablo.pdf', columns, data }) => {
  try {
    // Temizlenmiş veri
    const safeTitle = cleanTR(title)
    const safeColumns = columns.map(cleanTR)
    const safeData = data.map(row => row.map(cleanTR))

    const doc = new jsPDF('landscape')
  
  // Başlık ekle
  doc.setFontSize(16)
  doc.text(safeTitle, 14, 15)
  
  // Tarih ekle
  doc.setFontSize(10)
  const today = new Date().toLocaleDateString('tr-TR')
  doc.text(`Tarih: ${today}`, 14, 22)

    // Tabloyu oluştur
    autoTable(doc, {
      startY: 28,
      head: [safeColumns],
      body: safeData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    })

  // PDF Blob oluştur
  const pdfBlob = doc.output('blob')
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

  // WhatsApp Paylaşım Mantığı
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      // Mobil cihaz: Native paylaşım menüsü
      try {
        await navigator.share({
          title: safeTitle,
          text: `${safeTitle} belgesi ektedir.`,
          files: [file]
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Paylaşım hatası:', err)
          alert('Paylaşım iptal edildi veya bir hata oluştu.')
        }
      }
    } else {
      // Masaüstü: PDF indir ve WhatsApp'a yönlendir
      doc.save(filename)
      
      // Popup engelleyiciyi aşmak için gizli bir <a> etiketi kullanıyoruz
      const textMsg = encodeURIComponent(`${safeTitle} PDF olarak bilgisayarınıza indirildi. Lütfen indirdiğiniz PDF dosyasını bu mesaja sürükleyip bırakın.`)
      const a = document.createElement('a')
      a.href = `https://wa.me/?text=${textMsg}`
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch (error) {
    console.error('PDF Oluşturma Hatası:', error)
    alert(`PDF Oluşturulurken bir hata meydana geldi:\n\n${error.message}\n\nLütfen konsolu kontrol edin.`)
  }
}
