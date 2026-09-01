// Supabase Edge Function: google-drive
// Resmi Google Drive REST API v3 Entegrasyonu

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  project_id?: string
}

/**
 * Google Service Account ile OAuth2 Access Token üretir (Web Crypto API RS256)
 */
async function getGoogleAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const encodedClaimSet = btoa(JSON.stringify(claimSet)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`

  // PEM private key'i DER binary formatına çevir
  const pem = serviceAccount.private_key
  const pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const assertion = `${unsignedToken}.${encodedSignature}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw new Error(`Google Auth Token Hatası: ${tokenResponse.status} - ${errorText}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * Belirtilen üst klasör altında isimle klasör bulur veya oluşturur
 */
async function getOrCreateFolder(folderName: string, parentId: string, accessToken: string): Promise<string> {
  const parts = folderName.split('/').map(p => p.trim()).filter(Boolean)
  let currentParentId = parentId

  for (const part of parts) {
    const query = `'${currentParentId}' in parents and name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true`

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const searchData = await searchRes.json()

    if (searchData.files && searchData.files.length > 0) {
      currentParentId = searchData.files[0].id
    } else {
      // Klasör yoksa oluştur
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentParentId]
        })
      })

      const createData = await createRes.json()
      if (!createRes.ok) {
        throw new Error(`Klasör oluşturulamadı (${part}): ${JSON.stringify(createData)}`)
      }
      currentParentId = createData.id
    }
  }

  return currentParentId
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action } = body

    // 1. Service Account & Root Folder ID yapılandırması
    const serviceAccountJsonStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || ''
    const rootFolderId = body.rootFolderId || Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || '1lfi1DFXdgl1U_V-fP9OAWWm1Udn5NI4b'

    if (!serviceAccountJsonStr) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY ortam değişkeni Supabase Secrets içinde tanımlanmamış.')
    }

    let serviceAccount: ServiceAccountKey
    try {
      serviceAccount = typeof serviceAccountJsonStr === 'string' ? JSON.parse(serviceAccountJsonStr) : serviceAccountJsonStr
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY geçerli bir JSON formatında değil.')
    }

    // Google API Access Token al
    const accessToken = await getGoogleAccessToken(serviceAccount)

    // ==========================================
    // ACTION: UPLOAD (Görsel / Belge Yükleme)
    // ==========================================
    if (action === 'upload') {
      const { fileName, folderName = 'Gelirler', base64Data, mimeType = 'image/jpeg' } = body

      if (!fileName || !base64Data) {
        throw new Error('fileName ve base64Data zorunludur.')
      }

      // Hedef klasörü bul veya oluştur (Örn: 'Gelirler')
      const targetFolderId = await getOrCreateFolder(folderName, rootFolderId, accessToken)

      // Base64 verisini binary buffer'a çevir
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

      // Multipart/related body oluştur
      const boundary = '-------314159265358979323846'
      const delimiter = `\r\n--${boundary}\r\n`
      const closeDelimiter = `\r\n--${boundary}--`

      const metadata = {
        name: fileName,
        mimeType: mimeType,
        parents: [targetFolderId]
      }

      const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
      const mediaHeaderPart = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`
      
      const encoder = new TextEncoder()
      const part1 = encoder.encode(metadataPart)
      const part2 = encoder.encode(mediaHeaderPart)
      const part4 = encoder.encode(closeDelimiter)

      // Tüm parçaları birleştir
      const totalLength = part1.length + part2.length + binaryData.length + part4.length
      const fullBody = new Uint8Array(totalLength)
      let offset = 0
      fullBody.set(part1, offset); offset += part1.length
      fullBody.set(part2, offset); offset += part2.length
      fullBody.set(binaryData, offset); offset += binaryData.length
      fullBody.set(part4, offset)

      // Google Drive API v3 Upload
      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink&supportsAllDrives=true', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: fullBody
      })

      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        throw new Error(`Google Drive yükleme hatası: ${JSON.stringify(uploadData)}`)
      }

      const fileId = uploadData.id

      // Dosya izinlerini "Bağlantıya sahip herkes görüntüleyebilir" yap
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      })

      const isImage = (mimeType || '').startsWith('image/')
      const directUrl = isImage 
        ? `https://lh3.googleusercontent.com/d/${fileId}`
        : `https://drive.google.com/uc?export=view&id=${fileId}`

      return new Response(JSON.stringify({
        success: true,
        fileId,
        fileName,
        folderName,
        url: directUrl,
        directUrl,
        webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ==========================================
    // ACTION: MOVE TO DELETED (Ayna Klasör Silme / Arşivleme)
    // ==========================================
    if (action === 'moveToDeleted' || action === 'delete') {
      const { fileId, folderName = 'Gelirler' } = body
      if (!fileId) {
        throw new Error('fileId parametresi zorunludur.')
      }

      // 1. Dosyanın mevcut üst klasörlerini al
      const fileInfoRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,parents&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const fileInfo = await fileInfoRes.json()
      if (!fileInfoRes.ok) {
        throw new Error(`Dosya bulunamadı (${fileId}): ${JSON.stringify(fileInfo)}`)
      }

      const previousParents = (fileInfo.parents || []).join(',')

      // 2. 'Silinenler' ana klasörünü bul veya oluştur
      const silinenlerRootId = await getOrCreateFolder('Silinenler', rootFolderId, accessToken)

      // 3. 'Silinenler/<folderName>' ayna alt klasörünü bul veya oluştur
      const mirrorTargetFolderId = await getOrCreateFolder(folderName, silinenlerRootId, accessToken)

      // 4. Dosyayı ATOMİK olarak ayna klasöre taşı (addParents + removeParents)
      const moveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${mirrorTargetFolderId}&removeParents=${encodeURIComponent(previousParents)}&fields=id,name,parents&supportsAllDrives=true`
      const moveRes = await fetch(moveUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` }
      })

      const moveData = await moveRes.json()
      if (!moveRes.ok) {
        throw new Error(`Dosya taşınamadı: ${JSON.stringify(moveData)}`)
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Dosya Silinenler/${folderName} klasörüne atomik olarak taşındı.`,
        fileId: moveData.id,
        fileName: moveData.name,
        targetPath: `Silinenler/${folderName}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error(`Bilinmeyen eylem (action): ${action}`)

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Bilinmeyen hata'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
