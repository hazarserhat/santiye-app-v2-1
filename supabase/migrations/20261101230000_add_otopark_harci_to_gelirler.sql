-- Gelirler ve Malikler tablolarina otopark harci destegi ekleme
ALTER TABLE gelirler 
ADD COLUMN IF NOT EXISTS is_otopark_harci boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS harc_turu text DEFAULT 'genel';

ALTER TABLE malikler 
ADD COLUMN IF NOT EXISTS otopark_harc_durum boolean DEFAULT false;
