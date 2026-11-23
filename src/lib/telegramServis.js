import { supabase } from './supabase'
import { paraFormatla } from './format'
import { operasyonVerisiYukle } from './operasyonKayit'
import { KEY_VERILEN_SOZLER } from '../components/VerilenSozlerPanel'
import { KEY_OTOMASYON_KUYRUK } from './otomasyonEngine'

export const KEY_TELEGRAM_AYAR = 'asistan_telegram_ayar_v1'
const KEY_MAKINE_LISTESI = 'santiye_makine_kayitlari_v1'

const bugunISO = () => new Date().toISOString().slice(0, 10)
const tarihTR = (str) => {
  if (!str) return '—'
  const p = String(str).slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : str
}

export async function telegramAyarYukle() {
  const varsayilan = { botToken: '', chatId: '', yeniTaslakBildir: true }
  try {
    const local = localStorage.getItem(KEY_TELEGRAM_AYAR)
    if (local) {
      const parsed = JSON.parse(local)
      if (parsed && typeof parsed === 'object') return { ...varsayilan, ...parsed }
    }
  } catch { /* ignore */ }
  try {
    const { data } = await supabase
      .from('sistem_ayarlari')
      .select('deger')
      .eq('anahtar', KEY_TELEGRAM_AYAR)
      .maybeSingle()
    if (data?.deger) {
      const parsed = JSON.parse(data.deger)
      if (parsed && typeof parsed === 'object') {
        try { localStorage.setItem(KEY_TELEGRAM_AYAR, JSON.stringify(parsed)) } catch { /* ignore */ }
        return { ...varsayilan, ...parsed }
      }
    }
  } catch { /* ignore */ }
  return varsayilan
}

export async function telegramAyarKaydet(ayar) {
  const temiz = {
    botToken: String(ayar?.botToken || '').trim(),
    chatId: String(ayar?.chatId || '').trim(),
    yeniTaslakBildir: ayar?.yeniTaslakBildir !== false,
  }
  try {
    localStorage.setItem(KEY_TELEGRAM_AYAR, JSON.stringify(temiz))
  } catch { /* ignore */ }
  await supabase
    .from('sistem_ayarlari')
    .upsert({ anahtar: KEY_TELEGRAM_AYAR, deger: JSON.stringify(temiz) }, { onConflict: 'anahtar' })
  return temiz
}

