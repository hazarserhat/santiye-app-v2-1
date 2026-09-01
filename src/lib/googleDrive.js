/**
 * Google Drive Entegrasyon Modülü
 * Google Apps Script Web App webhook üzerinden dosyaları Google Drive'a yükler ve yönetir.
 */

// Google Apps Script Web Uygulaması URL'si (Environment variable veya doğrudan sabit)
export const GOOGLE_SCRIPT_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_SCRIPT_URL) || 
  'https://script.google.com/macros/s/AKfycbzXrx0tgTX3O_D2RzmJdwqpZsarA_51sP8ObKeoFE-sHOhjILstpfboTxDrd_0Q9NFfaQ/exec'

export const GOOGLE_DRIVE_ROOT_FOLDER_ID = 
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_DRIVE_ROOT_FOLDER_ID) || 
  '1lfi1DFXdgl1U_V-fP9OAWWm1Udn5NI4b'

/**
 * Türkçe karakterleri dosya sistemine uygun ASCII karakterlere dönüştürür
 */
function turkceKarakterleriTemizle(str = '') {
  return String(str)
    .replace(/ğ/g, 'G')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'U')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 'S')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'O')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'C')
    .replace(/Ç/g, 'C')
}

/**
 * Dosya ismini istenen formata dönüştürür:
 * gün-ay-yıl-saat-dakika-saniye-ADSOYAD-uniqueId.UZANTI
 * Örnek: 22-08-2026-18-55-33-BARAN-YILDIRIM-a1b2c3.jpg
 */
export function formatGoogleDriveFileName(originalName = 'belge.jpg', adSoyad = 'ISIMSIZ', targetDate = null) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')

  let gun = pad(now.getDate())
  let ay = pad(now.getMonth() + 1)
  let yil = now.getFullYear()

  if (targetDate) {
    if (typeof targetDate === 'string') {
      const cleanDate = targetDate.slice(0, 10)
      if (cleanDate.includes('-')) {
        const [y, m, d] = cleanDate.split('-').map(Number)
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          yil = y
          ay = pad(m)
          gun = pad(d)
        }
      }
    } else if (targetDate instanceof Date && !isNaN(targetDate.getTime())) {
      gun = pad(targetDate.getDate())
      ay = pad(targetDate.getMonth() + 1)
      yil = targetDate.getFullYear()
    }
  }

  // Saat, dakika ve saniye HER ZAMAN anlık işlem saatinden alınır (Örn: 18-55-33)
  const saat = pad(now.getHours())
  const dakika = pad(now.getMinutes())
  const saniye = pad(now.getSeconds())

  // Ad soyad temizleme: Türkçe karakterleri dönüştür, boşlukları tire yap, geçersiz karakterleri ayıkla
  let cleanAdSoyad = turkceKarakterleriTemizle(adSoyad || 'ISIMSIZ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>#&]/g, '')

  if (!cleanAdSoyad) cleanAdSoyad = 'ISIMSIZ'

  // Benzersiz kısa ID (rastgele 6 karakter)
  const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase()

  // Uzantı alma
  const parts = (originalName || 'belge.jpg').split('.')
  const ext = (parts.length > 1 ? parts.pop() : 'jpg').toLowerCase()

  return `${gun}-${ay}-${yil}-${saat}-${dakika}-${saniye}-${cleanAdSoyad}-${uniqueId}.${ext}`
}

/**
 * Görselleri yüklemeden önce tarayıcıda optimize eder/sıkıştırır
 * Bu sayede megabaytlarca görsel saniyeler içinde anında Google Drive'a yüklenir.
 * @param {File|Blob} file - Orijinal dosya
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1600] - Maksimum genişlik
 * @param {number} [options.maxHeight=1600] - Maksimum yükseklik
 * @param {number} [options.quality=0.82] - JPEG kalitesi (0.1 - 1.0)
 * @param {number} [options.maxSizeBytes=300000] - 300KB altı dosyalar doğrudan yüklenir
 * @returns {Promise<File|Blob>}
 */
