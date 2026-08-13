import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'

export default function CekTakip() {
  const { santiyeler } = useSite()
  const [cekler, setCekler] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtreAy, setFiltreAy] = useState('hepsi')
  const [siralamaAlani, setSiralamaAlani] = useState('cek_vadesi')
  const [siralamaYonu, setSiralamaYonu] = useState('asc')

  useEffect(() => {
    supabase.from('cekler').select('*, santiyeler(ad)').then(({ data, error }) => {
      if (error) { alert('Çekler yüklenemedi: ' + error.message); return }
      setCekler(data || [])
    })
  }, [])

  const siralamaTikla = (alan) => {
    if (siralamaAlani === alan) setSiralamaYonu((y) => (y === 'asc' ? 'desc' : 'asc'))
    else { setSiralamaAlani(alan); setSiralamaYonu('asc') }
  }

  const ok = (alan) => (siralamaAlani === alan ? (siralamaYonu === 'asc' ? ' ▲' : ' ▼') : '')

  const bankalar = [...new Set(cekler.map((c) => c.banka).filter(Boolean))].sort()
  const aylar = [...new Set(cekler.map((c) => c.verilis_tarihi?.slice(0, 7)).filter(Boolean))].sort()

  let liste = cekler
    .filter((c) => filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye)
    .filter((c) => filtreBanka === 'hepsi' || c.banka === filtreBanka)
    .filter((c) => filtreAy === 'hepsi' || c.verilis_tarihi?.slice(0, 7) === filtreAy)

  liste = [...liste].sort((a, b) => {
    let av = a[siralamaAlani], bv = b[siralamaAlani]
    if (siralamaAlani === 'santiyeler') { av = a.santiyeler?.ad || ''; bv = b.santiyeler?.ad || '' }
    if (av == null) av = ''
    if (bv == null) bv = ''
    if (siralamaAlani === 'tutar') { av = Number(av); bv = Number(bv) }
    if (av < bv) return siralamaYonu === 'asc' ? -1 : 1
    if (av > bv) return siralamaYonu === 'asc' ? 1 : -1
    return 0
  })

  const bugun = new Date().toISOString().slice(0, 10)
  const vadesiGelmemis = cekler.filter((c) => c.cek_vadesi && c.cek_vadesi >= bugun)
  const vadesiGelmemisTutar = vadesiGelmemis.reduce((t, c) => t + Number(c.tutar), 0)

  const baslikStil = { cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#5F5E5A', borderBottom: '1px solid #D3D1C7' }
  const hucreStil = { padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }

  return (
    <div className="sayfa">
      <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
      <h2>Çek Takip Sayfası</h2>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş çek sayısı</p>
          <p className="ozet-tutar">{vadesiGelmemis.length}</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Vadesi gelmemiş toplam</p>
          <p className="ozet-tutar">{paraFormatla(vadesiGelmemisTutar)} ₺</p>
        </div>
      </div>

      <div className="filtre-satiri">
        <button className={`filtre-chip ${filtreSantiye === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreSantiye('hepsi')}>Tüm şantiyeler</button>
        {santiyeler.map((s) => (
          <button key={s.id} className={`filtre-chip ${filtreSantiye === s.id ? 'secili' : ''}`} onClick={() => setFiltreSantiye(s.id)}>{s.ad}</button>
        ))}
      </div>
      {bankalar.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreBanka === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreBanka('hepsi')}>Tüm bankalar</button>
          {bankalar.map((b) => (
            <button key={b} className={`filtre-chip ${filtreBanka === b ? 'secili' : ''}`} onClick={() => setFiltreBanka(b)}>{b}</button>
          ))}
        </div>
      )}
      {aylar.length > 0 && (
        <div className="filtre-satiri">
          <button className={`filtre-chip ${filtreAy === 'hepsi' ? 'secili' : ''}`} onClick={() => setFiltreAy('hepsi')}>Tüm aylar</button>
          {aylar.map((a) => (
            <button key={a} className={`filtre-chip ${filtreAy === a ? 'secili' : ''}`} onClick={() => setFiltreAy(a)}>{a}</button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto', marginTop: 12, background: 'white', borderRadius: 12, border: '1px solid #D3D1C7' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={baslikStil} onClick={() => siralamaTikla('banka')}>Banka{ok('banka')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_seri_no')}>Çek No{ok('cek_seri_no')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('verilis_tarihi')}>Veriliş T.{ok('verilis_tarihi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_vadesi')}>Vade T.{ok('cek_vadesi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('odenen')}>Verilen Kişi{ok('odenen')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('tutar')}>Tutar{ok('tutar')}</th>
              <th style={baslikStil}>Açıklama</th>
              <th style={baslikStil} onClick={() => siralamaTikla('santiyeler')}>Şantiye{ok('santiyeler')}</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.id}>
                <td style={hucreStil}>{c.banka || '—'}</td>
                <td style={hucreStil}>{c.cek_seri_no || '—'}</td>
                <td style={hucreStil}>{c.verilis_tarihi ? new Date(c.verilis_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                <td style={hucreStil}>{c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}</td>
                <td style={hucreStil}>{c.odenen || '—'}</td>
                <td style={hucreStil}>{paraFormatla(c.tutar)} ₺</td>
                <td style={hucreStil}>{c.aciklama || '—'}</td>
                <td style={hucreStil}>{c.santiyeler?.ad || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {liste.length === 0 && <p className="bos-mesaj">Bu filtrede çek yok.</p>}
      </div>
      <p style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>Sütun başlıklarına tıklayarak sıralayabilirsiniz. Yeni çek eklemek için Muhasebe → Çek Girdileri sekmesini kullanın.</p>
    </div>
  )
}
