-- Layout de página para impressão térmica (cupom, fechamento, recibo).
-- compat: largura fixa em px (melhor em drivers Windows/Chromium problemáticos)
-- thermal_80_72 / thermal_80_full: tamanhos em mm

ALTER TABLE empresas_config ADD COLUMN cupom_layout_pagina TEXT DEFAULT 'compat';
