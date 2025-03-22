// src/app/api/tokens/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Verificar clave API para seguridad
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Crear cliente Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener parámetros (opcional: horas antes de vencimiento)
    const { hoursBeforeExpiry = 2 } = await request.json().catch(() => ({}));
    
    // Calcular timestamp para tokens a punto de expirar
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() + hoursBeforeExpiry);
    
    // Buscar tiendas con tokens próximos a expirar
    const { data: stores, error } = await supabase
      .from('stores')
      .select('id, store_id, refresh_token, token_expiry')
      .lt('token_expiry', expiryThreshold.toISOString());
      
    if (error) {
      console.error('Error fetching stores with expiring tokens:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }
    
    console.log(`Found ${stores?.length || 0} stores with tokens expiring in the next ${hoursBeforeExpiry} hours`);
    
    // Procesar cada tienda
    const results = [];
    for (const store of stores || []) {
      try {
        // Llamar a la API de ML para renovar token
        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID || '',
            client_secret: process.env.NEXT_PUBLIC_MERCADOLIBRE_SECRET_KEY || '',
            refresh_token: store.refresh_token
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error refreshing token for store ${store.id}:`, errorData);
          
          // Si el token es inválido, marcar la tienda como desconectada
          if (errorData.error === 'invalid_grant') {
            await supabase
              .from('stores')
              .update({
                is_connected: false,
                connection_status: 'disconnected',
                disconnected_at: new Date().toISOString(),
                disconnection_reason: 'invalid_refresh_token'
              })
              .eq('id', store.id);
          }
          
          results.push({
            store_id: store.id,
            ml_store_id: store.store_id,
            success: false,
            error: errorData.error || 'API error'
          });
          continue;
        }
        
        // Procesar la respuesta
        const tokenData = await response.json();
        
        // Calcular nueva fecha de expiración
        const newExpiryDate = new Date();
        newExpiryDate.setSeconds(newExpiryDate.getSeconds() + tokenData.expires_in);
        
        // Actualizar tokens en la base de datos
        const { error: updateError } = await supabase
          .from('stores')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expiry: newExpiryDate.toISOString(),
            updated_at: new Date().toISOString(),
            is_connected: true,
            connection_status: 'connected',
            last_token_refresh: new Date().toISOString()
          })
          .eq('id', store.id);
          
        if (updateError) {
          console.error(`Error updating tokens for store ${store.id}:`, updateError);
          results.push({
            store_id: store.id,
            ml_store_id: store.store_id,
            success: false,
            error: 'Database update failed'
          });
          continue;
        }
        
        // Éxito
        results.push({
          store_id: store.id,
          ml_store_id: store.store_id,
          success: true,
          new_expiry: newExpiryDate.toISOString()
        });
        
      } catch (error: any) {
        console.error(`Error processing store ${store.id}:`, error);
        results.push({
          store_id: store.id,
          ml_store_id: store.store_id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    // Resumen de resultados
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: results.length,
      renewed: successful,
      failed: failed,
      results: results
    });
    
  } catch (error: any) {
    console.error('Error in token refresh endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}