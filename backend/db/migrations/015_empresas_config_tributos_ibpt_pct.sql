-- Percentuais para cálculo dos tributos aproximados no cupom (Lei 12.741/2012), quando não houver API IBPT
ALTER TABLE empresas_config ADD COLUMN tributo_aprox_federal_pct REAL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN tributo_aprox_estadual_pct REAL DEFAULT 0;
ALTER TABLE empresas_config ADD COLUMN tributo_aprox_municipal_pct REAL DEFAULT 0;