export async function compressImage(file, {
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82,
  maxSizeBytes = 300 * 1024
} = {}) {
  // Eğer File nesnesi değilse, resim değilse (örn. PDF) veya zaten küçükse sıkıştırma yapma
  if (!file || !file.type || !file.type.startsWith('image/')) return file
  if (file.size <= maxSizeBytes) return file
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file

  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = () => {
        try {
          let width = img.width
          let height = img.height

          // En-boy oranını koruyarak yeniden boyutlandır
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width)
              width = maxWidth
            } else {
              width = Math.round((width * maxHeight) / height)
              height = maxHeight
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          // Arka planı beyaz yap (PNG şeffaflığı JPEG'e geçerken siyah olmasın)
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)

          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                // Eğer sıkıştırma boyutu küçültemediyse orijinalini kullan
                resolve(file)
              } else {
                const compressedFile = new File([blob], file.name || 'belge.jpg', {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              }
            },
            'image/jpeg',
            quality
          )
        } catch (canvasErr) {
          console.warn('Canvas sıkıştırma hatası, orijinal dosya kullanılacak:', canvasErr)
          resolve(file)
        }
      }
      img.onerror = () => resolve(file)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/**
 * Google Drive URL formatından File ID'yi ayıklar
 */
export function extractGoogleDriveFileId(url) {
  if (!url || typeof url !== 'string') return null
  // lh3.googleusercontent.com/d/{id}
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // drive.google.com/file/d/{id}
  match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // id={id}
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return null
}

/**
 * Verilen URL'in Google Drive'a ait olup olmadığını kontrol eder
 */
export function isGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return false
  return url.includes('googleusercontent.com') || url.includes('drive.google.com')
}

/**
 * Bir Google Drive linkini HTML <img> etiketinde güvenli şekilde gösterecek Thumbnail (CDN) linkine çevirir
 */
export function getGoogleDriveInlineImageUrl(url) {
  const fileId = extractGoogleDriveFileId(url)
  if (!fileId) return url
  return `https://lh3.googleusercontent.com/d/${fileId}`
}

/**
 * Bir Google Drive linkini tarayıcıda doğrudan (yeni sekmede) açılabilir linke çevirir
 */
