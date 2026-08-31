/**
 * Google Apps Script - Şantiye App Google Drive Entegrasyonu
 * 
 * KURULUM ADIMLARI:
 * 1. https://script.google.com adresine gidin ve "Yeni Proje" oluşturun.
 * 2. Bu dosyadaki kodun tamamını projenin içine (Code.gs) yapıştırın.
 * 3. Aşağıdaki ROOT_FOLDER_ID değişkenine Google Drive'da açtığınız ana klasörün ID'sini yazın.
 *    (Örnek ID: drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ adresindeki "1aBcDeFgHiJkLmNoPqRsTuVwXyZ" kısmı)
 * 4. Sağ üstteki "Dağıt (Deploy)" -> "Yeni Dağıtım (New deployment)" butonuna tıklayın.
 * 5. Tür seçin: "Web Uygulaması (Web app)".
 * 6. Açıklama: "Santiye Drive API"
 * 7. "Şunun adına yürüt (Execute as)": "Ben (Me)"
 * 8. "Erişimi olanlar (Who has access)": "Herkes (Anyone)" -> ÇOK ÖNEMLİ!
 * 9. "Dağıt"a basın, Google izinlerini onaylayın ve verilen Web Uygulaması URL'sini kopyalayın.
 * 10. Kopyaladığınız URL'yi projedeki .env dosyasında VITE_GOOGLE_SCRIPT_URL değişkenine yapıştırın.
 */

// Buraya Google Drive'daki Ana Klasörünüzün ID'sini yazın:
var DEFAULT_ROOT_FOLDER_ID = "1lfi1DFXdgl1U_V-fP9OAWWm1Udn5NI4b";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Şantiye App Google Drive API servisi çalışıyor."
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Geçersiz istek gövdesi (empty payload)" });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var rootFolderId = data.rootFolderId || DEFAULT_ROOT_FOLDER_ID;

    if (!rootFolderId || rootFolderId === "BURAYA_GOOGLE_DRIVE_ANA_KLASOR_ID_YAZIN") {
      return createJsonResponse({ 
        success: false, 
        error: "Google Drive Ana Klasör ID (ROOT_FOLDER_ID) tanımlanmamış. Lütfen Code.gs veya istek parametresinde belirtin." 
      });
    }

    var rootFolder = DriveApp.getFolderById(rootFolderId);

    // 1. DOSYA YÜKLEME (UPLOAD)
    if (action === "upload") {
      var folderName = data.folderName || "Gelirler";
      var fileName = data.fileName;
      var base64Data = data.base64Data;
      var mimeType = data.mimeType || "image/jpeg";

      if (!fileName || !base64Data) {
        return createJsonResponse({ success: false, error: "fileName ve base64Data zorunludur." });
      }

      // Ana klasör altında hedef alt klasörü (ör. 'Gelirler/Santiye Adi/Banka') bul veya oluştur
      var pathParts = folderName.split('/');
      var currentFolder = rootFolder;
      
      for (var i = 0; i < pathParts.length; i++) {
        var partName = pathParts[i].trim();
        if (partName) {
          var subFolders = currentFolder.getFoldersByName(partName);
          currentFolder = subFolders.hasNext() ? subFolders.next() : currentFolder.createFolder(partName);
        }
      }
      var targetFolder = currentFolder;

      // Base64 verisinden Blob oluştur ve klasöre kaydet
      var decodedBytes = Utilities.base64Decode(base64Data);
      var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
      var file = targetFolder.createFile(blob);

      // Dosya erişim iznini "Bağlantıya sahip herkes görüntüleyebilir" olarak ayarla
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileId = file.getId();
      var isImage = mimeType.indexOf("image/") === 0;
      
      // Resimler için yüksek performanslı ve doğrudan CORS destekleyen CDN linki
      var directUrl = isImage ? "https://lh3.googleusercontent.com/d/" + fileId : "https://drive.google.com/uc?export=view&id=" + fileId;
      var webViewLink = file.getUrl();
      var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;

      return createJsonResponse({
        success: true,
        fileId: fileId,
        fileName: fileName,
        folderName: folderName,
        url: directUrl,
        directUrl: directUrl,
        webViewLink: webViewLink,
        downloadUrl: downloadUrl
      });
    }

    // 2. SİLİNENLERE TAŞIMA (MOVE TO DELETED - AYNA KLASÖR YAPISI)
    if (action === "moveToDeleted" || action === "delete") {
      var fileId = data.fileId;
      var fileUrl = data.fileUrl;
      var folderName = data.folderName;

      if (!fileId && fileUrl) {
        fileId = extractFileIdFromUrl(fileUrl);
      }

      if (!fileId) {
        return createJsonResponse({ success: false, error: "fileId veya geçerli bir Google Drive fileUrl belirtilmelidir." });
      }

      var file = DriveApp.getFileById(fileId);
      if (!file) {
        return createJsonResponse({ success: false, error: "Dosya bulunamadı: " + fileId });
      }

      // Eğer klasör adı istekte belirtilmemişse dosyanın şu anki üst klasörünü tespit et
      if (!folderName) {
        var parents = file.getParents();
        if (parents.hasNext()) {
          var parent = parents.next();
          if (parent.getId() !== rootFolder.getId()) {
            folderName = parent.getName();
          }
        }
      }
      if (!folderName || folderName === "Silinenler") {
        folderName = "Gelirler"; // Varsayılan ayna klasör
      }

      // 1. Ana klasör altında 'Silinenler/folderName' yolunu oluştur
      var targetPath = "Silinenler/" + (folderName || "Diger");
      var pathParts = targetPath.split('/');
      var currentFolder = rootFolder;
      
      for (var i = 0; i < pathParts.length; i++) {
        var partName = pathParts[i].trim();
        if (partName) {
          var subFolders = currentFolder.getFoldersByName(partName);
          currentFolder = subFolders.hasNext() ? subFolders.next() : currentFolder.createFolder(partName);
        }
      }
      var mirrorTargetFolder = currentFolder;

      // 2. Dosyayı ayna klasöre taşı
      file.moveTo(mirrorTargetFolder);

      return createJsonResponse({
        success: true,
        message: "Dosya Silinenler/" + folderName + " klasörüne taşındı.",
        fileId: file.getId(),
        fileName: file.getName(),
        parentFolder: "Silinenler",
        subFolder: folderName,
        targetPath: "Silinenler/" + folderName
      });
    }

    return createJsonResponse({ success: false, error: "Bilinmeyen eylem (action): " + action });

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

function extractFileIdFromUrl(url) {
  if (!url) return null;
  // Format 1: lh3.googleusercontent.com/d/{id}
  var match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Format 2: drive.google.com/file/d/{id}/view
  match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Format 3: id={id}
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return null;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
