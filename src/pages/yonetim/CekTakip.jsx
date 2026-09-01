import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'
import { generateAndSharePDF } from '../../lib/pdfGenerator'

export default function CekTakip() {
  const { santiyeler } = useSite()
  const [cekler, setCekler] = useState([])
  const [filtreSantiye, setFiltreSantiye] = useState('hepsi')
  const [filtreBanka, setFiltreBanka] = useState('hepsi')
  const [filtreAy, setFiltreAy] = useState('hepsi')
  const [siralamaAlani, setSiralamaAlani] = useState('cek_vadesi')
  const [siralamaYonu, setSiralamaYonu] = useState('asc')
  const [seciliCekler, setSeciliCekler] = useState([])

  useEffect(() => {
    supabase.from('cekler').select('*, santiyeler(ad)').then(({ data, error }) => {
      if (error) { alert('Çekler yüklenemedi: ' + error.message); return }

      const tumCekler = data || []
      const ciroCekleri = tumCekler.filter(c => c.yon === 'verilen' && c.aciklama && c.aciklama.includes('(Ciro Edildi)'))

      const tekillestirilmis = []
      tumCekler.forEach(c => {
        if (c.yon === 'verilen' && c.aciklama && c.aciklama.includes('(Ciro Edildi)')) return // Ciro kopyasını gizle

        let eklenecek = { ...c }
        if (c.yon === 'alinan' && c.cek_seri_no) {
          const ciroKarsiligi = ciroCekleri.find(ciro => ciro.cek_seri_no === c.cek_seri_no)
          if (ciroKarsiligi) {
            eklenecek.isCiroEdildi = true
            eklenecek.odenen = ciroKarsiligi.odenen || ciroKarsiligi.odeyen // Kime verildiğini asıl çeke yaz
            eklenecek.aciklama = `(Ciro: ${ciroKarsiligi.odenen || ciroKarsiligi.odeyen}) ` + (c.aciklama || '')
          }
        }
        tekillestirilmis.push(eklenecek)
      })

      setCekler(tekillestirilmis)
    })
  }, [])

  const siralamaTikla = (alan) => {
    if (siralamaAlani === alan) setSiralamaYonu((y) => (y === 'asc' ? 'desc' : 'asc'))
    else { setSiralamaAlani(alan); setSiralamaYonu('asc') }
  }

  const ok = (alan) => (siralamaAlani === alan ? (siralamaYonu === 'asc' ? ' ▲' : ' ▼') : '')

  const bankalar = [...new Set(cekler.map((c) => c.banka).filter(Boolean))].sort()
  const aylar = [...new Set(cekler.map((c) => c.cek_vadesi?.slice(0, 7)).filter(Boolean))].sort()

  let liste = cekler
    .filter((c) => filtreSantiye === 'hepsi' || c.santiye_id === filtreSantiye)
    .filter((c) => filtreBanka === 'hepsi' || c.banka === filtreBanka)
    .filter((c) => filtreAy === 'hepsi' || c.cek_vadesi?.slice(0, 7) === filtreAy)

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

  const filtreliToplam = liste.reduce((t, c) => t + Number(c.tutar), 0)

  const tumunuSecToggle = () => {
    if (seciliCekler.length === liste.length) {
      setSeciliCekler([]) // Hepsini kaldır
    } else {
      setSeciliCekler(liste.map(c => c.id)) // Filtrelenenlerin hepsini seç
    }
  }

  const cekSecToggle = (id) => {
    setSeciliCekler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const pdfPaylas = async (sadeceSecilenler = false) => {
    const dataListesi = sadeceSecilenler ? liste.filter(c => seciliCekler.includes(c.id)) : liste
    if (dataListesi.length === 0) return alert('PDF için seçili veya filtrelenmiş kayıt bulunamadı.')

    const basliklar = ['Banka', 'Cek No', 'Verilis', 'Vade', 'Verilen Kisi', 'Tutar', 'Aciklama', 'Santiye', 'Durum']
    const satirVerileri = dataListesi.map(c => [
      c.banka || '-',
      c.cek_seri_no || '-',
      c.verilis_tarihi ? new Date(c.verilis_tarihi).toLocaleDateString('tr-TR') : '-',
      c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '-',
      c.odenen || '-',
      `${paraFormatla(c.tutar)} TL`,
      c.aciklama || '-',
      c.santiyeler?.ad || '-',
      c.isCiroEdildi ? 'Ciro Edildi' : (c.cek_vadesi && c.cek_vadesi < bugun ? 'Odendi' : 'Bekliyor')
    ])

    const toplamTutar = dataListesi.reduce((acc, c) => acc + Number(c.tutar), 0)
    satirVerileri.push(['', '', '', '', 'TOPLAM:', `${paraFormatla(toplamTutar)} TL`, '', '', ''])

    await generateAndSharePDF({
      title: sadeceSecilenler ? 'Secilen Ceklerin Ekstresi' : 'Cek Takip Ekstresi',
      filename: 'cek-ekstresi.pdf',
      columns: basliklar,
      data: satirVerileri
    })
  }

  const bugun = new Date().toISOString().slice(0, 10)
  const vadesiGelmemis = cekler.filter((c) => !c.isCiroEdildi && c.cek_vadesi && c.cek_vadesi >= bugun)
  const vadesiGelmemisTutar = vadesiGelmemis.reduce((t, c) => t + Number(c.tutar), 0)
  const odenenCekler = cekler.filter((c) => !c.isCiroEdildi && c.cek_vadesi && c.cek_vadesi < bugun)
  const odenenTutar = odenenCekler.reduce((t, c) => t + Number(c.tutar), 0)
  const tumZamanlarToplam = cekler.filter(c => !c.isCiroEdildi).reduce((t, c) => t + Number(c.tutar), 0)

  const baslikStil = { cursor: 'pointer', whiteSpace: 'nowrap', padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#5F5E5A', borderBottom: '1px solid #D3D1C7' }
  const hucreStil = { padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #F1EFE8' }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
          <h2>Çek Takip Sayfası</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seciliCekler.length > 0 && (
            <button
              onClick={() => pdfPaylas(true)}
              style={{ background: '#F57F17', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📄 Seçilenleri Paylaş ({seciliCekler.length})
            </button>
          )}
          <button
            onClick={() => pdfPaylas(false)}
            style={{ background: '#2C3E50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Tüm Tabloyu Paylaş (PDF)
          </button>
        </div>
      </div>

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
      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Ödenen çekler toplamı</p>
          <p className="ozet-tutar">{paraFormatla(odenenTutar)} ₺</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Bugüne kadar verilen toplam</p>
          <p className="ozet-tutar">{paraFormatla(tumZamanlarToplam)} ₺</p>
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
              <th style={{ ...baslikStil, width: 40, textAlign: 'center' }}>
                <input type="checkbox" checked={liste.length > 0 && seciliCekler.length === liste.length} onChange={tumunuSecToggle} />
              </th>
              <th style={baslikStil} onClick={() => siralamaTikla('banka')}>Banka{ok('banka')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_seri_no')}>Çek No{ok('cek_seri_no')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('verilis_tarihi')}>Veriliş T.{ok('verilis_tarihi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('cek_vadesi')}>Vade T.{ok('cek_vadesi')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('odenen')}>Verilen Kişi{ok('odenen')}</th>
              <th style={baslikStil} onClick={() => siralamaTikla('tutar')}>Tutar{ok('tutar')}</th>
              <th style={{ ...baslikStil, maxWidth: 150 }}>Açıklama</th>
              <th style={baslikStil} onClick={() => siralamaTikla('santiyeler')}>Şantiye{ok('santiyeler')}</th>
              <th style={baslikStil}>Durum</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => (
              <tr key={c.id} style={{ backgroundColor: seciliCekler.includes(c.id) ? '#F3F8FF' : 'transparent' }}>
                <td style={{ ...hucreStil, textAlign: 'center' }}>
                  <input type="checkbox" checked={seciliCekler.includes(c.id)} onChange={() => cekSecToggle(c.id)} />
                </td>
                <td style={hucreStil}>{c.banka || '—'}</td>
                <td style={hucreStil}>{c.cek_seri_no || '—'}</td>
                <td style={hucreStil}>{c.verilis_tarihi ? new Date(c.verilis_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                <td style={hucreStil}>{c.cek_vadesi ? new Date(c.cek_vadesi).toLocaleDateString('tr-TR') : '—'}</td>
                <td style={hucreStil}>{c.odenen || '—'}</td>
                <td style={hucreStil}>{paraFormatla(c.tutar)} ₺</td>
                <td style={{ ...hucreStil, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.aciklama}>{c.aciklama || '—'}</td>
                <td style={hucreStil}>{c.santiyeler?.ad || '—'}</td>
                <td style={hucreStil}>
                  {c.isCiroEdildi
                    ? <span className="durum-rozet" style={{ background: '#E3F2FD', color: '#1976D2' }}>Ciro Edildi</span>
                    : (c.cek_vadesi && c.cek_vadesi < bugun
                      ? <span className="durum-rozet rozet-yesil">Ödendi</span>
                      : <span className="durum-rozet rozet-sari">Bekliyor</span>)}
                </td>
              </tr>
            ))}
          </tbody>
          {liste.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="6" style={{ ...hucreStil, fontWeight: 'bold', textAlign: 'right' }}>Filtrelenen Toplam:</td>
                <td style={{ ...hucreStil, fontWeight: 'bold' }}>{paraFormatla(filtreliToplam)} ₺</td>
                <td colSpan="3" style={hucreStil}></td>
              </tr>
            </tfoot>
          )}
        </table>
        {liste.length === 0 && <p className="bos-mesaj">Bu filtrede çek yok.</p>}
      </div>
      <p style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>Sütun başlıklarına tıklayarak sıralayabilirsiniz. Yeni çek eklemek için Muhasebe → Çek Girdileri sekmesini kullanın.</p>
    </div>
  )
}
