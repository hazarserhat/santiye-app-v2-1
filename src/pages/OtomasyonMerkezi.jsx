import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { uploadToGoogleDrive, getGoogleDriveInlineImageUrl, getGoogleDriveViewUrl } from '../lib/googleDrive'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from '../lib/operasyonKayit'
import {
  KEY_OTOMASYON_KUYRUK,
  KEY_ASISTAN_CHAT,
  HEDEF_MODUL_META,
  geminiAnahtariYukle,
  geminiAnahtariKaydet,
  asistanMesajAnalizEt,
  denetimKaydiniIsle,
} from '../lib/otomasyonEngine'
import {
  telegramAyarYukle,
  telegramAyarKaydet,
  telegramChatIdOtomatikBul,
  telegramMesajGonder,
  sabahRaporuOlustur,
  aksamRaporuOlustur,
} from '../lib/telegramServis'

const ORNEK_KOMUTLAR = [
  'Gökkuşağı Yapı\'nın telefon numarası neydi?',
  'Bu hafta vadesi gelen çek var mı?',
  'Dilek Erdoğan\'ın Yarısı Bizden bina numarası kaç?',
  'Erdoğan Gökmen şantiyesinde QNB karttan 3.200 TL nalbur gideri yaptık',
  'Ahmet Usta elektrikçi 0532 555 44 33 rehbere ekle',
  'Dilek Erdoğan 3 nolu malike Cuma\'ya kadar banyo seramiği sözü verdim',
]

const ALAN_ETIKETLERI = {
  baslik: 'Başlık',
  kisi: 'Kişi / Cari',
  tutar: 'Tutar (₺)',
  tarih: 'Tarih',
  santiyeAd: 'Şantiye',
  odemeYontemi: 'Ödeme Yöntemi',
  tahsilatNoktasi: 'Tahsilat Noktası',
  aciklama: 'Açıklama',
  ad: 'Ad',
  firma: 'Firma Adı',
  telefon: 'Telefon',
  hizmetAlani: 'Hizmet Alanı',
  adres: 'Adres',
  tur: 'Tür (soz / not)',
  kategori: 'Kategori',
  terminTarihi: 'Termin Tarihi',
  icerik: 'İçerik',
  oncelik: 'Öncelik',
  makineTuru: 'Makine Türü',
  calismaSaati: 'Çalışma Saati',
  toplamTutar: 'Toplam Tutar (₺)',
  cariAdi: 'Firma / Cari',
  adSoyad: 'Çalışan Ad Soyad',
  tcNo: 'T.C. Kimlik No',
  taseronAd: 'Taşeron',
  islemTuru: 'SGK İşlem (giris/cikis/aktif)',
  girisTarihi: 'Giriş Tarihi',
  cikisTarihi: 'Çıkış Tarihi',
  gosterilecekGun: 'Gösterilecek Gün',
  notMetni: 'Not',
  tip: 'Fatura Tipi (kesilecek/iade)',
  firmaAd: 'Firma Adı',
  vergiNo: 'Vergi No',
  kdvOrani: 'KDV Oranı (%)',
  kdvDurum: 'KDV (haric/dahil)',
  belgeTuru: 'Belge Türü',
  tedarikci: 'Tedarikçi',
  malzeme: 'Ürün / Malzeme',
  teslimAlan: 'Teslim Alan',
  binaNo: 'Yarısı Bizden Bina No',
}

