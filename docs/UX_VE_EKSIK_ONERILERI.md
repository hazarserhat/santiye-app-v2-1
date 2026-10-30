# Uygulama Eksikleri ve UX İyileştirme Önerileri

Tarih: 2026-10-30

> Not: Öneriler bu oturumdaki gözlemlere ve kod yapısına dayanır. Her sayfa tek tek denetlenmedi, bazı maddeler tahmin içerir.

## 1. Mobil kullanım (sahada asıl cihaz telefon)
- [ ] **Geniş tablolar:** Proje Gelirleri ve Puantaj masaüstü tablosu, telefonda yatay kaydırma gerektiriyor. Dar ekranda satırı karta çeviren görünüm.
- [ ] **Hızlı giriş:** İş makinesi formundaki sadeliği Masraf, Gelir ve Günlük Rapor girişlerine uygula (sık seçenekler tek dokunuş, az alan).
- [ ] **Başparmak erişimi:** Ekleme düğmesi sabit ve ekranın altında olsun.
- [ ] **Giriş taslağı:** Yarım kalan formlar otomatik saklansın.

## 2. Tutarlılık
- [ ] **Tasarım dili:** Bazı sayfalar kurumsal turkuaz temada, bazıları farklı (ör. Drive sayfalarındaki mavi/mor başlık). Ortak bileşen seti (başlık, kart, düğme, boş durum).
- [ ] **CSS yapısı:** `src/index.css` 8000+ satır ve tekrar eden kurallar içeriyor. Ruha satırı isim sorunu bu tür bir çakışmadan çıktı.
- [ ] **Sayfa içi stiller:** JSX içine gömülü stiller aynı düzeltmenin birden fazla yerde yapılmasına yol açıyor.

## 3. Veri ve güvenlik
- [ ] **Silme güvencesi:** Kayıtlar için geri alma / çöp kutusu. (Dosyalar Silinenler klasörüne gidiyor, kayıtlar geri dönmüyor.)
- [ ] **Değişiklik geçmişi:** Kim, neyi, ne zaman değiştirdi. Tutar ve ödeme değişikliklerinde özellikle önemli.
- [ ] **Yetkiler:** Arayüz kontrollerine ek olarak Supabase RLS politikalarının denetimi.
- [ ] **Yedekleme:** Düzenli veritabanı yedeği ve geri yükleme denemesi.
- [ ] **Çevrimdışı çalışma:** Girişleri çevrimdışı kuyruğa alıp bağlantı gelince gönder.

## 4. Performans
- [ ] **Büyük paketler:** Puantaj ~765 kB, Proje Gelirleri ~480 kB. Excel/PDF kütüphanelerini gerektiğinde yükle.
- [ ] **Uzun listeler:** Sayfalandırma veya "daha fazla yükle".
- [ ] **Görsel yükleme:** İlerleme göstergesi ve hata durumunda "tekrar dene".

## 5. Gezinme ve bulunabilirlik
- [ ] **Genel arama:** Firma, şantiye, belge, çek vb. tek yerden.
- [ ] **Ana sayfa özeti:** Kullanıcıya özel "bugün" kutusu (yaklaşan çekler, geciken görevler, açık borç, bekleyen onaylar).
- [ ] **Alt menü yoğunluğu:** Role göre sadeleşmiş menü ve sık kullanılanlar kısayolu.
- [ ] **Boş durumlar:** Veri yokken ne yapılacağını söyleyen yönlendirme.

## 6. Raporlama
- [ ] **Şantiye karşılaştırma:** Maliyet, gelir ve nakit durumunu yan yana gösteren panel.
- [ ] **Bütçe takibi:** Şantiye / kalem bazında planlanan ile gerçekleşen.
- [ ] **PDF/Excel çıktıları:** Ortak başlık, logo ve tarih formatı.
- [ ] **Bildirim merkezi:** Çek vadesi, geciken görev, onay bekleyen kayıt.

## 7. Erişilebilirlik ve ayrıntılar
- [ ] Dokunma hedefleri en az ~44 px.
- [ ] Tablo yazıları 9–10 px'e kadar iniyor, telefonda okunması zor.
- [ ] Renk tek başına anlam taşımasın (metin veya simge ekle).
- [ ] Tarayıcı `alert` pencereleri yerine sayfa içi bildirim (toast).
- [ ] Geri dönüşsüz işlemlerde tek tip onay penceresi.

## Öncelik önerisi
1. **Düşük çaba, yüksek etki:** alert yerine toast, boş durum yönlendirmeleri, tablo yazı boyutu, taslak saklama.
2. **Orta:** Ana sayfa "bugün" özeti, genel arama, bildirim merkezi, ağır paketleri geç yükleme.
3. **Büyük ama değerli:** Değişiklik geçmişi ve geri alma, RLS denetimi, çevrimdışı kuyruk, bütçe takibi.
4. **Altyapı:** CSS temizliği ve ortak bileşen seti.

## İlgili: Muhasebeci modülü (konuşuldu, henüz uygulanmadı)
- Tek kişilik `muhasebeci` rolü, alt menüde 🧾 Muhasebe sekmesi.
- Muhasebe takvimi: kart kesim/son ödeme, çek vadeleri, planlanan ödemeler otomatik; vergi, mizan, fatura şablonları.
- Fatura/irsaliye yükleme (Google Drive, `Muhasebe/{Şantiye}/...`), "Logo'ya işlendi / Luca'ya işlendi" tikleri, eksik belge listesi.
- Logo GO3'e elle giriş için "Girilecek Kayıtlar" listesi ve hesap kodu eşleştirmesi.
- Uygulama içi bildirim.
- Açık karar: muhasebeci tutarları düzenleyebilsin mi (A: hayır, sadece durum işaretler; B: evet).

