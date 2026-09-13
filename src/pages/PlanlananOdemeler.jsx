import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSite } from '../context/SiteContext'
import { useAuth } from '../context/AuthContext'
import { paraFormatla, sadeceSayiTuslari, formatInputTutar, temizleTutar } from '../lib/format'
import CariAramaSecici from '../components/CariAramaSecici'
import { icsOlustur } from '../lib/takvim'

const bugun = () => new Date().toISOString().slice(0, 10)

export default function PlanlananOdemeler() {
  const { aktifSantiye } = useSite()
  const { profile } = useAuth()
  const yonetici = profile?.rol === 'yonetici' || profile?.rol === 'koordinator'
  
  const [odemeler, setOdemeler] = useState([])
  const [kategoriler, setKategoriler] = useState([])
  const [odemeYontemleri, setOdemeYontemleri] = useState([])
  const [santiyeler, setSantiyeler] = useState([])
  
  const [yukleniyor, setYukleniyor] = useState(false)
  const [baslik, setBaslik] = useState('')
  const [tutar, setTutar] = useState('')
  const [vadeTarihi, setVadeTarihi] = useState(bugun())
  const [kategoriId, setKategoriId] = useState('')
  const [siklik, setSiklik] = useState('bir_kez')
  const [notMetni, setNotMetni] = useState('')
  
  const [odenenKisi, setOdenenKisi] = useState('')
  const [secilenCariId, setSecilenCariId] = useState(null)
  
  // Masrafa Aktarma (Ödeme) Modalı State'leri
  const [odeModalId, setOdeModalId] = useState(null)
  const [odeYontemiId, setOdeYontemiId] = useState('')
  const [odeTaksitSayisi, setOdeTaksitSayisi] = useState(1)
  const [odeTarihi, setOdeTarihi] = useState(bugun())
  const [odeYukleniyor, setOdeYukleniyor] = useState(false)

  // Çekle Ödeme State'leri
  const [odeTip, setOdeTip] = useState('masraf') // 'masraf' | 'cek'
  const [odeCekBanka, setOdeCekBanka] = useState('')
  const [odeCekSeriNo, setOdeCekSeriNo] = useState('')
  const [odeCekVadesi, setOdeCekVadesi] = useState('')
  const [bankalar, setBankalar] = useState([])

  // Düzenleme State'leri
  const [duzenlenenId, setDuzenlenenId] = useState(null)
  const [duzBaslik, setDuzBaslik] = useState('')
  const [duzTutar, setDuzTutar] = useState('')
  const [duzVadeTarihi, setDuzVadeTarihi] = useState('')
  const [duzSiklik, setDuzSiklik] = useState('bir_kez')
  const [duzKategoriId, setDuzKategoriId] = useState('')
  const [duzNotMetni, setDuzNotMetni] = useState('')
  const [duzOdenenKisi, setDuzOdenenKisi] = useState('')
  const [duzCariId, setDuzCariId] = useState(null)
  const [duzSantiyeId, setDuzSantiyeId] = useState('')

  const [filtreDurum, setFiltreDurum] = useState('bekliyor') // 'bekliyor' | 'odendi' | 'iptal'
  const [secilenSantiyeId, setSecilenSantiyeId] = useState('')

  useEffect(() => {
    odemeleriYukle()
    
    supabase.from('masraf_kategorileri').select('*').order('ad').then(({ data }) => {
      setKategoriler(data || [])
      if (data?.length) setKategoriId(data[0].id)
    })

    supabase.from('cek_bankalari').select('*').order('ad').then(({ data }) => {
      setBankalar(data || [])
    })

    supabase.from('odeme_yontemleri').select('*').order('sira').then(({ data }) => {
      const filtrelenmis = profile?.rol === 'santiye_sefi' 
        ? data?.filter(o => o.sef_gorebilir) 
        : data?.filter(o => o.yonetici_gorebilir)
      setOdemeYontemleri(filtrelenmis || [])
      if (filtrelenmis?.length) setOdeYontemiId(filtrelenmis[0].id)
    })

    supabase.from('santiyeler').select('*').order('ad').then(({ data }) => {
      setSantiyeler(data || [])
    })
  }, [aktifSantiye, profile])

  useEffect(() => {
    if (aktifSantiye) setSecilenSantiyeId(aktifSantiye.id)
  }, [aktifSantiye])

  const odemeleriYukle = async () => {
    let query = supabase
      .from('planlanan_odemeler')
      .select('*, masraf_kategorileri(ad), taseronlar(ad)')
      .order('vade_tarihi', { ascending: true })
      
    const { data, error } = await query
    if (error) {
      console.error('Planlanan ödemeler yüklenirken hata:', error)
      return
    }
    setOdemeler(data || [])
  }

  const planliOdemeEkle = async () => {
    if (!baslik.trim() || !tutar) {
      alert("Lütfen başlık ve tutar giriniz.")
      return
    }
    setYukleniyor(true)

    let finalCariId = secilenCariId
    let finalCariAdi = odenenKisi
    if (!finalCariId && odenenKisi.trim()) {
      const { data: eslesenler } = await supabase.from('taseronlar').select('*').ilike('ad', odenenKisi.trim()).limit(1)
      if (eslesenler && eslesenler.length > 0) {
        finalCariId = eslesenler[0].id
        finalCariAdi = eslesenler[0].ad
      } else {
        const { data: yeniTaseron } = await supabase.from('taseronlar').insert({ ad: odenenKisi.trim(), sef_gorunur: true }).select().single()
        if (yeniTaseron) {
          finalCariId = yeniTaseron.id
          finalCariAdi = yeniTaseron.ad
        }
      }
    }

    const { error } = await supabase.from('planlanan_odemeler').insert({
      santiye_id: secilenSantiyeId === 'genel' ? null : secilenSantiyeId,
      baslik: baslik,
      tutar: temizleTutar(tutar),
      vade_tarihi: vadeTarihi,
      kategori_id: kategoriId || null,
      siklik: siklik,
      not_metni: notMetni,
      cari_id: finalCariId || null,
      durum: 'bekliyor',
      ekleyen: profile?.id
    })

    if (error) {
      alert("Eklenirken hata oluştu: " + error.message)
      setYukleniyor(false)
      return
    }

    setBaslik('')
    setTutar('')
    setNotMetni('')
    setOdenenKisi('')
    setSecilenCariId(null)
    setSiklik('bir_kez')
    setVadeTarihi(bugun())
    setYukleniyor(false)
    odemeleriYukle()
  }

  const odemeIptalEt = async (id) => {
    if (!window.confirm("Bu ödeme planını iptal etmek/silmek istediğinize emin misiniz? (Eğer tekrarlayan bir ödemeyse sonraki aylar için de iptal edilmiş olur.)")) return
    
    // Geçmiş veri kalması için delete yerine durum='iptal' yapıyoruz
    const { error } = await supabase.from('planlanan_odemeler').update({ durum: 'iptal' }).eq('id', id)
    if (error) {
      alert("İptal edilemedi: " + error.message)
      return
    }
    odemeleriYukle()
  }

  const odemeDuzenle = async (id) => {
    if (!duzBaslik.trim() || !duzTutar) return
    const guncelTutar = temizleTutar(duzTutar)

    const { error } = await supabase.from('planlanan_odemeler').update({
      santiye_id: duzSantiyeId === 'genel' ? null : duzSantiyeId,
      baslik: duzBaslik,
      tutar: guncelTutar,
      vade_tarihi: duzVadeTarihi,
      siklik: duzSiklik,
      kategori_id: duzKategoriId || null,
      not_metni: duzNotMetni,
      cari_id: duzCariId || null
    }).eq('id', id)

    if (error) { alert('Güncellenemedi: ' + error.message); return }
    setDuzenlenenId(null)
    odemeleriYukle()
  }

  const masrafaAktar = async (plan) => {
    if (odeTip === 'masraf' && !odeYontemiId) {
      alert("Lütfen ödemenin yapıldığı hesabı / kasayı seçiniz.")
      return
    }
    if (odeTip === 'cek' && (!odeCekBanka || !odeCekVadesi)) {
      alert("Lütfen Çek Bankası ve Vadesi seçiniz.")
      return
    }
    setOdeYukleniyor(true)
    let yeniMasrafId = null

    if (odeTip === 'masraf') {
      const taksit = parseInt(odeTaksitSayisi) || 1
      const finalBaslik = taksit > 1 ? `${plan.baslik} (Planlı Ödemeden, ${taksit} Taksit)` : `${plan.baslik} (Planlı Ödemeden)`

      const masrafData = {
        santiye_id: plan.santiye_id,
        kategori_id: plan.kategori_id,
        baslik: finalBaslik,
        odenen_kisi: plan.taseronlar?.ad || '',
        cari_id: plan.cari_id,
        aciklama: plan.not_metni,
        tutar: plan.tutar,
        taksit_sayisi: taksit,
        odeme_yontemi_id: odeYontemiId,
        harcama_tarihi: odeTarihi,
        ekleyen: profile?.id
      }

      const { data: yeniMasraf, error: masrafErr } = await supabase.from('masraflar').insert([masrafData]).select().single()
      if (masrafErr) {
        alert("Masrafa aktarılırken hata: " + masrafErr.message)
        setOdeYukleniyor(false)
        return
      }
      yeniMasrafId = yeniMasraf.id
    } else {
      const cekData = {
        odeme_konusu: plan.baslik + " (Planlı Ödemeden)",
        santiye_id: plan.santiye_id,
        odeyen: profile?.ad_soyad || 'Firma',
        odenen: plan.taseronlar?.ad || '',
        cari_id: plan.cari_id,
        cek_seri_no: odeCekSeriNo,
        banka: odeCekBanka,
        verilis_tarihi: odeTarihi,
        cek_vadesi: odeCekVadesi,
        tutar: plan.tutar,
        aciklama: plan.not_metni,
        yon: 'verilen',
        ekleyen: profile?.id
      }
      const { error: cekErr } = await supabase.from('cekler').insert([cekData])
      if (cekErr) {
        alert("Çeklere aktarılırken hata: " + cekErr.message)
        setOdeYukleniyor(false)
        return
      }
    }

    // 2. Planlanan ödemeyi "odendi" yap
    await supabase.from('planlanan_odemeler').update({ 
      durum: 'odendi', 
      odenen_tarih: odeTarihi,
      masraf_id: yeniMasrafId
    }).eq('id', plan.id)

    // 3. Tekrarlayan ödemeyse (Aylık veya Haftalık) yeni planı oluştur
    if (plan.siklik === 'aylik' || plan.siklik === 'haftalik') {
      const yeniVade = new Date(plan.vade_tarihi)
      if (plan.siklik === 'aylik') {
        yeniVade.setMonth(yeniVade.getMonth() + 1)
      } else {
        yeniVade.setDate(yeniVade.getDate() + 7)
      }

      await supabase.from('planlanan_odemeler').insert({
        santiye_id: plan.santiye_id,
        baslik: plan.baslik,
        tutar: plan.tutar,
        vade_tarihi: yeniVade.toISOString().slice(0, 10),
        kategori_id: plan.kategori_id,
        siklik: plan.siklik,
        not_metni: plan.not_metni,
        cari_id: plan.cari_id,
        durum: 'bekliyor',
        ekleyen: profile?.id
      })
    }

    setOdeModalId(null)
    setOdeTarihi(bugun())
    setOdeTaksitSayisi(1)
    setOdeTip('masraf')
    setOdeCekBanka('')
    setOdeCekSeriNo('')
    setOdeCekVadesi('')
    setOdeYukleniyor(false)
    odemeleriYukle()
  }

  let gorunenler = odemeler.filter(o => o.durum === filtreDurum)

  const seciliOdeYontemi = odemeYontemleri.find(o => o.id === odeYontemiId)
  const isOdeKrediKarti = seciliOdeYontemi && seciliOdeYontemi.ad.toLowerCase().includes('kart')

  // Vadeye Göre Kart Renkleri
  const vadeRengiGetir = (vadeStr) => {
    const vade = new Date(vadeStr).getTime()
    const simdi = new Date(bugun()).getTime()
    const ucGun = 3 * 24 * 60 * 60 * 1000
    
    if (vade < simdi) return '#FEE2E2' // Gecikmiş (Kırmızı)
    if (vade - simdi <= ucGun) return '#FEF3C7' // Yaklaşmış (Sarı)
    return '#ffffff' // Normal
  }

  const vadeMetniGetir = (vadeStr) => {
    const vade = new Date(vadeStr).getTime()
    const simdi = new Date(bugun()).getTime()
    const farkGun = Math.ceil((vade - simdi) / (1000 * 60 * 60 * 24))
    
    if (farkGun < 0) return `Vadesi ${Math.abs(farkGun)} gün gecikti`
    if (farkGun === 0) return 'Vadesi Bugün!'
    return `${farkGun} gün kaldı`
  }

  const siklikEtiketi = (s) => {
    switch (s) {
      case 'haftalik': return '🔁 Haftalık'
      case 'aylik': return '🔁 Aylık'
      case 'manuel': return '✍️ Manuel Periyot'
      default: return '1 Kez'
    }
  }

  return (
    <div>
      <div className="ekleme-kutusu" style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#0F6E56' }}>Yeni Ödeme Planla</p>
        
        <select value={secilenSantiyeId} onChange={e => setSecilenSantiyeId(e.target.value)} style={{ marginBottom: 8, width: '100%', padding: 8, borderRadius: 6 }}>
          {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
          <option value="genel">Genel Gider (Şantiyeye Bağlı Değil)</option>
        </select>
        
        <input type="text" placeholder="Ödeme Başlığı (Maaş, Hakediş vb.)..." value={baslik} onChange={e => setBaslik(e.target.value)} />
        
        <CariAramaSecici 
          deger={odenenKisi} 
          onDegisti={(isim, id) => { setOdenenKisi(isim); setSecilenCariId(id || null); }} 
          placeholder="İlgili Kişi / Firma Seçimi (Opsiyonel)" 
        />
        
        <div className="ekleme-satiri-2">
          <input type="text" placeholder="Tutar (₺)" value={tutar} onChange={(e) => setTutar(formatInputTutar(e.target.value))} onKeyDown={sadeceSayiTuslari} />
          <select value={kategoriId} onChange={e => setKategoriId(e.target.value)}>
            {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        </div>

        <div className="ekleme-satiri-2">
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Vade Tarihi</label>
            <input type="date" value={vadeTarihi} onChange={e => setVadeTarihi(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2, display: 'block' }}>Tekrarlama Sıklığı</label>
            <select value={siklik} onChange={e => setSiklik(e.target.value)}>
              <option value="bir_kez">Tek Seferlik (1 Kez)</option>
              <option value="haftalik">Haftalık</option>
              <option value="aylik">Aylık</option>
              <option value="manuel">Manuel</option>
            </select>
          </div>
        </div>

        <textarea
          placeholder="Açıklama / not (opsiyonel)..."
          value={notMetni}
          onChange={(e) => setNotMetni(e.target.value)}
          rows={2}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
        />

        <button className="ekle-buton-genis" onClick={planliOdemeEkle} disabled={yukleniyor} style={{ marginTop: 8 }}>
          {yukleniyor ? 'Planlanıyor...' : 'Takvime Ekle'}
        </button>
      </div>

      <div className="gorunum-secici" style={{ marginBottom: 14 }}>
        <button className={filtreDurum === 'bekliyor' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('bekliyor')}>Bekleyenler</button>
        <button className={filtreDurum === 'odendi' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('odendi')}>Ödenenler</button>
        <button className={filtreDurum === 'iptal' ? 'secili-tab' : ''} onClick={() => setFiltreDurum('iptal')}>İptaller</button>
      </div>

      <div className="liste">
        {gorunenler.map(plan => (
          <div key={plan.id} className="kart" style={{ background: filtreDurum === 'bekliyor' ? vadeRengiGetir(plan.vade_tarihi) : '#fff', borderColor: filtreDurum === 'bekliyor' && vadeRengiGetir(plan.vade_tarihi) !== '#ffffff' ? '#F59E0B' : '#E2E8F0' }}>
            
            {duzenlenenId === plan.id && yonetici ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontWeight: 700, color: '#0F6E56', fontSize: 13, margin: '0 0 4px 0' }}>Planı Düzenle</p>
                <select value={duzSantiyeId} onChange={e => setDuzSantiyeId(e.target.value)} style={{ padding: 8, borderRadius: 6 }}>
                  <option value="genel">Genel Gider (Şantiyeye Bağlı Değil)</option>
                  {santiyeler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
                <input type="text" value={duzBaslik} onChange={(e) => setDuzBaslik(e.target.value)} placeholder="Ödeme Başlığı" />
                <CariAramaSecici deger={duzOdenenKisi} onDegisti={(isim, id) => { setDuzOdenenKisi(isim); setDuzCariId(id || null); }} placeholder="İlgili Kişi / Firma" />
                <div className="ekleme-satiri-2">
                  <input type="text" value={duzTutar} onChange={(e) => setDuzTutar(formatInputTutar(e.target.value))} placeholder="Tutar (₺)" onKeyDown={sadeceSayiTuslari} />
                  <select value={duzKategoriId} onChange={e => setDuzKategoriId(e.target.value)}>
                    <option value="">Kategori...</option>
                    {kategoriler.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
                  </select>
                </div>
                <div className="ekleme-satiri-2">
                  <input type="date" value={duzVadeTarihi} onChange={e => setDuzVadeTarihi(e.target.value)} />
                  <select value={duzSiklik} onChange={e => setDuzSiklik(e.target.value)}>
                    <option value="bir_kez">Tek Seferlik (1 Kez)</option>
                    <option value="haftalik">Haftalık</option>
                    <option value="aylik">Aylık</option>
                    <option value="manuel">Manuel</option>
                  </select>
                </div>
                <textarea value={duzNotMetni} onChange={(e) => setDuzNotMetni(e.target.value)} placeholder="Açıklama / Not" rows={2} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D3D1C7', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setDuzenlenenId(null)} style={{ flex: 1, padding: '8px', background: '#f0f0ed', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Vazgeç</button>
                  <button onClick={() => odemeDuzenle(plan.id)} style={{ flex: 1, padding: '8px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Değişiklikleri Kaydet</button>
                </div>
              </div>
            ) : odeModalId === plan.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontWeight: 700, color: '#0F6E56', fontSize: 14, margin: 0 }}>Ödemeyi Gerçekleştir</p>
                
                <div className="gorunum-secici" style={{ marginBottom: 4 }}>
                  <button className={odeTip === 'masraf' ? 'secili-tab' : ''} onClick={() => setOdeTip('masraf')} style={{ padding: '6px 8px', fontSize: 12 }}>Nakit / Kasa ile</button>
                  <button className={odeTip === 'cek' ? 'secili-tab' : ''} onClick={() => setOdeTip('cek')} style={{ padding: '6px 8px', fontSize: 12 }}>Çek Keserek</button>
                </div>
                
                <div className="ekleme-satiri-2">
                  <label style={{ fontSize: 11, color: '#666', marginTop: 4 }}>İşlem Tarihi:</label>
                  <input type="date" value={odeTarihi} onChange={e => setOdeTarihi(e.target.value)} />
                </div>

                {odeTip === 'masraf' ? (
                  <>
                    <div className="ekleme-satiri-2">
                      <select value={odeYontemiId} onChange={e => setOdeYontemiId(e.target.value)}>
                        <option value="">Ödeme Yapılan Kasa/Banka...</option>
                        {odemeYontemleri.map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
                      </select>
                    </div>
                    {isOdeKrediKarti && (
                      <div style={{ padding: 8, background: '#FFF3E0', borderRadius: 6, border: '1px solid #FFE0B2', marginBottom: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 'bold', color: '#E65100', display: 'block', marginBottom: 4 }}>Taksit Sayısı</label>
                        <select value={odeTaksitSayisi} onChange={(e) => setOdeTaksitSayisi(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #FFCC80' }}>
                          <option value={1}>Peşin (Tek Çekim)</option>
                          {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n} Taksit</option>)}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="ekleme-satiri-2">
                      <select value={odeCekBanka} onChange={e => setOdeCekBanka(e.target.value)}>
                        <option value="">-- Çek Bankası Seç --</option>
                        {bankalar.map(b => <option key={b.id} value={b.ad}>{b.ad}</option>)}
                      </select>
                      <input type="text" placeholder="Çek Seri No" value={odeCekSeriNo} onChange={e => setOdeCekSeriNo(e.target.value)} />
                    </div>
                    <div className="ekleme-satiri-2">
                      <label style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Çek Vadesi:</label>
                      <input type="date" value={odeCekVadesi} onChange={e => setOdeCekVadesi(e.target.value)} />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setOdeModalId(null)} style={{ flex: 1, padding: '8px', background: '#f0f0ed', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Vazgeç</button>
                  <button onClick={() => masrafaAktar(plan)} disabled={odeYukleniyor} style={{ flex: 1, padding: '8px', background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                    {odeYukleniyor ? 'İşleniyor...' : (odeTip === 'masraf' ? 'Masrafa Yaz' : 'Çeklere Aktar')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="kart-ust">
                  <span className="kart-baslik">{plan.baslik} {plan.taseronlar?.ad ? `(${plan.taseronlar.ad})` : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="kart-tutar">{paraFormatla(plan.tutar)} ₺</span>
                    {filtreDurum === 'bekliyor' && yonetici && (
                      <>
                        <button className="sil-buton" onClick={() => {
                          setDuzenlenenId(plan.id)
                          setDuzSantiyeId(plan.santiye_id || 'genel')
                          setDuzBaslik(plan.baslik)
                          setDuzTutar(formatInputTutar(plan.tutar))
                          setDuzVadeTarihi(plan.vade_tarihi)
                          setDuzSiklik(plan.siklik || 'bir_kez')
                          setDuzKategoriId(plan.kategori_id || '')
                          setDuzNotMetni(plan.not_metni || '')
                          setDuzOdenenKisi(plan.taseronlar?.ad || '')
                          setDuzCariId(plan.cari_id || null)
                        }} aria-label="Düzenle" title="Düzenle">✎</button>
                        <button className="sil-buton" onClick={() => odemeIptalEt(plan.id)} aria-label="İptal Et" title="İptal Et/Sil">🗑</button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="etiket-satiri">
                  <span className="etiket etiket-vurgu">Vade: {new Date(plan.vade_tarihi).toLocaleDateString('tr-TR')}</span>
                  <span className="etiket">{plan.masraf_kategorileri?.ad}</span>
                  {plan.siklik !== 'bir_kez' && (
                    <span className="etiket" style={{ background: '#E0F2FE', color: '#0369A1', borderColor: '#BAE6FD' }}>
                      {siklikEtiketi(plan.siklik)}
                    </span>
                  )}
                </div>

                {filtreDurum === 'bekliyor' && (
                  <p style={{ margin: '6px 0 0 0', fontSize: 12, fontWeight: 600, color: vadeRengiGetir(plan.vade_tarihi) === '#FEE2E2' ? '#DC2626' : '#D97706' }}>
                    ⏳ {vadeMetniGetir(plan.vade_tarihi)}
                  </p>
                )}
                
                {plan.not_metni && <p className="not-icerik" style={{ marginTop: 6 }}>{plan.not_metni}</p>}
                
                {filtreDurum === 'odendi' && (
                  <p style={{ margin: '6px 0 0 0', fontSize: 11, color: '#0F6E56', fontWeight: 600 }}>✅ Ödenen Tarih: {new Date(plan.odenen_tarih).toLocaleDateString('tr-TR')}</p>
                )}

                {filtreDurum === 'bekliyor' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={() => setOdeModalId(plan.id)} style={{ flex: 1, padding: '8px 4px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      ✅ Öde & Aktar
                    </button>
                    <button onClick={() => icsOlustur(plan.baslik, plan.vade_tarihi, plan.tutar, plan.not_metni)} style={{ flex: 1, padding: '8px 4px', background: '#F8F9FA', color: '#333', border: '1px solid #D3D1C7', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      🗓️ Takvime Ekle
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        {gorunenler.length === 0 && <p className="bos-mesaj">Kayıt yok.</p>}
      </div>
    </div>
  )
}