export function getGoogleDriveViewUrl(url) {
  const fileId = extractGoogleDriveFileId(url)
  if (!fileId) return url
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

import { supabase } from './supabase'

/**
 * Dosyayı Google Drive'a yükler (Supabase Edge Function 'google-drive' üzerinden)
 * @param {Object} params
 * @param {File|Blob} params.file - Yüklenecek dosya nesnesi
 * @param {string} params.folderName - Hedef klasör adı (ör. 'Gelirler')
 * @param {string} params.adSoyad - Ödeme yapan / Malik adı
 * @param {Date|string} [params.date] - Tarih (opsiyonel)
 * @param {string} [params.rootFolderId] - Özel Root Folder ID (opsiyonel)
 * @param {boolean} [params.compress=true] - Görselleri otomatik sıkıştır
 * @returns {Promise<{success: boolean, url: string, directUrl: string, fileId: string, fileName: string}>}
 */
export async function uploadToGoogleDrive({
  file,
  folderName = 'Gelirler',
  adSoyad = 'ISIMSIZ',
  date = null,
  rootFolderId = GOOGLE_DRIVE_ROOT_FOLDER_ID,
  compress = true
}) {
  if (!file) throw new Error('Yüklenecek dosya seçilmedi.')

  // 1. Görselleri istemci tarafında optimize et (Yükleme süresini 10 kat hızlandırır)
  let processedFile = file
  if (compress && typeof window !== 'undefined' && file.type && file.type.startsWith('image/')) {
    try {
      processedFile = await compressImage(file)
    } catch (err) {
      console.warn('Görsel sıkıştırma başarısız, orijinal dosya yükleniyor:', err)
      processedFile = file
    }
  }

  // 2. İstenen formata göre dosya adını oluştur (Saat, dakika, saniye anlık zamandan alınır)
  const fileName = formatGoogleDriveFileName(file.name || 'belge.jpg', adSoyad, date)

  // 3. Dosyayı Base64 formatına çevir
  const base64Data = await fileToBase64(processedFile)

  let finalMimeType = processedFile.type || file.type || 'image/jpeg'
  if (!finalMimeType.startsWith('image/') && !finalMimeType.includes('pdf')) {
    const ext = fileName.split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) {
      finalMimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    } else {
      finalMimeType = 'image/jpeg'
    }
  }

  const payload = {
    action: 'upload',
    folderName,
    fileName,
    base64Data,
    mimeType: finalMimeType,
    rootFolderId: rootFolderId || undefined
  }

  // Supabase Edge Function çağrısı yerine Google Apps Script kullanıyoruz (Quota sorunu nedeniyle)
  const scriptUrl = GOOGLE_SCRIPT_URL
  if (!scriptUrl || scriptUrl.includes('supabase.co')) {
    // Eğer Vite önbelleği nedeniyle eski Supabase Edge Function URL'si kalmışsa, doğrudan fallback'i kullan
    throw new Error('Lütfen terminalde çalışan sunucuyu durdurup (Ctrl+C) tekrar `npm run dev` yazarak başlatın. Eski önbellek temizlenmeli.')
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  let data
  try {
    data = await response.json()
  } catch (err) {
    const text = await response.text()
    throw new Error('Google Apps Script geçersiz yanıt döndü: ' + text)
  }

  if (data.error) {
    throw new Error(`Google Drive yükleme hatası: ${data.error}`)
  }

  if (!data || !data.success) {
    throw new Error(data?.error || 'Google Drive yükleme işlemi başarısız oldu.')
  }

  return {
    success: true,
    url: data.directUrl || data.url,
    directUrl: data.directUrl,
    fileId: data.fileId,
    fileName: data.fileName,
    webViewLink: data.webViewLink,
    downloadUrl: data.downloadUrl
  }
}

/**
 * Google Drive'daki bir dosyayı 'Silinenler/{folderName}' ayna klasörüne taşır (Atomik API)
 * @param {string} fileUrlOrId - Dosya URL'i veya Google Drive File ID'si
 * @param {string} [folderName='Gelirler'] - Kaynağın ait olduğu alt klasör (ör. 'Gelirler', 'Masraflar', 'Cekler')
 * @param {string} [rootFolderId] - Root Folder ID (opsiyonel)
 */
export async function moveToSilinenler(
  fileUrlOrId,
  folderName = 'Gelirler',
  rootFolderId = GOOGLE_DRIVE_ROOT_FOLDER_ID
) {
  if (!fileUrlOrId) return { success: false, message: 'Dosya linki veya ID boş' }

  // Eğer Google Drive linki değilse (örn. eski Supabase storage linki), taşıma yapma
  if (typeof fileUrlOrId === 'string' && !isGoogleDriveUrl(fileUrlOrId) && !fileUrlOrId.match(/^[a-zA-Z0-9_-]{25,}$/)) {
    return { success: false, message: 'Google Drive dosyası değil (eski kayıt).' }
  }

  const fileId = extractGoogleDriveFileId(fileUrlOrId) || fileUrlOrId

  const payload = {
    action: 'moveToDeleted',
    fileId,
    fileUrl: fileUrlOrId,
    folderName: folderName || 'Gelirler',
    rootFolderId: rootFolderId || undefined
  }

  try {
    const scriptUrl = GOOGLE_SCRIPT_URL
    if (!scriptUrl || scriptUrl.includes('supabase.co')) return { success: false, message: 'Google Script URL yok veya eski önbellek kalmış.' }

    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    
    if (data.error) {
      console.warn('Silinenlere taşıma Script hatası:', data.error)
      return { success: false, error: data.error }
    }

    return data || { success: true }
  } catch (err) {
    console.warn('Silinenlere taşıma sırasında hata oluştu:', err)
    return { success: false, error: err.message }
  }
}

/**
 * File veya Blob nesnesini saf base64 string'e dönüştürür
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      // "data:image/jpeg;base64," ön ekini ayıkla
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

