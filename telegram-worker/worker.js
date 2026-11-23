/**
 * Şantiye App — 7/24 Telegram Bot + 07:00 / 18:30 Otomatik Raporlar Cloudflare Worker
 *
 * Kurulum (Cloudflare Workers Secrets):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY (veya SERVICE_ROLE_KEY)
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   GEMINI_API_KEY
 */

const KEY_KUYRUK = 'otomasyon_denetim_kuyrugu_v1'
const KEY_SOZLER = 'gorevler_sozler_notlar_v1'
const KEY_MAKINE = 'santiye_makine_kayitlari_v1'
const KEY_CALISAN = 'muhasebe_calisanlar_v1'
const KEY_FATURA = 'muhasebe_fatura_islemleri_v1'
const KEY_BELGE = 'muhasebe_gelen_belgeler_v1'

const bugunTR = () => {
  const d = new Date(Date.now() + 3 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}
const tarihTR = (s) => {
  if (!s) return '—'
  const p = String(s).slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : s
}
const tl = (n) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function sbFetch(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Supabase ${res.status}: ${t.slice(0, 160)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function ayarOku(env, anahtar, varsayilan = []) {
  const rows = await sbFetch(env, `sistem_ayarlari?select=deger&anahtar=eq.${encodeURIComponent(anahtar)}`)
  if (rows?.[0]?.deger) {
    try { return JSON.parse(rows[0].deger) } catch { return varsayilan }
  }
  return varsayilan
}

async function ayarYaz(env, anahtar, deger) {
  await sbFetch(env, 'sistem_ayarlari?on_conflict=anahtar', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ anahtar, deger: JSON.stringify(deger) }),
  })
}

async function tgGonder(env, chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }
  if (replyMarkup) body.reply_markup = replyMarkup
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function raporHazirla(env, tip) {
  const bugun = bugunTR()
  const santiyeler = (await sbFetch(env, 'santiyeler?select=id,ad')) || []
  const sMap = Object.fromEntries(santiyeler.map((s) => [s.id, s.ad]))

  if (tip === 'sabah') {
    const yediGun = new Date(Date.now() + 7 * 86400000 + 3 * 3600 * 1000).toISOString().slice(0, 10)
    const [cekler, gorevler, sozler, kuyruk] = await Promise.all([
      sbFetch(env, 'cekler?select=*&order=cek_vadesi.asc&limit=100'),
      sbFetch(env, 'gorevler?select=baslik,durum,santiye_id&durum=neq.tamamlandi&limit=50'),
      ayarOku(env, KEY_SOZLER, []),
      ayarOku(env, KEY_KUYRUK, []),
    ])
    const yaklasan = (cekler || []).filter((c) => {
      const d = String(c.durum || '').toLowerCase()
      const vade = String(c.cek_vadesi || '').slice(0, 10)
      return !d.includes('odendi') && !d.includes('ödendi') && !d.includes('tahsil') && vade && vade >= bugun && vade <= yediGun
    })
    const acikSozler = (sozler || []).filter((x) => !x.tamamlandi)
    const bekleyen = (kuyruk || []).filter((k) => k.durum === 'bekliyor')

    const lines = [
      `🌅 <b>GÜN BAŞI RAPORU — ${tarihTR(bugun)} (07:00)</b>`,
      '',
      `💳 <b>Yaklaşan Çekler (7 Gün): ${yaklasan.length} adet</b>`,
      ...(yaklasan.length ? yaklasan.slice(0, 8).map((c) => `• ${tarihTR(c.cek_vadesi)} | <b>${tl(c.tutar)} ₺</b> (${c.yon === 'alinan' ? c.odeyen : c.odenen || '—'})`) : ['• Yaklaşan çek yok.']),
      '',
      `🤝 <b>Verilen Sözler &amp; Notlar (${acikSozler.length} açık):</b>`,
      ...(acikSozler.length ? acikSozler.slice(0, 8).map((s) => `• <b>${s.santiyeAd || 'Genel'}</b>: ${s.icerik}${s.terminTarihi ? ` [${tarihTR(s.terminTarihi)}]` : ''}`) : ['• Açık söz yok.']),
      '',
      `📋 <b>Aktif Görevler (${(gorevler || []).length} adet):</b>`,
      ...((gorevler || []).slice(0, 8).map((g) => `• [${sMap[g.santiye_id] || 'Genel'}] ${g.baslik}`)),
      '',
      `🤖 <b>Otomasyon Denetim:</b> ${bekleyen.length} işlem onay bekliyor.`,
    ]
    return lines.join('\n')
  }

  const [giderler, gelirler, makineler, sozler, kuyruk] = await Promise.all([
    sbFetch(env, `masraflar?select=baslik,tutar,santiye_id,odenen_kisi&harcama_tarihi=eq.${bugun}`),
    sbFetch(env, `gelirler?select=tutar,santiye_id,tahsilat_noktasi,odeme_yapan_adi&tarih=eq.${bugun}`),
    ayarOku(env, KEY_MAKINE, []),
    ayarOku(env, KEY_SOZLER, []),
    ayarOku(env, KEY_KUYRUK, []),
  ])
  const topGider = (giderler || []).reduce((a, b) => a + Number(b.tutar || 0), 0)
  const topGelir = (gelirler || []).reduce((a, b) => a + Number(b.tutar || 0), 0)
  const bugunMak = (makineler || []).filter((m) => m.tarih === bugun)
  const bekleyen = (kuyruk || []).filter((k) => k.durum === 'bekliyor')
  const acikSoz = (sozler || []).filter((x) => !x.tamamlandi)

  return [
    `🌙 <b>GÜN SONU RAPORU — ${tarihTR(bugun)} (18:30)</b>`,
    '',
    `💸 <b>Bugünkü Giderler (${(giderler || []).length}): ${tl(topGider)} ₺</b>`,
    ...((giderler || []).slice(0, 8).map((m) => `• [${sMap[m.santiye_id] || 'Genel'}] ${m.baslik} — <b>${tl(m.tutar)} ₺</b>`)),
    '',
    `💰 <b>Bugünkü Tahsilatlar (${(gelirler || []).length}): ${tl(topGelir)} ₺</b>`,
    ...((gelirler || []).slice(0, 6).map((g) => `• [${sMap[g.santiye_id] || 'Genel'}] ${g.odeme_yapan_adi || g.tahsilat_noktasi || 'Tahsilat'} — <b>${tl(g.tutar)} ₺</b>`)),
    ...(bugunMak.length ? ['', `🚜 <b>Saha / Makine:</b> ${bugunMak.length} kayıt`] : []),
    '',
    `🤝 <b>Açık Söz &amp; Notlar:</b> ${acikSoz.length}`,
    `⏳ <b>Onay Bekleyen Denetim:</b> ${bekleyen.length}`,
  ].join('\n')
}

