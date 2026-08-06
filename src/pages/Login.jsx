import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [eposta, setEposta] = useState('')
  const [sifre, setSifre] = useState('')
  const [hata, setHata] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const girisYap = async (e) => {
    e.preventDefault()
    setHata('')
    setGonderiliyor(true)
    const { error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre })
    if (error) setHata('E-posta veya şifre hatalı.')
    setGonderiliyor(false)
  }

  return (
    <div className="login-ekrani">
      <form onSubmit={girisYap} className="login-form">
        <h1>Şantiye Yönetim</h1>
        <label>
          E-posta
          <input type="email" value={eposta} onChange={(e) => setEposta(e.target.value)} required />
        </label>
        <label>
          Şifre
          <input type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} required />
        </label>
        {hata && <p className="login-hata">{hata}</p>}
        <button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </form>
    </div>
  )
}
