// ProjeGelirleri.jsx - Görsel Nizamı Koruyan Dinamik Versiyon

return (
  <div className="sayfa">
    {/* ... [Üst Kısım: Geri Butonu ve Başlıklar] ... */}

    <div style={{ overflowX: 'auto', background: 'white', borderRadius: 12, border: '1px solid #D3D1C7', marginBottom: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...baslikStil, position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>Malik</th>
            <th style={baslikStil}>Şantiye</th>
            <th style={baslikStil}>Alacak</th>
            <th style={baslikStil}>Destek</th>
            <th style={baslikStil}>Kalan Bak.</th>
            {/* Dinamik Aşama Başlıkları */}
            {Array.from({ length: maxStageCount }).map((_, i) => (
              <th key={i} style={baslikStil}>Aşama {i + 1}</th>
            ))}
            <th style={baslikStil}>Alınan</th>
            <th style={baslikStil}>Kalan</th>
            <th style={baslikStil}></th>
          </tr>
        </thead>
        <tbody>
          {gorunenler.map((m) => {
            const stages = asamalar[m.id] || []
            const renkler = renkHesapla(m.id, stages)
            const kalanBakiye = Number(m.toplam_alacak || 0) - Number(m.devlet_destegi || 0)
            const alinan = odemeToplamlari[m.id] || 0
            const kalan = Math.max(0, kalanBakiye - alinan)
            
            return (
              <tr key={m.id} style={{ borderBottom: '1px solid #F1EFE8' }}>
                <td style={{ ...hucreStil, position: 'sticky', left: 0, background: 'white', fontWeight: 700 }}>{m.ad_soyad}</td>
                <td style={hucreStil}>{m.santiyeler?.ad}</td>
                <td style={hucreStil}>{paraFormatla(m.toplam_alacak)} ₺</td>
                <td style={hucreStil}>{paraFormatla(m.devlet_destegi)} ₺</td>
                <td style={hucreStil}>{paraFormatla(kalanBakiye)} ₺</td>
                
                {/* Dinamik Aşama Hücreleri - Eski Görsel Nizam Korundu */}
                {Array.from({ length: maxStageCount }).map((_, i) => {
                  const s = stages[i]
                  return (
                    <td key={i} style={{ ...hucreStil, background: s ? renkArkaplan[renkler[i] || 'yok'] : 'transparent', minWidth: 120 }}>
                      {s && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                            <input type="checkbox" checked={s.tamamlandi} onChange={() => asamaTikle(s)} />
                            {s.ad || '—'}
                          </label>
                          <span style={{ fontSize: 11, color: '#5F5E5A', marginLeft: 17 }}>{paraFormatla(s.tutar)} ₺</span>
                        </div>
                      )}
                    </td>
                  )
                })}
                
                <td style={{ ...hucreStil, color: '#1D9596', fontWeight: 700 }}>{paraFormatla(alinan)} ₺</td>
                <td style={hucreStil}>{paraFormatla(kalan)} ₺</td>
                <td style={hucreStil}>
                  <button className="sil-buton" onClick={() => duzenlemeyiAc(m)}>✎</button>
                  <button className="sil-buton" onClick={() => malikSil(m.id)}>🗑</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    {/* DÜZENLEME FORMU (Görsel Nizamlı) */}
    {duzenlenenId && (
      <div className="ekleme-kutusu">
        <p className="alt-baslik">Düzenle: {malikler.find((m) => m.id === duzenlenenId)?.ad_soyad}</p>
        {/* ... [Toplam Alacak / Destek inputları aynı] ... */}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
           <p style={{ fontSize: 12, fontWeight: 700 }}>Ödeme Aşamaları</p>
           <button onClick={asamaEkle} style={{ fontSize: 11, padding: '2px 8px' }}>+ Aşama Ekle</button>
        </div>

        {taslakAsamalar.map((a, i) => (
          <div key={i} className="ekleme-satiri-2" style={{ marginBottom: 6 }}>
            <input value={a.ad} placeholder={`Aşama ${i + 1} Adı`} onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, ad: e.target.value} : x))} />
            <input type="number" value={a.tutar} placeholder="Tutar" onChange={(e) => setTaslakAsamalar(o => o.map((x, j) => j === i ? {...x, tutar: e.target.value} : x))} />
            {/* Silme butonu ekleyerek nizamı koruyabilirsiniz */}
            <button onClick={() => setTaslakAsamalar(o => o.filter((_, idx) => idx !== i))} style={{ background: '#D64545', color: '#fff', border: 'none', borderRadius: 4 }}>×</button>
          </div>
        ))}
      </div>
    )}
  </div>
)