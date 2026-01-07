// src/app/api/cache/stats/route.ts
import { NextResponse } from 'next/server';
import { meliCache } from '@/lib/cache';

/**
 * Endpoint para ver estadísticas del caché (para debugging)
 * GET /api/cache/stats
 */
export async function GET() {
  try {
    const stats = meliCache.getStats();

    return NextResponse.json({
      success: true,
      stats: {
        hits: stats.hits,
        misses: stats.misses,
        total_requests: stats.hits + stats.misses,
        hit_rate: stats.hitRate,
        cache_size: stats.size,
        sets: stats.sets
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json(
      { error: 'Error getting cache stats' },
      { status: 500 }
    );
  }
}

/**
 * Endpoint para limpiar el caché (para debugging)
 * DELETE /api/cache/stats
 */
export async function DELETE() {
  try {
    meliCache.clear();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Error clearing cache' },
      { status: 500 }
    );
  }
}
