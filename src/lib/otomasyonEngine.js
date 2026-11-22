import { supabase } from './supabase'
import { paraFormatla } from './format'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from './operasyonKayit'
import { KEY_VERILEN_SOZLER } from '../components/VerilenSozlerPanel'
import {
  KEY_MUHASEBE_CALISANLAR,
  KEY_MUHASEBE_FATURALAR,
  KEY_MUHASEBE_BELGELER,
} from '../pages/Muhasebe'

export const KEY_OTOMASYON_KUYRUK = 'otomasyon_denetim_kuyrugu_v1'
export const KEY_ASISTAN_CHAT = 'asistan_chat_gecmisi_v1'
export const KEY_GEMINI_API = 'asistan_gemini_api_key_v1'
const KEY_MAKINE_LISTESI = 'santiye_makine_kayitlari_v1'
const KEY_BINA_NO = 'yarisi_bizden_bina_no_v1'

export const HEDEF_MODUL_META = {
  gider: { etiket: 'Finans → Giderler', ikon: '💸', renk: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  gelir: { etiket: 'Finans → Gelirler', ikon: '💰', renk: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  rehber: { etiket: 'Rehber & Cari Kartlar', ikon: '📇', renk: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
  soz_not: { etiket: 'Görevler → Verilen Sözler / Notlar', ikon: '🤝', renk: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  gorev: { etiket: 'Görevler → Yeni Görev', ikon: '✅', renk: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  makine: { etiket: 'Saha → İş Makinesi (JCB / Vinç)', ikon: '🚜', renk: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  muhasebe_calisan: { etiket: 'Muhasebe → Çalışanlar (SGK)', ikon: '👷', renk: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
  muhasebe_fatura: { etiket: 'Muhasebe → Fatura İşlemleri', ikon: '🧾', renk: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  muhasebe_belge: { etiket: 'Muhasebe → Fatura / İrsaliyeler', ikon: '📄', renk: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  yarisi_bizden: { etiket: 'Portföy → Yarısı Bizden', ikon: '🏛️', renk: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
}

const bugun = () => new Date().toISOString().slice(0, 10)

const normTr = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim()

export async function geminiAnahtariYukle() {
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY
  if (envKey) return envKey
  try {
    const local = localStorage.getItem(KEY_GEMINI_API)
    if (local) return local
  } catch { /* ignore */ }
  try {
    const { data } = await supabase
      .from('sistem_ayarlari')
      .select('deger')
      .eq('anahtar', KEY_GEMINI_API)
      .maybeSingle()
    if (data?.deger) {
      try { localStorage.setItem(KEY_GEMINI_API, data.deger) } catch { /* ignore */ }
      return data.deger
    }
  } catch { /* ignore */ }
  return ''
}

export async function geminiAnahtariKaydet(key) {
  const temiz = String(key || '').trim()
  try {
    if (temiz) localStorage.setItem(KEY_GEMINI_API, temiz)
    else localStorage.removeItem(KEY_GEMINI_API)
  } catch { /* ignore */ }
  await supabase
    .from('sistem_ayarlari')
    .upsert({ anahtar: KEY_GEMINI_API, deger: temiz }, { onConflict: 'anahtar' })
}

// =========================================================
// CANLI VERİTABANI BAĞLAMI (60 SN ÖNBELLEKLİ & AKILLI HAFİF MOD)
// =========================================================
let baglamCache = { zaman: 0, temel: null, detay: null }
const KEY_GEMINI_MODEL = 'asistan_gemini_aktif_model_v1'

function soruMu(metin = '') {
  const m = normTr(metin)
  if (!m) return false
  return (
    m.includes('?') ||
    /\b(kac|nedir|neydi|kim|kimin|hangi|numara|telefon|var mi|ne kadar|toplam|ozet|rapor|liste|bina no|vade|borc|alacak|kalan|goster|sorgula|bul)\b/.test(m)
  )
}

async function canliBaglamTopla(santiyeler = [], detayGerekli = false) {
  const simdi = Date.now()
  const tazeMi = simdi - baglamCache.zaman < 60000

  if (tazeMi && baglamCache.temel && (!detayGerekli || baglamCache.detay)) {
    return detayGerekli
      ? { ...baglamCache.temel, ...baglamCache.detay }
      : baglamCache.temel
  }

  const santiyeMap = {}
  santiyeler.forEach((s) => { santiyeMap[s.id] = s.ad })

  // Temel bağlam (her zaman hızlı & çok küçük)
  let temel = tazeMi ? baglamCache.temel : null
  if (!temel) {
    const [taseronRes, odemeRes, binaRes] = await Promise.all([
      supabase.from('taseronlar').select('ad, firma, telefon').order('ad').limit(150),
      supabase.from('odeme_yontemleri').select('ad').order('ad'),
      supabase.from('sistem_ayarlari').select('deger').eq('anahtar', KEY_BINA_NO).maybeSingle(),
    ])

    let binaMap = {}
    if (binaRes.data?.deger) {
      try { binaMap = JSON.parse(binaRes.data.deger) || {} } catch { /* ignore */ }
    }

    temel = {
      bugun: bugun(),
      santiyeler: santiyeler.map((s) => binaMap[s.id] ? `${s.ad} (BinaNo:${binaMap[s.id]})` : s.ad),
      odemeYontemleri: (odemeRes.data || []).map((o) => o.ad),
      rehberAdlari: (taseronRes.data || []).map((t) => t.firma || t.ad).filter(Boolean),
      rehberDetay: (taseronRes.data || [])
        .filter((t) => t.telefon)
        .map((t) => `${t.firma || t.ad}: ${String(t.telefon).slice(0, 60)}`),
    }
    baglamCache.temel = temel
    baglamCache.zaman = simdi
    baglamCache.detay = null
  }

  if (!detayGerekli) {
    // Kayıt ekleme modunda telefon detaylarını bile gönderme — süper hızlı!
    return {
      bugun: temel.bugun,
      santiyeler: temel.santiyeler,
      odemeYontemleri: temel.odemeYontemleri,
      rehberAdlari: temel.rehberAdlari.slice(0, 120),
    }
  }

  // Soru-cevap modunda detaylı canlı verileri çek
  if (!baglamCache.detay) {
    const [masrafRes, gelirRes, cekRes, gorevRes, sozlerList] = await Promise.all([
      supabase.from('masraflar').select('baslik, tutar, harcama_tarihi, santiye_id, odenen_kisi').order('harcama_tarihi', { ascending: false }).limit(50),
      supabase.from('gelirler').select('tutar, tarih, santiye_id, tahsilat_noktasi, odeme_yapan_adi').order('tarih', { ascending: false }).limit(30),
      supabase.from('cekler').select('yon, tutar, vade_tarihi, kesideci, banka, durum, santiye_id').order('vade_tarihi', { ascending: true }).limit(35),
      supabase.from('gorevler').select('baslik, durum, santiye_id').neq('durum', 'tamamlandi').limit(35),
      operasyonVerisiYukle(KEY_VERILEN_SOZLER, []),
    ])

    baglamCache.detay = {
      sonMasraflar: (masrafRes.data || []).map((m) => ({
        t: m.harcama_tarihi,
        s: santiyeMap[m.santiye_id] || 'Genel',
        b: m.baslik,
        k: m.odenen_kisi || '',
        tl: m.tutar,
      })),
      sonGelirler: (gelirRes.data || []).map((g) => ({
        t: g.tarih,
        s: santiyeMap[g.santiye_id] || 'Genel',
        n: g.tahsilat_noktasi || '',
        k: g.odeme_yapan_adi || '',
        tl: g.tutar,
      })),
      cekler: (cekRes.data || []).map((c) => ({
        y: c.yon,
        v: c.vade_tarihi,
        tl: c.tutar,
        k: c.kesideci || '',
        b: c.banka || '',
        d: c.durum || '',
        s: santiyeMap[c.santiye_id] || 'Genel',
      })),
      acikGorevler: (gorevRes.data || []).map((g) => `${santiyeMap[g.santiye_id] || 'Genel'}: ${g.baslik}`),
      acikSozlerNotlar: (Array.isArray(sozlerList) ? sozlerList : [])
        .filter((x) => !x.tamamlandi)
        .slice(0, 30)
        .map((x) => `${x.santiyeAd || 'Genel'} | ${x.kisi || ''} | ${x.terminTarihi || ''} | ${x.icerik}`),
    }
  }

  return { ...temel, ...baglamCache.detay }
}

function dosyaToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve({ mimeType: file.type || 'image/jpeg', data: base64 })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// =========================================================
// GEMINI AI MESAJ & GÖRSEL ANALİZİ
// =========================================================
export async function asistanMesajAnalizEt({ metin, dosya, belgeUrl, santiyeler }) {
  const apiKey = await geminiAnahtariYukle()
  if (!apiKey) {
    return {
      mod: 'anahtar_yok',
      cevap: 'Yapay zeka asistanının fiş/kartvizit okuyup sorularınızı yanıtlayabilmesi için sağ üstteki **"🔑 AI Ayarları"** butonundan ücretsiz Gemini API anahtarınızı 1 kez girmeniz yeterli.',
      taslaklar: [],
    }
  }

  const detayGerekli = !dosya && soruMu(metin)
  const baglam = await canliBaglamTopla(santiyeler, detayGerekli)

  const sistemPrompt = `Sen "Şantiye App" için çalışan uzman bir inşaat yönetim ve muhasebe asistanısın.
Bugünün tarihi: ${baglam.bugun}.
Kullanıcı (Serhat Hazar) sana Türkçe metin ve/veya görsel (fiş, fatura, dekont, kartvizit, kimlik, irsaliye, not) gönderecek.

GÖREVİN:
1. Eğer kullanıcı bir SORU soruyorsa (telefon numarası, harcama toplamı, vadesi gelen çek, verilen sözler, yarısı bizden bina no, açık görevler vb.), aşağıdaki CANLI VERİTABANI BAĞLAMI'na bakarak net, kısa, rakamları doğru Türkçe cevap ver ("mod": "soru_cevap").
2. Eğer kullanıcı bir İŞLEM / KAYIT / BELGE / KARTVİZİT / SÖZ / NOT / SGK / FATURA / İRSALİYE / JCB paylaşıyorsa, bunu bir veya birden fazla onay taslağına dönüştür ("mod": "islem_taslagi"). Tek mesajda birden fazla işlem varsa ayrı taslaklar oluştur!

DESTEKLENEN "hedefModul" DEĞERLERİ VE "veri" ALANLARI:
- "gider": { baslik, kisi, tutar (sayı), tarih (YYYY-MM-DD), santiyeAd, odemeYontemi, aciklama }
- "gelir": { baslik, kisi, tutar (sayı), tarih (YYYY-MM-DD), santiyeAd, tahsilatNoktasi, aciklama }
- "rehber": { ad, firma, telefon, hizmetAlani, adres, santiyeAd, notMetni }
- "soz_not": { tur ("soz" veya "not"), kategori ("Malik"|"Taşeron"|"Ödeme"|"Genel"), kisi, santiyeAd, terminTarihi (YYYY-MM-DD veya ""), icerik }
- "gorev": { baslik, santiyeAd, oncelik ("kirmizi"|"turuncu"|"sari"|"yesil") }
- "makine": { makineTuru (ör: "JCB","Vinç","Ekskavatör"), santiyeAd, calismaSaati (sayı), toplamTutar (sayı), cariAdi, tarih (YYYY-MM-DD), aciklama }
- "muhasebe_calisan": { adSoyad, tcNo, telefon, taseronAd, santiyeAd, islemTuru ("giris"|"cikis"|"aktif"), girisTarihi (YYYY-MM-DD), cikisTarihi, gosterilecekGun, notMetni }
- "muhasebe_fatura": { tip ("kesilecek"|"iade"), firmaAd, vergiNo, santiyeAd, tutar (sayı), kdvOrani ("20"|"10"|"1"|"0"), kdvDurum ("haric"|"dahil"), tarih (YYYY-MM-DD), aciklama }
- "muhasebe_belge": { belgeTuru ("İrsaliye"|"Fatura"|"Beton İrsaliyesi"), santiyeAd, tedarikci, malzeme, teslimAlan, tarih (YYYY-MM-DD), notMetni }
- "yarisi_bizden": { santiyeAd, binaNo, notMetni }

ÖNEMLİ KURALLAR:
- Şantiye adlarını, ödeme yöntemlerini ve cari adlarını mümkün olduğunca aşağıdaki mevcut listelerle birebir eşleştir.
- SADECE geçerli bir JSON objesi döndür (markdown kod bloğu koyma):
{
  "mod": "soru_cevap" | "islem_taslagi",
  "cevap": "Kullanıcıya gösterilecek net ve sıcak Türkçe yanıt",
  "taslaklar": [
    {
      "hedefModul": "gider",
      "ozet": "Kısa 1 satırlık özet (ör: Erdoğan Gökmen - Gökkuşağı Yapı 5.720 TL gider)",
      "guven": 95,
      "veri": { ... }
    }
  ]
}

CANLI VERİTABANI BAĞLAMI:
${JSON.stringify(baglam)}`

  const parts = [{ text: `${sistemPrompt}\n\nKULLANICI MESAJI:\n${metin || '(Sadece görsel gönderildi, görseli analiz edip uygun modüle taslak oluştur.)'}` }]

  if (dosya) {
    const inline = await dosyaToBase64(dosya)
    parts.push({ inline_data: { mime_type: inline.mimeType, data: inline.data } })
  }

  const hizliPayload = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  })
  const standartPayload = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: 'application/json',
    },
  })

  const kayitliModel = (() => {
    try { return localStorage.getItem(KEY_GEMINI_MODEL) || '' } catch { return '' }
  })()
  const adayModeller = [
    ...(kayitliModel ? [kayitliModel] : []),
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-3.8-flash',
    'gemini-3.0-flash',
    'gemini-2.5-flash',
  ].filter((v, i, a) => a.indexOf(v) === i)

  const modelCagir = async (modelAdi) => {
    let r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelAdi}:generateContent?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: hizliPayload }
    )
    // Eğer model thinkingConfig desteklemiyorsa (400), standart payload ile hemen dene
    if (r.status === 400) {
      r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelAdi}:generateContent?key=${encodeURIComponent(apiKey)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: standartPayload }
      )
    }
    return r
  }

  const geciciVeyaYok = (status) => [404, 429, 500, 502, 503, 504].includes(status)

  let res = null
  let sonHata = ''

  for (const modelAdi of adayModeller) {
    res = await modelCagir(modelAdi)
    if (res.ok) {
      try { localStorage.setItem(KEY_GEMINI_MODEL, modelAdi) } catch { /* ignore */ }
      break
    }
    sonHata = await res.text()
    if (modelAdi === kayitliModel && (geciciVeyaYok(res.status) || res.status === 400)) {
      try { localStorage.removeItem(KEY_GEMINI_MODEL) } catch { /* ignore */ }
    }
    if (!geciciVeyaYok(res.status)) break
  }

  // Adaylar 404 veya 503 (yoğunluk) döndüyse hesaptaki diğer aktif metin/görsel Flash modellerini otomatik dene (TTS/Audio/Image hariç!)
  const gecersizModelMi = (ad) =>
    /(tts|audio|image|imagen|veo|embedding|live|robotics|computer-use)/i.test(ad)

  if (!res || !res.ok) {
    if (geciciVeyaYok(res?.status)) {
      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        )
        if (listRes.ok) {
          const listJson = await listRes.json()
          const adayListesi = (listJson.models || [])
            .filter((m) => {
              const ad = String(m.name || '')
              return (
                Array.isArray(m.supportedGenerationMethods) &&
                m.supportedGenerationMethods.includes('generateContent') &&
                (ad.includes('flash') || ad.includes('gemini')) &&
                !gecersizModelMi(ad)
              )
            })
            .map((m) => String(m.name).replace(/^models\//, ''))
            .filter((ad) => !adayModeller.includes(ad))
            .slice(0, 4)

          for (const temizAd of adayListesi) {
            res = await modelCagir(temizAd)
            if (res.ok) {
              try { localStorage.setItem(KEY_GEMINI_MODEL, temizAd) } catch { /* ignore */ }
              break
            }
            sonHata = await res.text()
            if (!geciciVeyaYok(res.status)) break
          }
        }
      } catch { /* ignore */ }
    }
  }

  if (!res || !res.ok) {
    if (res?.status === 503 || res?.status === 429) {
      throw new Error('Google Gemini sunucuları şu an anlık yoğunluk yaşıyor (503). Lütfen 5-10 saniye sonra tekrar gönderin.')
    }
    throw new Error(`Gemini API hatası (${res?.status || 'ERR'}): ${sonHata.slice(0, 220)}`)
  }

  const json = await res.json()
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  let parsed = null
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return {
      mod: 'soru_cevap',
      cevap: rawText || 'Yanıt çözümlenemedi, lütfen tekrar deneyin.',
      taslaklar: [],
    }
  }

  const taslaklar = Array.isArray(parsed.taslaklar)
    ? parsed.taslaklar.map((t, idx) => ({
        id: `oto-${Date.now()}-${idx}`,
        durum: 'bekliyor',
        hedefModul: HEDEF_MODUL_META[t.hedefModul] ? t.hedefModul : 'soz_not',
        ozet: t.ozet || 'Yeni otomasyon taslağı',
        guven: Number(t.guven) || 90,
        veri: t.veri || {},
        belgeUrl: belgeUrl || '',
        orijinalMesaj: metin || '(Görsel)',
        olusturmaTarihi: new Date().toISOString(),
      }))
    : []

  return {
    mod: taslaklar.length > 0 ? 'islem_taslagi' : (parsed.mod || 'soru_cevap'),
    cevap: parsed.cevap || (taslaklar.length > 0 ? `${taslaklar.length} işlem taslağı Otomasyon Denetim'e gönderildi.` : 'İşlem tamamlandı.'),
    taslaklar,
  }
}

