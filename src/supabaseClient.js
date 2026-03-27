import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fsgssvindtmryytpgmxg.supabase.co'
const supabaseAnonKey = 'sb_publishable_DjrbE6DTqXfsMAJIgSw1Jg_L2sip5V3'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)