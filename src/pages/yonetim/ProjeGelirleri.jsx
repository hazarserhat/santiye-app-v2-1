import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla, sadeceSayiTuslari } from '../../lib/format'

export default function ProjeGelirleri() {
  const { santiyeler } = useSite()
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [malikler, setMalikler] = useState([])
  const [asamalar, setAsamalar] = useState({})
  const [odemeToplamlari, setOdemeToplamlari] = useState({})

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [taslak, setTaslak] = useState({})
  const [taslakAsamalar, setTaslakAsamalar] = useState([])
  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')

  // Dinamik sütun sayısı: Tüm maliklerin aşamaları içindeki en uzun listeyi bulur
  const maxStageCount = Math.max(4, ...Object.values(asamalar).map(a => a.length || 0))

  const yenile = async () => {
    const { data: m } = await supabase.from('malikler').select('*, santiyeler(ad)').order('ad_soyad')
    setMalikler(m || [])
    const { data: a } = await supabase.from('malik_asamalari').select('*').order('sira')
    const harita = {}
    ;(a || []).forEach((r) => { if (!harita[r.malik_id]) harita[r.malik_id] = []; harita[r.malik_id].push(r) })
    setAsamalar(harita)
    const { data: g } = await supabase.from('gelirler').select('malik_id, tutar').not('malik_id', 'is', null)
    const odemeHarita = {}
    ;(g || []).forEach((r) => { odemeHarita[r.malik_id] = (odemeHarita[r.malik_id] || 0) + Number(r.tutar) })
    setOdemeToplamlari(odemeHarita)
  }

  useEffect(() => { yenile() }, [])

  const duzenlemeyiAc = (m) => {
    setDuzenlenenId(m.id)
    setTaslak({ toplam_alacak: m.toplam_alacak || 0, devlet_destegi: m.devlet_destegi || 0 })
    setTaslakAsamalar(asamalar[m.id]?.length ? [...asamalar[m.id]] : [{ ad: '', tutar: 0, sira: 1 }])
  }

  const kaydet = async (malikId) => {
    await supabase.from('malikler').update({ toplam_alacak: taslak.toplam_alacak, devlet_destegi: taslak.devlet_destegi }).eq('id', malikId)
    await supabase.from('malik_asamalari').delete().eq('malik_id', malikId)
    await supabase.from('malik_asamalari').insert(taslakAsamalar.map((a, i) => ({ malik_id: malikId, ad: a.ad, tutar: a.tutar, sira: i + 1 })))
    setDuzenlenenId(null); yenile()
  }

  const renkHesapla = (malikId, stages) => {
    let kalan = odemeToplamlari[malikId] || 0
    return stages.map((s) => {
      if (!s.tutar || s.tutar <= 0) return 'yok'
      if (kalan >= s.tutar) { kalan -= s.tutar; return 'yesil' }
      if (kalan > 0) { kalan = 0; return 'sari' }
      return 'kirmizi'
    })
  }

  const renkArkaplan = { yesil: 'rgba(63,158,92,0.25)', sari: 'rgba(217,180,41,0.3)', kirmizi: 'rgba(214,69,69,0.18)', yok: 'transparent' }
  const hucreStil = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7', background: 'white' }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Proje Gelirleri</h2>
      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tümü</button>
        {santiyeler.map((s) => <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>)}
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, position: 'sticky', left: 0, zIndex: 1 }}>Malik</th>
              <th style={baslikStil}>Alacak</th>
              {Array.from({ length: maxStageCount }).map((_, i) => <th key={i} style={baslikStil}>Aşama {i + 1}</th>)}
              <th style={baslikStil}>Alınan</th>
              <th style={baslikStil}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gorunenler.map((m) => {
              const stages = asamalar[m.id] || []
              const renkler = renkHesapla(m.id, stages)
              return (
                <tr key={m.id}>
                  <td style={{ ...hucreStil, fontWeight: 700, position: 'sticky', left: 0, background: 'white' }}>{m.ad_soyad}</td>
                  <td style={hucreStil}>{paraFormatla(m.toplam_alacak)} ₺</td>
                  {Array.from({ length: maxStageCount }).map((_, i) => {
                    const s = stages[i]
                    return (
                      <td key={i} style={{ ...hucreStil, background: s ? renkArkaplan[renkler[i]] : 'transparent', minWidth: 110 }}>
                        {s && <><div style={{ fontSize: 11 }}>{s.ad}</div><div style={{ fontSize: 10 }}>{paraFormatla(s.tutar)} ₺</div></>}
                      </td>
                    )
                  })}
                  <td style={{ ...hucreStil, color: '#1D9596' }}>{paraFormatla(odemeToplamlari[m.id])} ₺</td>
                  <td style={hucreStil}><button className="sil-buton" onClick={() => duzenlemeyiAc(m)}>✎</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {duzenlenenId && (
        <div className="ekleme-kutusu" style={{ marginTop: 20 }}>
          <p className="alt-baslik">Aşamaları Düzenle</p>
          {taslakAsamalar.map((a, i) => (
            <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
              <input value={a.ad} placeholder="Aşama Adı" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, ad: e.target.value} : x))} />
              <input type="number" value={a.tutar} placeholder="Tutar" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, tutar: e.target.value} : x))} />
              <button onClick={() => setTaslakAsamalar(o => o.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          <button onClick={() => setTaslakAsamalar([...taslakAsamalar, { ad: '', tutar: 0 }])}>+ Aşama Ekle</button>
          <button className="ekle-buton-genis" onClick={() => kaydet(duzenlenenId)}>Kaydet</button>
        </div>
      )}
    </div>
  )
}