// =========================================================
// ONAY MOTORU: ONAYLANAN TASLAĞI İLGİLİ MODÜLE İŞLE
// =========================================================
function santiyeBul(santiyeler, ad) {
  if (!ad) return null
  const hedef = normTr(ad)
  return (
    santiyeler.find((s) => normTr(s.ad) === hedef) ||
    santiyeler.find((s) => normTr(s.ad).includes(hedef) || hedef.includes(normTr(s.ad))) ||
    null
  )
}

export async function denetimKaydiniIsle(kayit, { santiyeler = [], profile = null }) {
  const v = kayit.veri || {}
  const hedef = kayit.hedefModul
  const santiye = santiyeBul(santiyeler, v.santiyeAd)
  const ekleyen = profile?.ad_soyad || 'Serhat Hazar'

  if (hedef === 'gider') {
    let odemeId = null
    if (v.odemeYontemi) {
      const { data: yontemler } = await supabase.from('odeme_yontemleri').select('id, ad')
      const eslesen = (yontemler || []).find((o) => normTr(o.ad).includes(normTr(v.odemeYontemi)) || normTr(v.odemeYontemi).includes(normTr(o.ad)))
      if (eslesen) odemeId = eslesen.id
    }
    let cariId = null
    if (v.kisi) {
      const { data: cariler } = await supabase.from('taseronlar').select('id, ad, firma')
      const eslesen = (cariler || []).find((c) => normTr(c.firma || c.ad).includes(normTr(v.kisi)) || normTr(v.kisi).includes(normTr(c.firma || c.ad)))
      if (eslesen) cariId = eslesen.id
    }
    const { data, error } = await supabase
      .from('masraflar')
      .insert({
        santiye_id: santiye?.id || null,
        baslik: v.baslik || kayit.ozet || 'Harcama',
        odenen_kisi: v.kisi || '',
        cari_id: cariId,
        tutar: Number(v.tutar) || 0,
        taksit_sayisi: 1,
        harcama_tarihi: v.tarih || bugun(),
        kayit_tarihi: new Date().toISOString(),
        odeme_yontemi_id: odemeId,
        aciklama: v.aciklama || '',
        fotograf_url: kayit.belgeUrl || null,
        ekleyen: profile?.id || null,
      })
      .select('id')
      .single()
    if (error) throw error
    return { mesaj: `Finans → Giderler tablosuna işlendi (${paraFormatla(v.tutar || 0)} ₺)`, kayitId: data?.id }
  }

  if (hedef === 'gelir') {
    let cariId = null
    if (v.kisi) {
      const { data: cariler } = await supabase.from('taseronlar').select('id, ad, firma')
      const eslesen = (cariler || []).find((c) => normTr(c.firma || c.ad).includes(normTr(v.kisi)))
      if (eslesen) cariId = eslesen.id
    }
    const gelirPayload = {
      santiye_id: santiye?.id || null,
      tutar: Number(v.tutar) || 0,
      tarih: v.tarih || bugun(),
      kayit_tarihi: new Date().toISOString(),
      tahsilat_noktasi: v.tahsilatNoktasi || 'Serhat Kasa',
      odeme_yapan_adi: v.kisi || v.baslik || '',
      not_metni: [v.baslik, v.aciklama].filter(Boolean).join(' — '),
      cari_id: cariId,
      belge_url: kayit.belgeUrl || null,
      ekleyen: profile?.id || null,
    }
    let { data, error } = await supabase.from('gelirler').insert(gelirPayload).select('id').single()
    if (error && error.message?.includes('kayit_tarihi')) {
      delete gelirPayload.kayit_tarihi
      const retry = await supabase.from('gelirler').insert(gelirPayload).select('id').single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    return { mesaj: `Finans → Gelirler tablosuna işlendi (${paraFormatla(v.tutar || 0)} ₺)`, kayitId: data?.id }
  }

  if (hedef === 'rehber') {
    const ad = (v.firma || v.ad || 'Yeni Cari').trim()
    const { data, error } = await supabase
      .from('taseronlar')
      .insert({
        ad,
        firma: v.firma || ad,
        telefon: v.telefon || '',
        sifat: v.hizmetAlani || '',
        kategori: v.hizmetAlani || 'Taşeronlar',
        adres: v.adres || '',
        sef_gorunur: true,
        puantajda_goster: true,
        ikincil: false,
      })
      .select('id')
      .single()
    if (error) throw error
    if (santiye?.id && data?.id) {
      await supabase.from('taseron_santiyeler').insert({ taseron_id: data.id, santiye_id: santiye.id })
    }
    return { mesaj: `Rehber'e "${ad}" eklendi`, kayitId: data?.id }
  }

  if (hedef === 'soz_not') {
    const mevcut = await operasyonVerisiYukle(KEY_VERILEN_SOZLER, [])
    const yeni = {
      id: `soz-${Date.now()}`,
      tur: v.tur === 'not' ? 'not' : 'soz',
      kategori: v.kategori || 'Malik',
      kisi: v.kisi || '',
      santiyeId: santiye?.id || '',
      santiyeAd: santiye?.ad || v.santiyeAd || 'Genel',
      terminTarihi: v.terminTarihi || '',
      icerik: v.icerik || kayit.ozet,
      tamamlandi: false,
      ekleyen,
      olusturmaTarihi: new Date().toISOString(),
    }
    await operasyonVerisiKaydet(KEY_VERILEN_SOZLER, [yeni, ...(Array.isArray(mevcut) ? mevcut : [])])
    return { mesaj: 'Görevler → Verilen Sözler / Notlar alanına eklendi', kayitId: yeni.id }
  }

  if (hedef === 'gorev') {
    const { data, error } = await supabase
      .from('gorevler')
      .insert({
        baslik: v.baslik || kayit.ozet,
        santiye_id: santiye?.id || null,
        olusturan: profile?.id || null,
        aciklama: kayit.belgeUrl ? `IMAGE_URL:${kayit.belgeUrl}` : null,
      })
      .select('id')
      .single()
    if (error) throw error
    if (data?.id) {
      await supabase.from('gorev_etiketleri').insert({
        gorev_id: data.id,
        etiket_turu: 'oncelik',
        deger: ['kirmizi', 'turuncu', 'sari', 'yesil'].includes(v.oncelik) ? v.oncelik : 'sari',
      })
      if (kayit.belgeUrl) {
        await supabase.from('gorev_etiketleri').insert({
          gorev_id: data.id,
          etiket_turu: 'fotograf',
          deger: kayit.belgeUrl,
        })
      }
    }
    return { mesaj: 'Görevler sayfasına eklendi', kayitId: data?.id }
  }

  if (hedef === 'makine') {
    const mevcut = await operasyonVerisiYukle(KEY_MAKINE_LISTESI, [])
    const saat = Number(v.calismaSaati) || 1
    const toplam = Number(v.toplamTutar) || 0
    const yeni = {
      id: `mak-${Date.now()}`,
      tarih: v.tarih || bugun(),
      santiyeId: santiye?.id || '',
      santiyeAdi: santiye?.ad || v.santiyeAd || 'Genel',
      makineTuru: v.makineTuru || 'JCB',
      calismaSaati: saat,
      ilkSaatFiyati: saat > 0 ? Math.round(toplam / saat) : toplam,
      sonrakiSaatFiyati: saat > 0 ? Math.round(toplam / saat) : toplam,
      toplamTutar: toplam,
      cariAdi: v.cariAdi || '',
      aciklama: v.aciklama || kayit.ozet,
      mutabakat: false,
      gorseller: kayit.belgeUrl ? [{ url: kayit.belgeUrl, ad: 'Makine Belgesi' }] : [],
      ekleyen,
      olusturmaTarihi: new Date().toISOString(),
    }
    await operasyonVerisiKaydet(KEY_MAKINE_LISTESI, [yeni, ...(Array.isArray(mevcut) ? mevcut : [])])
    return { mesaj: 'Saha Operasyon → İş Makineleri listesine eklendi', kayitId: yeni.id }
  }

  if (hedef === 'muhasebe_calisan') {
    const mevcut = await operasyonVerisiYukle(KEY_MUHASEBE_CALISANLAR, [])
    const yeni = {
      id: `cal-${Date.now()}`,
      adSoyad: v.adSoyad || kayit.ozet,
      tcNo: v.tcNo || '',
      telefon: v.telefon || '',
      taseronAd: v.taseronAd || '',
      santiyeId: santiye?.id || '',
      santiyeAd: santiye?.ad || v.santiyeAd || 'Genel',
      islemTuru: ['giris', 'cikis', 'aktif'].includes(v.islemTuru) ? v.islemTuru : 'giris',
      girisTarihi: v.girisTarihi || bugun(),
      cikisTarihi: v.cikisTarihi || '',
      gosterilecekGun: String(v.gosterilecekGun || '30'),
      notMetni: v.notMetni || '',
      belgeler: kayit.belgeUrl ? [{ url: kayit.belgeUrl, ad: 'Kimlik / Evrak' }] : [],
      durum: 'bekliyor',
      ekleyen,
      olusturmaTarihi: new Date().toISOString(),
    }
    await operasyonVerisiKaydet(KEY_MUHASEBE_CALISANLAR, [yeni, ...(Array.isArray(mevcut) ? mevcut : [])])
    return { mesaj: 'Muhasebe → Çalışanlar (SGK) sayfasına eklendi', kayitId: yeni.id }
  }

  if (hedef === 'muhasebe_fatura') {
    const mevcut = await operasyonVerisiYukle(KEY_MUHASEBE_FATURALAR, [])
    const yeni = {
      id: `fat-${Date.now()}`,
      tip: v.tip === 'iade' ? 'iade' : 'kesilecek',
      firmaAd: v.firmaAd || kayit.ozet,
      vergiNo: v.vergiNo || '',
      santiyeId: santiye?.id || '',
      santiyeAd: santiye?.ad || v.santiyeAd || 'Genel',
      tutar: Number(v.tutar) || 0,
      kdvOrani: String(v.kdvOrani || '20'),
      kdvDurum: v.kdvDurum === 'dahil' ? 'dahil' : 'haric',
      tarih: v.tarih || bugun(),
      aciklama: v.aciklama || '',
      belgeler: kayit.belgeUrl ? [{ url: kayit.belgeUrl, ad: 'Fatura Belgesi' }] : [],
      durum: 'bekliyor',
      ekleyen,
      olusturmaTarihi: new Date().toISOString(),
    }
    await operasyonVerisiKaydet(KEY_MUHASEBE_FATURALAR, [yeni, ...(Array.isArray(mevcut) ? mevcut : [])])
    return { mesaj: `Muhasebe → Fatura İşlemleri (${yeni.tip === 'iade' ? 'İade' : 'Kesilecek'}) sekmesine eklendi`, kayitId: yeni.id }
  }

  if (hedef === 'muhasebe_belge') {
    const mevcut = await operasyonVerisiYukle(KEY_MUHASEBE_BELGELER, [])
    const yeni = {
      id: `blg-${Date.now()}`,
      belgeTuru: v.belgeTuru || 'İrsaliye',
      santiyeId: santiye?.id || '',
      santiyeAd: santiye?.ad || v.santiyeAd || 'Genel',
      tedarikci: v.tedarikci || 'Belirtilmemiş',
      malzeme: v.malzeme || kayit.ozet,
      teslimAlan: v.teslimAlan || ekleyen,
      tarih: v.tarih || bugun(),
      notMetni: v.notMetni || '',
      belgeler: kayit.belgeUrl ? [{ url: kayit.belgeUrl, ad: 'Belge' }] : [],
      ekleyen,
      olusturmaTarihi: new Date().toISOString(),
    }
    await operasyonVerisiKaydet(KEY_MUHASEBE_BELGELER, [yeni, ...(Array.isArray(mevcut) ? mevcut : [])])
    return { mesaj: 'Muhasebe → Fatura / İrsaliyeler sayfasına eklendi', kayitId: yeni.id }
  }

  if (hedef === 'yarisi_bizden' && santiye?.id && v.binaNo) {
    const { data: mevcutAyar } = await supabase
      .from('sistem_ayarlari')
      .select('deger')
      .eq('anahtar', KEY_BINA_NO)
      .maybeSingle()
    let harita = {}
    if (mevcutAyar?.deger) {
      try { harita = JSON.parse(mevcutAyar.deger) || {} } catch { /* ignore */ }
    }
    harita[santiye.id] = String(v.binaNo).trim()
    await supabase
      .from('sistem_ayarlari')
      .upsert({ anahtar: KEY_BINA_NO, deger: JSON.stringify(harita) }, { onConflict: 'anahtar' })
    return { mesaj: `Yarısı Bizden → ${santiye.ad} Bina No (${v.binaNo}) güncellendi`, kayitId: santiye.id }
  }

  throw new Error('Bu taslak türü için hedef şantiye veya alan eksik; lütfen düzenleyip tekrar onaylayın.')
}
