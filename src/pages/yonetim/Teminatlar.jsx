import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../context/SiteContext'
import { paraFormatla, sadeceSayiTuslari } from '../../lib/format'
import { generateAndSharePDF } from '../../lib/pdfGenerator'

const BASLIKLAR = {
  banka_teminat_mektubu: 'Banka Teminat Mektupları',
  belediye_teminati: 'Belediye Teminatları',
  abonelik_bedeli: 'Abonelik Bedelleri / Teminatları',
}

export default function Teminatlar({ tur }) {
  const { santiyeler } = useSite()
  const { profile } = useAuth()
  const [kayitlar, setKayitlar] = useState([])
  const [seciliKayitlar, setSeciliKayitlar] = useState([])
  const [ekleAcik, setEkleAcik] = useState(false)
  const [tutar, setTutar] = useState('')
  const [santiyeId, setSantiyeId] = useState('')
  const [verildigiKurum, setVerildigiKurum] = useState('')
  const [verilisTarihi, setVerilisTarihi] = useState(new Date().toISOString().slice(0, 10))
  const [geriAlisKosulu, setGeriAlisKosulu] = useState('')

  const yenile = async () => {
    const { data, error } = await supabase.from('teminatlar').select('*, santiyeler(ad)').eq('tur', tur).order('verilis_tarihi', { ascending: false })
    if (error) { alert('Yüklenemedi: ' + error.message); return }
    setKayitlar(data || [])
  }

  useEffect(() => { yenile() }, [tur])

  const ekle = async () => {
    if (!tutar) { alert('Tutar zorunludur.'); return }
    const { error } = await supabase.from('teminatlar').insert({
      tur, tutar: Number(tutar), santiye_id: santiyeId || null, verildigi_kurum: verildigiKurum,
      verilis_tarihi: verilisTarihi, geri_alis_kosulu: geriAlisKosulu, ekleyen: profile?.id,
    })
    if (error) { alert('Eklenemedi: ' + error.message); return }
    setTutar(''); setSantiyeId(''); setVerildigiKurum(''); setGeriAlisKosulu(''); setEkleAcik(false)
    yenile()
  }

  const tikle = async (k) => {
    await supabase.from('teminatlar').update({ geri_alindi: !k.geri_alindi }).eq('id', k.id)
    yenile()
  }

  const sil = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return
    await supabase.from('teminatlar').delete().eq('id', id)
    yenile()
  }

  const aktifOlanlar = kayitlar.filter((k) => !k.geri_alindi)
  const toplamTutar = aktifOlanlar.reduce((t, k) => t + Number(k.tutar), 0)

  const kayitSecToggle = (id) => {
    setSeciliKayitlar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const pdfPaylas = async (sadeceSecilenler = false) => {
    const dataListesi = sadeceSecilenler ? kayitlar.filter(k => seciliKayitlar.includes(k.id)) : aktifOlanlar
    if (dataListesi.length === 0) return alert('PDF için kayıt bulunamadı.')

    const basliklar = ['Santiye', 'Verildigi Kurum', 'Verilis Tarihi', 'Geri Alis Kosulu', 'Durum', 'Tutar']
    const satirVerileri = dataListesi.map(k => [
      k.santiyeler?.ad || '-',
      k.verildigi_kurum || '-',
      k.verilis_tarihi ? new Date(k.verilis_tarihi).toLocaleDateString('tr-TR') : '-',
      k.geri_alis_kosulu || '-',
      k.geri_alindi ? 'Geri Alindi' : 'Aktif',
      `${paraFormatla(k.tutar)} TL`
    ])

    const toplam = dataListesi.reduce((acc, k) => acc + Number(k.tutar), 0)
    satirVerileri.push(['', '', '', '', 'TOPLAM:', `${paraFormatla(toplam)} TL`])

    await generateAndSharePDF({
      title: `${BASLIKLAR[tur]} (${sadeceSecilenler ? 'Secilenler' : 'Aktif Olanlar'})`,
      filename: `teminatlar-${tur}.pdf`,
      columns: basliklar,
      data: satirVerileri
    })
  }

  return (
    <div className="sayfa">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Link to="/yonetim" className="geri-buton">← Yönetim</Link>
          <h2>{BASLIKLAR[tur]}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seciliKayitlar.length > 0 && (
            <button 
              onClick={() => pdfPaylas(true)}
              style={{ background: '#F57F17', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📄 Seçilenleri Paylaş ({seciliKayitlar.length})
            </button>
          )}
          <button 
            onClick={() => pdfPaylas(false)}
            style={{ background: '#2C3E50', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            📄 Aktif Olanları Paylaş (PDF)
          </button>
        </div>
      </div>

      <div className="ozet-satiri">
        <div className="ozet-kart">
          <p className="ozet-etiket">Aktif kayıt sayısı</p>
          <p className="ozet-tutar">{aktifOlanlar.length}</p>
        </div>
        <div className="ozet-kart">
          <p className="ozet-etiket">Aktif toplam tutar</p>
          <p className="ozet-tutar">{paraFormatla(toplamTutar)} ₺</p>
        </div>
      </div>

      <div className="liste">
        {kayitlar.map((k) => (
          <div key={k.id} className="kart" style={{ opacity: k.geri_alindi ? 0.6 : 1, border: seciliKayitlar.includes(k.id) ? '2px solid #F57F17' : '1px solid #D3D1C7' }}>
            <div className="kart-ust" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input 
                  type="checkbox" 
                  checked={seciliKayitlar.includes(k.id)} 
                  onChange={() => kayitSecToggle(k.id)} 
                  style={{ width: 18, height: 18, accentColor: '#F57F17', cursor: 'pointer' }}
                  title="PDF'e eklemek için seç"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={k.geri_alindi} onChange={() => tikle(k)} style={{ width: 16, height: 16 }} />
                  <span className="kart-baslik" style={{ margin: 0 }}>{paraFormatla(k.tutar)} ₺ {k.geri_alindi && '· Geri alındı'}</span>
                </label>
              </div>
              <button className="sil-buton" onClick={() => sil(k.id)} aria-label="Sil">🗑</button>
            </div>
            <div className="etiket-satiri">
              {k.santiyeler?.ad && <span className="etiket etiket-vurgu">{k.santiyeler.ad}</span>}
              {k.verildigi_kurum && <span className="etiket">{k.verildigi_kurum}</span>}
              {k.verilis_tarihi && <span className="etiket">{new Date(k.verilis_tarihi).toLocaleDateString('tr-TR')}</span>}
            </div>
            {k.geri_alis_kosulu && <p className="not-icerik" style={{ marginTop: 6 }}>{k.geri_alis_kosulu}</p>}
          </div>
        ))}
        {kayitlar.length === 0 && <p className="bos-mesaj">Henüz kayıt yok.</p>}
      </div>

      {!ekleAcik ? (
        <button className="ekle-buton-genis" style={{ marginTop: 14 }} onClick={() => setEkleAcik(true)}>+ Yeni kayıt ekle</button>
      ) : (
        <div className="ekleme-kutusu">
          <input type="number" placeholder="Teminat tutarı (₺)" value={tutar} onChange={(e) => setTutar(e.target.value)} onKeyDown={sadeceSayiTuslari} />
          <select value={santiyeId} onChange={(e) => setSantiyeId(e.target.value)}>
            <option value="">Şantiye seç (opsiyonel)</option>
            {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          </select>
          <input type="text" placeholder="Verildiği kurum" value={verildigiKurum} onChange={(e) => setVerildigiKurum(e.target.value)} />
          <input type="date" value={verilisTarihi} onChange={(e) => setVerilisTarihi(e.target.value)} />
          <textarea
            placeholder="Geri alış koşulu..."
            value={geriAlisKosulu}
            onChange={(e) => setGeriAlisKosulu(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />
          <div className="ekleme-satiri-2">
            <button onClick={() => setEkleAcik(false)}>Vazgeç</button>
            <button className="ekle-buton-genis" onClick={ekle}>Kaydet</button>
          </div>
        </div>
      )}
    </div>
  )
}
