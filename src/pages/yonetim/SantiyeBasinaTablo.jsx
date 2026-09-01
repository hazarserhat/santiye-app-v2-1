import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { generateAndSharePDF } from '../../lib/pdfGenerator'

export default function SantiyeBasinaTablo({ baslik, tablo, alanlar }) {
  const { santiyeler } = useSite()
  const [kayitlar, setKayitlar] = useState({}) // { santiyeId: row }
  const [duzenlenenSantiyeId, setDuzenlenenSantiyeId] = useState(null)
  const [taslak, setTaslak] = useState({})
  const [seciliSantiyeler, setSeciliSantiyeler] = useState([])

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

  const santiyeSecToggle = (id) => {
    setSeciliSantiyeler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const pdfPaylas = async (sadeceSecilenler = false) => {
    const dataListesi = sadeceSecilenler ? santiyeler.filter(s => seciliSantiyeler.includes(s.id)) : santiyeler
    if (dataListesi.length === 0) return alert('PDF için şantiye bulunamadı.')

    const pdfBasliklar = ['Santiye Adi', ...alanlar.map(a => a.etiket)]
    const satirVerileri = dataListesi.map(s => {
      const kayit = kayitlar[s.id] || {}
      return [s.ad, ...alanlar.map(a => kayit[a.anahtar] || '-')]
    })

    await generateAndSharePDF({
      title: `${baslik} ${sadeceSecilenler ? '(Secilenler)' : ''}`,
      filename: `${tablo}.pdf`,
      columns: pdfBasliklar,
      data: satirVerileri
    })
  }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
          <h2>{baslik}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seciliSantiyeler.length > 0 && (
            <button 
              onClick={() => pdfPaylas(true)}
              style={{ background: '#F57F17', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📄 Seçilenleri Paylaş ({seciliSantiyeler.length})
            </button>
          )}
          <button 
            onClick={() => pdfPaylas(false)}
            style={{ background: '#2C3E50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Tüm Listeyi Paylaş (PDF)
          </button>
        </div>
      </div>

      <div className="liste">
        {santiyeler.map((s) => {
          const kayit = kayitlar[s.id]
          const duzenleniyor = duzenlenenSantiyeId === s.id
          return (
            <div key={s.id} className="kart" style={{ border: seciliSantiyeler.includes(s.id) ? '2px solid #F57F17' : '1px solid #D3D1C7' }}>
              <div className="kart-ust">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={seciliSantiyeler.includes(s.id)} onChange={() => santiyeSecToggle(s.id)} style={{ width: 18, height: 18, accentColor: '#F57F17' }} />
                  <span className="kart-baslik" style={{ margin: 0 }}>{s.ad}</span>
                </label>
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
