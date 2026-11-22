import { useEffect, useMemo, useState } from 'react'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { operasyonVerisiYukle, operasyonVerisiKaydet } from '../lib/operasyonKayit'

export const KEY_VERILEN_SOZLER = 'gorevler_sozler_notlar_v1'

const bugun = () => new Date().toISOString().slice(0, 10)

const tarihTR = (str) => {
  if (!str) return ''
  const parts = String(str).slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : str
}

export default function VerilenSozlerPanel({ onSayiDegisti }) {
  const { santiyeler, aktifSantiye } = useSite()
  const { profile } = useAuth()

  const [kayitlar, setKayitlar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [filtreTur, setFiltreTur] = useState('hepsi') // 'hepsi' | 'soz' | 'not'
  const [filtreDurum, setFiltreDurum] = useState('acik') // 'acik' | 'tamamlandi' | 'hepsi'
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [arama, setArama] = useState('')

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [form, setForm] = useState({
    tur: 'soz', // 'soz' | 'not'
    kategori: 'Malik', // 'Malik' | 'Taşeron' | 'Ödeme' | 'Genel'
    kisi: '',
    santiyeId: '',
    terminTarihi: '',
    icerik: '',
  })

  useEffect(() => {
    if (aktifSantiye?.id) {
      setForm((p) => (p.santiyeId ? p : { ...p, santiyeId: aktifSantiye.id }))
    }
  }, [aktifSantiye])

  useEffect(() => {
    let iptal = false
    const yukle = async () => {
      setYukleniyor(true)
      const data = await operasyonVerisiYukle(KEY_VERILEN_SOZLER, [])
      if (!iptal) {
        const list = Array.isArray(data) ? data : []
        setKayitlar(list)
        if (onSayiDegisti) onSayiDegisti(list.filter((x) => !x.tamamlandi).length)
        setYukleniyor(false)
      }
    }
    yukle()
    return () => { iptal = true }
  }, [])

  const kaydetVeBildir = async (yeniListe) => {
    setKayitlar(yeniListe)
    if (onSayiDegisti) onSayiDegisti(yeniListe.filter((x) => !x.tamamlandi).length)
    await operasyonVerisiKaydet(KEY_VERILEN_SOZLER, yeniListe)
  }

  const santiyeAdiBul = (id) => santiyeler.find((s) => s.id === id)?.ad || 'Genel'

  const handleKaydet = async (e) => {
    e.preventDefault()
    if (!form.icerik.trim()) return

    const mevcut = duzenlenenId ? kayitlar.find((k) => k.id === duzenlenenId) : null
    const yeni = {
      id: duzenlenenId || `soz-${Date.now()}`,
      tur: form.tur,
      kategori: form.kategori,
      kisi: form.kisi.trim(),
      santiyeId: form.santiyeId || '',
      santiyeAd: form.santiyeId ? santiyeAdiBul(form.santiyeId) : 'Genel',
      terminTarihi: form.terminTarihi || '',
      icerik: form.icerik.trim(),
      tamamlandi: mevcut?.tamamlandi || false,
      ekleyen: mevcut?.ekleyen || profile?.ad_soyad || 'Yönetici',
      olusturmaTarihi: mevcut?.olusturmaTarihi || new Date().toISOString(),
      tamamlanmaTarihi: mevcut?.tamamlanmaTarihi || '',
    }

    const guncel = duzenlenenId
      ? kayitlar.map((k) => (k.id === duzenlenenId ? yeni : k))
      : [yeni, ...kayitlar]

    await kaydetVeBildir(guncel)
    setDuzenlenenId(null)
    setForm({
      tur: form.tur,
      kategori: form.kategori,
      kisi: '',
      santiyeId: aktifSantiye?.id || '',
      terminTarihi: '',
      icerik: '',
    })
  }

  const toggleTamamla = async (id) => {
    const guncel = kayitlar.map((k) =>
      k.id === id
        ? {
            ...k,
            tamamlandi: !k.tamamlandi,
            tamamlanmaTarihi: !k.tamamlandi ? new Date().toISOString() : '',
          }
        : k
    )
    await kaydetVeBildir(guncel)
  }

  const handleSil = async (id) => {
    if (!window.confirm('Bu söz / not kaydını silmek istiyor musunuz?')) return
    const guncel = kayitlar.filter((k) => k.id !== id)
    await kaydetVeBildir(guncel)
  }

  const filtrelenmis = useMemo(() => {
    return kayitlar.filter((k) => {
      if (filtreTur !== 'hepsi' && k.tur !== filtreTur) return false
      if (filtreDurum === 'acik' && k.tamamlandi) return false
      if (filtreDurum === 'tamamlandi' && !k.tamamlandi) return false
      if (filtreSantiye !== 'hepsi' && k.santiyeId !== filtreSantiye) return false
      if (arama.trim()) {
        const q = arama.toLocaleLowerCase('tr-TR')
        const m = `${k.icerik} ${k.kisi} ${k.santiyeAd} ${k.kategori}`.toLocaleLowerCase('tr-TR')
        if (!m.includes(q)) return false
      }
      return true
    })
  }, [kayitlar, filtreTur, filtreDurum, filtreSantiye, arama])

  const acikSayi = kayitlar.filter((k) => !k.tamamlandi).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Hızlı Ekleme Formu */}
      <form
        onSubmit={handleKaydet}
        style={{
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#0F172A' }}>
            {duzenlenenId ? '✏️ Söz / Not Düzenle' : '🤝 Yeni Verilen Söz veya Günlük Not Ekle'}
          </strong>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, tur: 'soz' }))}
              style={{
                padding: '5px 11px',
                borderRadius: 8,
                border: form.tur === 'soz' ? '1.5px solid #B45309' : '1px solid #CBD5E1',
                background: form.tur === 'soz' ? '#FEF3C7' : '#F8FAFC',
                color: form.tur === 'soz' ? '#92400E' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🤝 Verilen Söz
            </button>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, tur: 'not' }))}
              style={{
                padding: '5px 11px',
                borderRadius: 8,
                border: form.tur === 'not' ? '1.5px solid #0284C7' : '1px solid #CBD5E1',
                background: form.tur === 'not' ? '#E0F2FE' : '#F8FAFC',
                color: form.tur === 'not' ? '#0369A1' : '#475569',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📝 Günlük Not
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <select value={form.santiyeId} onChange={(e) => setForm({ ...form, santiyeId: e.target.value })}>
            <option value="">🏗️ Genel / Şantiyesiz</option>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>

          <select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
            <option value="Malik">👤 Malik</option>
            <option value="Taşeron">👷 Taşeron</option>
            <option value="Ödeme">💳 Ödeme</option>
            <option value="Genel">📌 Genel</option>
          </select>

          <input
            type="text"
            placeholder="Kime? (Örn: 3 Nolu Malik Ahmet Bey)"
            value={form.kisi}
            onChange={(e) => setForm({ ...form, kisi: e.target.value })}
          />

          <input
            type="date"
            title="Termin / Hatırlatma Tarihi"
            value={form.terminTarihi}
            onChange={(e) => setForm({ ...form, terminTarihi: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder={form.tur === 'soz' ? 'Verilen sözü yazın (Örn: Cuma gününe kadar banyo seramiği bitecek)...' : 'Günlük notunuzu yazın...'}
            value={form.icerik}
            onChange={(e) => setForm({ ...form, icerik: e.target.value })}
            style={{ flex: 1, minWidth: 220 }}
            required
          />
          {duzenlenenId && (
            <button
              type="button"
              onClick={() => {
                setDuzenlenenId(null)
                setForm({ tur: 'soz', kategori: 'Malik', kisi: '', santiyeId: aktifSantiye?.id || '', terminTarihi: '', icerik: '' })
              }}
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, cursor: 'pointer' }}
            >
              Vazgeç
            </button>
          )}
          <button
            type="submit"
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: '#1D9596', color: '#FFFFFF', fontWeight: 800, cursor: 'pointer' }}
          >
            {duzenlenenId ? 'Güncelle' : '+ Kaydet'}
          </button>
        </div>
      </form>

      {/* Filtre Çubuğu */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { id: 'acik', ad: `⏳ Açık (${acikSayi})` },
            { id: 'tamamlandi', ad: `✅ Tamamlanan (${kayitlar.length - acikSayi})` },
            { id: 'hepsi', ad: `Tümü (${kayitlar.length})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltreDurum(f.id)}
              style={{
                padding: '5px 11px',
                borderRadius: 999,
                border: filtreDurum === f.id ? '1.5px solid #0F766E' : '1px solid #CBD5E1',
                background: filtreDurum === f.id ? '#0F766E' : '#FFFFFF',
                color: filtreDurum === f.id ? '#FFFFFF' : '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {f.ad}
            </button>
          ))}
        </div>

        <select value={filtreTur} onChange={(e) => setFiltreTur(e.target.value)} style={{ minWidth: 130 }}>
          <option value="hepsi">Tüm Türler</option>
          <option value="soz">🤝 Sadece Sözler</option>
          <option value="not">📝 Sadece Notlar</option>
        </select>

        <select value={filtreSantiye} onChange={(e) => setFiltreSantiye(e.target.value)} style={{ minWidth: 150 }}>
          <option value="hepsi">🏗️ Tüm Şantiyeler</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        <input
          type="text"
          placeholder="Söz veya notlarda ara..."
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />
      </div>

      {/* Liste */}
      {yukleniyor ? (
        <p className="bos-mesaj">Yükleniyor...</p>
      ) : filtrelenmis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 36, background: '#FFFFFF', borderRadius: 14, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
          Bu filtrede kayıtlı söz veya günlük not bulunmuyor.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrelenmis.map((k) => {
            const gecikti = !k.tamamlandi && k.terminTarihi && k.terminTarihi < bugun()
            return (
              <div
                key={k.id}
                style={{
                  background: k.tamamlandi ? '#F8FAFC' : '#FFFFFF',
                  opacity: k.tamamlandi ? 0.78 : 1,
                  border: '1px solid #E2E8F0',
                  borderLeft: `4px solid ${k.tamamlandi ? '#059669' : gecikti ? '#DC2626' : k.tur === 'soz' ? '#D97706' : '#0284C7'}`,
                  borderRadius: 13,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 7,
                      background: k.tur === 'soz' ? '#FEF3C7' : '#E0F2FE',
                      color: k.tur === 'soz' ? '#92400E' : '#0369A1',
                    }}>
                      {k.tur === 'soz' ? '🤝 VERİLEN SÖZ' : '📝 GÜNLÜK NOT'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: '#F1F5F9', color: '#334155' }}>
                      {k.kategori}
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 7, background: '#E6F9F0', color: '#0F6E56' }}>
                      🏗️ {k.santiyeAd || 'Genel'}
                    </span>
                    {k.terminTarihi && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 7,
                        background: gecikti ? '#FEE2E2' : '#F8FAFC',
                        color: gecikti ? '#B91C1C' : '#475569',
                        border: gecikti ? '1px solid #FECACA' : '1px solid #E2E8F0',
                      }}>
                        📅 Termin: {tarihTR(k.terminTarihi)} {gecikti ? '⚠️' : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleTamamla(k.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: k.tamamlandi ? '1px solid #059669' : '1px solid #CBD5E1',
                        background: k.tamamlandi ? '#059669' : '#FFFFFF',
                        color: k.tamamlandi ? '#FFFFFF' : '#334155',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {k.tamamlandi ? '✅ Tamamlandı' : '○ Tamamla'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDuzenlenenId(k.id)
                        setForm({
                          tur: k.tur || 'soz',
                          kategori: k.kategori || 'Malik',
                          kisi: k.kisi || '',
                          santiyeId: k.santiyeId || '',
                          terminTarihi: k.terminTarihi || '',
                          icerik: k.icerik || '',
                        })
                      }}
                      style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, cursor: 'pointer' }}
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSil(k.id)}
                      style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #FECDD3', background: '#FFF1F2', color: '#E11D48', fontSize: 12, cursor: 'pointer' }}
                      title="Sil"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', textDecoration: k.tamamlandi ? 'line-through' : 'none' }}>
                  {k.icerik}
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: '#64748B' }}>
                  {k.kisi && <span>👤 İlgili: <strong>{k.kisi}</strong></span>}
                  <span>✍️ {k.ekleyen} • {tarihTR(k.olusturmaTarihi)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
