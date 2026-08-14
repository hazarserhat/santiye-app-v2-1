import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { paraFormatla, sadeceSayiTuslari } from '../../lib/format'

export default function AbonelikBedelleri() {
  const [sutunlar, setSutunlar] = useState([])
  const [satirlar, setSatirlar] = useState([])
  const [yeniSutunAcik, setYeniSutunAcik] = useState(false)
  const [yeniSutunAdi, setYeniSutunAdi] = useState('')

  const yenile = async () => {
    const { data: s, error: e1 } = await supabase.from('abonelik_sutunlari').select('*').order('sira')
    if (e1) { alert('Sütunlar yüklenemedi: ' + e1.message); return }
    setSutunlar(s || [])
    const { data: r, error: e2 } = await supabase.from('abonelik_odemeleri').select('*').order('sira')
    if (e2) { alert('Satırlar yüklenemedi: ' + e2.message); return }
    setSatirlar(r || [])
  }

  useEffect(() => { yenile() }, [])

  const sutunEkle = async () => {
    if (!yeniSutunAdi.trim()) return
    const { error } = await supabase.from('abonelik_sutunlari').insert({ ad: yeniSutunAdi, sira: sutunlar.length + 1 })
    if (error) { alert('Sütun eklenemedi: ' + error.message); return }
    setYeniSutunAdi(''); setYeniSutunAcik(false)
    yenile()
  }

  const sutunSil = async (id) => {
    if (!window.confirm('Bu sütunu silmek istediğinize emin misiniz?')) return
    await supabase.from('abonelik_sutunlari').delete().eq('id', id)
    yenile()
  }

  const satirEkle = async () => {
    const { error } = await supabase.from('abonelik_odemeleri').insert({ sira: satirlar.length + 1 })
    if (error) { alert('Satır eklenemedi: ' + error.message); return }
    yenile()
  }

  const satirSil = async (id) => {
    if (!window.confirm('Bu satırı silmek istediğinize emin misiniz?')) return
    await supabase.from('abonelik_odemeleri').delete().eq('id', id)
    yenile()
  }

  // Anlık ekranda tutup, kutu odağı kaybedince (onBlur) kaydediyoruz
  const [yerelDeger, setYerelDeger] = useState({}) // { "satirId-alan": deger }
  const anahtar = (satirId, alan) => `${satirId}-${alan}`

  const ekstraGuncelle = async (satir, sutunAdi, deger) => {
    const yeniEkstra = { ...(satir.ekstra || {}), [sutunAdi]: deger }
    await supabase.from('abonelik_odemeleri').update({ ekstra: yeniEkstra }).eq('id', satir.id)
    setSatirlar((onceki) => onceki.map((s) => (s.id === satir.id ? { ...s, ekstra: yeniEkstra } : s)))
  }

  const tutarGuncelle = async (satir, deger) => {
    const sayi = Number(deger) || 0
    await supabase.from('abonelik_odemeleri').update({ tutar: sayi }).eq('id', satir.id)
    setSatirlar((onceki) => onceki.map((s) => (s.id === satir.id ? { ...s, tutar: sayi } : s)))
  }

  const odendiGuncelle = async (satir) => {
    const yeni = !satir.odendi
    await supabase.from('abonelik_odemeleri').update({ odendi: yeni }).eq('id', satir.id)
    setSatirlar((onceki) => onceki.map((s) => (s.id === satir.id ? { ...s, odendi: yeni } : s)))
  }

  const toplamOdenmis = satirlar.filter((s) => s.odendi).reduce((t, s) => t + Number(s.tutar || 0), 0)
  const toplamOdenmemis = satirlar.filter((s) => !s.odendi).reduce((t, s) => t + Number(s.tutar || 0), 0)

  const hucreStil = { padding: '6px 8px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }
  const baslikStil = { ...hucreStil, fontWeight: 700, color: '#5F5E5A', fontSize: 11, borderBottom: '1px solid #D3D1C7' }
  const hucreInput = { border: 'none', background: 'transparent', fontSize: 12, width: '100%', padding: 2 }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Abonelik Bedelleri</h2>
      <p style={{ fontSize: 12, color: '#5F5E5A', marginTop: 0 }}>Elektrik / Su / Doğalgaz vb. abonelik ödemeleri — satır ve sütun serbestçe eklenebilir.</p>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Toplam ödenmiş</p>
          <p className="ozet-tutar">{paraFormatla(toplamOdenmis)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Toplam ödenmemiş</p>
          <p className="ozet-tutar">{paraFormatla(toplamOdenmemis)} ₺</p>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7', marginBottom: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {sutunlar.map((s) => (
                <th key={s.id} style={{ ...baslikStil, minWidth: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.ad}
                    <button onClick={() => sutunSil(s.id)} style={{ background: 'none', border: 'none', color: '#888780', cursor: 'pointer', fontSize: 12 }} aria-label="Sütunu sil">×</button>
                  </div>
                </th>
              ))}
              <th style={{ ...baslikStil, minWidth: 100 }}>Tutar</th>
              <th style={{ ...baslikStil, minWidth: 70 }}>Ödendi</th>
              <th style={baslikStil}></th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((satir) => (
              <tr key={satir.id} style={{ background: satir.odendi ? '#F8F7F2' : undefined }}>
                {sutunlar.map((s) => (
                  <td key={s.id} style={hucreStil}>
                    <input
                      type="text"
                      style={hucreInput}
                      defaultValue={satir.ekstra?.[s.ad] || ''}
                      onBlur={(e) => ekstraGuncelle(satir, s.ad, e.target.value)}
                    />
                  </td>
                ))}
                <td style={hucreStil}>
                  <input
                    type="number"
                    style={hucreInput}
                    defaultValue={satir.tutar || ''}
                    onKeyDown={sadeceSayiTuslari}
                    onBlur={(e) => tutarGuncelle(satir, e.target.value)}
                  />
                </td>
                <td style={{ ...hucreStil, textAlign: 'center' }}>
                  <input type="checkbox" checked={satir.odendi} onChange={() => odendiGuncelle(satir)} style={{ width: 16, height: 16 }} />
                </td>
                <td style={hucreStil}>
                  <button onClick={() => satirSil(satir.id)} style={{ background: 'none', border: 'none', color: '#888780', cursor: 'pointer' }} aria-label="Satırı sil">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {satirlar.length === 0 && <p className="bos-mesaj">Henüz satır eklenmemiş.</p>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="ekle-buton-genis" style={{ width: 'auto', padding: '8px 14px' }} onClick={satirEkle}>+ Satır ekle</button>
        {!yeniSutunAcik ? (
          <button style={{ padding: '8px 14px' }} onClick={() => setYeniSutunAcik(true)}>+ Sütun ekle</button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" placeholder="Sütun adı" value={yeniSutunAdi} onChange={(e) => setYeniSutunAdi(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sutunEkle()} style={{ width: 140 }} />
            <button onClick={sutunEkle}>Kaydet</button>
          </div>
        )}
      </div>
    </div>
  )
}
