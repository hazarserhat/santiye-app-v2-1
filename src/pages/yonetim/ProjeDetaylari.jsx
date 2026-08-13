import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'

const ALANLAR = [
  { anahtar: 'daire', etiket: 'Daire' }, { anahtar: 'dukkan', etiket: 'Dükkan' },
  { anahtar: 'demir', etiket: 'Demir' }, { anahtar: 'beton', etiket: 'Beton' },
  { anahtar: 'kalip', etiket: 'Kalıp' }, { anahtar: 'tugla', etiket: 'Tuğla' },
  { anahtar: 'cati_m2', etiket: 'Çatı M2' }, { anahtar: 'kenet_m2', etiket: 'Kenet M2' },
  { anahtar: 'asansor', etiket: 'Asansör' }, { anahtar: 'siva_isleri', etiket: 'Sıva İşleri' },
  { anahtar: 'alci_isleri', etiket: 'Alçı İşleri' }, { anahtar: 'seramik', etiket: 'Seramik' },
  { anahtar: 'parke', etiket: 'Parke' }, { anahtar: 'dis_kapi', etiket: 'Dış Kapı' },
  { anahtar: 'daire_kapisi', etiket: 'Daire Kapısı' }, { anahtar: 'camsiz_kapi', etiket: 'Camsız Kapı' },
  { anahtar: 'camli_kapi', etiket: 'Camlı Kapı' }, { anahtar: 'dusa_kabin', etiket: 'Duşa Kabin' },
  { anahtar: 'denizlik', etiket: 'Denizlik' }, { anahtar: 'merdiven_mermer', etiket: 'Merdiven Mermer' },
  { anahtar: 'merdiven_kupeste', etiket: 'Merdiven Küpeşte' }, { anahtar: 'dis_kupeste', etiket: 'Dış Küpeşte' },
  { anahtar: 'hidrofor', etiket: 'Hidrofor' }, { anahtar: 'su_deposu_ton', etiket: 'Su Deposu (Ton)' },
  { anahtar: 'jenerator', etiket: 'Jeneratör' }, { anahtar: 'kombi', etiket: 'Kombi' },
  { anahtar: 'klima', etiket: 'Klima' }, { anahtar: 'ankastre', etiket: 'Ankastre' },
  { anahtar: 'bina_aydinlatma_led', etiket: 'Bina Aydınlatma Led (m/tül)' }, { anahtar: 'tabela_sayisi', etiket: 'Tabela Sayısı' },
]

export default function ProjeDetaylari() {
  const { santiyeler } = useSite()
  const [kayitlar, setKayitlar] = useState({}) // { santiyeId: row }
  const [duzenlenenSantiyeId, setDuzenlenenSantiyeId] = useState('')
  const [taslak, setTaslak] = useState({})

  const yenile = async () => {
    const { data, error } = await supabase.from('proje_detaylari').select('*')
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

  const kaydet = async () => {
    const payload = { santiye_id: duzenlenenSantiyeId, ...Object.fromEntries(ALANLAR.map((a) => [a.anahtar, taslak[a.anahtar] || null])) }
    const { error } = await supabase.from('proje_detaylari').upsert(payload, { onConflict: 'santiye_id' })
    if (error) { alert('Kaydedilemedi: ' + error.message); return }
    setDuzenlenenSantiyeId('')
    yenile()
  }

  const hucreStil = { padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7' }
  const sabitSutun = { position: 'sticky', left: 0, background: 'white', zIndex: 1 }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Proje Detaylı Bilgiler</h2>
      <p style={{ fontSize: 12, color: '#5F5E5A', marginTop: 0 }}>Sağa doğru kaydırırken şantiye adı sabit kalır. Düzenlemek için aşağıdan bir şantiye seçin.</p>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7', marginBottom: 16 }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, ...sabitSutun }}>Şantiye Adı</th>
              {ALANLAR.map((a) => <th key={a.anahtar} style={baslikStil}>{a.etiket}</th>)}
            </tr>
          </thead>
          <tbody>
            {santiyeler.map((s) => {
              const kayit = kayitlar[s.id] || {}
              return (
                <tr key={s.id}>
                  <td style={{ ...hucreStil, ...sabitSutun, fontWeight: 700 }}>{s.ad}</td>
                  {ALANLAR.map((a) => <td key={a.anahtar} style={hucreStil}>{kayit[a.anahtar] || '—'}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="ekleme-kutusu">
        <select value={duzenlenenSantiyeId} onChange={(e) => duzenlemeyiAc(e.target.value)}>
          <option value="">Düzenlenecek şantiyeyi seçin...</option>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
        </select>

        {duzenlenenSantiyeId && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ALANLAR.map((a) => (
                <div key={a.anahtar}>
                  <label style={{ fontSize: 11, color: '#5F5E5A' }}>{a.etiket}</label>
                  <input
                    type="text"
                    value={taslak[a.anahtar] || ''}
                    onChange={(e) => setTaslak((o) => ({ ...o, [a.anahtar]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button className="ekle-buton-genis" onClick={kaydet}>Kaydet</button>
          </>
        )}
      </div>
    </div>
  )
}
