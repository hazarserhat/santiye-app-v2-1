# Google Drive Entegrasyon Kurulum Kılavuzu

Bu kılavuz, Şantiye uygulamasındaki yüklenen belgelerin Google Drive'a kaydedilmesini ve silindiğinde "Silinenler" klasörüne taşınmasını sağlayan Google Apps Script kurulumunu açıklar.

---

## 1. Google Drive'da Ana Klasör Oluşturma
1. [Google Drive](https://drive.google.com)'a gidin.
2. Yeni bir klasör oluşturun (Örn: `Santiye-Belgeleri`).
3. Klasörün içine girin ve tarayıcının adres çubuğundaki bağlantıya bakın:
   `https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ`
4. Buradaki `1aBcDeFgHiJkLmNoPqRsTuVwXyZ` kısmı sizin **Ana Klasör ID'nizdir**. Bunu bir yere not edin.

---

## 2. Google Apps Script'i Oluşturma & Dağıtma
1. [script.google.com](https://script.google.com) adresine gidin.
2. **"Yeni Proje (New Project)"** butonuna tıklayın.
3. Proje adını sol üstten `Santiye Drive API` yapın.
4. `Code.gs` dosyasındaki mevcut kodu silip, projemizdeki [Code.gs](file:///c:/Users/serha/OneDrive/Diğer/Belgeler/GitHub/santiye-app/google-apps-script/Code.gs) dosyasının içeriğini buraya yapıştırın.
5. Kodun 19. satırındaki:
   ```javascript
   var DEFAULT_ROOT_FOLDER_ID = "BURAYA_GOOGLE_DRIVE_ANA_KLASOR_ID_YAZIN";
   ```
   kısmına 1. adımda not aldığınız Klasör ID'sini yazın.
6. `Ctrl + S` ile kaydedin.

---

## 3. Web Uygulaması Olarak Dağıtma (Deploy)
1. Sağ üstteki mavi **"Dağıt (Deploy)"** -> **"Yeni Dağıtım (New deployment)"** seçeneğine tıklayın.
2. Sol taraftaki çark (ayar) simgesinden tür olarak **"Web Uygulaması (Web app)"** seçin.
3. Ayarları şu şekilde yapın:
   - **Açıklama**: `Santiye Drive API v1`
   - **Şunun adına yürüt (Execute as)**: `Ben (Me / e-posta adresiniz)`
   - **Erişimi olanlar (Who has access)**: **`Herkes (Anyone)`** *(Çok Önemli! Bu ayar web uygulamasının istek atabilmesini sağlar)*
4. **"Dağıt (Deploy)"** butonuna tıklayın.
5. İlk seferde Google sizden erişim izni isteyecektir:
   - *"Erişimi yetkilendir (Authorize access)"* butonuna tıklayın.
   - Google hesabınızı seçin.
   - *"Gelişmiş (Advanced)"* -> *"Santiye Drive API (güvenli değil / unsafe)"* bağlantısına tıklayın.
   - *"İzin Ver (Allow)"* butonuna tıklayın.
6. Size verilen **Web Uygulaması URL'sini (Web app URL)** kopyalayın:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## 4. Projeye URL'yi Tanımlama
1. Projenin ana dizininde `.env` adında bir dosya oluşturun (veya `.env.example` dosyasını `.env` olarak kopyalayın).
2. İçeriğine kopyaladığınız Web App URL'sini yazın:
   ```env
   VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```
3. Uygulamayı yeniden başlatın (`npm run dev`).

Tebrikler! Artık "Gelirler" sekmesinden yüklenen belgeler Google Drive ana klasörünüzün altındaki `Gelirler` klasörüne `gün-ay-yıl-saat-dakika-saniye-ADSOYAD-uniqueId.UZANTI` formatında kaydedilecek; silinen belgeler ise otomatik olarak `Silinenler` klasörüne taşınacaktır.
