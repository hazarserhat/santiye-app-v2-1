import { supabase } from './supabase'

/**
 * Saha operasyon verilerini (Beton Dökümü, Sevkiyat Planlama & Kabul, İş Makineleri & Hafriyat)
 * Supabase 'sistem_ayarlari' tablosu üzerinden tüm cihazlar arasında senkronize eder.
 * Aynı zamanda localStorage'ı önbellek (cache) olarak güncel tutar.
 */
export async function operasyonVerisiYukle(anahtar, varsayilanDeger = []) {
  let yerelListe = []
  try {
    const yerelStr = localStorage.getItem(anahtar)
    if (yerelStr) {
      const parsed = JSON.parse(yerelStr)
      if (Array.isArray(parsed)) yerelListe = parsed
    }
  } catch (err) {
    console.warn(`Yerel veri okuma hatası (${anahtar}):`, err)
  }

  try {
    const { data, error } = await supabase
      .from('sistem_ayarlari')
      .select('deger')
      .eq('anahtar', anahtar)
      .maybeSingle()

    if (!error && data?.deger) {
      const uzakListe = JSON.parse(data.deger)
      if (Array.isArray(uzakListe)) {
        // Eğer yerelde olup henüz sunucuda olmayan kayıt varsa (ilk geçiş için) birleştir
        const uzakIdSet = new Set(uzakListe.map(item => item.id))
        const sadeceYereldeOlanlar = yerelListe.filter(
          item => item.id && !String(item.id).startsWith('ornek-') && !uzakIdSet.has(item.id)
        )

        const birlesikListe = sadeceYereldeOlanlar.length > 0
          ? [...sadeceYereldeOlanlar, ...uzakListe]
          : uzakListe

        localStorage.setItem(anahtar, JSON.stringify(birlesikListe))

        if (sadeceYereldeOlanlar.length > 0) {
          await supabase
            .from('sistem_ayarlari')
            .upsert({ anahtar, deger: JSON.stringify(birlesikListe) }, { onConflict: 'anahtar' })
        }

        return birlesikListe
      }
    } else if (yerelListe.length > 0) {
      // Sunucuda henüz kayıt yoksa mevcut yerel veriyi sunucuya ilk kez yaz
      await supabase
        .from('sistem_ayarlari')
        .upsert({ anahtar, deger: JSON.stringify(yerelListe) }, { onConflict: 'anahtar' })
      return yerelListe
    }
  } catch (err) {
    console.warn(`Supabase operasyon verisi yükleme hatası (${anahtar}):`, err)
  }

  if (yerelListe.length > 0) return yerelListe

  if (varsayilanDeger.length > 0) {
    try {
      localStorage.setItem(anahtar, JSON.stringify(varsayilanDeger))
    } catch (e) {
      // ignore
    }
  }
  return varsayilanDeger
}

export async function operasyonVerisiKaydet(anahtar, yeniListe) {
  try {
    localStorage.setItem(anahtar, JSON.stringify(yeniListe))
  } catch (err) {
    console.warn(`Yerel veri kaydetme hatası (${anahtar}):`, err)
  }

  try {
    const { error } = await supabase
      .from('sistem_ayarlari')
      .upsert({ anahtar, deger: JSON.stringify(yeniListe) }, { onConflict: 'anahtar' })
    if (error) {
      console.warn(`Supabase operasyon verisi yazma uyarısı (${anahtar}):`, error.message)
    }
  } catch (err) {
    console.warn(`Supabase operasyon verisi kaydetme hatası (${anahtar}):`, err)
  }
}

