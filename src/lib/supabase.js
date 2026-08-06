import { createClient } from '@supabase/supabase-js'

// Bu iki değer "public" kullanım için tasarlanmıştır, kodun içinde durması güvenlidir.
const supabaseUrl = 'https://mkvjtqjxjrbofcpopldb.supabase.co'
const supabaseAnonKey = 'sb_publishable_BhpP0C8hANkPL-ejDmd6Mw_BT-ZFAdA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
