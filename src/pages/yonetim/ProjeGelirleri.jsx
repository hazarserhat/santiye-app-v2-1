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

  // Tablodaki dinamik sütun sayısını belirlemek için en uzun aşama listesini bulalım
  const maxStageCount = Math.max(0, ...Object.values(asamalar).map(a => a.length), ...malikler.map(m => (asamalar[m.id] || []).length))

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

  const malikEkle = async () => {
    if (!yeniAd.trim() || !yeniSantiyeId) { alert('Ad ve şantiye zorunludur.'); return }
    const { data } = await supabase.from('malikler').insert({ ad_soyad: yeniAd, santiye_id: yeniSantiyeId }).select().single()
    setYeniAd(''); setYeniAcik(false)
    yenile()
  }

  const duzenlemeyiAc = (m) => {
    setDuzenlenenId(m.id)
    setTaslak({ toplam_alacak: m.toplam_alacak || 0, devlet_destegi: m.devlet_destegi || 0 })
    setTaslakAsamalar(asamalar[m.id] || [{ ad: '', tutar: 0, sira: 1 }])
  }

  const kaydet = async (malikId) => {
    await supabase.from('malikler').update({
      toplam_alacak: Number(taslak.toplam_alacak) || 0,
      devlet_destegi: Number(taslak.devlet_destegi) || 0,
    }).eq('id', malikId)

    // Önce eskileri temizleyip yenilerini yazmak veya upsert etmek gerekebilir
    // Basit olması için ilgili malikin tüm aşamalarını silip tekrar ekliyoruz
    await supabase.from('malik_asamalari').delete().eq('malik_id', malikId)
    const yeniAsamalar = taslakAsamalar.map((a, i) => ({ malik_id: malikId, ad: a.ad, tutar: Number(a.tutar) || 0, sira: i + 1 }))
    await supabase.from('malik_asamalari').insert(yeniAsamalar)
    
    setDuzenlenenId(null)
    yenile()
  }

  const asamaEkle = () => {
    setTaslakAsamalar([...taslakAsamalar, { ad: '', tutar: 0, sira: taslakAsamalar.length + 1 }])
  }

  // Render yardımcıları
  const gorunenler = filtreSantiye === 'hepsi' ? malikler : malikler.filter((m) => m.santiye_id === filtreSantiye)
  const hucreStil = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7' }

  return (
    <div className="sayfa">
      <h2>Proje Gelirleri</h2>
      {/* ... (Filtre ve Tablo başlıkları aynı kalabilir) ... */}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={baslikStil}>Malik</th>
            {Array.from({ length: maxStageCount }).map((_, i) => <th key={i} style={baslikStil}>Aşama {i + 1}</th>)}
            <th style={baslikStil}>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {gorunenler.map((m) => (
            <tr key={m.id}>
              <td style={hucreStil}>{m.ad_soyad}</td>
              {(asamalar[m.id] || []).map((s, i) => <td key={i} style={hucreStil}>{s.ad} ({paraFormatla(s.tutar)}₺)</td>)}
              <td style={hucreStil}><button onClick={() => duzenlemeyiAc(m)}>Düzenle</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {duzenlenenId && (
        <div className="ekleme-kutusu">
          {taslakAsamalar.map((a, i) => (
            <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
              <input value={a.ad} placeholder="Aşama Adı" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, ad: e.target.value} : x))} />
              <input value={a.tutar} placeholder="Tutar" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, tutar: e.target.value} : x))} />
            </div>
          ))}
          <button onClick={asamaEkle}>+ Aşama Ekle</button>
          <button onClick={() => kaydet(duzenlenenId)}>Kaydet</button>
        </div>
      )}
    </div>
  )
}