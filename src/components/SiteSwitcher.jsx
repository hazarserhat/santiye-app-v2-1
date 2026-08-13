import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'

export default function SiteSwitcher() {
  const { santiyeler, aktifSantiye, santiyeSec } = useSite()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')

  const filtreli = santiyeler.filter((s) => s.ad.toLowerCase().includes(arama.toLowerCase()))

  return (
    <>
      <button className="site-switcher-buton" onClick={() => setAcik(true)}>
        {aktifSantiye?.ad || 'Şantiye seç'} <span className="chevron">▾</span>
      </button>

      {acik && (
        <div className="modal-arka-plan" onClick={() => setAcik(false)}>
          <div className="modal-kutu" onClick={(e) => e.stopPropagation()}>
            <p className="modal-baslik">Şantiye seç</p>
            <input
              type="text"
              placeholder="Şantiye ara..."
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              autoFocus
            />
            <div className="site-listesi">
              {filtreli.map((s) => (
                <div
                  key={s.id}
                  className={`site-satiri ${s.id === aktifSantiye?.id ? 'aktif' : ''}`}
                  onClick={() => {
                    santiyeSec(s)
                    setAcik(false)
                  }}
                >
                  <span>{s.ad}</span>
                  {s.id === aktifSantiye?.id && <span>✓</span>}
                </div>
              ))}
              {filtreli.length === 0 && <p className="bos-mesaj">Şantiye bulunamadı</p>}
            </div>

            {profile?.sistem_yoneticisi && (
              <button
                className="ekle-buton-genis"
                style={{ marginTop: 12 }}
                onClick={() => { setAcik(false); navigate('/yonetim/santiyeler') }}
              >
                + Yeni şantiye ekle (Yönetim'de)
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
