import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'

export default function SantiyeBasinaTablo({ baslik, tablo, alanlar }) {
  const { santiyeler } = useSite()
  const [kayitlar, setKayitlar] = useState({}) // { santiyeId: row }
  const [duzenlenenSantiyeId, setDuzenlenenSantiyeId] = useState(null)
  const [taslak, setTaslak] = useState({})

  const yenile = async () => {
    const { data, error } = await supabase.from(tablo).select('*')
    if (error) { alert('Yüklenemedi: ' + error.message); return }
    const harita = {}
    ;(data || []).forEach((r) => { harita[r.santiye_id] = r })
    setKayitlar(harita)
  }

  useEffect(() => { yenile() }, [])

  const duzenlemeyiAc = (santiyeId) => {
    setDuzenlenenSantiyeId(santiyeId)
    setTaslak(kayitlar[santiyeId] || {})
  }

  const kaydet = async (santiyeId) => {
    const payload = { santiye_id: santiyeId, ...Object.fromEntries(alanlar.map((a) => [a.anahtar, taslak[a.anahtar] || null])) }
    const { error } = await supabase.from(tablo).upsert(payload, { onConflict: 'santiye_id' })
    if (error) { alert('Kaydedilemedi: ' + error.message); return }
    setDuzenlenenSantiyeId(null)
    yenile()
  }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>{baslik}</h2>

      <div className="liste">
        {santiyeler.map((s) => {
          const kayit = kayitlar[s.id]
          const duzenleniyor = duzenlenenSantiyeId === s.id
          return (
            <div key={s.id} className="kart">
              <div className="kart-ust">
                <span className="kart-baslik">{s.ad}</span>
                {!duzenleniyor && (
                  <button className="sil-buton" onClick={() => duzenlemeyiAc(s.id)} aria-label="Düzenle">✎</button>
                )}
              </div>

              {duzenleniyor ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {alanlar.map((a) => (
                    <input
                      key={a.anahtar}
                      type="text"
                      placeholder={a.etiket}
                      value={taslak[a.anahtar] || ''}
                      onChange={(e) => setTaslak((o) => ({ ...o, [a.anahtar]: e.target.value }))}
                    />
                  ))}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setDuzenlenenSantiyeId(null)} style={{ fontSize: 12 }}>Vazgeç</button>
                    <button onClick={() => kaydet(s.id)} style={{ fontSize: 12 }}>Kaydet</button>
                  </div>
                </div>
              ) : (
                <div className="bilgi-kutusu" style={{ marginTop: 8, marginBottom: 0 }}>
                  {alanlar.map((a) => (
                    <div key={a.anahtar} className="bilgi-satiri"><span>{a.etiket}</span><span>{kayit?.[a.anahtar] || '—'}</span></div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {santiyeler.length === 0 && <p className="bos-mesaj">Henüz şantiye yok.</p>}
      </div>
    </div>
  )
}
