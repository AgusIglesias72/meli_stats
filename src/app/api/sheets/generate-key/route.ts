// src/app/api/sheets/generate-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, stores } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda seleccionada
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!selectedStoreId) {
      return NextResponse.json({ error: 'No store selected' }, { status: 400 });
    }

    // Determinar si es una regeneración forzada
    const body = await request.json().catch(() => ({}));
    const forceReset = body?.reset === true;

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db.select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, selectedStoreId)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para generar API key (owner o admin)
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to generate API keys' }, { status: 403 });
    }

    // Obtener información de la tienda
    const [storeData] = await db.select({
      gsheets_api_key: stores.gsheets_api_key,
      store_id: stores.store_id,
    }).from(stores)
      .where(eq(stores.id, selectedStoreId))
      .limit(1);

    if (!storeData) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Verificar si ya tiene una API key y no se solicita regeneración
    if (storeData.gsheets_api_key && !forceReset) {
      return NextResponse.json({
        apiKey: storeData.gsheets_api_key,
        storeId: storeData.store_id,
        message: 'API key already exists'
      });
    }

    // Generar una nueva API key
    const newApiKey = generateApiKey(storeData.store_id!);

    // Actualizar la API key de la tienda
    await db.update(stores).set({
      gsheets_api_key: newApiKey,
      updated_at: new Date()
    }).where(eq(stores.id, selectedStoreId));

    return NextResponse.json({
      apiKey: newApiKey,
      storeId: storeData.store_id,
      message: forceReset ? 'API key regenerated' : 'API key generated'
    });
  } catch (error) {
    console.error('Error generating sheets API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Genera una API key segura basada en el ID de tienda y un componente aleatorio
 */
function generateApiKey(storeId: string): string {
  // Combinar el ID de tienda con un timestamp y un componente aleatorio
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const baseString = `${storeId}-${timestamp}-${randomBytes}`;

  // Generar un hash SHA-256 del string base
  const hash = crypto.createHash('sha256').update(baseString).digest('hex');

  // Devolver los primeros 32 caracteres del hash para una API key más manejable
  return hash.substring(0, 32);
}
