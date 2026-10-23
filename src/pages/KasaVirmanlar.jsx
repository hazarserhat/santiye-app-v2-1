import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'

const bugun = () => new Date().toISOString().slice(0, 10)

const KATEGORILER = {
  Kasalar: ['Merkez Kasa', 'Serhat Kasa', 'Abdullah Kasa', 'Fuat Kasa', 'Engin Hazar ( Fırat Tekstil Diyarbakır )'],
  Bankalar: ['Ziraat', 'QNB', 'Garanti', 'Garanti Havale', 'Emlak Bank Havale'],
  'Kredi Kartları': ['Ziraat Kredi Kartı', 'Garanti Kredi Kartı', 'Qnb Kredi Kartı']
}

const KALDIRILACAKLAR = ['Nakit', 'Şirket Kredi kartı', 'Şirket kredi kartı', 'Malikler Ödedi', 'Kişisel kredi kartı', 'Kişisel Kredi Kartı']

export default function KasaVirmanlar() {
  const { profile } = useAuth()
  
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [dbKasalar, setDbKasalar] = useState([])
  const [gelirler, setGelirler] = useState([])
  const [masraflar, setMasraflar] = useState([])
  const [kasaIslemleri, setKasaIslemleri] = useState([])
  const [yukleniyor, setYukleniyor] = useState(false)

  // Form State
  const [islemTipi, setIslemTipi] = useState('virman') // 'virman' | 'mutabakat'
  const [cikisKasasi, setCikisKasasi] = useState('')
  const [girisKasasi, setGirisKasasi] = useState('')
  const [mutabakatYonu, setMutabakatYonu] = useState('arti') // 'arti' | 'eksi'
  const [tutar, setTutar] = useState('')
  const [tarih, setTarih] = useState(bugun())
  const [notMetni, setNotMetni] = useState('')

  // Filtre State'leri
  const [filtreMuhasebe, setFiltreMuhasebe] = useState('hepsi')
  const [filtreKasa, setFiltreKasa] = useState('hepsi')
  const [filtreTip, setFiltreTip] = useState('hepsi')
  const [filtreBaslangic, setFiltreBaslangic] = useState('')
  const [filtreBitis, setFiltreBitis] = useState('')
  const [filtreAcik, setFiltreAcik] = useState(false)

  useEffect(() => {
    verileriYukle()
  }, [])

  const verileriYukle = async () => {
    // 1. Ödeme yöntemlerini DB'den çek (Masraflarla ID eşleştirmek için)
    const { data: oData } = await supabase.from('odeme_yontemleri').select('*').order('sira')
    const dbGelen = oData || []
    setDbKasalar(dbGelen)
    
    // UI'da gösterilecek tam listeyi sabit KATEGORILER'den oluştur
    let tumKasalar = []
    Object.values(KATEGORILER).forEach(liste => {
      liste.forEach(ad => {
        const dbKarsiligi = dbGelen.find(k => k.ad.toLowerCase() === ad.toLowerCase())
        tumKasalar.push({ ad, id: dbKarsiligi ? dbKarsiligi.id : null })
      })
    })
    
    setOdemeYontemleri(tumKasalar)
    
    // Default değerleri ayarla
    if (tumKasalar.length >= 2) {
      setCikisKasasi(tumKasalar[0].ad)
      setGirisKasasi(tumKasalar[1].ad)
    } else if (tumKasalar.length === 1) {
      setCikisKasasi(tumKasalar[0].ad)
      setGirisKasasi(tumKasalar[0].ad)
    }

    // 2. Gelirleri çek
    const { data: gData } = await supabase.from('gelirler').select('tahsilat_noktasi, tutar')
    setGelirler(gData || [])

    // 3. Masrafları çek
    const { data: mData } = await supabase.from('masraflar').select('odeme_yontemi_id, tutar')
    setMasraflar(mData || [])

    // 4. Kasa işlemlerini (Virman ve Mütabakat) çek
    const { data: kiData } = await supabase
      .from('kasa_islemleri')
      .select('*, profiles(ad_soyad)')
      .order('kayit_tarihi', { ascending: false })
    setKasaIslemleri(kiData || [])
  }

  // Bakiye Hesaplama
  const bakiyeHesapla = (kasaAdi, kasaId) => {
    let toplam = 0
    const lowerKasa = kasaAdi.toLowerCase()
    
    // Gelirlerdeki (Tahsilat Noktası) karşılığını bul (Bankalar için "Ruha " ön eki kullanılıyor)
    let gelirKasaAdi = kasaAdi
    if (lowerKasa === 'ziraat') gelirKasaAdi = 'Ruha Ziraat'
    if (lowerKasa === 'qnb') gelirKasaAdi = 'Ruha QNB'
    if (lowerKasa === 'garanti' || lowerKasa === 'garanti havale') gelirKasaAdi = 'Ruha Garanti'
    if (lowerKasa === 'emlak bank havale') gelirKasaAdi = 'Ruha Emlak Bank'

    // + Gelirler
    gelirler.forEach(g => {
      if (g.tahsilat_noktasi === gelirKasaAdi || g.tahsilat_noktasi === kasaAdi) {
        toplam += Number(g.tutar)
      }
    })

    // - Masraflar (Masraflar sayfasında kasaId 'odeme_yontemi_id' alanında tutuluyor)
    masraflar.forEach(m => {
      if (m.odeme_yontemi_id === kasaId) {
        toplam -= Number(m.tutar)
      }
    })

    // Kasa İşlemleri (Virman ve Mütabakat)
    kasaIslemleri.forEach(islem => {
      if (islem.tip === 'virman') {
        if (islem.giris_noktasi === kasaAdi) toplam += Number(islem.tutar)
        if (islem.cikis_noktasi === kasaAdi) toplam -= Number(islem.tutar)
      } else if (islem.tip === 'mutabakat_arti') {
        if (islem.giris_noktasi === kasaAdi) toplam += Number(islem.tutar)
      } else if (islem.tip === 'mutabakat_eksi') {
        if (islem.cikis_noktasi === kasaAdi) toplam -= Number(islem.tutar)
      }
    })

    return toplam
  }

  const islemKaydet = async () => {
    if (!tutar || Number(temizleTutar(tutar)) <= 0) {
      alert('Geçerli bir tutar giriniz.')
      return
    }

    setYukleniyor(true)
    let tip = islemTipi
    let cikis = null
    let giris = null

    if (islemTipi === 'virman') {
      if (!cikisKasasi || !girisKasasi) {
        alert('Lütfen çıkış ve giriş kasasını seçin.')
        setYukleniyor(false)
        return
      }
      if (cikisKasasi === girisKasasi) {
        alert('Çıkış ve giriş kasası aynı olamaz.')
        setYukleniyor(false)
        return
      }
      cikis = cikisKasasi
      giris = girisKasasi
    } else {
      if (!cikisKasasi) {
        alert('Lütfen kasa seçin.')
        setYukleniyor(false)
        return
      }
      if (mutabakatYonu === 'arti') {
        tip = 'mutabakat_arti'
        giris = cikisKasasi
      } else {
        tip = 'mutabakat_eksi'
        cikis = cikisKasasi
      }
    }

    const { error } = await supabase.from('kasa_islemleri').insert({
      tip,
      cikis_noktasi: cikis,
      giris_noktasi: giris,
      tutar: temizleTutar(tutar),
      tarih,
      not_metni: notMetni,
      ekleyen: profile?.id
    })

    if (error) {
      alert('İşlem kaydedilemedi: ' + error.message)
    } else {
      setTutar('')
      setNotMetni('')
      verileriYukle()
    }
    setYukleniyor(false)
  }

  const islemSil = async (id) => {
    if (!window.confirm('Bu işlemi silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('kasa_islemleri').delete().eq('id', id)
    if (error) {
      alert('Silinemedi: ' + error.message)
    } else {
      verileriYukle()
    }
  }

  const muhasebePaylasimGuncelle = async (id, deger) => {
    const { error } = await supabase.from('kasa_islemleri').update({ muhasebe_paylasim: deger }).eq('id', id)
    if (error) {
      alert("Durum güncellenirken hata oluştu. Lütfen sayfayı yenileyin.\nDetay: " + error.message)
      return
    }
    setKasaIslemleri((onceki) => onceki.map((islem) => islem.id === id ? { ...islem, muhasebe_paylasim: deger } : islem))
  }

  const whatsappGorselliPaylas = (islem) => {
    let baslik = ''
    if (islem.tip === 'virman') {
      baslik = '🔄 VİRMAN (TRANSFER)'
    } else if (islem.tip === 'mutabakat_arti') {
      baslik = '🟢 KASA BÜYÜMESİ (GİRİŞ)'
    } else if (islem.tip === 'mutabakat_eksi') {
      baslik = '🔴 KASA KÜÇÜLMESİ (ÇIKIŞ)'
    }

    const metin = 
      `💰 *KASA İŞLEM BİLDİRİMİ*\n` +
      `📌 *İşlem Tipi:* ${baslik}\n` +
      `💵 *Tutar:* ${paraFormatla(islem.tutar)} ₺\n` +
      (islem.tip === 'virman' ? `📤 *Çıkış Kasası:* ${islem.cikis_noktasi}\n📥 *Giriş Kasası:* ${islem.giris_noktasi}\n` : '') +
      (islem.tip === 'mutabakat_arti' ? `📥 *İlgili Kasa:* ${islem.giris_noktasi}\n` : '') +
      (islem.tip === 'mutabakat_eksi' ? `📤 *İlgili Kasa:* ${islem.cikis_noktasi}\n` : '') +
      `📅 *Tarih:* ${new Date(islem.tarih).toLocaleDateString('tr-TR')}\n` +
      (islem.not_metni ? `📝 *Not:* ${islem.not_metni}\n` : '') +
      `👤 *İşlemi Yapan:* ${islem.profiles?.ad_soyad || 'Bilinmiyor'}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(metin)}`
    window.open(whatsappUrl, '_blank')
  }

  // Filtrelenmiş Kasa İşlemleri (Geçmiş Zaman Çizelgesi İçin)
  const gorunenKasaIslemleri = kasaIslemleri
    .filter(islem => {
      if (filtreMuhasebe === 'paylasildi') return !!islem.muhasebe_paylasim
      if (filtreMuhasebe === 'paylasilmadi') return !islem.muhasebe_paylasim
      return true
    })
    .filter(islem => {
      if (filtreKasa === 'hepsi') return true
      return islem.cikis_noktasi === filtreKasa || islem.giris_noktasi === filtreKasa
    })
    .filter(islem => {
      if (filtreTip === 'hepsi') return true
      if (filtreTip === 'virman') return islem.tip === 'virman'
      if (filtreTip === 'mutabakat') return islem.tip?.startsWith('mutabakat')
      return true
    })
    .filter(islem => {
      if (!filtreBaslangic && !filtreBitis) return true
      if (!islem.tarih) return false
      if (filtreBaslangic && islem.tarih < filtreBaslangic) return false
      if (filtreBitis && islem.tarih > filtreBitis) return false
      return true
    })

  return (
    <div className="sayfa">
      <div className="sayfa-baslik">
        <h2>🏦 Kasa İşlemleri & Virmanlar</h2>
      </div>


      {/* Yeni İşlem Ekleme Kutusu */}
      <div className="ekleme-kutusu" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
          <button 
            onClick={() => setIslemTipi('virman')}
            style={{
              flex: 1, padding: 10, borderRadius: 8, fontWeight: 600,
              background: islemTipi === 'virman' ? '#e3f2fd' : '#f5f5f5',
              color: islemTipi === 'virman' ? '#1976d2' : '#757575',
              border: `1px solid ${islemTipi === 'virman' ? '#90caf9' : '#e0e0e0'}`
            }}
          >
            🔄 Virman (Transfer)
          </button>
          <button 
            onClick={() => setIslemTipi('mutabakat')}
            style={{
              flex: 1, padding: 10, borderRadius: 8, fontWeight: 600,
              background: islemTipi === 'mutabakat' ? '#f3e5f5' : '#f5f5f5',
              color: islemTipi === 'mutabakat' ? '#8e24aa' : '#757575',
              border: `1px solid ${islemTipi === 'mutabakat' ? '#ce93d8' : '#e0e0e0'}`
            }}
          >
            ⚖️ Kasa Mütabakatı
          </button>
        </div>

        {islemTipi === 'virman' ? (
          <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Çıkış Yapılacak Kasa</label>
              <select value={cikisKasasi} onChange={(e) => setCikisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Giriş Yapılacak Kasa</label>
              <select value={girisKasasi} onChange={(e) => setGirisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>İlgili Kasa</label>
              <select value={cikisKasasi} onChange={(e) => setCikisKasasi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                {odemeYontemleri.map(k => <option key={k.id} value={k.ad}>{k.ad}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>İşlem Yönü</label>
              <select value={mutabakatYonu} onChange={(e) => setMutabakatYonu(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                <option value="arti">🟢 Bakiye Ekle (+)</option>
                <option value="eksi">🔴 Bakiye Çıkar (-)</option>
              </select>
            </div>
          </div>
        )}

        <div className="ekleme-satiri-2" style={{ marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tutar (₺)</label>
            <input type="text" placeholder="Tutar..." value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tarih</label>
            <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
          </div>
        </div>

        <textarea
          placeholder="İşlem açıklaması / notu..."
          value={notMetni}
          onChange={(e) => setNotMetni(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <button className="ekle-buton-genis" onClick={islemKaydet} disabled={yukleniyor} style={{ marginTop: 8 }}>
          {yukleniyor ? 'Kaydediliyor...' : 'İşlemi Kaydet'}
        </button>
      </div>

      {/* FİLTRE ALANI */}
      <div style={{ marginBottom: 14 }}>
        <button className="ekle-buton-genis" onClick={() => setFiltreAcik(!filtreAcik)}>
          {filtreAcik ? 'Filtreleri Gizle' : (
            (filtreMuhasebe !== 'hepsi' || filtreKasa !== 'hepsi' || filtreTip !== 'hepsi' || filtreBaslangic || filtreBitis)
              ? 'Filtreleri Göster (Aktif Filtre Var)'
              : 'Filtreleri Göster'
          )}
        </button>
      </div>

      {filtreAcik && (
        <div className="ekleme-kutusu" style={{ marginBottom: 15, background: '#fdfdfd' }}>
          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Muhasebe Paylaşım Durumu</p>
          <select value={filtreMuhasebe} onChange={(e) => setFiltreMuhasebe(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tümü</option>
            <option value="paylasildi">✓ Muhasebe ile Paylaşıldı</option>
            <option value="paylasilmadi">⏳ Muhasebe ile Paylaşılmadı</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Kasa / Hesap Filtresi</p>
          <select value={filtreKasa} onChange={(e) => setFiltreKasa(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm Kasalar / Hesaplar</option>
            {odemeYontemleri.map(k => <option key={k.id || k.ad} value={k.ad}>{k.ad}</option>)}
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>İşlem Türü</p>
          <select value={filtreTip} onChange={(e) => setFiltreTip(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6 }}>
            <option value="hepsi">Tüm İşlemler</option>
            <option value="virman">🔄 Virman (Transfer)</option>
            <option value="mutabakat">⚖️ Kasa Mütabakatı</option>
          </select>

          <p style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 5 }}>Tarih Aralığı</p>
          <div className="ekleme-satiri-2">
            <input type="date" value={filtreBaslangic} onChange={(e) => setFiltreBaslangic(e.target.value)} />
            <input type="date" value={filtreBitis} onChange={(e) => setFiltreBitis(e.target.value)} />
          </div>

          {(filtreBaslangic || filtreBitis || filtreMuhasebe !== 'hepsi' || filtreKasa !== 'hepsi' || filtreTip !== 'hepsi') && (
            <button
              onClick={() => {
                setFiltreBaslangic('')
                setFiltreBitis('')
                setFiltreMuhasebe('hepsi')
                setFiltreKasa('hepsi')
                setFiltreTip('hepsi')
              }}
              style={{ marginTop: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#0F6E56', cursor: 'pointer', padding: 0 }}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      )}

      {/* Zaman Çizelgesi (Timeline) */}
      <div className="liste">
        <h3 style={{ fontSize: 14, color: '#2C3E50', marginBottom: 12, paddingLeft: 4 }}>Geçmiş İşlemler</h3>
        
        {gorunenKasaIslemleri.map(islem => {
          let renk = '#e0e0e0'
          let baslik = ''
          let ikon = ''
          let bg = '#fff'
          
          if (islem.tip === 'virman') {
            renk = '#2196F3'
            baslik = `${islem.cikis_noktasi} ➔ ${islem.giris_noktasi}`
            ikon = '🔄'
            bg = '#e3f2fd'
          } else if (islem.tip === 'mutabakat_arti') {
            renk = '#4CAF50'
            baslik = `${islem.giris_noktasi} (Ekleme)`
            ikon = '🟢'
            bg = '#e8f5e9'
          } else if (islem.tip === 'mutabakat_eksi') {
            renk = '#F44336'
            baslik = `${islem.cikis_noktasi} (Çıkarma)`
            ikon = '🔴'
            bg = '#ffebee'
          }

          return (
            <div key={islem.id} className="kart" style={{ borderLeft: `4px solid ${renk}`, padding: '12px 16px', background: '#fff' }}>
              <div className="kart-ust" style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, padding: '4px 8px', borderRadius: 6 }}>
                  <span style={{ fontSize: 14 }}>{ikon}</span>
                  <span className="kart-baslik" style={{ fontSize: 13, color: renk, fontWeight: 700 }}>{baslik}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="kart-tutar" style={{ color: '#2C3E50', fontSize: 15, fontWeight: 800 }}>{paraFormatla(islem.tutar)} ₺</span>
                  <button className="sil-buton" onClick={() => islemSil(islem.id)} aria-label="Sil">🗑</button>
                </div>
              </div>
              
              {islem.not_metni && <p className="not-icerik" style={{ margin: '8px 0', fontSize: 13, color: '#455a64' }}>{islem.not_metni}</p>}
              
              <div className="kart-alt-tarih" style={{ fontSize: 11, color: '#888', marginTop: 6, marginBottom: 8 }}>
                <span>{new Date(islem.tarih).toLocaleDateString('tr-TR')}</span>
                <span>Ekleyen: {islem.profiles?.ad_soyad || 'Bilinmiyor'}</span>
              </div>

              <div style={{ borderTop: '1px solid #eee', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Muhasebe Paylaşım Kutucuğu */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 6,
                  background: islem.muhasebe_paylasim ? '#E6F9F0' : '#FFF8E1',
                  border: `1px solid ${islem.muhasebe_paylasim ? '#4CAF50' : '#FFD54F'}`,
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color: islem.muhasebe_paylasim ? '#0B6B41' : '#F57F17',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={islem.muhasebe_paylasim || false}
                    onChange={(e) => muhasebePaylasimGuncelle(islem.id, e.target.checked)}
                    style={{ accentColor: '#4CAF50', width: 16, height: 16 }}
                  />
                  {islem.muhasebe_paylasim ? '✓ Muhasebeye gönderildi' : 'Muhasebe ile paylaşıldı mı?'}
                </label>

                {/* WhatsApp Paylaş */}
                <button
                  className="ekle-buton-genis"
                  onClick={() => whatsappGorselliPaylas(islem)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', fontSize: 12 }}
                >
                  💬 WhatsApp ile Paylaş
                </button>
              </div>

            </div>
          )
        })}
        {gorunenKasaIslemleri.length === 0 && <p className="bos-mesaj">Henüz kasa işlemi bulunmuyor (veya filtreye uygun kayıt yok).</p>}
      </div>

    </div>
  )
}
