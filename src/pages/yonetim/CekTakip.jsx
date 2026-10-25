import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla } from '../../lib/format'
import { generateAndSharePDF } from '../../lib/pdfGenerator'

const ayFormatla = (yilAy) => {
  if (!yilAy || typeof yilAy !== 'string') return ''
  const parcalar = yilAy.split('-')
  if (parcalar.length !== 2) return yilAy
  const [yil, ay] = parcalar
  const aylarTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const idx = parseInt(ay, 10) - 1
  if (idx >= 0 && idx < 12) {
    return `${aylarTr[idx]} - ${yil}`
  }
  return yilAy
}

// Mükerrer çek seri numaraları için Soft Pastel Renk Paleti
const SOFT_PASTEL_RENKLER = [
  { bg: '#FFF7ED', border: '#FDBA74', badgeBg: '#FFEDD5', text: '#9A3412', ad: 'Soft Kehribar' },
  { bg: '#FEF2F2', border: '#FCA5A5', badgeBg: '#FEE2E2', text: '#991B1B', ad: 'Soft Gül' },
  { bg: '#FAF5FF', border: '#D8B4FE', badgeBg: '#F3E8FF', text: '#6B21A8', ad: 'Soft Mor' },
  { bg: '#F0F9FF', border: '#7DD3FC', badgeBg: '#E0F2FE', text: '#0369A1', ad: 'Soft Gök Mavisi' },
  { bg: '#ECFDF5', border: '#6EE7B7', badgeBg: '#D1FAE5', text: '#065F46', ad: 'Soft Zümrüt' },
  { bg: '#FDF4FF', border: '#F0ABFC', badgeBg: '#FAE8FF', text: '#86198F', ad: 'Soft Fuşya' },
  { bg: '#FEFCE8', border: '#FDE047', badgeBg: '#FEF9C3', text: '#854D0E', ad: 'Soft Sarı' },
  { bg: '#F0FDFA', border: '#5EEAD4', badgeBg: '#CCFBF1', text: '#115E59', ad: 'Soft Turkuaz' },
  { bg: '#F5F3FF', border: '#C4B5FD', badgeBg: '#EDE9FE', text: '#5B21B6', ad: 'Soft Leylak' },
  { bg: '#FFFBEB', border: '#FCD34D', badgeBg: '#FEF3C7', text: '#78350F', ad: 'Soft Bal' }
]

const getMukerrerRenk = (seriNo) => {
  if (!seriNo) return null
  let hash = 0
  const s = String(seriNo).trim().toLowerCase()
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 37 + s.charCodeAt(i)) >>> 0
  }
  return SOFT_PASTEL_RENKLER[hash % SOFT_PASTEL_RENKLER.length]
}

