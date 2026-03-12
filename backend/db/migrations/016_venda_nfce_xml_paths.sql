-- Armazena caminhos do XML autorizado da NFC-e (local e Supabase)
ALTER TABLE venda_nfce ADD COLUMN xml_local_path TEXT;
ALTER TABLE venda_nfce ADD COLUMN xml_supabase_path TEXT;

