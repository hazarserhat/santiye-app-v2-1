export const icsOlustur = (baslik, tarih, tutar, notMetni) => {
  // Tarihleri YYYYMMDD formatına dönüştürme (Tüm Gün Etkinliği)
  const islemTarihi = new Date(tarih);
  const yil = islemTarihi.getFullYear();
  const ay = String(islemTarihi.getMonth() + 1).padStart(2, '0');
  const gun = String(islemTarihi.getDate()).padStart(2, '0');
  
  const tarihStr = `${yil}${ay}${gun}`;

  // Tüm gün etkinlikleri için bitiş tarihi 1 gün sonrası olmalıdır
  const bitisTarihi = new Date(islemTarihi);
  bitisTarihi.setDate(bitisTarihi.getDate() + 1);
  const bitisYil = bitisTarihi.getFullYear();
  const bitisAy = String(bitisTarihi.getMonth() + 1).padStart(2, '0');
  const bitisGun = String(bitisTarihi.getDate()).padStart(2, '0');
  const bitisStr = `${bitisYil}${bitisAy}${bitisGun}`;

  const UID = Date.now().toString() + "@santiye-app";
  const mevcutZaman = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
  
  const temizBaslik = baslik.replace(/,/g, '\\,').replace(/;/g, '\\;');
  const temizNot = (notMetni || 'Planlanan ödeme').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const icsIcerik = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Santiye App//Planlanan Odemeler//TR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTAMP:${mevcutZaman}`,
    `DTSTART;VALUE=DATE:${tarihStr}`,
    `DTEND;VALUE=DATE:${bitisStr}`,
    `UID:${UID}`,
    `SUMMARY:Ödeme: ${temizBaslik} (${tutar} ₺)`,
    `DESCRIPTION:${temizNot}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Ödeme Hatırlatıcısı",
    "TRIGGER:-P1D", // 1 Gün önceden haber ver
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsIcerik], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `odeme_${baslik.replace(/\s+/g, '_').substring(0, 15)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
