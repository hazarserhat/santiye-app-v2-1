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
  const strDeger = String(deger)
  
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
