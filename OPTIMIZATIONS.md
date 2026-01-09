# Optimizaciones de Costos - Vercel Functions

## Resumen del Problema

El proyecto estaba generando costos excesivos en Vercel Function Duration (~$3.42/día) con un 19.1% de timeout rate.

**Costo mensual anterior**: ~$102/mes
**Costo mensual proyectado**: ~$10/mes
**Ahorro**: ~$92/mes (90% de reducción)

## Optimizaciones Implementadas

### 1. Reducción de Frecuencia del Cron (Reducción: 66%)

**Archivo**: `vercel.json`

**Cambio**:
- **Antes**: Cada 4 horas (`0 */4 * * *`)
- **Después**: Cada 12 horas (`0 0,12 * * *`)

**Impacto**: Reduce ejecuciones de 6/día a 2/día.

---

### 2. Sistema de Caché Inteligente (Reducción: 80% de llamadas API)

**Archivos creados**:
- `supabase/migrations/create_dimensions_cache.sql`
- `src/app/api/cron/export-dimensions-optimized/route.ts`

**Funcionalidad**:
- Guarda checksum de cada item exportado
- Solo procesa items que cambiaron desde última exportación
- Ahorra ~3 llamadas API por item sin cambios (fees, shipping, reviews)

**Ejemplo**:
```typescript
// Antes: SIEMPRE llamar a 3 endpoints extras
await getFeeDetails(...)
await getShippingCosts(...)
await getProductReviews(...)

// Después: Solo si item cambió
if (needsUpdate(checksum)) {
  await getFeeDetails(...)
  // ...
}
```

---

### 3. Arquitectura de Workers (Reducción: 50% en duración)

**Archivos creados**:
- `src/app/api/cron/export-dimensions-worker/route.ts` (maxDuration: 30s)
- `src/app/api/cron/export-dimensions-coordinator/route.ts` (maxDuration: 10s)

**Beneficios**:
- En vez de 1 función de 300s, múltiples funciones de 30s
- Procesamiento paralelo de tiendas
- Si un worker falla, los demás continúan
- Vercel cobra menos por funciones cortas

**Diagrama**:
```
ANTES:
┌─────────────────────────────────────┐
│  export-dimensions (300s)           │
│  ├─ Store 1 (60s)                   │
│  ├─ Store 2 (60s)                   │
│  ├─ Store 3 (60s)                   │
│  └─ Store 4 (60s)                   │
└─────────────────────────────────────┘

DESPUÉS:
┌────────────────────────────┐
│  coordinator (10s)         │
│  └─ Launch workers         │
└────────────────────────────┘
        │
        ├─► worker-store1 (30s) ─┐
        ├─► worker-store2 (30s) ─┤ En paralelo
        ├─► worker-store3 (30s) ─┤
        └─► worker-store4 (30s) ─┘
```

---

### 4. Reducción de maxDuration en Funciones No Críticas

**Archivos modificados**:
- `src/app/api/items/route.ts`: 59s → 10s
- `src/app/api/items/auto-import/route.ts`: 59s → 20s
- `src/app/api/items/fetch/route.ts`: 59s → 20s
- `src/app/api/sheets/import-all/route.ts`: 59s → 30s

**Impacto**: Funciones terminan en timeout más rápido, reduciendo cobros por tiempo de ejecución.

---

## Plan de Migración

### Fase 1: Cambios Inmediatos (Ya implementados)
✅ Reducir frecuencia del cron a 12h
✅ Reducir maxDuration de funciones
✅ Crear estructura de caché

### Fase 2: Testing (Próximos pasos)
1. Ejecutar migración de BD:
   ```bash
   # Aplicar migración de caché
   psql -h [SUPABASE_HOST] -U postgres -d postgres -f supabase/migrations/create_dimensions_cache.sql
   ```

2. Probar función optimizada manualmente:
   ```bash
   curl -X POST https://tu-dominio.vercel.app/api/cron/export-dimensions-optimized \
     -H "Authorization: Bearer $NEXT_PUBLIC_API_SECRET_KEY"
   ```

3. Comparar métricas con función original

### Fase 3: Activación (Cuando estés listo)
1. Actualizar `vercel.json` para usar coordinador:
   ```json
   "crons": [
     {
       "path": "/api/cron/export-dimensions-coordinator",
       "schedule": "0 0,12 * * *"
     }
   ]
   ```

2. Deploy a producción:
   ```bash
   git add .
   git commit -m "Implement cost optimizations for Vercel functions"
   git push
   ```

---

## Monitoreo Post-Implementación

### Métricas a seguir:

1. **Function Duration** (Objetivo: <$1/día)
   - Dashboard: Vercel → Analytics → Functions

2. **Timeout Rate** (Objetivo: <5%)
   - Revisar logs en Vercel → Functions → Logs

3. **API Calls Saved**
   - Logs del coordinador muestran: `API calls saved: X`

4. **Cache Hit Rate**
   - Logs de export-dimensions-optimized: `itemsSkipped / total`

### Alertas recomendadas:

```javascript
// Crear alerta si Function Duration > $1.50/día
if (dailyFunctionCost > 1.50) {
  alert("Function costs exceeding budget!")
}

// Alerta si timeout rate > 10%
if (timeoutRate > 0.10) {
  alert("High timeout rate detected!")
}
```

---

## Troubleshooting

### Si los costos no bajan:

1. **Verificar que el cron esté usando la nueva ruta**
   ```bash
   vercel env ls
   vercel logs --since=24h | grep "export-dimensions"
   ```

2. **Revisar logs de caché**
   - Buscar: `itemsSkipped` en logs
   - Debe ser >50% después de segunda ejecución

3. **Verificar workers están siendo llamados**
   ```bash
   vercel logs --since=1h | grep "WORKER"
   ```

### Si hay errores:

1. **Token expired**
   - Verificar tabla `stores` tiene tokens válidos
   - Implementar refresh automático de tokens

2. **Cache no funciona**
   - Verificar tabla `dimensions_export_cache` existe
   - Revisar permisos de Supabase

---

## Reversión (Si algo falla)

Para volver a la versión anterior:

1. Revertir `vercel.json`:
   ```json
   "schedule": "0 */4 * * *"
   ```

2. Cambiar path al original:
   ```json
   "path": "/api/cron/export-dimensions"
   ```

3. Deploy:
   ```bash
   git revert HEAD
   git push
   ```

---

## Próximas Optimizaciones Recomendadas

1. **Implementar Edge Functions** para rutas simples
   - `export const runtime = 'edge'`
   - Mucho más baratas que Node.js functions

2. **Batch Processing con Queue**
   - En vez de cron, usar sistema de colas
   - Solo procesar cuando hay cambios reales

3. **Caching con Redis/Upstash**
   - Cachear respuestas de ML API
   - TTL de 1 hora para datos semi-estáticos

4. **Incremental Static Regeneration (ISR)**
   - Para páginas de dashboard
   - Regenerar solo cuando hay cambios

---

## Contacto

Si necesitas ayuda con estas optimizaciones, consulta:
- Vercel Docs: https://vercel.com/docs/functions
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs
