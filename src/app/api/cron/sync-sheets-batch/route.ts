// src/app/api/cron/sync-sheets-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { syncItemToSheet } from '@/lib/syncItemToSheet';

export const maxDuration = 300; // 5 minutos máximo para procesar el batch
export const runtime = 'nodejs';

/**
 * Cron job que procesa los items pendientes de sincronizar con Google Sheets en batch
 * Se ejecuta cada 10 minutos
 *
 * Configurar en Vercel:
 * - Path: /api/cron/sync-sheets-batch
 * - Schedule: 0,10,20,30,40,50 * * * * (cada 10 minutos)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[SHEETS-BATCH] 🚀 Iniciando sincronización batch con Google Sheets...');

    const supabase = createServerSupabaseClient();

    // Obtener todos los items pendientes (máximo 500 por ejecución)
    const { data: pendingItems, error: fetchError } = await supabase
      .from('pending_sheet_syncs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(500);

    if (fetchError) {
      console.error('[SHEETS-BATCH] ❌ Error obteniendo items pendientes:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('[SHEETS-BATCH] ⏭️ No hay items pendientes para sincronizar');
      return NextResponse.json({
        success: true,
        message: 'No pending items',
        processed: 0,
        duration: Date.now() - startTime
      });
    }

    console.log(`[SHEETS-BATCH] 📊 Procesando ${pendingItems.length} items pendientes...`);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Procesar items en lotes pequeños para evitar timeouts
    const batchSize = 50;
    for (let i = 0; i < pendingItems.length; i += batchSize) {
      const batch = pendingItems.slice(i, i + batchSize);

      console.log(`[SHEETS-BATCH] 🔄 Procesando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pendingItems.length / batchSize)} (${batch.length} items)...`);

      // Procesar batch en paralelo (limitado)
      const results = await Promise.allSettled(
        batch.map(item => processSingleItem(item, supabase))
      );

      // Contar resultados
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value === 'success') successCount++;
          else if (result.value === 'skipped') skippedCount++;
          else failedCount++;
        } else {
          failedCount++;
          console.error(`[SHEETS-BATCH] ❌ Error procesando item ${batch[index].item_id}:`, result.reason);
        }
      });

      // Pequeña pausa entre batches para no saturar Google Sheets API
      if (i + batchSize < pendingItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SHEETS-BATCH] ✅ Sincronización completada en ${duration}ms`);
    console.log(`[SHEETS-BATCH] 📊 Resultados: ${successCount} exitosos, ${skippedCount} omitidos, ${failedCount} fallidos`);

    // Limpiar items procesados hace más de 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { error: cleanupError } = await supabase
      .from('pending_sheet_syncs')
      .delete()
      .eq('status', 'processed')
      .lt('processed_at', sevenDaysAgo.toISOString());

    if (cleanupError) {
      console.error('[SHEETS-BATCH] ⚠️ Error en cleanup:', cleanupError);
    } else {
      console.log('[SHEETS-BATCH] 🧹 Cleanup de registros antiguos completado');
    }

    return NextResponse.json({
      success: true,
      total: pendingItems.length,
      processed: successCount + skippedCount,
      successful: successCount,
      skipped: skippedCount,
      failed: failedCount,
      duration
    });

  } catch (error) {
    console.error('[SHEETS-BATCH] ❌ Error en sincronización batch:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Procesa un solo item de la cola
 */
async function processSingleItem(
  queueItem: any,
  supabase: any
): Promise<'success' | 'failed' | 'skipped'> {
  try {
    const { id, item_id, item_data, attempts } = queueItem;

    // Límite de 3 intentos
    if (attempts >= 3) {
      console.log(`[SHEETS-BATCH] ⚠️ Item ${item_id} excedió límite de intentos (${attempts})`);

      await supabase
        .from('pending_sheet_syncs')
        .update({
          status: 'failed',
          last_error: 'Max attempts exceeded',
          processed_at: new Date().toISOString()
        })
        .eq('id', id);

      return 'failed';
    }

    // Sincronizar con Sheets
    const result = await syncItemToSheet(item_data);

    if (result.success) {
      // Marcar como procesado
      await supabase
        .from('pending_sheet_syncs')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (result.action === 'skipped') {
        return 'skipped';
      }

      return 'success';
    } else {
      // Incrementar intentos y guardar error
      await supabase
        .from('pending_sheet_syncs')
        .update({
          attempts: attempts + 1,
          last_error: result.message || 'Unknown error'
        })
        .eq('id', id);

      return 'failed';
    }

  } catch (error) {
    console.error(`[SHEETS-BATCH] ❌ Error procesando item ${queueItem.item_id}:`, error);

    // Incrementar intentos
    try {
      await supabase
        .from('pending_sheet_syncs')
        .update({
          attempts: queueItem.attempts + 1,
          last_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', queueItem.id);
    } catch (updateError) {
      console.error('[SHEETS-BATCH] ❌ Error actualizando estado:', updateError);
    }

    return 'failed';
  }
}
