# 🚀 Sistema de Sincronización Batch con Google Sheets

## Problema Resuelto

**Antes:** Cada webhook con cambios hacía una llamada síncrona a `/api/internal/sync-sheet`
- ❌ 100 webhooks = 100 invocaciones serverless de 2-4s cada una
- ❌ Total: 200-400 segundos de ejecución
- ❌ **Costo muy alto en Vercel** 💸💸💸

**Ahora:** Los webhooks encolan los cambios y un cron job procesa todo en batch cada 10 minutos
- ✅ 100 webhooks = Solo inserts rápidos en DB
- ✅ 1 cron job cada 10 min procesa todo en batch
- ✅ **Reducción de ~95% en costos de Sheets sync** 💰

---

## Arquitectura del Sistema

### Flujo Nuevo

```
Webhook de ML
    ↓
Actualizar DB (items)
    ↓
¿Hay cambios para Sheets? → NO → FIN
    ↓ SÍ
Insertar en cola (pending_sheet_syncs) ← ⚡ RÁPIDO (<100ms)
    ↓
FIN (webhook completo en <1s)

...10 minutos después...

Cron Job (/api/cron/sync-sheets-batch)
    ↓
Leer TODOS los pending_sheet_syncs
    ↓
Procesar en batch (50 items a la vez)
    ↓
Actualizar Sheets
    ↓
Marcar como 'processed'
    ↓
FIN
```

---

## Componentes Implementados

### 1. Tabla `pending_sheet_syncs`

**Archivo:** [SHEETS_BATCH_SYNC.sql](SHEETS_BATCH_SYNC.sql)

**Estructura:**
```sql
CREATE TABLE pending_sheet_syncs (
  id UUID PRIMARY KEY,
  item_id VARCHAR NOT NULL,
  store_id UUID REFERENCES stores(id),
  item_data JSONB NOT NULL,        -- Datos completos del item
  change_type VARCHAR(20),          -- 'created' | 'updated'
  changed_fields TEXT[],            -- Campos que cambiaron
  status VARCHAR(20),               -- 'pending' | 'processed' | 'failed'
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP,
  processed_at TIMESTAMP,

  CONSTRAINT unique_pending_sync UNIQUE(item_id, store_id)
);
```

**Características:**
- ✅ Constraint único previene duplicados
- ✅ Si llega otro webhook del mismo item, actualiza el registro existente
- ✅ Índices optimizados para query del cron job

---

### 2. Modificación del Webhook

**Archivo:** [src/app/api/meli/webhooks/route.ts](src/app/api/meli/webhooks/route.ts)

**Cambio realizado (líneas 277-302):**

```typescript
// ❌ ANTES: Sync síncrono
if (updateResult.hasSheetsChanges) {
  await fetch(`${process.env.SELF_BASE_URL}/api/internal/sync-sheet`, {
    method: 'POST',
    body: JSON.stringify(newItemData)
  }); // ← 2-4 segundos de espera
}

// ✅ AHORA: Solo encolar
if (updateResult.hasSheetsChanges) {
  await supabase.from('pending_sheet_syncs').upsert({
    item_id: itemId,
    store_id: store.id,
    item_data: newItemData,
    change_type: updateResult.changeType,
    changed_fields: updateResult.sheetsFields,
    status: 'pending'
  }, {
    onConflict: 'item_id,store_id'
  }); // ← <100ms
}
```

**Beneficio:**
- Webhook pasa de **3-8s** a **<1s** ⚡
- No bloquea esperando Google Sheets API

---

### 3. Cron Job de Batch Sync

**Archivo:** [src/app/api/cron/sync-sheets-batch/route.ts](src/app/api/cron/sync-sheets-batch/route.ts)

**Características:**
- 🕐 Se ejecuta cada 10 minutos
- 📊 Procesa hasta 500 items por ejecución
- 🔄 Procesa en batches de 50 items (paralelo)
- ⚠️ Máximo 3 intentos por item
- 🧹 Auto-limpieza de registros procesados >7 días

**Lógica de procesamiento:**
```typescript
1. Obtener todos los pending (status='pending')
2. Dividir en batches de 50
3. Por cada batch:
   - Procesar items en paralelo
   - Llamar a syncItemToSheet()
   - Marcar como 'processed' o incrementar 'attempts'
4. Cleanup de registros viejos
```

---

## Configuración en Vercel

### Paso 1: Ejecutar SQL en Supabase

```bash
# Copiar contenido de SHEETS_BATCH_SYNC.sql
# Ejecutar en Supabase SQL Editor
```

### Paso 2: Configurar Cron Job en Vercel

1. Ir a Project → Settings → Cron Jobs
2. Agregar nuevo cron:
   - **Path:** `/api/cron/sync-sheets-batch`
   - **Schedule:** `0,10,20,30,40,50 * * * *` (cada 10 minutos)
   - **Description:** Batch sync con Google Sheets

Alternativamente, usar `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-sheets-batch",
      "schedule": "0,10,20,30,40,50 * * * *"
    }
  ]
}
```

---

## Monitoreo y Logs

### Logs del Webhook (ahora rápidos)

```bash
[WEBHOOK] 🚀 Iniciando procesamiento de MLA1234567890
[WEBHOOK] 📊 Item MLA1234567890 tiene cambios comerciales, encolando para sync a Sheets...
[WEBHOOK] ✅ Item MLA1234567890 encolado para sync a Sheets (procesará en batch)
[WEBHOOK] ✅ Item MLA1234567890 procesado correctamente en 890ms  # ← RÁPIDO!
```