export async function telegramChatIdOtomatikBul(botToken) {
  const token = String(botToken || '').trim()
  if (!token) throw new Error('Önce Bot Token bilgisini yapıştırın.')
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getUpdates?limit=10`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Telegram API yanıt vermedi.')
  const updates = json.result || []
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i]
    const chat = u.message?.chat || u.callback_query?.message?.chat
    if (chat?.id) {
      return {
        chatId: String(chat.id),
        ad: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || 'Kullanıcı',
      }
    }
  }
  throw new Error('Henüz bota mesaj atılmamış. Lütfen Telegram\'da kendi botunuza "Merhaba" yazıp tekrar deneyin.')
}

export async function telegramMesajGonder({ botToken, chatId, metin, inlineKeyboard = null }) {
  if (!botToken || !chatId) throw new Error('Telegram Bot Token ve Chat ID eksik.')
  const payload = {
    chat_id: chatId,
    text: metin,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }
  if (inlineKeyboard) {
    payload.reply_markup = { inline_keyboard: inlineKeyboard }
  }
  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || 'Telegram mesajı gönderilemedi.')
  return json.result
}

// =========================================================
// SABAH 07:00 RAPORU (GÜN BAŞI)
// =========================================================
export async function sabahRaporuOlustur(santiyeler = []) {
  const bugun = bugunISO()
  const yediGunSonra = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const santiyeMap = {}
  santiyeler.forEach((s) => { santiyeMap[s.id] = s.ad })

  const [cekRes, gorevRes, sozlerList, kuyrukList] = await Promise.all([
    supabase.from('cekler').select('*').order('cek_vadesi', { ascending: true }).limit(100),
    supabase.from('gorevler').select('baslik, durum, santiye_id').neq('durum', 'tamamlandi').limit(50),
    operasyonVerisiYukle(KEY_VERILEN_SOZLER, []),
    operasyonVerisiYukle(KEY_OTOMASYON_KUYRUK, []),
  ])

  const cekler = (cekRes.data || []).filter((c) => {
    const d = String(c.durum || '').toLowerCase()
    if (d.includes('odendi') || d.includes('ödendi') || d.includes('tahsil')) return false
    const vade = String(c.cek_vadesi || '').slice(0, 10)
    return vade && vade >= bugun && vade <= yediGunSonra
  })

  const acikSozler = (Array.isArray(sozlerList) ? sozlerList : []).filter((x) => !x.tamamlandi)
  const acikGorevler = gorevRes.data || []
  const bekleyenDenetim = (Array.isArray(kuyrukList) ? kuyrukList : []).filter((k) => k.durum === 'bekliyor')

  const satirlar = [
    `🌅 <b>GÜN BAŞI RAPORU — ${tarihTR(bugun)} (07:00)</b>`,
    '',
    `💳 <b>Yaklaşan Çekler (7 Gün İçinde): ${cekler.length} adet</b>`,
  ]

  if (cekler.length === 0) {
    satirlar.push('• Yaklaşan ödenmemiş çek yok.')
  } else {
    cekler.slice(0, 8).forEach((c) => {
      const yonEtiket = c.yon === 'alinan' ? 'Alınan' : 'Verilen'
      const kisi = c.yon === 'alinan' ? (c.odeyen || '—') : (c.odenen || '—')
      satirlar.push(`• ${tarihTR(c.cek_vadesi)} | <b>${paraFormatla(c.tutar)} ₺</b> (${yonEtiket} — ${kisi})`)
    })
  }

  satirlar.push('', `🤝 <b>Verilen Sözler &amp; Notlar (${acikSozler.length} açık):</b>`)
  if (acikSozler.length === 0) {
    satirlar.push('• Açık söz veya not bulunmuyor.')
  } else {
    acikSozler.slice(0, 8).forEach((s) => {
      const termin = s.terminTarihi ? ` [Termin: ${tarihTR(s.terminTarihi)}]` : ''
      satirlar.push(`• <b>${s.santiyeAd || 'Genel'}</b>${s.kisi ? ` (${s.kisi})` : ''}: ${s.icerik}${termin}`)
    })
  }

  satirlar.push('', `📋 <b>Aktif Görevler (${acikGorevler.length} adet):</b>`)
  if (acikGorevler.length === 0) {
    satirlar.push('• Bekleyen görev yok.')
  } else {
    acikGorevler.slice(0, 8).forEach((g) => {
      satirlar.push(`• [${santiyeMap[g.santiye_id] || 'Genel'}] ${g.baslik}`)
    })
    if (acikGorevler.length > 8) {
      satirlar.push(`<i>...ve ${acikGorevler.length - 8} görev daha</i>`)
    }
  }

  satirlar.push('', `🤖 <b>Otomasyon Denetim:</b> ${bekleyenDenetim.length} işlem onayınızı bekliyor.`)
  return satirlar.join('\n')
}

// =========================================================
// AKŞAM 18:30 RAPORU (GÜN SONU)
// =========================================================
export async function aksamRaporuOlustur(santiyeler = []) {
  const bugun = bugunISO()
  const santiyeMap = {}
  santiyeler.forEach((s) => { santiyeMap[s.id] = s.ad })

  const [masrafRes, gelirRes, makineList, sozlerList, kuyrukList] = await Promise.all([
    supabase.from('masraflar').select('baslik, tutar, santiye_id, odenen_kisi').eq('harcama_tarihi', bugun),
    supabase.from('gelirler').select('tutar, santiye_id, tahsilat_noktasi, odeme_yapan_adi').eq('tarih', bugun),
    operasyonVerisiYukle(KEY_MAKINE_LISTESI, []),
    operasyonVerisiYukle(KEY_VERILEN_SOZLER, []),
    operasyonVerisiYukle(KEY_OTOMASYON_KUYRUK, []),
  ])

  const bugunGiderler = masrafRes.data || []
  const bugunGelirler = gelirRes.data || []
  const toplamGider = bugunGiderler.reduce((t, m) => t + Number(m.tutar || 0), 0)
  const toplamGelir = bugunGelirler.reduce((t, g) => t + Number(g.tutar || 0), 0)

  const bugunMakineler = (Array.isArray(makineList) ? makineList : []).filter((m) => m.tarih === bugun)
  const acikSozler = (Array.isArray(sozlerList) ? sozlerList : []).filter((x) => !x.tamamlandi)
  const bekleyenDenetim = (Array.isArray(kuyrukList) ? kuyrukList : []).filter((k) => k.durum === 'bekliyor')

  const satirlar = [
    `🌙 <b>GÜN SONU RAPORU — ${tarihTR(bugun)} (18:30)</b>`,
    '',
    `💸 <b>Bugünkü Giderler (${bugunGiderler.length} işlem): ${paraFormatla(toplamGider)} ₺</b>`,
  ]
  if (bugunGiderler.length === 0) {
    satirlar.push('• Bugün gider girişi yapılmadı.')
  } else {
    bugunGiderler.slice(0, 8).forEach((m) => {
      satirlar.push(`• [${santiyeMap[m.santiye_id] || 'Genel'}] ${m.baslik}${m.odenen_kisi ? ` (${m.odenen_kisi})` : ''} — <b>${paraFormatla(m.tutar)} ₺</b>`)
    })
  }

  satirlar.push('', `💰 <b>Bugünkü Tahsilatlar (${bugunGelirler.length} işlem): ${paraFormatla(toplamGelir)} ₺</b>`)
  if (bugunGelirler.length === 0) {
    satirlar.push('• Bugün tahsilat girişi yapılmadı.')
  } else {
    bugunGelirler.slice(0, 6).forEach((g) => {
      satirlar.push(`• [${santiyeMap[g.santiye_id] || 'Genel'}] ${g.odeme_yapan_adi || g.tahsilat_noktasi || 'Tahsilat'} — <b>${paraFormatla(g.tutar)} ₺</b>`)
    })
  }

  if (bugunMakineler.length > 0) {
    satirlar.push('', `🚜 <b>Bugünkü Saha / Makine (${bugunMakineler.length} kayıt):</b>`)
    bugunMakineler.slice(0, 5).forEach((m) => {
      satirlar.push(`• [${m.santiyeAdi || 'Genel'}] ${m.makineTuru} (${m.calismaSaati} sa) — ${paraFormatla(m.toplamTutar || 0)} ₺`)
    })
  }

  satirlar.push(
    '',
    `🤝 <b>Açık Söz &amp; Notlar:</b> ${acikSozler.length} adet`,
    `⏳ <b>Onay Bekleyen Denetim Taslağı:</b> ${bekleyenDenetim.length} adet`
  )
  return satirlar.join('\n')
}
