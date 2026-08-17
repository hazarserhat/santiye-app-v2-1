import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'

const ASAMALAR = [
  { anahtar: 'asama1_odendi', yuzde: 0.30, etiket: '1. Aşama (%30)', aciklama: 'Kat İrtifakı Kurulunca' },
  { anahtar: 'asama2_odendi', yuzde: 0.30, etiket: '2. Aşama (%30)', aciklama: 'Kaba İnşaatın Bitiminde' },
  { anahtar: 'asama3_odendi', yuzde: 0.30, etiket: '3. Aşama (%30)', aciklama: 'Sıva ve İç Detayların Tamamlanınca' },
  { anahtar: 'asama4_odendi', yuzde: 0.10, etiket: '4. Aşama (%10)', aciklama: 'Yapı Kullanım İzin Belgesi Alınınca' },
]

export default function YarisiBizden() {
  const { santiyeler } = useSite()
  const [kayitlar, setKayitlar] = useState({}) // { santiyeId: row }
  const [devletDestegiHaritasi, setDevletDestegiHaritasi] = useState({}) // { santiyeId: toplam }

  const yenile = async () => {
    const { data, error } = await supabase.from('yarisi_bizden_odemeleri').select('*')
    if (error) { alert('Yüklenemedi: ' + error.message); return }
    const harita = {}
    ;(data || []).forEach((r) => { harita[r.santiye_id] = r })
    setKayitlar(harita)

    // Toplam tutar artık Proje Gelirleri'ndeki maliklerin "Devlet Desteği" alanından otomatik çekiliyor
    const { data: malikler, error: e2 } = await supabase.from('malikler').select('santiye_id, devlet_destegi')
    if (e2) { alert('Malik verileri yüklenemedi: ' + e2.message); return }
    const destekHarita = {}
    ;(malikler || []).forEach((m) => { destekHarita[m.santiye_id] = (destekHarita[m.santiye_id] || 0) + Number(m.devlet_destegi || 0) })
    setDevletDestegiHaritasi(destekHarita)
  }

  useEffect(() => { yenile() }, [])

  const satirGetirVeyaOlustur = async (santiyeId) => {
    if (kayitlar[santiyeId]) return kayitlar[santiyeId]
    const { data, error } = await supabase.from('yarisi_bizden_odemeleri').insert({ santiye_id: santiyeId }).select().single()
    if (error) { alert('Oluşturulamadı: ' + error.message); return null }
    setKayitlar((onceki) => ({ ...onceki, [santiyeId]: data }))
    return data
  }

  const basvuruGuncelle = async (santiyeId) => {
    const satir = await satirGetirVeyaOlustur(santiyeId)
    if (!satir) return
    const yeni = !satir.basvuru_durumu
    await supabase.from('yarisi_bizden_odemeleri').update({ basvuru_durumu: yeni }).eq('id', satir.id)
    setKayitlar((onceki) => ({ ...onceki, [santiyeId]: { ...onceki[santiyeId], basvuru_durumu: yeni } }))
  }

  const asamaTikle = async (santiyeId, asamaAnahtari) => {
    const satir = await satirGetirVeyaOlustur(santiyeId)
    if (!satir) return
    const yeni = !satir[asamaAnahtari]
    await supabase.from('yarisi_bizden_odemeleri').update({ [asamaAnahtari]: yeni }).eq('id', satir.id)
    setKayitlar((onceki) => ({ ...onceki, [santiyeId]: { ...onceki[santiyeId], [asamaAnahtari]: yeni } }))
  }

  // ---- Hesaplamalar (toplam tutar artık malik devlet desteklerinin toplamı) ----
  const toplamTutarBul = (santiyeId) => devletDestegiHaritasi[santiyeId] || 0

  const satirAlinan = (santiyeId, satir) => {
    const toplam = toplamTutarBul(santiyeId)
    return ASAMALAR.reduce((t, a) => t + (satir?.[a.anahtar] ? toplam * a.yuzde : 0), 0)
  }
  const satirBeklenen = (santiyeId, satir) => toplamTutarBul(santiyeId) - satirAlinan(santiyeId, satir)

  const toplamDevletDestegi = santiyeler.reduce((t, s) => t + toplamTutarBul(s.id), 0)
  const alinmisDestek = santiyeler.reduce((t, s) => t + satirAlinan(s.id, kayitlar[s.id]), 0)
  const beklenenBasvurulan = santiyeler.filter((s) => kayitlar[s.id]?.basvuru_durumu).reduce((t, s) => t + satirBeklenen(s.id, kayitlar[s.id]), 0)
  const tumBeklenen = santiyeler.reduce((t, s) => t + satirBeklenen(s.id, kayitlar[s.id]), 0)

  const hucreStil = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7', whiteSpace: 'nowrap' }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Yarısı Bizden Ödemeleri</h2>
      <p style={{ fontSize: 12, color: '#5F5E5A', marginTop: 0 }}>
        Toplam tutar, Proje Gelirleri sayfasındaki maliklerin "Devlet Desteği" alanlarının toplamından otomatik hesaplanır — buradan elle girilmez.
      </p>

      <div style={{ background: 'white', border: '1px solid #D3D1C7', borderRadius: 12, padding: 12, marginBottom: 14 }}>
        {ASAMALAR.map((a) => (
          <p key={a.anahtar} style={{ fontSize: 12, margin: '2px 0', color: '#5F5E5A' }}>
            <strong style={{ color: '#212124' }}>{a.etiket}</strong>: {a.aciklama}
          </p>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7', marginBottom: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, position: 'sticky', left: 0, background: 'white' }}>Şantiye</th>
              <th style={baslikStil}>Başvuru</th>
              <th style={baslikStil}>Toplam Tutar (otomatik)</th>
              {ASAMALAR.map((a) => <th key={a.anahtar} style={baslikStil}>{a.etiket}</th>)}
              <th style={baslikStil}>Alınan</th>
              <th style={baslikStil}>Beklenen</th>
            </tr>
          </thead>
          <tbody>
            {santiyeler.map((s) => {
              const satir = kayitlar[s.id]
              const toplam = toplamTutarBul(s.id)
              return (
                <tr key={s.id}>
                  <td style={{ ...hucreStil, position: 'sticky', left: 0, background: 'white', fontWeight: 700 }}>{s.ad}</td>
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <input type="checkbox" checked={satir?.basvuru_durumu || false} onChange={() => basvuruGuncelle(s.id)} style={{ width: 16, height: 16 }} />
                  </td>
                  <td style={hucreStil}>{paraFormatla(toplam)} ₺</td>
                  {ASAMALAR.map((a) => (
                    <td key={a.anahtar} style={{ ...hucreStil, textAlign: 'center' }}>
                      <input type="checkbox" checked={satir?.[a.anahtar] || false} onChange={() => asamaTikle(s.id, a.anahtar)} style={{ width: 16, height: 16, marginBottom: 4 }} />
                      <div style={{ fontSize: 11, color: '#5F5E5A' }}>{paraFormatla(toplam * a.yuzde)} ₺</div>
                    </td>
                  ))}
                  <td style={{ ...hucreStil, color: '#1D9596', fontWeight: 700 }}>{paraFormatla(satirAlinan(s.id, satir))} ₺</td>
                  <td style={hucreStil}>{paraFormatla(satirBeklenen(s.id, satir))} ₺</td>
                </tr>
              )
            })}
            {santiyeler.length === 0 && (
              <tr><td colSpan={8} style={hucreStil}>Henüz şantiye yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Toplam Devlet Desteği</p>
          <p className="ozet-tutar">{paraFormatla(toplamDevletDestegi)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Alınmış Devlet Desteği</p>
          <p className="ozet-tutar">{paraFormatla(alinmisDestek)} ₺</p>
        </div>
      </div>
      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Beklenen Devlet Desteği (Başvurulan)</p>
          <p className="ozet-tutar">{paraFormatla(beklenenBasvurulan)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Tüm Beklenen (Başvurulmamışlar Dahil)</p>
          <p className="ozet-tutar">{paraFormatla(tumBeklenen)} ₺</p>
        </div>
      </div>
    </div>
  )
}
