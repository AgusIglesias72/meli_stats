# Sistema de Caché para APIs Externas - Optimización de Webhooks

## Problema Actual

Cada webhook de MercadoLibre ejecuta **8-10 llamadas a APIs externas**:
- 2 llamadas base: `items/{id}` + `items/{id}/sale_price`
- 1 llamada: `getFeeDetails()` - tarifas de ML
- 1 llamada: `getShippingCosts()` - costos de envío
- 2-4 llamadas: `getCampaignInfo()` - información de promociones

**Esto genera:**
- ⏱️ Latencia alta (puede superar 10 segundos)
- 💰 Alto consumo en Vercel (cada llamada cuenta como invocación)
- 🔥 Rate limiting de la API de MercadoLibre

---

## Solución: Sistema de Caché Inteligente

### Opción 1: Caché In-Memory (Simple, Sin Costo Adicional)

**Ventajas:**
- ✅ Sin servicios externos
- ✅ Cero configuración
- ✅ Funciona con cualquier plan de Vercel

**Desventajas:**
- ❌ Caché no compartido entre invocaciones serverless
- ❌ Se pierde en cada cold start
- ❌ Solo útil si múltiples webhooks llegan en la misma invocación

**Implementación:**

```typescript
// src/lib/cache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const meliCache = new InMemoryCache();
```

**Uso en webhooks:**

```typescript
// src/app/api/meli/webhooks/route.ts
import { meliCache } from '@/lib/cache';

async function getFeeDetails(
  accessToken: string,
  price: number,
  categoryId: string,
  tags: string[],
  listingTypeId: string
): Promise<any> {
  // Crear clave única basada en parámetros
  const cacheKey = `fees:${categoryId}:${listingTypeId}:${tags.join(',')}`;

  // Intentar obtener del caché
  const cached = meliCache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE] ✅ Hit para ${cacheKey}`);
    return cached;
  }

  console.log(`[CACHE] ❌ Miss para ${cacheKey} - fetching...`);

  try {
    // ... código existente de fetch ...
    const data = await response.json();

    const result = {
      meli_percentage_fee: data.sale_fee_details?.meli_percentage_fee || 0,
      percentage_fee: data.sale_fee_details?.percentage_fee || 0,
      financing_add_on_fee: data.sale_fee_details?.financing_add_on_fee || 0,
      fixed_fee: data.sale_fee_details?.fixed_fee || 0,
      sale_fee_amount: data.sale_fee_amount || 0
    };

    // Cachear por 1 hora (las fees no cambian tan seguido)
    meliCache.set(cacheKey, result, 3600);

    return result;
  } catch (error) {
    // ... manejo de errores ...
  }
}

async function getCampaignInfo(itemId: string, accessToken: string): Promise<any> {
  const cacheKey = `campaign:${itemId}`;

  const cached = meliCache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE] ✅ Hit para ${cacheKey}`);
    return cached;
  }

  console.log(`[CACHE] ❌ Miss para ${cacheKey} - fetching...`);

  try {
    // ... código existente ...
    const result = {
      promotion_id: promotionId,
      campaign_type: promotionType,
      meli_percentage_cashback: itemPromotion?.meli_percentage || null,
      seller_percentage: itemPromotion?.seller_percentage || null
    };

    // Cachear por 15 minutos (las campañas pueden cambiar)
    meliCache.set(cacheKey, result, 900);

    return result;
  } catch (error) {
    // ... manejo de errores ...
  }
}
```

---

### Opción 2: Vercel KV (Redis) - Recomendado para Producción

**Ventajas:**
- ✅ Caché compartido entre todas las invocaciones
- ✅ Persiste entre deploys
- ✅ Alta velocidad (Redis)
- ✅ Integración nativa con Vercel

**Costos:**
- Plan Hobby: **$1/mes** (256 MB, 100K comandos/mes)
- Plan Pro: Incluido en el plan

**Implementación:**

1. **Instalar Vercel KV:**
```bash
npm install @vercel/kv
```

2. **Conectar KV store en Vercel Dashboard:**
- Storage → Create → KV
- Vincular al proyecto

3. **Usar en código:**

```typescript
// src/lib/cache.ts
import { kv } from '@vercel/kv';

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Intentar obtener del caché
  const cached = await kv.get<T>(key);

  if (cached) {
    console.log(`[KV CACHE] ✅ Hit para ${key}`);
    return cached;
  }

  console.log(`[KV CACHE] ❌ Miss para ${key} - fetching...`);

  // Fetch y cachear
  const data = await fetcher();
  await kv.set(key, data, { ex: ttlSeconds });

  return data;
}
```

**Uso en webhooks:**

