# Supabase Edge Function: google-drive

Bu Edge Function, resmi Google Drive REST API v3 kullanarak dosya yükleme ve ayna (mirror) klasörleme ile silinenleri arşivleme işlemlerini yönetir.

---

## 🛠️ Kurulum & Dağıtım

### 1. Supabase Secrets (Ortam Değişkenleri) Tanımlama

Supabase Dashboard'a gidin:
1. **Project Settings** -> **Edge Functions** -> **Secrets** (veya Supabase CLI ile).
2. Şu 2 gizli anahtarı ekleyin:
   - **`GOOGLE_SERVICE_ACCOUNT_KEY`**: Google Cloud'dan indirdiğiniz JSON anahtar dosyasının **tüm metin içeriği** (ör. `{"type": "service_account", ...}`).
   - **`GOOGLE_DRIVE_ROOT_FOLDER_ID`**: `1lfi1DFXdgl1U_V-fP9OAWWm1Udn5NI4b`

### 2. Edge Function'ı Dağıtma (Deploy)

Terminalinizden Supabase CLI ile fonksiyonu yayınlayın:
```bash
npx supabase functions deploy google-drive --no-verify-jwt
```
*(Veya Supabase Dashboard -> Edge Functions sayfasından doğrudan `supabase/functions/google-drive/index.ts` kodunu yapıştırarak oluşturabilirsiniz).*

### 3. Google Drive Klasör Paylaşımı
Google Drive'daki `1lfi1DFXdgl1U_V-fP9OAWWm1Udn5NI4b` ana klasörünü, Service Account JSON dosyasındaki `client_email` adresine **Düzenleyen (Editor)** olarak paylaştığınızdan emin olun.
