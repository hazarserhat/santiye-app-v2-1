// --- YARDIMCI: TELEFON ALANINDAKİ KİŞİLERİ ÇÖZÜMLEME (JSON, Çoklu Satır veya Klasik Tel) ---
export function parseContacts(t) {
  if (!t) return []
  const raw = (typeof t === 'string' ? t : (t.telefon || '')).trim()
  const fallbackAd = typeof t === 'object' ? (t.ad || t.firma || 'Yetkili') : 'Yetkili'

  if (!raw) {
    return [{
      id: 'default-1',
      ad: fallbackAd,
      rol: 'Yetkili',
      telefon: '',
      not: ''
    }]
  }

  // 1. JSON Array formatı
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item, idx) => ({
          id: item.id || `k-${idx}-${Date.now()}`,
          ad: item.ad || fallbackAd,
          rol: item.rol || item.unvan || 'Yetkili',
          telefon: item.telefon || '',
          not: item.not || ''
        }))
      }
    } catch {
      // Hata olursa alt adıma geç
    }
  }

  // 2. Çoklu satır veya '|' ayracı
  if (raw.includes('|') || raw.includes('\n')) {
    const lines = raw.split(/[|\n]/).map(s => s.trim()).filter(Boolean)
    if (lines.length > 1) {
      return lines.map((line, idx) => {
        const match = line.match(/^([0-9\s+()-]+)(?:\s*\((.*?)\))?$/)
        if (match) {
          const tel = match[1].trim()
          const info = match[2]?.trim() || ''
          const parts = info.split('-')
          const name = parts[0]?.trim() || fallbackAd
          const role = parts[1]?.trim() || 'Yetkili'
          return { id: `line-${idx}`, ad: name, rol: role, telefon: tel, not: '' }
        }
        return { id: `line-${idx}`, ad: fallbackAd, rol: 'Yetkili', telefon: line, not: '' }
      })
    }
  }

  // 3. Tek kişi formatı
  return [{
    id: `single-${typeof t === 'object' && t.id ? t.id : '1'}`,
    ad: fallbackAd,
    rol: 'Yetkili',
    telefon: raw,
    not: ''
  }]
}

// Kişiler dizisini telefon sütununa JSON string olarak paketle
export function serializeContacts(kisiler) {
  if (!kisiler || kisiler.length === 0) return ''
  // Sadece tek kişi varsa ve basit bir telefon girildiyse geriye dönük uyum için düz numara yaz
  if (kisiler.length === 1 && !kisiler[0].not && (!kisiler[0].rol || kisiler[0].rol === 'Yetkili') && (!kisiler[0].ad || kisiler[0].ad === 'Yetkili')) {
    return kisiler[0].telefon?.trim() || ''
  }
  return JSON.stringify(kisiler.map(k => ({
    ad: (k.ad || '').trim(),
    rol: (k.rol || '').trim(),
    telefon: (k.telefon || '').trim(),
    not: (k.not || '').trim()
  })))
}

// WhatsApp bağlantısı oluşturucu
export function whatsappBaglantisi(telefon) {
  if (!telefon) return ''
  const temiz = telefon.replace(/[^0-9]/g, '')
  if (!temiz) return ''
  const numara = temiz.startsWith('0') ? '9' + temiz : (temiz.startsWith('90') ? temiz : '90' + temiz)
  return `https://wa.me/${numara}`
}

// Cari ve Temsilcilerini arama metniyle eşleştirme
export function matchCari(c, arananMetin) {
  if (!c || !arananMetin) return { isMatch: false }
  const aranan = arananMetin.trim().toLocaleLowerCase('tr-TR')
  if (!aranan) return { isMatch: false }

  const adMatch = c.ad && c.ad.toLocaleLowerCase('tr-TR').includes(aranan)
  const firmaMatch = c.firma && c.firma.toLocaleLowerCase('tr-TR').includes(aranan)
  const sifatMatch = c.sifat && c.sifat.toLocaleLowerCase('tr-TR').includes(aranan)

  // Kişileri parse et
  const kisiler = parseContacts(c)
  const eslesenKisi = kisiler.find(k => 
    (k.ad && k.ad.toLocaleLowerCase('tr-TR').includes(aranan)) ||
    (k.telefon && k.telefon.replace(/\s+/g, '').includes(aranan.replace(/\s+/g, ''))) ||
    (k.rol && k.rol.toLocaleLowerCase('tr-TR').includes(aranan))
  )

  if (adMatch || firmaMatch || sifatMatch || eslesenKisi) {
    return {
      isMatch: true,
      matchedKisi: eslesenKisi || null,
      anaFirmaAdi: c.firma || c.ad,
      anaCariAdi: c.ad
    }
  }

  return { isMatch: false }
}
