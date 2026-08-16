import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla, sadeceSayiTuslari } from '../../lib/format'

const STAGE_SAYISI = 4

export default function ProjeGelirleri() {
  const { santiyeler } = useSite()
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [malikler, setMalikler] = useState([])
  const [asamalar, setAsamalar] = useState({}) // { malikId: [asama,...] }
  const [odemeToplamlari, setOdemeToplamlari] = useState({}) // { malikId: toplam }

  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [taslak, setTaslak] = useState({})
  const [taslakAsamalar, setTaslakAsamalar] = useState([])

  const [yeniAcik, setYeniAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSantiyeId, setYeniSantiyeId] = useState('')

  const yenile = async () => {
    const { data: m, error: e1 } = await supabase.from('malikler').select('*, santiyeler(ad)').order('ad_soyad')
    if (e1) { alert('Malikler yüklenemedi: ' + e1.message); return }
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

  useEffect(() => {
    if (santiyeler.length && !yeniSantiyeId) setYeniSantiyeId(santiyeler[0].id)
  }, [santiyeler])

  const malikEkle = async () => {
    if (!yeniAd.trim() || !yeniSantiyeId) { alert('Ad ve şantiye zorunludur.'); return }
    const { data, error } = await supabase.from('malikler').insert({ ad_soyad: yeniAd, santiye_id: yeniSantiyeId }).select().single()
    if (error) { alert('Eklenemedi: ' + error.message); return }
    const bosAsamalar = Array.from({ length: STAGE_SAYISI }).map((_, i) => ({ malik_id: data.id, ad: '', tutar: 0, tamamlandi: false, sira: i + 1 }))
    await supabase.from('malik_asamalari').insert(bosAsamalar)
    setYeniAd(''); setYeniAcik(false)
    yenile()
  }

  const malikSil = async (id) => {
    if (!window.confirm('Bu maliki ve tüm aşama kayıtlarını silmek istediğinize emin misiniz?')) return
    await supabase.from('malikler').delete().eq('id', id)
    yenile()
  }

  const duzenlemeyiAc = (m) => {
    setDuzenlenenId(m.id)
    setTaslak({ toplam_alacak: m.toplam_alacak || 0, devlet_destegi: m.devlet_destegi || 0 })
    const mevcut = asamalar[m.id] || []
    setTaslakAsamalar(Array.from({ length: STAGE_SAYISI }).map((_, i) => mevcut[i] || { ad: '', tutar: 0, sira: i + 1 }))
  }

  const kaydet = async (malikId) => {
    await supabase.from('malikler').update({
      toplam_alacak: Number(taslak.toplam_alacak) || 0,
      devlet_destegi: Number(taslak.devlet_destegi) || 0,
    }).eq('id', malikId)

    for (const a of taslakAsamalar) {
      if (a.id) {
        await supabase.from('malik_asamalari').update({ ad: a.ad, tutar: Number(a.tutar) || 0 }).eq('id', a.id)
      } else {
        await supabase.from('malik_asamalari').insert({ malik_id: malikId, ad: a.ad, tutar: Number(a.tutar) || 0, sira: a.sira })
      }
    }
    setDuzenlenenId(null)
    yenile()
  }

  const asamaTikle = async (asama) => {
    await supabase.from('malik_asamalari').update({ tamamlandi: !asama.tamamlandi }).eq('id', asama.id)
    yenile()
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

  const gorunenler = filtreSantiye === 'hepsi' ? malikler : malikler.filter((m) => m.santiye_id === filtreSantiye)

  // Genel toplamlar
  let toplamAlacakGenel = 0, toplamDevletGenel = 0, toplamAlinanGenel = 0, toplamKalanGenel = 0
  gorunenler.forEach((m) => {
    const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
    const alinan = odemeToplamlari[m.id] || 0
    toplamAlacakGenel += Number(m.toplam_alacak || 0)
    toplamDevletGenel += Number(m.devlet_destegi || 0)
    toplamAlinanGenel += alinan
    toplamKalanGenel += Math.max(0, kalanBakiye - alinan)
  })

  const hucreStil = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7', whiteSpace: 'nowrap' }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Proje Gelirleri</h2>
      <p style={{ fontSize: 12, color: '#5F5E5A', marginTop: 0 }}>
        🔴 Ödeme alınmadı · 🟡 Kısmi ödeme alındı · 🟢 Tamamen ödendi. Aşama başlığındaki tik, o aşamanın (iskan/ruhsat vb.) fiilen tamamlanıp tamamlanmadığını gösterir — ödemeden bağımsızdır.
      </p>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7', marginBottom: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...baslikStil, position: 'sticky', left: 0, background: 'white' }}>Malik</th>
              <th style={baslikStil}>Şantiye</th>
              <th style={baslikStil}>Toplam Alacak</th>
              <th style={baslikStil}>Devlet Desteği</th>
              <th style={baslikStil}>Kalan Bakiye</th>
              {Array.from({ length: STAGE_SAYISI }).map((_, i) => <th key={i} style={baslikStil}>Aşama {i + 1}</th>)}
              <th style={baslikStil}>Alınan</th>
              <th style={baslikStil}>Kalan</th>
              <th style={baslikStil}></th>
            </tr>
          </thead>
          <tbody>
            {gorunenler.map((m) => {
              const stages = asamalar[m.id] || []
              const renkler = renkHesapla(m.id, stages)
              const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
              const alinan = odemeToplamlari[m.id] || 0
              const kalan = Math.max(0, kalanBakiye - alinan)
              return (
                <tr key={m.id}>
                  <td style={{ ...hucreStil, position: 'sticky', left: 0, background: 'white', fontWeight: 700 }}>{m.ad_soyad}</td>
                  <td style={hucreStil}>{m.santiyeler?.ad}</td>
                  <td style={hucreStil}>{paraFormatla(m.toplam_alacak)} ₺</td>
                  <td style={hucreStil}>{paraFormatla(m.devlet_destegi)} ₺</td>
                  <td style={hucreStil}>{paraFormatla(kalanBakiye)} ₺</td>
                  {Array.from({ length: STAGE_SAYISI }).map((_, i) => {
                    const s = stages[i]
                    return (
                      <td key={i} style={{ ...hucreStil, background: renkArkaplan[renkler[i] || 'yok'], minWidth: 100 }}>
                        {s?.id && (
                          <>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                              <input type="checkbox" checked={s.tamamlandi} onChange={() => asamaTikle(s)} style={{ width: 13, height: 13 }} />
                              {s.ad || '—'}
                            </label>
                            <div style={{ fontSize: 11, color: '#5F5E5A' }}>{paraFormatla(s.tutar)} ₺</div>
                          </>
                        )}
                      </td>
                    )
                  })}
                  <td style={{ ...hucreStil, color: '#1D9596', fontWeight: 700 }}>{paraFormatla(alinan)} ₺</td>
                  <td style={hucreStil}>{paraFormatla(kalan)} ₺</td>
                  <td style={hucreStil}>
                    <button className="sil-buton" onClick={() => duzenlemeyiAc(m)} aria-label="Düzenle">✎</button>
                    <button className="sil-buton" onClick={() => malikSil(m.id)} aria-label="Sil">🗑</button>
                  </td>
                </tr>
              )
            })}
            {gorunenler.length === 0 && <tr><td colSpan={10} style={hucreStil}>Henüz malik eklenmemiş.</td></tr>}
          </tbody>
          {gorunenler.length > 0 && (
            <tfoot>
              <tr style={{ background: '#F8F7F2', fontWeight: 700 }}>
                <td style={{ ...hucreStil, position: 'sticky', left: 0, background: '#F8F7F2' }}>TOPLAM</td>
                <td style={hucreStil}></td>
                <td style={hucreStil}>{paraFormatla(toplamAlacakGenel)} ₺</td>
                <td style={hucreStil}>{paraFormatla(toplamDevletGenel)} ₺</td>
                <td style={hucreStil}>{paraFormatla(toplamAlacakGenel - toplamDevletGenel)} ₺</td>
                {Array.from({ length: STAGE_SAYISI }).map((_, i) => <td key={i} style={hucreStil}></td>)}
                <td style={{ ...hucreStil, color: '#1D9596' }}>{paraFormatla(toplamAlinanGenel)} ₺</td>
                <td style={hucreStil}>{paraFormatla(toplamKalanGenel)} ₺</td>
                <td style={hucreStil}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {duzenlenenId && (
        <div className="ekleme-kutusu">
          <p className="alt-baslik">Düzenle: {malikler.find((m) => m.id === duzenlenenId)?.ad_soyad}</p>
          <div className="ekleme-satiri-2">
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A' }}>Toplam Alacak</label>
              <input type="number" value={taslak.toplam_alacak} onKeyDown={sadeceSayiTuslari}
                onChange={(e) => setTaslak((o) => ({ ...o, toplam_alacak: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A' }}>Devlet Desteği (Kredi+Hibe)</label>
              <input type="number" value={taslak.devlet_destegi} onKeyDown={sadeceSayiTuslari}
                onChange={(e) => setTaslak((o) => ({ ...o, devlet_destegi: e.target.value }))} />
            </div>
          </div>

          <p style={{ fontSize: 12, fontWeight: 700, margin: '10px 0 4px' }}>Ödeme Aşamaları (kalan bakiyenin dağılımı)</p>
          {taslakAsamalar.map((a, i) => (
            <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
              <input
                type="text"
                placeholder={`Aşama ${i + 1} adı (örn. İskanda)`}
                value={a.ad}
                onChange={(e) => setTaslakAsamalar((o) => o.map((x, j) => (j === i ? { ...x, ad: e.target.value } : x)))}
              />
              <input
                type="number"
                placeholder="Tutar (₺)"
                value={a.tutar}
                onKeyDown={sadeceSayiTuslari}
                onChange={(e) => setTaslakAsamalar((o) => o.map((x, j) => (j === i ? { ...x, tutar: e.target.value } : x)))}
              />
            </div>
          ))}

          <div className="ekleme-satiri-2">
            <button onClick={() => setDuzenlenenId(null)}>Vazgeç</button>
            <button className="ekle-buton-genis" onClick={() => kaydet(duzenlenenId)}>Kaydet</button>
          </div>
        </div>
      )}

      {!yeniAcik ? (
        <button className="ekle-buton-genis" onClick={() => setYeniAcik(true)}>+ Yeni malik ekle</button>
      ) : (
        <div className="ekleme-kutusu">
          <select value={yeniSantiyeId} onChange={(e) => setYeniSantiyeId(e.target.value)}>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
          <input type="text" placeholder="Malik ad soyad" value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
          <div className="ekleme-satiri-2">
            <button onClick={() => setYeniAcik(false)}>Vazgeç</button>
            <button className="ekle-buton-genis" onClick={malikEkle}>Kaydet</button>
          </div>
        </div>
      )}
    </div>
  )
}
