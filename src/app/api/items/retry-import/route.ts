// src/app/api/items/retry-import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { stores, users, items, importErrors } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Maneja la solicitud POST para reintentar la importación de un item
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener IDs de usuario y tienda seleccionada de las cookies
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    const selectedStoreId = (await cookies()).get('selected_store_id')?.value;

    if (!authUserId) {
      return NextResponse.json(
        { error: 'No autorizado. Usuario no identificado.' },
        { status: 401 }
      );
    }

    if (!selectedStoreId) {
      return NextResponse.json(
        { error: 'No hay tienda seleccionada.' },
        { status: 400 }
      );
    }

    // Obtener información de la tienda seleccionada
    const [storeData] = await db.select().from(stores).where(eq(stores.id, selectedStoreId)).limit(1);

    if (!storeData) {
      console.error('Error al obtener información de la tienda');
      return NextResponse.json(
        { error: 'Error al obtener información de la tienda' },
        { status: 500 }
      );
    }

    const accessToken = storeData.access_token;
    const userId = storeData.ml_user_id;

    // Obtener datos del cuerpo de la solicitud
    const { itemId, errorId } = await request.json();

    if (!itemId) {
      return NextResponse.json(
        { error: 'ID de item no proporcionado' },
        { status: 400 }
      );
    }

    // Intentar obtener el item desde la API de Mercado Libre
    const response = await fetch(
      `https://api.mercadolibre.com/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error al obtener item: ${response.status} ${response.statusText}`);
    }

    const item = await response.json();

    // Insertar el item en la base de datos
    await db.insert(items).values({
      item_id: item.id,
      user_id: String(userId),
      site_id: item.site_id,
      title: item.title,
      seller_id: item.seller_id,
      category_id: item.category_id,
      official_store_id: item.official_store_id,
      price: item.price,
      base_price: item.base_price,
      currency_id: item.currency_id,
      available_quantity: item.available_quantity,
      status: item.status,
      permalink: item.permalink,
      thumbnail: item.thumbnail
    });

    // Si se proporcionó un ID de error, marcarlo como resuelto
    if (errorId) {
      await db.update(importErrors).set({
        resolved: true,
        resolved_at: new Date().toISOString(),
        notes: 'Resuelto automáticamente mediante reimportación exitosa'
      } as any).where(and(eq(importErrors.id, errorId), eq(importErrors.user_id, String(userId))));
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error al reintentar importación:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al reintentar la importación' },
      { status: 500 }
    );
  }
}
