import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://xyflyetsvsoanhslaxyd.supabase.co'

export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5Zmx5ZXRzdnNvYW5oc2xheHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzMwODAsImV4cCI6MjA4ODIwOTA4MH0.cjNELwkashKJI52Mt0IZaHkgiP2kcbFo-Rc_tyqY_wo'

export const CERT_PEPPER =
  process.env.CERT_ENCRYPT_KEY ||
  process.env.VITE_CERT_ENCRYPT_KEY ||
  SUPABASE_ANON_KEY ||
  'agiliza-pdv-cert-default-pepper'

export const NFCE_XML_BUCKET = 'nfce-xml'
export const NFE_XML_BUCKET = 'nfe-xml'
export const CERT_BUCKET = 'certificados'
export const NFE_DANFE_BUCKET = 'nfe-danfe'

export const HOMOLOG_NOME =
  'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_supabase) _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return _supabase
}
