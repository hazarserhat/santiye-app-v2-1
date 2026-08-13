import SantiyeBasinaTablo from './SantiyeBasinaTablo'

export default function FaturaBilgileri() {
  return (
    <SantiyeBasinaTablo
      baslik="Fatura Bilgileri"
      tablo="fatura_bilgileri"
      alanlar={[
        { anahtar: 'elektrik_sozlesme_no', etiket: 'Elektrik Sözleşme No' },
        { anahtar: 'su_abonelik_no', etiket: 'Su Abonelik No' },
      ]}
    />
  )
}
