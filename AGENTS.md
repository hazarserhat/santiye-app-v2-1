# Google Drive Entegrasyonu & Görev Özeti

## 📌 Proje Amacı & Genel Bakış
Uygulamada önceden Supabase Storage bucket'larına yüklenen dosya ve görsellerin, aşamalı (TAB bazlı) olarak **Google Drive** üzerine taşınması ve yönetilmesi kararlaştırıldı.

İlk aşamada **Gelirler** sekmesi başarıyla Google Drive entegrasyonuna geçirildi ve canlı testleri tamamlandı.

---

## 🏗️ Mimari & Çalışma Prensibi

### 1. Google Apps Script Katmanı (`Code.gs`)
- Frontend (React / Vite) doğrudan `fetch` üzerinden Google Apps Script Web App URL'sine (`VITE_GOOGLE_SCRIPT_URL`) çağrı yapar.
- Supabase Edge Function (Service Account) ücretsiz Google hesaplarında kotalara takıldığı için iptal edilmiştir.
- İşlemler kullanıcının kendi Drive kotası (15GB/100GB) üzerinden güvenle gerçekleştirilir.
- İstemci tarafında hiçbir gizli anahtar barındırılmaz, sadece Web App URL ile iletişim kurulur.

### 2. Dosya İsimlendirme Kuralı
Yüklenen tüm belgeler şu formatta kaydedilir:
```text
gün-ay-yıl-saat-dakika-saniye-ADSOYAD-uniqueId.UZANTI
```
*Örnek:* `22-08-2026-18-25-45-AHMET-YILMAZ-K7M9P2.png`
- `ADSOYAD`: Ödeme yapan kişi / Malik adı; boşluklar tire (`-`) ile ayrılır ve geçersiz dosya sistemi karakterleri ayıklanır.
- `uniqueId`: Çakışmaları önlemek için benzersiz rastgele kod.

### 3. Klasörleme & Silinenler Ayna (Mirror) Mekanizması
- **Yükleme Yolu**: Google Drive Ana Klasörü -> `Gelirler/` (veya `Masraflar/`, `Cekler/`, `GunlukRapor/`)
- **Silme İşlemi**: Bir kayıt silindiğinde dosya resmi Google Drive API `files.update` (`addParents` & `removeParents`) ile atomik olarak `Silinenler/` altındaki ilgili kategori klasörüne taşınır:
  - `Gelirler/` -> `Silinenler/Gelirler/22-08-2026-18-55-33-ADSOYAD-uniqueId.PNG`
  - `Masraflar/` -> `Silinenler/Masraflar/...`
  - `Cekler/` -> `Silinenler/Cekler/...`
  - `GunlukRapor/` -> `Silinenler/GunlukRapor/...`
- **Veritabanı Uyumu**: Google Drive doğrudan CDN linki (`https://lh3.googleusercontent.com/d/...`) Supabase tablolarındaki `belge_url` alanına yazılır.

---

## 📂 Oluşturulan ve Güncellenen Dosyalar

1. **[`supabase/functions/google-drive/index.ts`](supabase/functions/google-drive/index.ts)** *(Yeni Edge Function)*:
   - Google Drive REST API v3 `upload` ve `moveToDeleted` eylemlerini yöneten Deno fonksiyonu.

2. **[`src/lib/googleDrive.js`](src/lib/googleDrive.js)** *(Güncellendi)*:
   - `uploadToGoogleDrive`: İstemci tarafında hızlı görsel optimizasyonu (`compressImage`) yapıp Supabase Edge Function üzerinden Google Drive'a yükler.
   - `moveToSilinenler`: `Silinenler/Gelirler` ayna klasörüne atomik taşıma yaptırır.
   - `formatGoogleDriveFileName`: Anlık saat ve işlem tarihi formatlayıcısı.

3. **[`src/pages/Gelirler.jsx`](src/pages/Gelirler.jsx)**:
   - Gelir ekleme ve silme süreçleri Supabase Edge Function entegrasyonuyla tam uyumlu.

---

## ✅ Tamamlanan Canlı Testler

- **`doGet` Testi**: Google Apps Script Web App servisine erişim sağlandı (`status: ok`).
- **`upload` Testi**: `Gelirler` klasörü altına `22-08-2026-18-25-45-TEST-KULLANICI-TEST01.png` başarıyla yüklendi.
- **`moveToDeleted` Testi**: Dosya `Gelirler` klasöründen `Silinenler` klasörüne başarıyla taşındı.

---

## 🔮 Sıradaki Adımlar
*Not: Diğer sekmelere henüz dokunulmamıştır. Her sekmenin klasörleme ve dosya isimlendirme kuralları kullanıcı tarafından özel olarak tarif edildikten sonra sırayla yapılacaktır:*
1. **Masraflar Tab'i** (Kullanıcı kural ve formatları bekleniyor)
2. **Çekler Tab'i** (Kullanıcı kural ve formatları bekleniyor)
3. **Günlük Rapor Tab'i** (Kullanıcı kural ve formatları bekleniyor)
