export function paraFormatla(sayi) {
  return Number(sayi || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function sadeceSayiTuslari(e) {
  const izinliTuslar = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', '-', '.', ',']
  if (izinliTuslar.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return
  if (!/^[0-9]$/.test(e.key)) e.preventDefault()
}

export function formatInputTutar(deger) {
  if (deger === undefined || deger === null) return ''
  let strDeger = String(deger)
  
  // Eğer değer veritabanından float/sayı olarak geldiyse ondalık noktasını virgüle çevir
  if (typeof deger === 'number') {
    strDeger = strDeger.replace('.', ',')
  }
  
  // Sadece rakam ve virgül kalacak şekilde diğer her şeyi (nokta dahil) temizle
  let temiz = strDeger.replace(/[^0-9,]/g, '')
  
  // Birden fazla virgül varsa, sadece ilkini tut
  const parcalar = temiz.split(',')
  if (parcalar.length > 2) {
    temiz = parcalar[0] + ',' + parcalar.slice(1).join('')
  }
  
  // Tam sayı ve ondalık kısmı ayır
  const [tamSayi, ondalik] = temiz.split(',')
  
  // Tam sayı kısmını binlik ayracı (nokta) ile formatla
  const formatliTamSayi = tamSayi.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  
  // Eğer virgül varsa ondalık kısmı da ekle
  if (temiz.includes(',')) {
    return `${formatliTamSayi},${ondalik}`
  }
  
  return formatliTamSayi
}

export function temizleTutar(formatliDeger) {
  if (formatliDeger === undefined || formatliDeger === null || formatliDeger === '') return 0
  const strDeger = String(formatliDeger)
  // Noktaları (binlik ayracı) sil, virgülü noktaya (ondalık ayracı) çevir
  const temiz = strDeger.replace(/\./g, '').replace(',', '.')
  return Number(temiz) || 0
}

export function isOtoparkSantiye(santiyeAdi) {
  if (!santiyeAdi) return false
  const s = String(santiyeAdi).toLowerCase()
  return s.includes('furkan') || s.includes('8917') || s.includes('8919') || s.includes('8920')
}

export function isOtoparkHarcOdeme(gelirKaydi, santiyeAdi) {
  if (!gelirKaydi) return false
  if (gelirKaydi.is_otopark_harci || gelirKaydi.harc_turu === 'otopark') return true
  if (gelirKaydi.harc_turu === 'genel') return false
  if (gelirKaydi.not_metni && gelirKaydi.not_metni.toLowerCase().includes('otopark')) return true
  if (gelirKaydi.is_vergi_harc && isOtoparkSantiye(santiyeAdi)) return true
  return false
}
