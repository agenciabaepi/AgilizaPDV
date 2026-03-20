import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xyflyetsvsoanhslaxyd.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmx5ZXRzdnNvYW5oc2xheHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzMwODAsImV4cCI6MjA4ODIwOTA4MH0.cjNELwkashKJI52Mt0IZaHkgiP2kcbFo-Rc_tyqY_wo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
