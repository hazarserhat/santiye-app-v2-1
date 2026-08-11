export function paraFormatla(sayi) {
  return Number(sayi || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function sadeceSayiTuslari(e) {
  const izinliTuslar = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', '-', '.', ',']
  if (izinliTuslar.includes(e.key)) return
  if (e.ctrlKey || e.metaKey) return
  if (!/^[0-9]$/.test(e.key)) e.preventDefault()
}
