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
  const [taslak, setTaslak] = useState({ toplam_alacak: 0, devlet_destegi: 0 })
  const [taslakAsamalar, setTaslakAsamalar] = useState([])

  // GÜVENLİ MİKTAR HESABI: Hata vermemesi için önce veri kontrolü yapıyoruz
  const maxStageCount = Math.max(0, ...Object.values(asamalar).map(a => a?.length || 0), 4)

  const yenile = async () => {
    const { data: m } = await supabase.from('malikler').select('*, santiyeler(ad)').order('ad_soyad')
    setMalikler(m || [])

    const { data: a } = await supabase.from('malik_asamalari').select('*').order('sira')
    const harita = {}
    if (a) {
      a.forEach((r) => { if (!harita[r.malik_id]) harita[r.malik_id] = []; harita[r.malik_id].push(r) })
    }
    setAsamalar(harita)

    const { data: g } = await supabase.from('gelirler').select('malik_id, tutar').not('malik_id', 'is', null)
    const odemeHarita = {}
    if (g) {
      g.forEach((r) => { odemeHarita[r.malik_id] = (odemeHarita[r.malik_id] || 0) + Number(r.tutar) })
    }
    setOdemeToplamlari(odemeHarita)
  }

  useEffect(() => { yenile() }, [])

  const duzenlemeyiAc = (m) => {
    setDuzenlenenId(m.id)
    setTaslak({ toplam_alacak: m.toplam_alacak || 0, devlet_destegi: m.devlet_destegi || 0 })
    // Mevcut aşamalar yoksa 4 tane boş getir
    setTaslakAsamalar(asamalar[m.id]?.length > 0 ? [...asamalar[m.id]] : [{ ad: '', tutar: 0, sira: 1 }, { ad: '', tutar: 0, sira: 2 }, { ad: '', tutar: 0, sira: 3 }, { ad: '', tutar: 0, sira: 4 }])
  }

  const kaydet = async (malikId) => {
    await supabase.from('malikler').update({
      toplam_alacak: Number(taslak.toplam_alacak) || 0,
      devlet_destegi: Number(taslak.devlet_destegi) || 0,
    }).eq('id', malikId)

    await supabase.from('malik_asamalari').delete().eq('malik_id', malikId)
    const yeniAsamalar = taslakAsamalar.map((a, i) => ({ malik_id: malikId, ad: a.ad, tutar: Number(a.tutar) || 0, sira: i + 1 }))
    await supabase.from('malik_asamalari').insert(yeniAsamalar)
    
    setDuzenlenenId(null)
    yenile()
  }

  const asamaEkle = () => setTaslakAsamalar([...taslakAsamalar, { ad: '', tutar: 0, sira: taslakAsamalar.length + 1 }])

  const renkArkaplan = { yesil: 'rgba(63,158,92,0.25)', sari: 'rgba(217,180,41,0.3)', kirmizi: 'rgba(214,69,69,0.18)', yok: 'transparent' }
  const gorunenler = filtreSantiye === 'hepsi' ? malikler : malikler.filter((m) => m.santiye_id === filtreSantiye)
  const baslikStil = { padding: '8px 10px', fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7', background: 'white' }

  return (
    <div className="sayfa">
      <h2>Proje Gelirleri</h2>
      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={baslikStil}>Malik</th>
              {Array.from({ length: maxStageCount }).map((_, i) => <th key={i} style={baslikStil}>Aşama {i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {gorunenler.map((m) => (
              <tr key={m.id}>
                <td style={{ padding: 10, borderBottom: '1px solid #F1EFE8' }}>{m.ad_soyad}</td>
                {Array.from({ length: maxStageCount }).map((_, i) => {
                  const s = (asamalar[m.id] || [])[i]
                  return <td key={i} style={{ padding: 10, borderBottom: '1px solid #F1EFE8', background: s ? renkArkaplan.yesil : 'transparent' }}>{s?.ad}</td>
                })}
                <td style={{ padding: 10, borderBottom: '1px solid #F1EFE8' }}><button onClick={() => duzenlemeyiAc(m)}>Düzenle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {duzenlenenId && (
        <div className="ekleme-kutusu" style={{ marginTop: 20 }}>
          {taslakAsamalar.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
              <input value={a.ad} placeholder="Aşama Adı" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, ad: e.target.value} : x))} />
              <input type="number" value={a.tutar} placeholder="Tutar" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, tutar: e.target.value} : x))} />
            </div>
          ))}
          <button onClick={asamaEkle}>+ Aşama Ekle</button>
          <button onClick={() => kaydet(duzenlenenId)}>Kaydet</button>
        </div>
      )}
    </div>
  )
}