export default function OtomasyonMerkezi() {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const baslangicSekme = searchParams.get('sekme')
  const [aktifSekme, setAktifSekme] = useState(baslangicSekme === 'denetim' ? 'denetim' : 'chat')

  const [mesajlar, setMesajlar] = useState([])
  const [kuyruk, setKuyruk] = useState([])
  const [girdi, setGirdi] = useState('')
  const [seciliDosya, setSeciliDosya] = useState(null)
  const [seciliOnizleme, setSeciliOnizleme] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const [denetimFiltre, setDenetimFiltre] = useState('bekliyor') // 'bekliyor' | 'onaylandi' | 'reddedildi'
  const [islenenId, setIslenenId] = useState(null)
  const [onizlemeUrl, setOnizlemeUrl] = useState(null)

  // AI Anahtar Ayarları Modalı
  const [ayarAcik, setAyarAcik] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyVar, setApiKeyVar] = useState(false)
  const [ayarKaydedildi, setAyarKaydedildi] = useState(false)

  // Telegram Bot Ayar & Rapor Modalı
  const [tgAcik, setTgAcik] = useState(false)
  const [tgAyar, setTgAyar] = useState({ botToken: '', chatId: '', yeniTaslakBildir: true })
  const [tgDurumMesaj, setTgDurumMesaj] = useState('')
  const [tgIslemde, setTgIslemde] = useState(false)

  const chatSonRef = useRef(null)

  const sekmeDegistir = (yeni) => {
    setAktifSekme(yeni)
    setSearchParams({ sekme: yeni }, { replace: true })
  }

  useEffect(() => {
    const p = searchParams.get('sekme')
    if (p === 'chat' || p === 'denetim') setAktifSekme(p)
  }, [searchParams])

  useEffect(() => {
    const yukle = async () => {
      const [mList, kList, key, tg] = await Promise.all([
        operasyonVerisiYukle(KEY_ASISTAN_CHAT, []),
        operasyonVerisiYukle(KEY_OTOMASYON_KUYRUK, []),
        geminiAnahtariYukle(),
        telegramAyarYukle(),
      ])
      setMesajlar(Array.isArray(mList) ? mList : [])
      setKuyruk(Array.isArray(kList) ? kList : [])
      setApiKeyInput(key || '')
      setApiKeyVar(Boolean(key))
      setTgAyar(tg)
    }
    yukle()
  }, [])

  useEffect(() => {
    if (aktifSekme === 'chat') {
      chatSonRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [mesajlar, aktifSekme])

  const dosyaSec = (file) => {
    if (!file) return
    setSeciliDosya(file)
    if (file.type?.startsWith('image/')) {
      setSeciliOnizleme(URL.createObjectURL(file))
    } else {
      setSeciliOnizleme('')
    }
  }

  const dosyaTemizle = () => {
    if (seciliOnizleme) URL.revokeObjectURL(seciliOnizleme)
    setSeciliDosya(null)
    setSeciliOnizleme('')
  }

  const panodanYapistir = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'))
        if (imgType) {
          const blob = await item.getType(imgType)
          const file = new File([blob], `pano_${Date.now()}.png`, { type: imgType })
          dosyaSec(file)
          return
        }
      }
      alert('Panoda kopyalanmış bir görsel bulunamadı.')
    } catch {
      alert('Tarayıcı pano erişimine izin vermedi. Ctrl+V ile doğrudan yapıştırabilirsiniz.')
    }
  }

  const mesajGonder = async (e, hazirMetin = null) => {
    if (e) e.preventDefault()
    const metin = (hazirMetin !== null ? hazirMetin : girdi).trim()
    if (!metin && !seciliDosya) return
    if (gonderiliyor) return

    setGonderiliyor(true)
    const dosyaKopya = seciliDosya
    setGirdi('')
    dosyaTemizle()

    let belgeUrl = ''
    try {
      if (dosyaKopya) {
        const driveRes = await uploadToGoogleDrive({
          file: dosyaKopya,
          folderName: `AsistanChat/${new Date().toISOString().slice(0, 10)}`,
          adSoyad: profile?.ad_soyad || 'Asistan',
          date: new Date().toISOString().slice(0, 10),
        })
        belgeUrl = driveRes?.url || ''
      }

      const kullaniciMesaji = {
        id: `msg-u-${Date.now()}`,
        rol: 'kullanici',
        metin: metin || '(Belge / Görsel gönderildi)',
        belgeUrl,
        tarih: new Date().toISOString(),
      }
      const yeniMesajlar1 = [...mesajlar, kullaniciMesaji].slice(-60)
      setMesajlar(yeniMesajlar1)
      await operasyonVerisiKaydet(KEY_ASISTAN_CHAT, yeniMesajlar1)

      const sonuc = await asistanMesajAnalizEt({
        metin,
        dosya: dosyaKopya,
        belgeUrl,
        santiyeler,
      })

      if (sonuc.taslaklar?.length > 0) {
        const guncelKuyruk = [...sonuc.taslaklar, ...kuyruk]
        setKuyruk(guncelKuyruk)
        await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncelKuyruk)

        // Telegram bağlıysa yeni taslağı anında bildir
        if (tgAyar.botToken && tgAyar.chatId && tgAyar.yeniTaslakBildir) {
          for (const t of sonuc.taslaklar) {
            const meta = HEDEF_MODUL_META[t.hedefModul] || HEDEF_MODUL_META.soz_not
            telegramMesajGonder({
              botToken: tgAyar.botToken,
              chatId: tgAyar.chatId,
              metin: `🛡️ <b>Yeni Otomasyon Denetim Taslağı</b>\n• Hedef: <b>${meta.ikon} ${meta.etiket}</b>\n• Özet: ${t.ozet}`,
            }).catch(() => {})
          }
        }
      }

      const asistanMesaji = {
        id: `msg-a-${Date.now()}`,
        rol: 'asistan',
        metin: sonuc.cevap,
        taslakSayisi: sonuc.taslaklar?.length || 0,
        tarih: new Date().toISOString(),
      }
      const yeniMesajlar2 = [...yeniMesajlar1, asistanMesaji].slice(-60)
      setMesajlar(yeniMesajlar2)
      await operasyonVerisiKaydet(KEY_ASISTAN_CHAT, yeniMesajlar2)

      if (sonuc.mod === 'anahtar_yok') {
        setAyarAcik(true)
      }
    } catch (err) {
      const hataMesaji = {
        id: `msg-e-${Date.now()}`,
        rol: 'asistan',
        metin: `⚠️ İşlem sırasında hata oluştu: ${err.message || err}`,
        tarih: new Date().toISOString(),
      }
      const guncel = [...mesajlar, hataMesaji].slice(-60)
      setMesajlar(guncel)
      await operasyonVerisiKaydet(KEY_ASISTAN_CHAT, guncel)
    } finally {
      setGonderiliyor(false)
    }
  }

  const taslakAlaniGuncelle = async (id, alan, deger) => {
    const guncel = kuyruk.map((k) =>
      k.id === id ? { ...k, veri: { ...(k.veri || {}), [alan]: deger } } : k
    )
    setKuyruk(guncel)
    await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncel)
  }

  const taslakHedefDegistir = async (id, yeniHedef) => {
    const guncel = kuyruk.map((k) => (k.id === id ? { ...k, hedefModul: yeniHedef } : k))
    setKuyruk(guncel)
    await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncel)
  }

  const taslakOnayla = async (kayit) => {
    setIslenenId(kayit.id)
    try {
      const sonuc = await denetimKaydiniIsle(kayit, { santiyeler, profile })
      const guncel = kuyruk.map((k) =>
        k.id === kayit.id
          ? {
              ...k,
              durum: 'onaylandi',
              onaylayan: profile?.ad_soyad || 'Serhat Hazar',
              onayTarihi: new Date().toISOString(),
              sonucMesaj: sonuc.mesaj,
              islenenKayitId: sonuc.kayitId || '',
            }
          : k
      )
      setKuyruk(guncel)
      await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncel)
    } catch (err) {
      alert('Kayıt işlenemedi: ' + (err.message || err))
    } finally {
      setIslenenId(null)
    }
  }

  const taslakReddet = async (id) => {
    const guncel = kuyruk.map((k) =>
      k.id === id ? { ...k, durum: 'reddedildi', onayTarihi: new Date().toISOString() } : k
    )
    setKuyruk(guncel)
    await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncel)
  }

  const taslakSil = async (id) => {
    const guncel = kuyruk.filter((k) => k.id !== id)
    setKuyruk(guncel)
    await operasyonVerisiKaydet(KEY_OTOMASYON_KUYRUK, guncel)
  }

  const bekleyenSayisi = kuyruk.filter((k) => k.durum === 'bekliyor').length
  const onaylananSayisi = kuyruk.filter((k) => k.durum === 'onaylandi').length
  const reddedilenSayisi = kuyruk.filter((k) => k.durum === 'reddedildi').length

  const filtreliKuyruk = useMemo(() => {
    return kuyruk.filter((k) => k.durum === denetimFiltre)
  }, [kuyruk, denetimFiltre])

  return (
    <div className="sayfa" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 96 }}>
      {/* ÜST BAŞLIK */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
            🤖 Asistan &amp; Otomasyon Denetim
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748B' }}>
            Fiş, kartvizit, kimlik, söz veya soru paylaşın — ajan hazırlasın, siz onaylayınca ilgili modüle işlensin.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setTgAcik(true); setTgDurumMesaj('') }}
            style={{
              padding: '8px 13px',
              borderRadius: 10,
              border: tgAyar.botToken && tgAyar.chatId ? '1px solid #BAE6FD' : '1px solid #CBD5E1',
              background: tgAyar.botToken && tgAyar.chatId ? '#E0F2FE' : '#FFFFFF',
              color: tgAyar.botToken && tgAyar.chatId ? '#0369A1' : '#334155',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {tgAyar.botToken && tgAyar.chatId ? '✈️ Telegram Bağlı' : '✈️ Telegram Bağla'}
          </button>

          <button
            type="button"
            onClick={() => setAyarAcik(true)}
            style={{
              padding: '8px 13px',
              borderRadius: 10,
              border: apiKeyVar ? '1px solid #A7F3D0' : '1.5px solid #F59E0B',
              background: apiKeyVar ? '#ECFDF5' : '#FFFBEB',
              color: apiKeyVar ? '#047857' : '#B45309',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {apiKeyVar ? '🔑 AI Bağlı (Ayarlar)' : '🔑 AI Anahtarı Gir'}
          </button>
        </div>
      </div>

      {/* 2 ANA SEKME */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => sekmeDegistir('chat')}
          style={{
            padding: '11px 12px',
            borderRadius: 12,
            border: aktifSekme === 'chat' ? '1.5px solid #0F766E' : '1px solid #E2E8F0',
            background: aktifSekme === 'chat' ? '#F0FDFA' : '#FFFFFF',
            color: aktifSekme === 'chat' ? '#0F766E' : '#475569',
            fontWeight: 800,
            fontSize: 13.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>💬</span>
          <span>Asistan Chat</span>
        </button>

        <button
          type="button"
          onClick={() => sekmeDegistir('denetim')}
          style={{
            padding: '11px 12px',
            borderRadius: 12,
            border: aktifSekme === 'denetim' ? '1.5px solid #B45309' : '1px solid #E2E8F0',
            background: aktifSekme === 'denetim' ? '#FFFBEB' : '#FFFFFF',
            color: aktifSekme === 'denetim' ? '#B45309' : '#475569',
            fontWeight: 800,
            fontSize: 13.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>🛡️</span>
          <span>Otomasyon Denetim</span>
          {bekleyenSayisi > 0 && (
            <span style={{ fontSize: 11, background: '#DC2626', color: '#FFFFFF', borderRadius: 999, padding: '1px 7px' }}>
              {bekleyenSayisi}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* SEKME 1: ASİSTAN CHAT                                     */}
      {/* ========================================================= */}
      {aktifSekme === 'chat' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 520 }}>
          {/* Mesaj Alanı */}
          <div style={{ flex: 1, padding: 14, overflowY: 'auto', maxHeight: '58vh', display: 'flex', flexDirection: 'column', gap: 10, background: '#F8FAFC' }}>
            {mesajlar.length === 0 && (
              <div style={{ textAlign: 'center', padding: '22px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 34 }}>🤖</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                  Şantiye Asistanınız Hazır!
                </div>
                <div style={{ fontSize: 12.5, color: '#64748B', maxWidth: 460 }}>
                  Fiş, fatura, kartvizit, kimlik fotoğrafı veya metin paylaşın; hangi modüle nasıl işleneceğini hazırlayıp <strong>Otomasyon Denetim</strong>&apos;e göndereyim. Veya doğrudan soru sorun!
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                  {ORNEK_KOMUTLAR.map((ornek, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => mesajGonder(null, ornek)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#334155',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✨ {ornek}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mesajlar.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.rol === 'kullanici' ? 'flex-end' : 'flex-start',
                  maxWidth: '86%',
                  background: m.rol === 'kullanici' ? '#0F766E' : '#FFFFFF',
                  color: m.rol === 'kullanici' ? '#FFFFFF' : '#0F172A',
                  border: m.rol === 'kullanici' ? 'none' : '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '10px 13px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 4px rgba(15,23,42,0.05)',
                }}
              >
                {m.belgeUrl && (
                  <div style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => setOnizlemeUrl(m.belgeUrl)}
                      style={{ padding: '4px 9px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      📎 Ekli Görseli Gör
                    </button>
                  </div>
                )}
                <div>{m.metin}</div>
                {m.taslakSayisi > 0 && (
                  <button
                    type="button"
                    onClick={() => sekmeDegistir('denetim')}
                    style={{
                      marginTop: 8,
                      padding: '6px 11px',
                      borderRadius: 8,
                      border: '1px solid #F59E0B',
                      background: '#FFFBEB',
                      color: '#B45309',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    🛡️ Otomasyon Denetim&apos;de Onayla ({m.taslakSayisi}) →
                  </button>
                )}
              </div>
            ))}

            {gonderiliyor && (
              <div style={{ alignSelf: 'flex-start', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: '10px 14px', fontSize: 13, color: '#64748B', fontWeight: 600 }}>
                ⏳ Ajan analiz ediyor...
              </div>
            )}
            <div ref={chatSonRef} />
          </div>

          {/* Alt Giriş Barı */}
          <form
            onSubmit={mesajGonder}
            onPaste={(e) => {
              const items = e.clipboardData?.items
              if (!items) return
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  const file = item.getAsFile()
                  if (file) dosyaSec(new File([file], `pano_${Date.now()}.png`, { type: file.type }))
                  break
                }
              }
            }}
            style={{ padding: 12, borderTop: '1px solid #E2E8F0', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {seciliDosya && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 10, padding: '6px 10px' }}>
                {seciliOnizleme && <img src={seciliOnizleme} alt="Önizleme" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0F766E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📎 {seciliDosya.name}
                </span>
                <button type="button" onClick={dosyaTemizle} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 800, cursor: 'pointer' }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <label
                title="Fotoğraf, fiş, kartvizit veya kimlik ekle"
                style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
              >
                📷
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => { dosyaSec(e.target.files?.[0]); e.target.value = '' }} />
              </label>

              <button
                type="button"
                onClick={panodanYapistir}
                title="Panodaki görseli yapıştır"
                style={{ padding: '9px 11px', borderRadius: 10, border: '1px solid #BFDBFE', background: '#EFF6FF', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
              >
                📋
              </button>

              <input
                type="text"
                placeholder="Gider, söz, kartvizit, SGK bildirimi yazın veya soru sorun..."
                value={girdi}
                onChange={(e) => setGirdi(e.target.value)}
                disabled={gonderiliyor}
                style={{ flex: 1, minWidth: 160 }}
              />

              <button
                type="submit"
                disabled={gonderiliyor || (!girdi.trim() && !seciliDosya)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0F766E',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: gonderiliyor || (!girdi.trim() && !seciliDosya) ? 0.55 : 1,
                }}
              >
                Gönder ➤
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* SEKME 2: OTOMASYON DENETİM (ONAY MERKEZİ)                 */}
      {/* ========================================================= */}
      {aktifSekme === 'denetim' && (
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { id: 'bekliyor', ad: `⏳ Onay Bekleyen (${bekleyenSayisi})` },
              { id: 'onaylandi', ad: `✅ Onaylanan (${onaylananSayisi})` },
              { id: 'reddedildi', ad: `❌ Reddedilen (${reddedilenSayisi})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDenetimFiltre(f.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 999,
                  border: denetimFiltre === f.id ? '1.5px solid #0F172A' : '1px solid #CBD5E1',
                  background: denetimFiltre === f.id ? '#0F172A' : '#FFFFFF',
                  color: denetimFiltre === f.id ? '#FFFFFF' : '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {f.ad}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtreliKuyruk.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                {denetimFiltre === 'bekliyor'
                  ? 'Onay bekleyen işlem yok. Asistan Chat sekmesinden fiş, kartvizit veya not gönderdiğinizde burada birikir.'
                  : 'Bu sekmede kayıt bulunmuyor.'}
              </div>
            ) : filtreliKuyruk.map((k) => {
              const meta = HEDEF_MODUL_META[k.hedefModul] || HEDEF_MODUL_META.soz_not
              const alanlar = Object.entries(k.veri || {})
              return (
                <div
                  key={k.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderLeft: `4px solid ${meta.renk}`,
                    borderRadius: 14,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Üst: Nereye İşlenecek Rozeti */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: meta.bg, color: meta.renk, border: `1px solid ${meta.border}` }}>
                        {meta.ikon} Nereye: {meta.etiket}
                      </span>
                      {k.durum === 'bekliyor' && (
                        <select
                          value={k.hedefModul}
                          onChange={(e) => taslakHedefDegistir(k.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 11.5, borderRadius: 8 }}
                          title="Hedef modülü değiştir"
                        >
                          {Object.entries(HEDEF_MODUL_META).map(([key, m]) => (
                            <option key={key} value={key}>{m.ikon} {m.etiket}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                      Güven: %{k.guven || 90}
                    </span>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                    {k.ozet}
                  </div>

                  {/* Düzenlenebilir Alanlar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 10 }}>
                    {alanlar.map(([alanKey, alanVal]) => (
                      <div key={alanKey}>
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>
                          {ALAN_ETIKETLERI[alanKey] || alanKey}
                        </label>
                        {k.durum === 'bekliyor' ? (
                          <input
                            type="text"
                            value={alanVal ?? ''}
                            onChange={(e) => taslakAlaniGuncelle(k.id, alanKey, e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', fontSize: 12.5, boxSizing: 'border-box' }}
                          />
                        ) : (
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{String(alanVal ?? '—')}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Orijinal Mesaj & Ekli Görsel */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: '#64748B' }}>
                    <span>💬 Kaynak: &ldquo;{k.orijinalMesaj}&rdquo;</span>
                    {k.belgeUrl && (
                      <button
                        type="button"
                        onClick={() => setOnizlemeUrl(k.belgeUrl)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #BAE6FD', background: '#E0F2FE', color: '#0369A1', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        📎 Ekli Belgeyi Gör
                      </button>
                    )}
                  </div>

                  {k.sonucMesaj && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '6px 10px' }}>
                      ✅ {k.sonucMesaj}
                    </div>
                  )}

                  {/* Onay / Reddet Butonları */}
                  {k.durum === 'bekliyor' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                      <button
                        type="button"
                        disabled={islenenId === k.id}
                        onClick={() => taslakOnayla(k)}
                        style={{
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#059669',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {islenenId === k.id ? '⏳ İşleniyor...' : '✅ Onayla ve Modüle İşle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => taslakReddet(k.id)}
                        style={{
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: '1px solid #FECDD3',
                          background: '#FFF1F2',
                          color: '#BE123C',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        ❌ Reddet
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => taslakSil(k.id)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 11.5, cursor: 'pointer' }}>
                        🗑️ Listeden Kaldır
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TELEGRAM BOT & RAPOR AYAR MODALI */}
      {tgAcik && (
        <div onClick={() => setTgAcik(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, maxWidth: 510, width: '100%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16, color: '#0F172A' }}>✈️ Telegram Bot &amp; Günlük Raporlar (07:00 / 18:30)</strong>
              <button type="button" onClick={() => setTgAcik(false)} style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: 12.5, color: '#334155', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: 12, lineHeight: 1.55 }}>
              <strong>Sadece size özel Telegram botu nasıl açılır? (1 dakika)</strong>
              <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                <li>Telegram&apos;da <strong>@BotFather</strong> hesabını açın ve <code>/newbot</code> yazın.</li>
                <li>Botunuza bir isim verin (ör. <em>Santiye Asistanim</em>) ve size verdiği <strong>Token</strong>&apos;ı aşağıya yapıştırın.</li>
                <li>Yeni açtığınız botunuza girip <strong>Başlat (/start)</strong> veya <em>&ldquo;Merhaba&rdquo;</em> yazın, sonra aşağıdaki <strong>Chat ID&apos;mi Otomatik Bul</strong> butonuna basın.</li>
              </ol>
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bot Token</label>
              <input
                type="password"
                placeholder="123456789:AAF..."
                value={tgAyar.botToken}
                onChange={(e) => setTgAyar((p) => ({ ...p, botToken: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Sizin Telegram Chat ID&apos;niz</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Otomatik bulmak için sağdaki butona basın"
                  value={tgAyar.chatId}
                  onChange={(e) => setTgAyar((p) => ({ ...p, chatId: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  disabled={tgIslemde}
                  onClick={async () => {
                    setTgIslemde(true)
                    setTgDurumMesaj('')
                    try {
                      const bulunan = await telegramChatIdOtomatikBul(tgAyar.botToken)
                      const yeni = await telegramAyarKaydet({ ...tgAyar, chatId: bulunan.chatId })
                      setTgAyar(yeni)
                      setTgDurumMesaj(`✅ Chat ID bulundu ve kaydedildi: ${bulunan.chatId} (${bulunan.ad})`)
                    } catch (err) {
                      setTgDurumMesaj(`⚠️ ${err.message || err}`)
                    } finally {
                      setTgIslemde(false)
                    }
                  }}
                  style={{ padding: '8px 11px', borderRadius: 9, border: '1px solid #0284C7', background: '#E0F2FE', color: '#0369A1', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  🔍 Chat ID Bul
                </button>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tgAyar.yeniTaslakBildir}
                onChange={(e) => setTgAyar((p) => ({ ...p, yeniTaslakBildir: e.target.checked }))}
              />
              Yeni Denetim Taslağı oluştuğunda Telegram&apos;a da bildirim gönder
            </label>

            {/* Anında Rapor Test Butonları */}
            {tgAyar.botToken && tgAyar.chatId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  disabled={tgIslemde}
                  onClick={async () => {
                    setTgIslemde(true)
                    setTgDurumMesaj('⏳ Sabah raporu hazırlanıyor...')
                    try {
                      const metin = await sabahRaporuOlustur(santiyeler)
                      await telegramMesajGonder({ botToken: tgAyar.botToken, chatId: tgAyar.chatId, metin })
                      setTgDurumMesaj('✅ Sabah 07:00 raporu Telegram\'ınıza gönderildi!')
                    } catch (err) {
                      setTgDurumMesaj(`⚠️ ${err.message || err}`)
                    } finally {
                      setTgIslemde(false)
                    }
                  }}
                  style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  🌅 Sabah Raporu Gönder (Test)
                </button>
                <button
                  type="button"
                  disabled={tgIslemde}
                  onClick={async () => {
                    setTgIslemde(true)
                    setTgDurumMesaj('⏳ Akşam raporu hazırlanıyor...')
                    try {
                      const metin = await aksamRaporuOlustur(santiyeler)
                      await telegramMesajGonder({ botToken: tgAyar.botToken, chatId: tgAyar.chatId, metin })
                      setTgDurumMesaj('✅ Akşam 18:30 raporu Telegram\'ınıza gönderildi!')
                    } catch (err) {
                      setTgDurumMesaj(`⚠️ ${err.message || err}`)
                    } finally {
                      setTgIslemde(false)
                    }
                  }}
                  style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#4338CA', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  🌙 Akşam Raporu Gönder (Test)
                </button>
              </div>
            )}

            {tgDurumMesaj && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: tgDurumMesaj.startsWith('✅') ? '#047857' : '#B45309', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '8px 10px' }}>
                {tgDurumMesaj}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setTgAcik(false)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Kapat
              </button>
              <button
                type="button"
                disabled={tgIslemde}
                onClick={async () => {
                  const kayitli = await telegramAyarKaydet(tgAyar)
                  setTgAyar(kayitli)
                  setTgDurumMesaj('✅ Telegram ayarları kaydedildi!')
                }}
                style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#0284C7', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GEMİNİ API ANAHTARI AYAR MODALI */}
      {ayarAcik && (
        <div onClick={() => setAyarAcik(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16, color: '#0F172A' }}>🔑 Yapay Zeka (Gemini) Bağlantısı</strong>
              <button type="button" onClick={() => setAyarAcik(false)} style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: 12.5, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, lineHeight: 1.55 }}>
              <strong>Ücretsiz anahtar nasıl alınır? (1 dakika)</strong>
              <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#0F766E', fontWeight: 700 }}>aistudio.google.com/apikey</a> sayfasına Google hesabınızla girin.</li>
                <li><strong>&ldquo;Create API key&rdquo;</strong> butonuna tıklayın.</li>
                <li>Oluşan anahtarı kopyalayıp aşağıya yapıştırın ve Kaydet&apos;e basın.</li>
              </ol>
            </div>

            <input
              type="password"
              placeholder="AIzaSy... şeklinde başlayan anahtarı yapıştırın"
              value={apiKeyInput}
              onChange={(e) => { setApiKeyInput(e.target.value); setAyarKaydedildi(false) }}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />

            {ayarKaydedildi && (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#047857' }}>
                ✅ Kaydedildi! Artık hem bilgisayarda hem telefonda Asistan Chat aktif.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setAyarAcik(false)} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}>
                Kapat
              </button>
              <button
                type="button"
                onClick={async () => {
                  await geminiAnahtariKaydet(apiKeyInput)
                  setApiKeyVar(Boolean(apiKeyInput.trim()))
                  setAyarKaydedildi(true)
                }}
                style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#0F766E', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BELGE ÖNİZLEME MODALI */}
      {onizlemeUrl && (
        <div onClick={() => setOnizlemeUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.78)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '82vh', background: '#FFFFFF', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <img src={getGoogleDriveInlineImageUrl(onizlemeUrl)} alt="Belge" style={{ maxWidth: '88vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <a href={getGoogleDriveViewUrl(onizlemeUrl)} target="_blank" rel="noreferrer" style={{ padding: '7px 12px', borderRadius: 8, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>
                ☁️ Drive&apos;da Aç
              </a>
              <button type="button" onClick={() => setOnizlemeUrl(null)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#0F172A', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
