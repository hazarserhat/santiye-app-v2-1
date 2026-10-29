# Google Drive Entegrasyonu & Zorunlu Dosya/Görsel Kayıt Kuralları

## ⚠️ ZORUNLU KURAL (İSTİSNASIZ)
- **Uygulamada mevcut olan ve bundan sonra yeni eklenecek HER fonksiyon, modül ve sayfada yüklenen tüm belge, fotoğraf, irsaliye ve dosyalar KESİNLİKLE Google Drive'a (`uploadToGoogleDrive`) kaydedilmelidir.**
- **Hiçbir sayfada veya fonksiyonda yerel Base64 (`FileReader.readAsDataURL` ile kalıcı kayıt) veya Supabase Storage bucket'ı KULLANILMAMALIDIR.**
- **Silinen her görsel veya belge mutlaka `moveToSilinenler(url, folderName)` ile `Silinenler/{Kategori}/{Şantiye Adı}` ayna klasörüne taşınmalıdır.**

---

## 🏗️ Mimari & Çalışma Prensibi

### 1. Google Apps Script Katmanı (`Code.gs`)
- Frontend (React / Vite) doğrudan `fetch` üzerinden Google Apps Script Web App URL'sine (`VITE_GOOGLE_SCRIPT_URL`) çağrı yapar (`src/lib/googleDrive.js`).
- İşlemler kullanıcının kendi Drive kotası üzerinden güvenle gerçekleştirilir.
- İstemci tarafında görseller `compressImage` ile optimize edilerek yüklenir.

### 2. Dosya İsimlendirme Kuralı
Yüklenen tüm belgeler `formatGoogleDriveFileName` ile şu formatta kaydedilir:
```text
gün-ay-yıl-saat-dakika-saniye-ADSOYAD-uniqueId.UZANTI
```
*Örnek:* `29-10-2026-18-25-45-AHMET-YILMAZ-K7M9P2.jpg`

### 3. Aktif Google Drive Klasör Yapısı (Tam Entegre)
- **Gelirler** (`src/pages/Gelirler.jsx`): `Gelirler/{Şantiye Adı}/{Tahsilat Noktası}`
- **Masraflar** (`src/pages/Masraflar.jsx`): `Masraflar/{Şantiye Adı}/{Ödeme Yöntemi}`
- **Planlanan Ödemeler** (`src/pages/PlanlananOdemeler.jsx`): `Masraflar/{Şantiye Adı}/{Ödeme Yöntemi}`
- **Çekler & Çek Takip** (`src/pages/Cekler.jsx`, `src/pages/yonetim/CekTakip.jsx`): `Cekler/{Şantiye Adı}/{Alınan Çek | Verilen Çek | Ciro Edilen Çek}`
- **Anlaşma & Planlama** (`src/pages/yonetim/AnlasmaPlanlama.jsx`): `Planlama/{Kalem Adı}`
- **Günlük Rapor** (`src/pages/GunlukRapor.jsx`): `GunlukRapor/{Şantiye Adı}`
- **Görevler** (`src/pages/Gorevler.jsx`): `Gorevler/{Şantiye Adı}`
- **Notlarım** (`src/pages/Notlar.jsx`): `Notlar`
- **Drive - Saha Dosyaları** (`src/pages/SahaDosyalari.jsx`): `SahaDosyalari/{Şantiye Adı}`
- **Drive - Proje Dosyaları** (`src/pages/ProjeDosyalari.jsx`): `ProjeDosyalari/{Şantiye Adı}`
- **Beton Dökümü & Mikser** (`src/pages/BetonDokumu.jsx`): `BetonDokumu/{Şantiye Adı}`
- **Sevkiyat Planlama & Kabul** (`src/pages/SevkiyatPlanlama.jsx`): `Sevkiyatlar/{Şantiye Adı}`
- **İş Makinesi & Hafriyat** (`src/pages/MakineHafriyat.jsx`): `MakineHafriyat/{Şantiye Adı}`
