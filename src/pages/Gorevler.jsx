import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

const DURUMLAR = [
  { deger: 'hepsi', etiket: 'Tümü' },
  { deger: 'bekliyor', etiket: 'Bekliyor' },
  { deger: 'devam_ediyor', etiket: 'Devam ediyor' },
  { deger: 'tamamlandi', etiket: 'Tamamlandı' },
  { deger: 'gecikti', etiket: 'Geciken' },
]

export default function Gorevler() {
  const { aktifSantiye } = useSite()
  const { profile } = useAuth()
  const [gorevler, setGorevler] = useState([])
  const [filtre, setFiltre] = useState('hepsi')
  const [yeniBaslik, setYeniBaslik] = useState('')
  const [dinliyor, setDinliyor] = useState(false)

  useEffect(() => {
    if (aktifSantiye) gorevleriYukle()
  }, [aktifSantiye])

  const gorevleriYukle = async () => {
    const { data } = await supabase
      .from('gorevler')
      .select('*, gorev_etiketleri(*)')
      .eq('santiye_id', aktifSantiye.id)
      .order('created_at', { ascending: false })
    setGorevler(data || [])
  }

  const gorevEkle = async () => {
    if (!yeniBaslik.trim()) return
    await supabase.from('gorevler').insert({
      santiye_id: aktifSantiye.id,
      baslik: yeniBaslik,
      olusturan: profile?.id,
    })
    setYeniBaslik('')
    gorevleriYukle()
  }

  const durumGuncelle = async (id, yeniDurum) => {
    await supabase.from('gorevler').update({ durum: yeniDurum }).eq('id', id)
    gorevleriYukle()
  }

  const gorevSil = async (id) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return
    await supabase.from('gorevler').delete().eq('id', id)
    gorevleriYukle()
  }

  const sesleYaz = () => {
    const Tanima = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Tanima) {
      alert('Tarayıcınız sesli girişi desteklemiyor.')
      return
    }
    const tanima = new Tanima()
    tanima.lang = 'tr-TR'
    tanima.onresult = (e) => setYeniBaslik((onceki) => onceki + e.results[0][0].transcript)
    tanima.onstart = () => setDinliyor(true)
    tanima.onend = () => setDinliyor(false)
    tanima.start()
  }

  const gorunenler = filtre === 'hepsi' ? gorevler : gorevler.filter((g) => g.durum === filtre)

  if (!aktifSantiye) return <p className="bos-mesaj">Şantiye yükleniyor...</p>

  return (
    <div className="sayfa">
      <h2>Görevler · {aktifSantiye.ad}</h2>

      <div className="filtre-satiri">
        {DURUMLAR.map((d) => (
          <button
            key={d.deger}
            className={`filtre-chip ${filtre === d.deger ? 'secili' : ''}`}
            onClick={() => setFiltre(d.deger)}
          >
            {d.etiket}
          </button>
        ))}
      </div>

      <div className="liste">
        {gorunenler.map((g) => (
          <div key={g.id} className="kart">
            <div className="kart-ust">
              <span className="kart-baslik">{g.baslik}</span>
              <button className="sil-buton" onClick={() => gorevSil(g.id)} aria-label="Görevi sil">🗑</button>
            </div>
            {g.gorev_etiketleri?.length > 0 && (
              <div className="etiket-satiri">
                {g.gorev_etiketleri.map((e) => (
                  <span key={e.id} className="etiket">{e.deger}</span>
                ))}
              </div>
            )}
            <select value={g.durum} onChange={(ev) => durumGuncelle(g.id, ev.target.value)} className="durum-secici">
              {DURUMLAR.filter((d) => d.deger !== 'hepsi').map((d) => (
                <option key={d.deger} value={d.deger}>{d.etiket}</option>
              ))}
            </select>
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">Bu filtrede görev yok.</p>}
      </div>

      <div className="ekleme-cubugu">
        <input
          type="text"
          placeholder="Görev ekle..."
          value={yeniBaslik}
          onChange={(e) => setYeniBaslik(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gorevEkle()}
        />
        <button className="mikrofon-buton" onClick={sesleYaz} aria-label="Sesle yaz">
          {dinliyor ? '●' : '🎤'}
        </button>
        <button onClick={gorevEkle}>Ekle</button>
      </div>
    </div>
  )
}
