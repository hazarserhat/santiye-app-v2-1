-- Cekler tablosuna emanet verilen cekleri isaretlemek icin is_emanet sutunu ekleme
ALTER TABLE cekler 
ADD COLUMN IF NOT EXISTS is_emanet boolean DEFAULT false;