```typescript
import { getCachedOrFetch } from '@/lib/cache';

async function getFeeDetails(
  accessToken: string,
  price: number,
  categoryId: string,
  tags: string[],
  listingTypeId: string
): Promise<any> {
  const cacheKey = `fees:${categoryId}:${listingTypeId}:${tags.join(',')}`;

  return getCachedOrFetch(
    cacheKey,
    async () => {
      // Código existente de fetch
      const response = await fetch(
        `https://api.mercadolibre.com/sites/MLA/listing_prices?...`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      const data = await response.json();

      return {
        meli_percentage_fee: data.sale_fee_details?.meli_percentage_fee || 0,
        percentage_fee: data.sale_fee_details?.percentage_fee || 0,
        financing_add_on_fee: data.sale_fee_details?.financing_add_on_fee || 0,
        fixed_fee: data.sale_fee_details?.fixed_fee || 0,
        sale_fee_amount: data.sale_fee_amount || 0
      };
    },
    3600 // 1 hora
  );
}
```

---

### Opción 3: Caché Condicional (Sin Infraestructura Extra)

**Concepto:** Solo hacer llamadas API si cambió algo relevante.

```typescript
async function fetchItemFromMeli(itemId: string, accessToken: string) {
  // ... obtener datos base del item ...

  // ✅ Solo obtener fees si el precio cambió
  let feeDetails = null;
  const priceChanged = existingItem && existingItem.price !== data.price;

  if (!existingItem || priceChanged) {
    feeDetails = await getFeeDetails(...);
  } else {
    // Reutilizar fees existentes
    feeDetails = {
      meli_percentage_fee: existingItem.meli_percentage_fee,
      percentage_fee: existingItem.percentage_fee,
      // ... otros campos ...
    };
    console.log(`[SKIP] Fees sin cambios para ${itemId}`);
  }

  // ✅ Solo obtener campaña si precio o tags cambiaron
  let campaignInfo = null;
  const tagsChanged = existingItem &&
    JSON.stringify(existingItem.item_tags) !== JSON.stringify(data.tags);

  if (!existingItem || priceChanged || tagsChanged) {
    campaignInfo = await getCampaignInfo(itemId, accessToken);
  } else {
    campaignInfo = {
      promotion_id: existingItem.promotion_id,
      campaign_type: existingItem.campaign_type,
      // ... otros campos ...
    };
    console.log(`[SKIP] Campaign sin cambios para ${itemId}`);
  }

  // ...
}
```

---

## Comparación de Opciones

| Característica | In-Memory | Vercel KV | Condicional |
|----------------|-----------|-----------|-------------|
| **Complejidad** | Baja | Media | Baja |
| **Costo** | $0 | $1/mes | $0 |
| **Efectividad** | 20-30% | 80-90% | 50-70% |
| **Setup** | 5 min | 15 min | 10 min |
| **Recomendado para** | POC/Testing | Producción | Implementación rápida |

---

## Recomendación Final

**Para tu caso (alto tráfico de webhooks):**

1. **Corto plazo (HOY):** Implementar **Opción 3 (Condicional)**
   - Reducción inmediata del 50-70% de llamadas
   - Sin dependencias externas
   - Sin costo adicional

2. **Mediano plazo (ESTA SEMANA):** Agregar **Vercel KV**
   - Reducción del 80-90% de llamadas
   - $1/mes es nada comparado con el ahorro en Vercel functions
   - Mejora dramática en latencia

3. **Optimización extra:** Combinar ambas
   - Condicional previene llamadas innecesarias
   - KV cachea las llamadas necesarias
   - Reducción combinada del 90-95%

---

## Métricas Esperadas

### Sin Caché (Actual)
- 1000 webhooks/día → **8000-10000 llamadas API**
- Tiempo promedio: 8-12 segundos
- Costo Vercel: Alto

### Con Caché Condicional (Opción 3)
- 1000 webhooks/día → **3000-5000 llamadas API** ✅ 50% reducción
- Tiempo promedio: 4-6 segundos
- Costo Vercel: Medio

### Con Vercel KV (Opción 2)
- 1000 webhooks/día → **800-2000 llamadas API** ✅ 80% reducción
- Tiempo promedio: 1-3 segundos
- Costo Vercel: Bajo
- Costo KV: $1/mes

---

## ¿Qué implemento primero?

Te recomiendo implementar **ambas**:

1. ✅ **YA HECHO:** Promise.all paralelo (reduce latencia)
2. 🚀 **SIGUIENTE:** Caché condicional (5-10 min de implementación)
3. 💰 **LUEGO:** Vercel KV si ves que necesitas más reducción

¿Querés que implemente la Opción 3 (Caché Condicional) ahora?