### Logs del Cron Job

```bash
[SHEETS-BATCH] 🚀 Iniciando sincronización batch con Google Sheets...
[SHEETS-BATCH] 📊 Procesando 127 items pendientes...
[SHEETS-BATCH] 🔄 Procesando batch 1/3 (50 items)...
[SHEETS-BATCH] 🔄 Procesando batch 2/3 (50 items)...
[SHEETS-BATCH] 🔄 Procesando batch 3/3 (27 items)...
[SHEETS-BATCH] ✅ Sincronización completada en 23456ms
[SHEETS-BATCH] 📊 Resultados: 120 exitosos, 5 omitidos, 2 fallidos
[SHEETS-BATCH] 🧹 Cleanup de registros antiguos completado
```

---

## Métricas de Comparación

### Costo por 1000 webhooks con cambios

| Componente | Antes | Ahora | Ahorro |
|------------|-------|-------|--------|
| **Webhook duration** | 1000 × 4s = 4000s | 1000 × 1s = 1000s | **75%** ✅ |
| **Sheets sync calls** | 1000 invocaciones | ~1 invocación cada 10min | **~99%** ✅ |
| **Total execution time** | ~4000s | ~1050s | **73%** ✅ |
| **Costo estimado** | Alto | Bajo | **~70-80%** 💰 |

### Latencia de actualización en Sheets

- **Antes:** Tiempo real (0s de delay)
- **Ahora:** Hasta 10 minutos de delay
- **Trade-off:** Aceptable para mayoría de casos de uso

---

## Queries Útiles

### Ver items pendientes de sync

```sql
SELECT
  item_id,
  change_type,
  status,
  attempts,
  created_at,
  last_error
FROM pending_sheet_syncs
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### Ver items fallidos

```sql
SELECT
  item_id,
  attempts,
  last_error,
  created_at
FROM pending_sheet_syncs
WHERE status = 'failed' OR attempts >= 3
ORDER BY created_at DESC;
```

### Forzar re-procesamiento de item

```sql
UPDATE pending_sheet_syncs
SET status = 'pending', attempts = 0, last_error = NULL
WHERE item_id = 'MLA1234567890';
```

### Ver estadísticas generales

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM pending_sheet_syncs
GROUP BY status;
```

---

## Troubleshooting

### "Items no se sincronizan a Sheets"

1. Verificar que el cron job está configurado en Vercel
2. Revisar logs del cron: `/api/cron/sync-sheets-batch`
3. Verificar items pendientes en DB

### "Muchos items fallidos"

1. Revisar `last_error` en la tabla:
   ```sql
   SELECT item_id, last_error, attempts
   FROM pending_sheet_syncs
   WHERE status = 'failed';
   ```
2. Verificar credenciales de Google Sheets
3. Verificar límites de API de Google

### "Cron job tarda mucho"

1. El cron tiene `maxDuration = 300s` (5 minutos)
2. Si procesa >500 items, aumentar el límite en Vercel (plan Pro)
3. Considerar reducir el intervalo del cron a cada 5 minutos

---

## Testing Manual

### 1. Trigger un webhook manualmente

Desde Postman o curl:
```bash
curl -X POST https://tu-app.vercel.app/api/meli/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "items",
    "resource": "/items/MLA1234567890",
    "user_id": "205076801"
  }'
```

### 2. Verificar que se encoló

```sql
SELECT * FROM pending_sheet_syncs
WHERE item_id = 'MLA1234567890';
```

### 3. Ejecutar cron manualmente

```bash
curl https://tu-app.vercel.app/api/cron/sync-sheets-batch
```

### 4. Verificar que se procesó

```sql
SELECT status, processed_at
FROM pending_sheet_syncs
WHERE item_id = 'MLA1234567890';
```

---

## Próximas Mejoras (Opcional)

1. **Dashboard de monitoreo:**
   - Endpoint GET `/api/sheets-sync-status`
   - Muestra: pendientes, procesados hoy, fallidos

2. **Notificaciones:**
   - Enviar email/Slack si >10 items fallan

3. **Priorización:**
   - Items nuevos (created) procesados antes que updates

4. **Batch más grande:**
   - Si tienes plan Pro/Enterprise, aumentar a 1000 items

---

## ✅ Checklist de Deploy

- [ ] Ejecutar SQL en Supabase ([SHEETS_BATCH_SYNC.sql](SHEETS_BATCH_SYNC.sql))
- [ ] Verificar que la tabla `pending_sheet_syncs` existe
- [ ] Deploy del código a Vercel
- [ ] Configurar cron job en Vercel Dashboard
- [ ] Probar con webhook de prueba
- [ ] Verificar logs del primer cron job
- [ ] Confirmar que Sheets se actualiza

---

## Resumen

Este cambio **reduce dramáticamente los costos** al procesar las actualizaciones de Sheets en batch cada 10 minutos en lugar de tiempo real.

**Trade-offs:**
- ✅ 70-80% menos costos
- ✅ Webhooks 75% más rápidos
- ⚠️ Sheets se actualiza cada 10 min (en vez de tiempo real)

Para la mayoría de casos de uso, **10 minutos de delay es aceptable** y el ahorro de costos lo justifica ampliamente.
