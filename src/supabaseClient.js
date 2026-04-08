import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://ntdjxcohzrnzdtudmivn.supabase.co').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_xceGhfz3unUrlHJCSjnJFQ_RZbKZuQI').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)