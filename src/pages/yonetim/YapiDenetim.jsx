import SantiyeBasinaTablo from './SantiyeBasinaTablo'

export default function YapiDenetim() {
  return (
    <SantiyeBasinaTablo
      baslik="Yapı Denetim Bilgileri"
      tablo="yapi_denetim_bilgileri"
      alanlar={[
        { anahtar: 'firma', etiket: 'Yapı Denetim Firması' },
        { anahtar: 'temsilci_adi', etiket: 'Temsilci Adı' },
        { anahtar: 'temsilci_iletisim', etiket: 'Temsilci İletişim No' },
      ]}
    />
  )
}
