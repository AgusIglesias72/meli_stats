// src/lib/cache.ts
/**
 * Sistema de caché in-memory para optimizar llamadas a APIs externas
 * Reduce latencia y costos en Vercel al evitar llamadas redundantes
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0
  };

  /**
   * Guarda un valor en caché con TTL (time to live)
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
    this.stats.sets++;
  }

  /**
   * Obtiene un valor del caché si existe y no ha expirado
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Obtiene o ejecuta fetcher si no está en caché
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlSeconds);
    return data;
  }

  /**
   * Limpia entradas expiradas del caché
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[CACHE] 🧹 Limpiadas ${cleaned} entradas expiradas`);
    }
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear();
    console.log('[CACHE] 🗑️ Caché limpiado completamente');
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size
    };
  }

  /**
   * Imprime estadísticas del caché
   */
  logStats(): void {
    const stats = this.getStats();
    console.log(`[CACHE] 📊 Estadísticas - Hits: ${stats.hits}, Misses: ${stats.misses}, Hit Rate: ${stats.hitRate}, Size: ${stats.size}`);
  }
}

// Instancia global del caché
export const meliCache = new InMemoryCache();

// Cleanup automático cada 5 minutos
if (typeof global !== 'undefined') {
  setInterval(() => {
    meliCache.cleanup();
  }, 5 * 60 * 1000);
}
