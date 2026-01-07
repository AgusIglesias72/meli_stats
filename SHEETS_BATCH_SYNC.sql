-- Crear tabla para cola de sincronización con Google Sheets
-- Ejecutar este SQL en Supabase

CREATE TABLE IF NOT EXISTS pending_sheet_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id VARCHAR NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  item_data JSONB NOT NULL,
  change_type VARCHAR(20) NOT NULL, -- 'created' | 'updated'
  changed_fields TEXT[], -- Array de campos que cambiaron
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'processed' | 'failed'
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,

  -- Constraint para evitar duplicados (un item puede tener solo un sync pendiente)
  CONSTRAINT unique_pending_sync UNIQUE(item_id, store_id)
);

-- Índices para optimizar queries
CREATE INDEX idx_pending_sheet_syncs_status ON pending_sheet_syncs(status);
CREATE INDEX idx_pending_sheet_syncs_created_at ON pending_sheet_syncs(created_at);
CREATE INDEX idx_pending_sheet_syncs_store ON pending_sheet_syncs(store_id);

-- Índice compuesto para query del cron job
CREATE INDEX idx_pending_sheet_syncs_status_created ON pending_sheet_syncs(status, created_at);

-- Comentarios
COMMENT ON TABLE pending_sheet_syncs IS 'Cola de items pendientes de sincronizar con Google Sheets';
COMMENT ON COLUMN pending_sheet_syncs.item_data IS 'Datos completos del item en formato JSON';
COMMENT ON COLUMN pending_sheet_syncs.changed_fields IS 'Array de nombres de campos que cambiaron';
COMMENT ON COLUMN pending_sheet_syncs.attempts IS 'Número de intentos de procesamiento';
