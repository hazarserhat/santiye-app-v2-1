import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'

export default function CariKartlar() {
  const { aktifSantiye } = useSite()
  const [cariler, setCariler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [aramaMetni, setAramaMetni] = useState('')

  // Form State'leri
  const [unvan, setUnvan] = useState('')
  const [telefon, setTelefon] = useState('')
  const [yetkili, setYetkili] = useState('')
  const [tip, setTip] = useState('Tedarikçi')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    carileriYukle()
  }, [])

  const carileriYukle = async () => {
    setYukleniyor(true)
    const { data, error } = await supabase
      .from('cari_kartlar')
      .select('*')
      .order('unvan', { ascending: true })

    if (error) {
      console.error('Cari kartlar yüklenemedi:', error.message)
    } else {
      setCariler(data || [])
    }
    setYukleniyor(false)
  }

  const cariEkle = async () => {
    if (!unvan.trim()) {
      alert('Lütfen bir ünvan veya kişi adı girin.')
      return
    }

    setKaydediliyor(true)
    const { error } = await supabase.from('cari_kartlar').insert({
      unvan,
      telefon,
      yetkili_kisi: yetkili,
      tip,
    })

    if (error) {
      alert('Kayıt eklenemedi: ' + error.message)
    } else {
      setUnvan('')
      setTelefon('')
      setYetkili('')
      setTip('Tedarikçi')
      carileriYukle()
    }
    setKaydediliyor(false)
  }

  const cariSil = async (id) => {
    if (!window.confirm('Bu cari kaydı silmek istediğinize emin misiniz?')) return
    await supabase.from('cari_kartlar').delete().eq('id', id)
    carileriYukle()
  }

  const filtrelenmisCariler = cariler.filter((c) =>
    (c.unvan || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (c.yetkili_kisi || '').toLowerCase().includes(aramaMetni.toLowerCase()) ||
    (c.telefon || '').includes(aramaMetni)
  )

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  return (
    <div className="sayfa">
      <h2>REHBER / CARİ KARTLAR</h2>

      {/* Arama Kutusu */}
      <input
        type="text"
        placeholder="Rehberde ara (İsim, Yetkili, Telefon)..."
        value={aramaMetni}
        onChange={(e) => setAramaMetni(e.target.value)}
        style={{ marginBottom: 12, width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d3d1c7' }}
      />

      {/* Cari Liste */}
      <div className="liste">
        {yukleniyor ? (
          <p className="bos-mesaj">Kayıtlar yükleniyor...</p>
        ) : (
          filtrelenmisCariler.map((c) => (
            <div key={c.id} className="kart">
              <div className="kart-ust">
                <span className="kart-baslik">{c.unvan}</span>
                <button className="sil-buton" onClick={() => cariSil(c.id)} aria-label="Sil">🗑</button>
              </div>

              <div className="etiket-satiri">
                {c.tip && <span className="etiket etiket-vurgu">{c.tip}</span>}
                {c.yetkili_kisi && <span className="etiket">👤 {c.yetkili_kisi}</span>}
                {c.telefon && <span className="etiket">📞 {c.telefon}</span>}
              </div>
            </div>
          ))
        )}
        {!yukleniyor && filtrelenmisCariler.length === 0 && (
          <p className="bos-mesaj">Aranan kritere uygun rehber kaydı bulunamadı.</p>
        )}
      </div>

      {/* Yeni Kisi/Cari Ekleme Formu */}
      <div className="ekleme-kutusu" style={{ marginTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Yeni Rehber Kaydı Oluştur</p>
        
        <input
          type="text"
          placeholder="Firma / Kişi Ünvanı *"
          value={unvan}
          onChange={(e) => setUnvan(e.target.value)}
          style={{ marginBottom: 8 }}
        />

        <div className="ekleme-satiri-2" style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Yetkili Kişi"
            value={yetkili}
            onChange={(e) => setYetkili(e.target.value)}
          />
          <input
            type="text"
            placeholder="Telefon"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
          />
        </div>

        <select value={tip} onChange={(e) => setTip(e.target.value)} style={{ marginBottom: 8 }}>
          <option value="Tedarikçi">Tedarikçi</option>
          <option value="Taşeron">Taşeron</option>
          <option value="Müşteri">Müşteri</option>
          <option value="Personel">Personel</option>
          <option value="Diğer">Diğer</option>
        </select>

        <button className="ekle-buton-genis" onClick={cariEkle} disabled={kaydediliyor}>
          {kaydediliyor ? 'Kaydediliyor...' : 'Rehbere Kaydet'}
        </button>
      </div>
    </div>
  )
}