async function geminiSor(env, metin) {
  const [santiyeler, cekler, rehber, sozler] = await Promise.all([
    sbFetch(env, 'santiyeler?select=id,ad'),
    sbFetch(env, 'cekler?select=yon,cek_vadesi,tutar,odeyen,odenen,banka,durum,santiye_id&order=cek_vadesi.asc&limit=60'),
    sbFetch(env, 'taseronlar?select=ad,firma,telefon&limit=120'),
    ayarOku(env, KEY_SOZLER, []),
  ])
  const prompt = `Sen Şantiye App Telegram asistanısın. Bugün: ${bugunTR()}.
Soruysa JSON {"mod":"soru_cevap","cevap":"...","taslaklar":[]} döndür.
Kayıt/işlemse JSON {"mod":"islem_taslagi","cevap":"...","taslaklar":[{"hedefModul":"gider|gelir|rehber|soz_not|gorev|makine|muhasebe_calisan|muhasebe_fatura|muhasebe_belge","ozet":"...","veri":{...}}]} döndür.
Bağlam: ${JSON.stringify({ santiyeler: (santiyeler || []).map((s) => s.ad), cekler: (cekler || []).slice(0, 35), rehber: (rehber || []).filter((r) => r.telefon).slice(0, 80), acikSozler: (sozler || []).filter((x) => !x.tamamlandi).slice(0, 20) })}
Mesaj: ${metin}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, responseMimeType: 'application/json' },
      }),
    }
  )
  const json = await res.json()
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim())
}

export default {
  async scheduled(event, env) {
    const tip = event.cron === '0 4 * * *' ? 'sabah' : 'aksam'
    const metin = await raporHazirla(env, tip)
    await tgGonder(env, env.TELEGRAM_CHAT_ID, metin)
  },

  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/setup-webhook') {
      const hookUrl = `${url.origin}/telegram`
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(hookUrl)}`)
      return new Response(await r.text(), { headers: { 'Content-Type': 'application/json' } })
    }

    if (url.pathname === '/telegram' && request.method === 'POST') {
      const update = await request.json()

      // 1. Inline Buton (Onayla / İptal)
      if (update.callback_query) {
        const cq = update.callback_query
        const chatId = String(cq.message?.chat?.id || '')
        if (env.TELEGRAM_CHAT_ID && chatId !== String(env.TELEGRAM_CHAT_ID)) return new Response('ok')

        const [eylem, taslakId] = String(cq.data || '').split(':')
        const kuyruk = await ayarOku(env, KEY_KUYRUK, [])
        const idx = kuyruk.findIndex((k) => k.id === taslakId)
        if (idx !== -1 && kuyruk[idx].durum === 'bekliyor') {
          if (eylem === 'reddet') {
            kuyruk[idx].durum = 'reddedildi'
            await ayarYaz(env, KEY_KUYRUK, kuyruk)
            await tgGonder(env, chatId, `❌ Taslak iptal edildi: <b>${kuyruk[idx].ozet}</b>`)
          } else if (eylem === 'onayla') {
            const k = kuyruk[idx]
            const v = k.veri || {}
            if (k.hedefModul === 'soz_not') {
              const sozler = await ayarOku(env, KEY_SOZLER, [])
              sozler.unshift({ id: `soz-${Date.now()}`, tur: v.tur || 'soz', kategori: v.kategori || 'Malik', kisi: v.kisi || '', santiyeAd: v.santiyeAd || 'Genel', terminTarihi: v.terminTarihi || '', icerik: v.icerik || k.ozet, tamamlandi: false, ekleyen: 'Telegram', olusturmaTarihi: new Date().toISOString() })
              await ayarYaz(env, KEY_SOZLER, sozler)
            } else if (k.hedefModul === 'gorev') {
              await sbFetch(env, 'gorevler', { method: 'POST', body: JSON.stringify({ baslik: v.baslik || k.ozet }) })
            } else if (k.hedefModul === 'rehber') {
              await sbFetch(env, 'taseronlar', { method: 'POST', body: JSON.stringify({ ad: v.firma || v.ad || k.ozet, firma: v.firma || v.ad || k.ozet, telefon: v.telefon || '', sifat: v.hizmetAlani || '' }) })
            } else if (k.hedefModul === 'muhasebe_calisan') {
              const list = await ayarOku(env, KEY_CALISAN, [])
              list.unshift({ id: `cal-${Date.now()}`, ...v, durum: 'bekliyor', ekleyen: 'Telegram', olusturmaTarihi: new Date().toISOString() })
              await ayarYaz(env, KEY_CALISAN, list)
            } else if (k.hedefModul === 'muhasebe_fatura') {
              const list = await ayarOku(env, KEY_FATURA, [])
              list.unshift({ id: `fat-${Date.now()}`, ...v, durum: 'bekliyor', ekleyen: 'Telegram', olusturmaTarihi: new Date().toISOString() })
              await ayarYaz(env, KEY_FATURA, list)
            } else if (k.hedefModul === 'muhasebe_belge') {
              const list = await ayarOku(env, KEY_BELGE, [])
              list.unshift({ id: `blg-${Date.now()}`, ...v, ekleyen: 'Telegram', olusturmaTarihi: new Date().toISOString() })
              await ayarYaz(env, KEY_BELGE, list)
            } else if (k.hedefModul === 'gider') {
              await sbFetch(env, 'masraflar', { method: 'POST', body: JSON.stringify({ baslik: v.baslik || k.ozet, odenen_kisi: v.kisi || '', tutar: Number(v.tutar) || 0, harcama_tarihi: v.tarih || bugunTR(), kayit_tarihi: new Date().toISOString(), taksit_sayisi: 1, aciklama: v.aciklama || '' }) })
            }
            kuyruk[idx].durum = 'onaylandi'
            kuyruk[idx].onaylayan = 'Telegram'
            kuyruk[idx].onayTarihi = new Date().toISOString()
            await ayarYaz(env, KEY_KUYRUK, kuyruk)
            await tgGonder(env, chatId, `✅ Onaylandı ve işlendi: <b>${k.ozet}</b>`)
          }
        }
        return new Response('ok')
      }

      // 2. Gelen Mesaj / Soru
      const msg = update.message
      if (!msg?.text) return new Response('ok')
      const chatId = String(msg.chat.id)
      if (env.TELEGRAM_CHAT_ID && chatId !== String(env.TELEGRAM_CHAT_ID)) return new Response('ok')

      if (msg.text === '/sabah') {
        await tgGonder(env, chatId, await raporHazirla(env, 'sabah'))
        return new Response('ok')
      }
      if (msg.text === '/aksam') {
        await tgGonder(env, chatId, await raporHazirla(env, 'aksam'))
        return new Response('ok')
      }

      const sonuc = await geminiSor(env, msg.text)
      if (sonuc.taslaklar?.length > 0) {
        const kuyruk = await ayarOku(env, KEY_KUYRUK, [])
        for (let i = 0; i < sonuc.taslaklar.length; i++) {
          const t = sonuc.taslaklar[i]
          const yeni = {
            id: `tg-${Date.now()}-${i}`,
            durum: 'bekliyor',
            hedefModul: t.hedefModul || 'soz_not',
            ozet: t.ozet || msg.text,
            guven: 90,
            veri: t.veri || {},
            orijinalMesaj: msg.text,
            olusturmaTarihi: new Date().toISOString(),
          }
          kuyruk.unshift(yeni)
          await tgGonder(
            env,
            chatId,
            `🛡️ <b>Otomasyon Denetim Taslağı</b>\n• Hedef: <b>${yeni.hedefModul}</b>\n• Özet: ${yeni.ozet}`,
            {
              inline_keyboard: [[
                { text: '✅ Onayla ve İşle', callback_data: `onayla:${yeni.id}` },
                { text: '❌ İptal', callback_data: `reddet:${yeni.id}` },
              ]],
            }
          )
        }
        await ayarYaz(env, KEY_KUYRUK, kuyruk)
      } else {
        await tgGonder(env, chatId, sonuc.cevap || 'Yanıt oluşturulamadı.')
      }
      return new Response('ok')
    }

    return new Response('Santiye App Telegram Worker aktif.')
  },
}
