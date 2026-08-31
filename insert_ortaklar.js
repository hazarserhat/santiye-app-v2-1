import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Lütfen .env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değerlerini tanımlayın.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const ortaklar = [
    { ad: 'Fuat Hazar', sifat: 'Ortak', sef_gorunur: true },
    { ad: 'Fırat Tekstil Diyarbakır', sifat: 'Ortak', sef_gorunur: true },
    { ad: 'Abdullah Tufan', sifat: 'Ortak', sef_gorunur: true }
  ]

  for (const ortak of ortaklar) {
    const { data: existing } = await supabase.from('taseronlar').select('*').eq('ad', ortak.ad)
    if (existing && existing.length > 0) {
      console.log(`Zaten var: ${ortak.ad}`)
      continue
    }

    const { data, error } = await supabase.from('taseronlar').insert(ortak).select()
    if (error) {
      console.error(`Hata (${ortak.ad}):`, error.message)
    } else {
      console.log(`Başarıyla eklendi: ${ortak.ad}`)
    }
  }
}

run()
