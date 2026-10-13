ALTER TABLE gelirler 
ADD COLUMN IF NOT EXISTS is_devlet_destegi boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS devlet_destegi_asama text DEFAULT NULL;
