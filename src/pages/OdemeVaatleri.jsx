import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'

const bugun = () => new Date().toISOString().slice(0, 10)

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

const turkceTarihFormatla = (tarihStr) => {
  if (!tarihStr) return ''
  const d = new Date(tarihStr)
  if (isNaN(d.getTime())) return tarihStr
  const gun = String(d.getDate()).padStart(2, '0')
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const yil = d.getFullYear()
  const gunAdi = GUNLER[d.getDay()]
  return `${gun}.${ay}.${yil} (${gunAdi})`
}

const turkceKisaTarih = (tarihStr) => {
  if (!tarihStr) return ''
  const d = new Date(tarihStr)
  if (isNaN(d.getTime())) return tarihStr
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`
}

export default function OdemeVaatleri() {
  const { aktifSantiye, santiyeler } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'

  const [vaatler, setVaatler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [filtreDurum, setFiltreDurum] = useState('bekliyor') // 'bekliyor' | 'odendi' | 'hepsi'
  const [aramaMetni, setAramaMetni] = useState('')
  const [seciliSantiyeFiltre, setSeciliSantiyeFiltre] = useState('hepsi') // 'hepsi' | santiye_id

  // Form State
  const [kisiAdi, setKisiAdi] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  const [tutar, setTutar] = useState('')
  const [vadeTarihi, setVadeTarihi] = useState(bugun())
  const [notMetni, setNotMetni] = useState('')
  const [formSantiyeId, setFormSantiyeId] = useState(aktifSantiye?.id || 'genel')
  const [eklemeModu, setEklemeModu] = useState(false)

  // Düzenleme State
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzKisi, setDuzKisi] = useState('')
  const [duzTutar, setDuzTutar] = useState('')
  const [duzVadeTarihi, setDuzVadeTarihi] = useState('')
  const [duzNot, setDuzNot] = useState('')
  const [duzSantiyeId, setDuzSantiyeId] = useState('genel')

  // Toplu Seçim (WhatsApp Paylaşımı İçin)
  const [seciliVaatIdler, setSeciliVaatIdler] = useState([])

  // Bildirim / Mesaj
  const [bilgiMesaji, setBilgiMesaji] = useState('')

  const bildirimGoster = (msg) => {
    setBilgiMesaji(msg)
    setTimeout(() => setBilgiMesaji(''), 3500)
  }

  useEffect(() => {
    if (aktifSantiye?.id) {
      setFormSantiyeId(aktifSantiye.id)
    }
  }, [aktifSantiye])

  useEffect(() => {
    vaatleriYukle()
  }, [])

  const vaatleriYukle = async () => {
    setYukleniyor(true)
    const { data, error } = await supabase
      .from('planlanan_odemeler')
      .select('*, santiyeler(ad), taseronlar(ad)')
      .eq('siklik', 'vaat')
      .order('vade_tarihi', { ascending: true })

    if (error) {
      console.error('Ödeme vaatleri yüklenirken hata:', error)
    } else {
      setVaatler(data || [])
    }
    setYukleniyor(false)
  }

  // Hızlı Tarih Seçimleri
  const hizliTarihBelirle = (gunEkle) => {
    const d = new Date()
    d.setDate(d.getDate() + gunEkle)
    setVadeTarihi(d.toISOString().slice(0, 10))
  }

  const buCumaBelirle = () => {
    const d = new Date()
    const gun = d.getDay()
    const fark = gun <= 5 ? 5 - gun : 6 // Bu cuma veya sonraki cuma
    d.setDate(d.getDate() + fark)
    setVadeTarihi(d.toISOString().slice(0, 10))
  }

  // Yeni Vaat Ekleme
  const vaatEkle = async () => {
    if (!kisiAdi.trim()) {
      alert('Lütfen kime söz verildiğini (kişi veya firma adı) yazınız.')
      return
    }
    const temizTutarNum = temizleTutar(tutar)
    if (!temizTutarNum || Number(temizTutarNum) <= 0) {
      alert('Lütfen geçerli bir söz verilen tutar giriniz.')
      return
    }

    setYukleniyor(true)

    let finalCariId = secilenCariId
    // Eğer cari seçilmemişse arayalım veya taseronlara kaydedelim
    if (!finalCariId && kisiAdi.trim()) {
      const { data: eslesen } = await supabase
        .from('taseronlar')
        .select('id, ad')
        .ilike('ad', kisiAdi.trim())
        .limit(1)

      if (eslesen && eslesen.length > 0) {
        finalCariId = eslesen[0].id
      }
    }

    const yeniKayit = {
      baslik: kisiAdi.trim(),
      tutar: temizTutarNum,
      vade_tarihi: vadeTarihi || bugun(),
      siklik: 'vaat',
      durum: 'bekliyor',
      not_metni: notMetni.trim() || null,
      santiye_id: formSantiyeId === 'genel' ? null : formSantiyeId,
      cari_id: finalCariId || null,
      ekleyen: profile?.id || null
    }

    const { error } = await supabase.from('planlanan_odemeler').insert(yeniKayit)

    if (error) {
      alert('Kayıt eklenirken hata: ' + error.message)
      setYukleniyor(false)
      return
    }

    // Formu Temizle
    setKisiAdi('')
    setSecilenCariId(null)
    setTutar('')
    setNotMetni('')
    setVadeTarihi(bugun())
    setEklemeModu(false)
    bildirimGoster('✓ Ödeme vaadi başarıyla kaydedildi.')
    vaatleriYukle()
  }

  // Durum Değiştirme (Ödendi / Bekliyor)
  const durumDegistir = async (id, mevcutDurum) => {
    const yeniDurum = mevcutDurum === 'odendi' ? 'bekliyor' : 'odendi'
    const { error } = await supabase
      .from('planlanan_odemeler')
      .update({ durum: yeniDurum })
      .eq('id', id)

    if (error) {
      alert('Durum güncellenirken hata: ' + error.message)
      return
    }

    setVaatler(prev => prev.map(v => v.id === id ? { ...v, durum: yeniDurum } : v))
    bildirimGoster(yeniDurum === 'odendi' ? '✓ Ödeme yapıldı olarak işaretlendi' : '✓ Geri alındı (Bekliyor)')
  }

  // Düzenleme Başlat
  const duzenlemeyiBaslat = (item) => {
    setDuzenlenenId(item.id)
    setDuzKisi(item.baslik || '')
    setDuzTutar(String(item.tutar || ''))
    setDuzVadeTarihi(item.vade_tarihi ? item.vade_tarihi.slice(0, 10) : bugun())
    setDuzNot(item.not_metni || '')
    setDuzSantiyeId(item.santiye_id || 'genel')
  }

  // Düzenlemeyi Kaydet
  const duzenlemeyiKaydet = async (id) => {
    const temizTutarNum = temizleTutar(duzTutar)
    if (!duzKisi.trim() || !temizTutarNum) {
      alert('Kişi adı ve tutar boş bırakılamaz.')
      return
    }

    const { error } = await supabase
      .from('planlanan_odemeler')
      .update({
        baslik: duzKisi.trim(),
        tutar: temizTutarNum,
        vade_tarihi: duzVadeTarihi,
        not_metni: duzNot.trim() || null,
        santiye_id: duzSantiyeId === 'genel' ? null : duzSantiyeId
      })
      .eq('id', id)

    if (error) {
      alert('Güncellenirken hata: ' + error.message)
      return
    }

    setDuzenlenenId(null)
    bildirimGoster('✓ Değişiklikler kaydedildi.')
    vaatleriYukle()
  }

  // Vaat Silme
  const vaatSil = async (id, isim) => {
    if (!window.confirm(`"${isim}" için verilen ödeme vaadini silmek istediğinize emin misiniz?`)) return

    const { error } = await supabase.from('planlanan_odemeler').delete().eq('id', id)
    if (error) {
      alert('Silinirken hata: ' + error.message)
      return
    }
    setVaatler(prev => prev.filter(v => v.id !== id))
    bildirimGoster('✓ Ödeme vaadi silindi.')
  }

  // Filtrelenmiş Liste
  const filtrelenmisVaatler = useMemo(() => {
    return vaatler.filter(v => {
      // Durum Filtresi
      if (filtreDurum !== 'hepsi' && v.durum !== filtreDurum) return false

      // Şantiye Filtresi
      if (seciliSantiyeFiltre !== 'hepsi') {
        if (seciliSantiyeFiltre === 'genel' && v.santiye_id !== null) return false
        if (seciliSantiyeFiltre !== 'genel' && v.santiye_id !== seciliSantiyeFiltre) return false
      }

      // Arama Metni Filtresi
      if (aramaMetni.trim()) {
        const aranan = aramaMetni.toLowerCase().trim()
        const ad = (v.baslik || '').toLowerCase()
        const notu = (v.not_metni || '').toLowerCase()
        const santiye = (v.santiyeler?.ad || '').toLowerCase()
        const tutarStr = String(v.tutar || '')
        if (!ad.includes(aranan) && !notu.includes(aranan) && !santiye.includes(aranan) && !tutarStr.includes(aranan)) {
          return false
        }
      }

      return true
    })
  }, [vaatler, filtreDurum, seciliSantiyeFiltre, aramaMetni])

  // İstatistik Hesapları
  const bekleyenler = useMemo(() => vaatler.filter(v => v.durum === 'bekliyor'), [vaatler])
  const bugunTarihStr = bugun()

  const toplamBekleyenTutar = useMemo(() => {
    return bekleyenler.reduce((acc, curr) => acc + Number(curr.tutar || 0), 0)
  }, [bekleyenler])

  const vadesiGecenVeyaBugun = useMemo(() => {
    return bekleyenler.filter(v => (v.vade_tarihi || '') <= bugunTarihStr)
  }, [bekleyenler, bugunTarihStr])

  const vadesiGecenTutar = useMemo(() => {
    return vadesiGecenVeyaBugun.reduce((acc, curr) => acc + Number(curr.tutar || 0), 0)
  }, [vadesiGecenVeyaBugun])

  const odenenToplamTutar = useMemo(() => {
    return vaatler.filter(v => v.durum === 'odendi').reduce((acc, curr) => acc + Number(curr.tutar || 0), 0)
  }, [vaatler])

  // Vade Durumu Rozeti
  const vadeDurumuBilgisi = (vadeStr, durum) => {
    if (durum === 'odendi') {
      return { metin: '✓ Ödendi', renk: '#166534', bg: '#DCFCE7', border: '#BBF7D0' }
    }
    if (!vadeStr) return { metin: 'Tarih Yok', renk: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' }

    const simdi = new Date(bugunTarihStr).getTime()
    const vade = new Date(vadeStr.slice(0, 10)).getTime()
    const farkGun = Math.ceil((vade - simdi) / (1000 * 60 * 60 * 24))

    if (farkGun < 0) {
      return { metin: `⚠️ ${Math.abs(farkGun)} gün gecikti!`, renk: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5' }
    }
    if (farkGun === 0) {
      return { metin: '🔥 Vadesi Bugün!', renk: '#92400E', bg: '#FEF3C7', border: '#FDE68A' }
    }
    if (farkGun === 1) {
      return { metin: '⏳ Yarın', renk: '#B45309', bg: '#FEF9C3', border: '#FDE047' }
    }
    return { metin: `🗓 ${farkGun} gün sonra`, renk: '#0369A1', bg: '#E0F2FE', border: '#BAE6FD' }
  }

  // Tekil WhatsApp Mesajı
  const tekilWhatsAppPaylas = (item) => {
    const tarih = turkceTarihFormatla(item.vade_tarihi)
    const tutarFormatli = paraFormatla(item.tutar)
    const santiyeAdi = item.santiyeler?.ad ? `${item.santiyeler.ad} şantiyemiz için ` : ''
    const notDetay = item.not_metni ? `\n📝 *Açıklama:* ${item.not_metni}` : ''

    const mesaj = `Merhaba *${item.baslik}*,\n\n${santiyeAdi}*${tarih}* vadeli *${tutarFormatli} ₺* tutarındaki ödeme sözümüz kayıtlarımızdadır.${notDetay}\n\nBilginize sunar, hayırlı işler dileriz.`

    const url = `https://wa.me/?text=${encodeURIComponent(mesaj)}`
    window.open(url, '_blank')
  }

  // Toplu WhatsApp Paylaşımı (Tüm filtrelenmiş veya seçili olanlar)
  const topluWhatsAppPaylas = () => {
    // Eğer seçim yapılmışsa sadece seçilenleri, yoksa ekrandaki bekleyenleri al
    const paylasilacaklar = seciliVaatIdler.length > 0
      ? filtrelenmisVaatler.filter(v => seciliVaatIdler.includes(v.id))
      : filtrelenmisVaatler.filter(v => v.durum === 'bekliyor')

    if (paylasilacaklar.length === 0) {
      alert('Paylaşılacak bekleyen bir ödeme vaadi bulunamadı. Lütfen listeden vaat seçiniz veya ekleyiniz.')
      return
    }

    const toplamTutar = paylasilacaklar.reduce((acc, curr) => acc + Number(curr.tutar || 0), 0)
    const tarihBugun = turkceTarihFormatla(bugunTarihStr)

    let mesaj = `🤝 *ÖDEME VAATLERİMİZ (Söz Verilen Ödemeler)*\n`
    mesaj += `📅 *Rapor Tarihi:* ${tarihBugun}\n`
    if (aktifSantiye?.ad && seciliSantiyeFiltre !== 'hepsi') {
      mesaj += `🏢 *Şantiye:* ${aktifSantiye.ad}\n`
    }
    mesaj += `━━━━━━━━━━━━━━━━━━━━━\n\n`

    paylasilacaklar.forEach((item, index) => {
      const siraNo = index + 1
      const santiyeTag = item.santiyeler?.ad ? ` [${item.santiyeler.ad}]` : ''
      const vadeTr = turkceKisaTarih(item.vade_tarihi)
      const notStr = item.not_metni ? `\n   📝 _Not:_ ${item.not_metni}` : ''
      const durumStr = item.durum === 'odendi' ? ' (ÖDENDİ ✓)' : ''

      mesaj += `*${siraNo}.* *${item.baslik}*${santiyeTag}${durumStr}\n`
      mesaj += `   💵 *${paraFormatla(item.tutar)} ₺*\n`
      mesaj += `   🗓 *Vade:* ${vadeTr}${notStr}\n\n`
    })

    mesaj += `━━━━━━━━━━━━━━━━━━━━━\n`
    mesaj += `💰 *TOPLAM VAAT:* *${paraFormatla(toplamTutar)} ₺* (${paylasilacaklar.length} Kayıt)\n`
    mesaj += `_Söz verdiğimiz ödeme listesidir._`

    // Panoya kopyala
    navigator.clipboard?.writeText(mesaj).catch(() => {})

    // WhatsApp'ı aç
    const url = `https://wa.me/?text=${encodeURIComponent(mesaj)}`
    window.open(url, '_blank')
    bildirimGoster('✓ Liste WhatsApp formatında hazırlandı ve panoya kopyalandı!')
  }

  // Tümünü Seç / Kaldır
  const tumunuSecTetikle = () => {
    if (seciliVaatIdler.length === filtrelenmisVaatler.length) {
      setSeciliVaatIdler([])
    } else {
      setSeciliVaatIdler(filtrelenmisVaatler.map(v => v.id))
    }
  }

  return (
    <div>
      {/* ÜST BİLDİRİM TOAST */}
      {bilgiMesaji && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #0F6E56, #1D9596)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 24,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 9999,
          fontWeight: 600,
          fontSize: 13,
          animation: 'fadeIn 0.2s'
        }}>
          {bilgiMesaji}
        </div>
      )}

      {/* İSTATİSTİK KARTLARI */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 120px', background: '#F0FDF4', padding: '12px 14px', borderRadius: 12, border: '1px solid #86EFAC', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#15803D', fontWeight: 600 }}>Toplam Bekleyen Vaat</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 17, fontWeight: 800, color: '#166534' }}>
            {paraFormatla(toplamBekleyenTutar)} ₺
          </p>
          <span style={{ fontSize: 10, color: '#15803D', opacity: 0.85 }}>{bekleyenler.length} kişiye söz verildi</span>
        </div>

        <div style={{ flex: '1 1 120px', background: vadesiGecenVeyaBugun.length > 0 ? '#FEF2F2' : '#F8FAFC', padding: '12px 14px', borderRadius: 12, border: vadesiGecenVeyaBugun.length > 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: 0, fontSize: 11, color: vadesiGecenVeyaBugun.length > 0 ? '#B91C1C' : '#64748B', fontWeight: 600 }}>Vadesi Gelen / Geçen</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 17, fontWeight: 800, color: vadesiGecenVeyaBugun.length > 0 ? '#991B1B' : '#334155' }}>
            {paraFormatla(vadesiGecenTutar)} ₺
          </p>
          <span style={{ fontSize: 10, color: vadesiGecenVeyaBugun.length > 0 ? '#B91C1C' : '#64748B', opacity: 0.85 }}>{vadesiGecenVeyaBugun.length} vaat acil / bugün</span>
        </div>

        <div style={{ flex: '1 1 120px', background: '#EFF6FF', padding: '12px 14px', borderRadius: 12, border: '1px solid #93C5FD', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#1D4ED8', fontWeight: 600 }}>Ödenen / Kapatılan</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 17, fontWeight: 800, color: '#1E3A8A' }}>
            {paraFormatla(odenenToplamTutar)} ₺
          </p>
          <span style={{ fontSize: 10, color: '#1D4ED8', opacity: 0.85 }}>Tamamlanan sözler</span>
        </div>
      </div>

      {/* AKSİYON BUTONLARI & ARAMA ÇUBUĞU */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setEklemeModu(!eklemeModu)}
            className="ekle-buton"
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              background: eklemeModu ? '#E2E8F0' : 'linear-gradient(135deg, #0F6E56, #1D9596)',
              color: eklemeModu ? '#334155' : '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: eklemeModu ? 'none' : '0 2px 8px rgba(15, 110, 86, 0.3)'
            }}
          >
            {eklemeModu ? '✕ Formu Kapat' : '➕ Yeni Vaat Ekle'}
          </button>

          {/* TOPLU WHATSAPP PAYLAŞ BUTONU */}
          <button
            onClick={topluWhatsAppPaylas}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
              transition: 'all 0.15s'
            }}
            title="Söz verilen ödemeleri WhatsApp üzerinden toplu liste olarak paylaş"
          >
            <span style={{ fontSize: 15 }}>📲</span>
            <span>Toplu WhatsApp Paylaş</span>
            {seciliVaatIdler.length > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.3)', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>
                {seciliVaatIdler.length}
              </span>
            )}
          </button>
        </div>

        {/* Canlı Arama Input'u */}
        <div style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 360 }}>
          <input
            type="text"
            placeholder="🔍 Kişi, firma, not veya tutar ara..."
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px',
              fontSize: 12.5,
              borderRadius: 8,
              border: '1px solid #D3D1C7',
              background: '#ffffff',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* HIZLI VAAT EKLEME KUTUSU (BASİT USULDE) */}
      {eklemeModu && (
        <div className="ekleme-kutusu" style={{ marginBottom: 16, border: '1.5px solid #1D9596', borderRadius: 12, padding: 14, background: '#faf9f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: '#0F6E56', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🤝</span> Söz Verilen Kişi / Ödeme Vaadi Kaydı
            </p>
            <span style={{ fontSize: 11, color: '#64748B' }}>Basit ve Hızlı Kayıt</span>
          </div>

          {/* İlgili Şantiye */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Şantiye (Opsiyonel):
            </label>
            <select
              value={formSantiyeId}
              onChange={e => setFormSantiyeId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13 }}
            >
              {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
              <option value="genel">Genel / Şantiyeden Bağımsız</option>
            </select>
          </div>

          {/* Kime Söz Verildi (Cari veya Serbest Yazım) */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Söz Verilen Kişi / Firma Adı: <span style={{ color: '#E11D48' }}>*</span>
            </label>
            <CariAramaSecici
              deger={kisiAdi}
              onDegisti={(isim, id) => {
                setKisiAdi(isim)
                setSecilenCariId(id || null)
              }}
              placeholder="Örn: Remzi Akın (Öz Marmara), Mehmet Demirci, Pimapenci vb."
            />
          </div>

          {/* Tutar & Vade Tarihi */}
          <div className="ekleme-satiri-2" style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Söz Verilen Tutar (₺): <span style={{ color: '#E11D48' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Örn: 50.000"
                value={tutar}
                onChange={(e) => setTutar(formatInputTutar(e.target.value))}
                onKeyDown={sadeceSayiTuslari}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 14, fontWeight: 600 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                Söz Verilen Tarih (Vade):
              </label>
              <input
                type="date"
                value={vadeTarihi}
                onChange={e => setVadeTarihi(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Hızlı Tarih Seçim Kısayolları */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#64748B', alignSelf: 'center' }}>Hızlı Tarih:</span>
            <button type="button" onClick={() => hizliTarihBelirle(0)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: '#E2E8F0', border: 'none', cursor: 'pointer' }}>Bugün</button>
            <button type="button" onClick={() => hizliTarihBelirle(1)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: '#E2E8F0', border: 'none', cursor: 'pointer' }}>Yarın</button>
            <button type="button" onClick={buCumaBelirle} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: '#E2E8F0', border: 'none', cursor: 'pointer' }}>Bu Cuma</button>
            <button type="button" onClick={() => hizliTarihBelirle(7)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6, background: '#E2E8F0', border: 'none', cursor: 'pointer' }}>+1 Hafta</button>
          </div>

          {/* Açıklama / Not */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Hatırlatıcı Not / Açıklama (Opsiyonel):
            </label>
            <textarea
              placeholder="Örn: Doğrama hakediş avansı, Cuma öğleden sonra havale sözü verildi..."
              value={notMetni}
              onChange={(e) => setNotMetni(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEklemeModu(false)}
              style={{ flex: 1, padding: '9px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Vazgeç
            </button>
            <button
              onClick={vaatEkle}
              disabled={yukleniyor}
              style={{
                flex: 2,
                padding: '9px',
                background: 'linear-gradient(135deg, #0F6E56, #1D9596)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 6px rgba(15,110,86,0.3)'
              }}
            >
              {yukleniyor ? 'Kaydediliyor...' : '✓ Vaadi Kaydet'}
            </button>
          </div>
        </div>
      )}

      {/* FİLTRE VE SEÇİM BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div className="gorunum-secici" style={{ margin: 0 }}>
          <button className={filtreDurum === 'bekliyor' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('bekliyor')}>
            Bekleyenler ({bekleyenler.length})
          </button>
          <button className={filtreDurum === 'odendi' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('odendi')}>
            Ödenenler ({vaatler.filter(v => v.durum === 'odendi').length})
          </button>
          <button className={filtreDurum === 'hepsi' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('hepsi')}>
            Tümü ({vaatler.length})
          </button>
        </div>

        {/* Çoklu Seçim Bilgisi */}
        {filtrelenmisVaatler.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={tumunuSecTetikle}
              style={{
                background: 'none',
                border: '1px solid #CBD5E1',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
                color: '#475569',
                fontWeight: 600
              }}
            >
              {seciliVaatIdler.length === filtrelenmisVaatler.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
            </button>
            <span style={{ fontSize: 11, color: '#64748B' }}>
              {seciliVaatIdler.length > 0 ? `${seciliVaatIdler.length} seçili` : `${filtrelenmisVaatler.length} kayıt`}
            </span>
          </div>
        )}
      </div>

      {/* LİSTELEME */}
      {yukleniyor && vaatler.length === 0 ? (
        <p className="bos-mesaj">Yükleniyor...</p>
      ) : filtrelenmisVaatler.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', background: '#ffffff', borderRadius: 12, border: '1px dashed #CBD5E1', marginTop: 10 }}>
          <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🤝</span>
          <p style={{ margin: 0, fontWeight: 600, color: '#475569', fontSize: 14 }}>
            {aramaMetni ? 'Aramanıza uygun ödeme vaadi bulunamadı.' : 'Henüz kayıtlı bir ödeme vaadi bulunmuyor.'}
          </p>
          <p style={{ margin: '6px 0 14px 0', fontSize: 12, color: '#94A3B8' }}>
            Söz verdiğiniz kişileri hızlıca ekleyip vadelerini takip edebilirsiniz.
          </p>
          {!eklemeModu && (
            <button
              onClick={() => setEklemeModu(true)}
              style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #0F6E56, #1D9596)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
            >
              ➕ İlk Vaadi Ekle
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrelenmisVaatler.map(item => {
            const vadeInfo = vadeDurumuBilgisi(item.vade_tarihi, item.durum)
            const secili = seciliVaatIdler.includes(item.id)

            if (duzenlenenId === item.id) {
              return (
                <div key={item.id} className="kart" style={{ padding: 12, border: '1.5px solid #1D9596', borderRadius: 12, background: '#faf9f5' }}>
                  <p style={{ fontWeight: 700, color: '#0F6E56', fontSize: 13, margin: '0 0 8px 0' }}>Vaadi Düzenle</p>
                  <input
                    type="text"
                    value={duzKisi}
                    onChange={e => setDuzKisi(e.target.value)}
                    placeholder="Kişi / Firma Adı"
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D3D1C7', marginBottom: 6, fontSize: 13 }}
                  />
                  <div className="ekleme-satiri-2" style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      type="text"
                      value={duzTutar}
                      onChange={e => setDuzTutar(formatInputTutar(e.target.value))}
                      placeholder="Tutar (₺)"
                      onKeyDown={sadeceSayiTuslari}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13 }}
                    />
                    <input
                      type="date"
                      value={duzVadeTarihi}
                      onChange={e => setDuzVadeTarihi(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13 }}
                    />
                  </div>
                  <textarea
                    value={duzNot}
                    onChange={e => setDuzNot(e.target.value)}
                    placeholder="Not / Açıklama"
                    rows={2}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #D3D1C7', marginBottom: 8, fontSize: 13, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDuzenlenenId(null)} style={{ flex: 1, padding: 8, background: '#E2E8F0', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Vazgeç</button>
                    <button onClick={() => duzenlemeyiKaydet(item.id)} style={{ flex: 2, padding: 8, background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>✓ Kaydet</button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={item.id}
                className="kart"
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: item.durum === 'odendi' ? '#F8FAFC' : '#ffffff',
                  border: secili ? '2px solid #1D9596' : '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: item.durum === 'odendi' ? 0.75 : 1,
                  transition: 'all 0.15s'
                }}
              >
                {/* ÜST SATIR: Checkbox, İsim, Vade Rozeti ve Tutar */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                    {/* Toplu Paylaşım Checkbox */}
                    <input
                      type="checkbox"
                      checked={secili}
                      onChange={() => {
                        setSeciliVaatIdler(prev =>
                          prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                        )
                      }}
                      style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0, cursor: 'pointer' }}
                      title="WhatsApp paylaşım listesine dahil et"
                    />

                    {/* Hızlı Ödendi / Geri Al Butonu */}
                    <button
                      onClick={() => durumDegistir(item.id, item.durum)}
                      style={{
                        padding: '2px 7px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: item.durum === 'odendi' ? '#DCFCE7' : '#F1F5F9',
                        color: item.durum === 'odendi' ? '#15803D' : '#64748B',
                        flexShrink: 0,
                        marginTop: 1
                      }}
                      title={item.durum === 'odendi' ? 'Bekliyor durumuna geri al' : 'Ödendi olarak işaretle'}
                    >
                      {item.durum === 'odendi' ? '✓ Ödendi' : '○ Bekliyor'}
                    </button>

                    {/* Kişi / Firma Adı */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontWeight: 700,
                        fontSize: 14.5,
                        color: item.durum === 'odendi' ? '#64748B' : '#1E293B',
                        textDecoration: item.durum === 'odendi' ? 'line-through' : 'none',
                        wordBreak: 'break-word',
                        lineHeight: 1.3
                      }}>
                        {item.baslik}
                      </p>
                      {item.santiyeler?.ad && (
                        <span style={{
                          display: 'inline-block',
                          marginTop: 3,
                          padding: '1px 6px',
                          fontSize: 10.5,
                          fontWeight: 700,
                          borderRadius: 8,
                          background: '#E6FFFA',
                          color: '#0D9488',
                          border: '1px solid #99F6E4'
                        }}>
                          🏢 {item.santiyeler.ad}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sağ Taraf: Tutar & Vade Rozeti */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: item.durum === 'odendi' ? '#64748B' : '#0F6E56',
                      letterSpacing: '-0.3px'
                    }}>
                      {paraFormatla(item.tutar)} ₺
                    </div>
                    <span style={{
                      display: 'inline-block',
                      marginTop: 3,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: vadeInfo.bg,
                      color: vadeInfo.renk,
                      border: `1px solid ${vadeInfo.border}`
                    }}>
                      {vadeInfo.metin}
                    </span>
                  </div>
                </div>

                {/* ORTA: Açıklama / Not (Varsa) */}
                {item.not_metni && (
                  <div style={{
                    fontSize: 12.5,
                    color: '#475569',
                    background: '#F8F7F2',
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid #E2E0D8',
                    lineHeight: 1.4,
                    wordBreak: 'break-word'
                  }}>
                    <span style={{ fontWeight: 600, color: '#334155' }}>Not: </span>
                    {item.not_metni}
                  </div>
                )}

                {/* ALT SATIR: Tarih Bilgisi ve Aksiyon Butonları */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 6,
                  borderTop: '1px solid rgba(0,0,0,0.04)',
                  flexWrap: 'wrap',
                  gap: 6
                }}>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    <span>🗓 Vade: </span>
                    <strong style={{ color: '#334155' }}>{turkceTarihFormatla(item.vade_tarihi)}</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                    {/* Tekil WhatsApp Paylaş */}
                    <button
                      onClick={() => tekilWhatsAppPaylas(item)}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11.5,
                        background: '#DCFCE7',
                        color: '#15803D',
                        border: '1px solid #BBF7D0',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      title="Bu vaadi WhatsApp ile paylaş"
                    >
                      <span>💬 WhatsApp</span>
                    </button>

                    {/* Düzenle */}
                    {yonetici && (
                      <button
                        onClick={() => duzenlemeyiBaslat(item)}
                        style={{
                          padding: '3px 7px',
                          fontSize: 12,
                          background: '#f8f7f2',
                          color: '#475569',
                          border: '1px solid #D3D1C7',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                        title="Düzenle"
                      >
                        ✎
                      </button>
                    )}

                    {/* Sil */}
                    {yonetici && (
                      <button
                        onClick={() => vaatSil(item.id, item.baslik)}
                        style={{
                          padding: '3px 7px',
                          fontSize: 12,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                        title="Sil"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