export default function CekTakip() {
  const { santiyeler } = useSite()
  const [cekler, setCekler] = useState([])
  const [aramaMetni, setAramaMetni] = useState('')
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
      const ciroCekleri = tumCekler.filter(c => c.yon === 'verilen' && c.aciklama && c.aciklama.toLowerCase().includes('ciro'))

      const islenmis = tumCekler.map(c => {
        const seriNoTemiz = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
        let eklenecek = { ...c }

        if (c.yon === 'alinan' && seriNoTemiz) {
          const ciroKarsiligi = ciroCekleri.find(ciro => String(ciro.cek_seri_no).trim().toLowerCase() === seriNoTemiz)
          if (ciroKarsiligi) {
            eklenecek.isCiroEdildi = true
            eklenecek.odenen = ciroKarsiligi.odenen || ciroKarsiligi.odeyen
            eklenecek.aciklama = `(Ciro: ${ciroKarsiligi.odenen || ciroKarsiligi.odeyen}) ` + (c.aciklama || '')
          }
        }
        return eklenecek
      })

      setCekler(islenmis)
    })
  }, [])

  // Seri Numarası Tekrar Eden Çekleri Say
  const seriNoSayilari = useMemo(() => {
    const sayilar = {}
    cekler.forEach(c => {
      const s = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
      if (s) {
        sayilar[s] = (sayilar[s] || 0) + 1
      }
    })
    return sayilar
  }, [cekler])

  // Çek Silme (Mükerrer veya yanlış girilmiş kayıtları doğrudan temizleyebilmek için)
  const cekSil = async (id, seriNo, kisi) => {
    const onayMetni = `"${kisi || 'İsimsiz'}" adına kayıtlı ${seriNo ? `(Seri No: ${seriNo})` : ''} çek kaydını silmek istediğinize emin misiniz?`
    if (!window.confirm(onayMetni)) return

    const { error } = await supabase.from('cekler').delete().eq('id', id)
    if (error) {
      alert('Çek silinemedi: ' + error.message)
      return
    }
    setCekler(prev => prev.filter(c => c.id !== id))
    setSeciliCekler(prev => prev.filter(x => x !== id))
  }

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
    .filter((c) => {
      if (!aramaMetni.trim()) return true
      const aranan = aramaMetni.toLowerCase().trim()
      const odenen = (c.odenen || '').toLowerCase()
      const odeyen = (c.odeyen || '').toLowerCase()
      const banka = (c.banka || '').toLowerCase()
      const seriNo = (c.cek_seri_no || '').toLowerCase()
      const aciklama = (c.aciklama || '').toLowerCase()
      const santiye = (c.santiyeler?.ad || '').toLowerCase()
      const tutarStr = String(c.tutar || '')
      return odenen.includes(aranan) || odeyen.includes(aranan) || banka.includes(aranan) ||
             seriNo.includes(aranan) || aciklama.includes(aranan) || santiye.includes(aranan) ||
             tutarStr.includes(aranan)
    })

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

      {/* ARAMA VE FİLTRELER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1.5px solid #CBD5E1',
        padding: '2px 14px',
        marginBottom: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
      }}>
        <span style={{ fontSize: 15, marginRight: 8, color: '#64748B' }}>🔍</span>
        <input
          type="text"
          placeholder="Çek takipte ara (Kişi, banka, çek no, açıklama, şantiye, tutar)..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '9px 0',
            fontSize: 13.5,
            background: 'transparent',
            color: '#1E293B'
          }}
        />
        {aramaMetni && (
          <button
            type="button"
            onClick={() => setAramaMetni('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 6px',
              fontWeight: 'bold'
            }}
            title="Aramayı Temizle"
          >
            ✕
          </button>
        )}
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
            <button key={a} className={`filtre-chip ${filtreAy === a ? 'secili' : ''}`} onClick={() => setFiltreAy(a)}>
              {ayFormatla(a)}
            </button>
          ))}
        </div>
      )}

      {/* Mükerrer Çek Uyarısı */}
      {Object.values(seriNoSayilari).some(sayi => sayi > 1) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          marginTop: 12,
          borderRadius: 10,
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          color: '#92400E',
          fontSize: 12.5,
          fontWeight: 600
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            Tabloda aynı seri numarasına sahip <strong>mükerrer çek kayıtları</strong> tespit edildi. Bu çekler ayırt edilebilmeleri için eşleşen <strong>soft pastel renklerle</strong> vurgulanmıştır. Fazla/hatalı kayıtları sağdaki 🗑️ butonuyla doğrudan silebilirsiniz.
          </span>
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
              <th style={{ ...baslikStil, width: 48, textAlign: 'center' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((c) => {
              const seriNoTemiz = c.cek_seri_no ? String(c.cek_seri_no).trim().toLowerCase() : ''
              const mukerrerSayisi = seriNoTemiz ? (seriNoSayilari[seriNoTemiz] || 0) : 0
              const isMukerrer = mukerrerSayisi > 1
              const softRenk = isMukerrer ? getMukerrerRenk(seriNoTemiz) : null

              return (
                <tr
                  key={c.id}
                  style={{
                    backgroundColor: seciliCekler.includes(c.id)
                      ? '#E0F2FE'
                      : (isMukerrer ? softRenk.bg : 'transparent'),
                    borderLeft: isMukerrer ? `5px solid ${softRenk.border}` : '5px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <input type="checkbox" checked={seciliCekler.includes(c.id)} onChange={() => cekSecToggle(c.id)} />
                  </td>
                  <td style={hucreStil}>{c.banka || '—'}</td>
                  <td style={hucreStil}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: isMukerrer ? 700 : 500 }}>{c.cek_seri_no || '—'}</span>
                      {isMukerrer && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            background: softRenk.badgeBg,
                            color: softRenk.text,
                            border: `1px solid ${softRenk.border}`,
                            whiteSpace: 'nowrap'
                          }}
                          title={`Bu seri numarası (${c.cek_seri_no}) sistemde ${mukerrerSayisi} kez kayıtlı!`}
                        >
                          ⚠️ Tekrar ({mukerrerSayisi})
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={hucreStil}>
                    {c.verilis_tarihi ? (
                      <div>
                        <div>{new Date(c.verilis_tarihi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>{ayFormatla(c.verilis_tarihi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={hucreStil}>
                    {c.cek_vadesi ? (
                      <div>
                        <div>{new Date(c.cek_vadesi).toLocaleDateString('tr-TR')}</div>
                        <div style={{ fontSize: 10, color: '#1D9596', fontWeight: 600 }}>{ayFormatla(c.cek_vadesi.slice(0, 7))}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={hucreStil}>{c.odenen || '—'}</td>
                  <td style={{ ...hucreStil, fontWeight: 700 }}>{paraFormatla(c.tutar)} ₺</td>
                  <td style={{ ...hucreStil, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.aciklama}>{c.aciklama || '—'}</td>
                  <td style={hucreStil}>{c.santiyeler?.ad || '—'}</td>
                  <td style={hucreStil}>
                    {c.isCiroEdildi
                      ? <span className="durum-rozet" style={{ background: '#E3F2FD', color: '#1976D2' }}>Ciro Edildi</span>
                      : (c.cek_vadesi && c.cek_vadesi < bugun
                        ? <span className="durum-rozet rozet-yesil">Ödendi</span>
                        : <span className="durum-rozet rozet-sari">Bekliyor</span>)}
                  </td>
                  <td style={{ ...hucreStil, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => cekSil(c.id, c.cek_seri_no, c.odenen || c.odeyen)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: '1px solid #FECACA',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      title="Bu çek kaydını sil"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {liste.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="6" style={{ ...hucreStil, fontWeight: 'bold', textAlign: 'right' }}>Filtrelenen Toplam:</td>
                <td style={{ ...hucreStil, fontWeight: 'bold' }}>{paraFormatla(filtreliToplam)} ₺</td>
                <td colSpan="4" style={hucreStil}></td>
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
