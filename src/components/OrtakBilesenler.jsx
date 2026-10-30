import React from 'react'

export function SayfaBaslik({ baslik, altBaslik, ikon, sagAksiyon, className = '' }) {
  return (
    <div className={`ortak-sayfa-baslik ${className}`}>
      <div className="ortak-sayfa-baslik-sol">
        <h2>
          {ikon && <span role="img" aria-label="ikon">{ikon}</span>}
          {baslik}
        </h2>
        {altBaslik && <p className="ortak-sayfa-altbilgi">{altBaslik}</p>}
      </div>
      {sagAksiyon && (
        <div className="ortak-sayfa-baslik-sag">
          {sagAksiyon}
        </div>
      )}
    </div>
  )
}

export function Kart({ children, className = '', onClick, style = {} }) {
  return (
    <div 
      className={`ortak-kart ${className}`} 
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  )
}

export function BosDurum({ 
  ikon = '📭', 
  baslik = 'Kayıt Bulunamadı', 
  aciklama, 
  aksiyonButon,
  className = '' 
}) {
  return (
    <div className={`ortak-bos-durum ${className}`}>
      <div className="ortak-bos-durum-ikon">{ikon}</div>
      <h3 className="ortak-bos-durum-baslik">{baslik}</h3>
      {aciklama && <p className="ortak-bos-durum-aciklama">{aciklama}</p>}
      {aksiyonButon && (
        <div className="ortak-bos-durum-aksiyon">
          {aksiyonButon}
        </div>
      )}
    </div>
  )
}

export function Buton({ 
  children, 
  varyant = 'primary', 
  ikon, 
  onClick, 
  disabled = false, 
  type = 'button',
  className = '',
  style = {} 
}) {
  return (
    <button
      type={type}
      className={`ortak-btn ortak-btn-${varyant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {ikon && <span>{ikon}</span>}
      {children}
    </button>
  )
}

