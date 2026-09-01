import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mkvjtqjxjrbofcpopldb.supabase.co'
const supabaseAnonKey = 'sb_publishable_BhpP0C8hANkPL-ejDmd6Mw_BT-ZFAdA'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function turkceKarakterleriTemizle(str = '') {
  return String(str)
    .replace(/ğ/g, 'G').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'U').replace(/Ü/g, 'U')
    .replace(/ş/g, 'S').replace(/Ş/g, 'S')
    .replace(/ı/g, 'I').replace(/İ/g, 'I')
    .replace(/ö/g, 'O').replace(/Ö/g, 'O')
    .replace(/ç/g, 'C').replace(/Ç/g, 'C')
}

function cleanName(str = '') {
  return turkceKarakterleriTemizle(str)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[/\\?%*:|"<>#&]/g, '')
}

async function migrate() {
  console.log('=== MIGRATION BASLIYOR ===');
  
  // 1. GELIRLER
  console.log('\n--- GELIRLER ---');
  const { data: gelirler } = await supabase.from('gelirler').select('id, belge_url, odeme_yapan_adi, tarih, tahsilat_noktasi, not_metni, malik_id, malikler(ad_soyad), santiyeler(ad)')
  for (const g of (gelirler || [])) {
    if (g.belge_url && g.belge_url.includes('supabase.co/storage')) {
      console.log(`Processing Gelir ${g.id}`);
      
      const res = await fetch(g.belge_url);
      if (!res.ok) { console.log('Fetch failed'); continue; }
      const buffer = await res.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      let mimeType = res.headers.get('content-type') || 'image/jpeg';
      if (mimeType === 'application/octet-stream') mimeType = 'image/jpeg';
      
      const ext = mimeType.includes('pdf') ? 'pdf' : (mimeType.includes('png') ? 'png' : 'jpg')
      const santiyeAdi = g.santiyeler?.ad || 'Genel';
      const folderName = `Gelirler/${santiyeAdi}/${g.tahsilat_noktasi || 'Diger'}`;
      
      const odenenAdi = g.odeme_yapan_adi || g.malikler?.ad_soyad || 'ISIMSIZ';
      const kisaNot = g.not_metni ? g.not_metni.substring(0, 20) : 'Tahsilat';
      
      const fileName = `${g.tarih}-${cleanName(kisaNot)}-${cleanName(odenenAdi)}-${Math.random().toString(36).substring(2,8)}.${ext}`;

      const { data: uploadRes, error: err } = await supabase.functions.invoke('google-drive', {
        body: { action: 'upload', folderName, fileName, base64Data, mimeType }
      })
      if (err) { console.error("Upload error:", err.message); continue; }
      if (uploadRes && uploadRes.success) {
        console.log(`-> GD URL: ${uploadRes.url}`);
        await supabase.from('gelirler').update({ belge_url: uploadRes.url }).eq('id', g.id);
      }
    }
  }

  // 2. MASRAFLAR
  console.log('\n--- MASRAFLAR ---');
  const { data: masraflar } = await supabase.from('masraflar').select('id, fotograf_url, baslik, odenen_kisi, harcama_tarihi, santiyeler(ad), odeme_yontemleri(ad)')
  for (const m of (masraflar || [])) {
    if (m.fotograf_url && m.fotograf_url.includes('supabase.co/storage')) {
      console.log(`Processing Masraf ${m.id}`);
      
      const res = await fetch(m.fotograf_url);
      if (!res.ok) { console.log('Fetch failed'); continue; }
      const buffer = await res.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      let mimeType = res.headers.get('content-type') || 'image/jpeg';
      if (mimeType === 'application/octet-stream') mimeType = 'image/jpeg';
      
      const ext = mimeType.includes('pdf') ? 'pdf' : (mimeType.includes('png') ? 'png' : 'jpg')
      const santiyeAdi = m.santiyeler?.ad || 'Genel';
      const yontemAdi = m.odeme_yontemleri?.ad || 'Diger';
      const folderName = `Masraflar/${santiyeAdi}/${yontemAdi}`;
      
      const kisaBaslik = m.baslik ? m.baslik.substring(0, 30) : 'Masraf';
      const fileName = `${m.harcama_tarihi}-${cleanName(kisaBaslik)}-${cleanName(m.odenen_kisi || 'ISIMSIZ')}-${Math.random().toString(36).substring(2,8)}.${ext}`;

      const { data: uploadRes, error: err } = await supabase.functions.invoke('google-drive', {
        body: { action: 'upload', folderName, fileName, base64Data, mimeType }
      })
      if (err) { console.error("Upload error:", err.message); continue; }
      if (uploadRes && uploadRes.success) {
        console.log(`-> GD URL: ${uploadRes.url}`);
        await supabase.from('masraflar').update({ fotograf_url: uploadRes.url }).eq('id', m.id);
      }
    }
  }

  // 3. CEKLER
  console.log('\n--- CEKLER ---');
  const { data: cekler } = await supabase.from('cekler').select('id, belge_url, odeme_konusu, odeyen, odenen, verilis_tarihi, yon, santiyeler(ad)')
  for (const c of (cekler || [])) {
    if (c.belge_url && c.belge_url.includes('supabase.co/storage')) {
      console.log(`Processing Cek ${c.id}`);
      
      const res = await fetch(c.belge_url);
      if (!res.ok) { console.log('Fetch failed'); continue; }
      const buffer = await res.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
      let mimeType = res.headers.get('content-type') || 'image/jpeg';
      if (mimeType === 'application/octet-stream') mimeType = 'image/jpeg';
      
      const ext = mimeType.includes('pdf') ? 'pdf' : (mimeType.includes('png') ? 'png' : 'jpg')
      const santiyeAdi = c.santiyeler?.ad || 'Genel';
      const islem = c.yon === 'alinan' ? 'Alınan Çek' : 'Verilen Çek';
      const folderName = `Cekler/${santiyeAdi}/${islem}`;
      
      const kisaKonu = c.odeme_konusu ? c.odeme_konusu.substring(0, 20) : 'Cek';
      const firmaKisi = c.odenen || c.odeyen || 'Bilinmiyor';
      const fileName = `${c.verilis_tarihi}-${cleanName(kisaKonu)}-${cleanName(firmaKisi)}-${Math.random().toString(36).substring(2,8)}.${ext}`;

      const { data: uploadRes, error: err } = await supabase.functions.invoke('google-drive', {
        body: { action: 'upload', folderName, fileName, base64Data, mimeType }
      })
      if (err) { console.error("Upload error:", err.message); continue; }
      if (uploadRes && uploadRes.success) {
        console.log(`-> GD URL: ${uploadRes.url}`);
        await supabase.from('cekler').update({ belge_url: uploadRes.url }).eq('id', c.id);
      }
    }
  }

  console.log('=== MIGRATION TAMAMLANDI ===');
  process.exit(0);
}

migrate();
