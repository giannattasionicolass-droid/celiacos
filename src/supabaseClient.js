import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://fsgssvindtmryytpgmxg.supabase.co').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DjrbE6DTqXfsMAJIgSw1Jg_L2sip5V3').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)