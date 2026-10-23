-- Görevler tablosuna görsel/fotoğraf desteği için fotograf_url sütunu ekleme
ALTER TABLE gorevler 
ADD COLUMN IF NOT EXISTS fotograf_url text DEFAULT NULL;
