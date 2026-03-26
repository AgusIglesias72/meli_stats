// src/app/api/import-errors/[id]/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { stores, importErrors } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Maneja la solicitud POST para marcar un error como resuelto
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const errorId = searchParams.get('id');

    if (!errorId) {
      return NextResponse.json(
        { error: 'ID de error no proporcionado' },
        { status: 400 }
      );
    }

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

    // El usuario ML será el asociado a la tienda
    const userId = storeData.ml_user_id;

    if (!userId) {
      return NextResponse.json(
        { error: 'No se pudo obtener el ID de usuario de Mercado Libre para la tienda.' },
        { status: 400 }
      );
    }

    // Obtener datos del cuerpo de la solicitud
    const { notes } = await request.json();

    // Actualizar el error
    await db.update(importErrors).set({
      resolved: true,
      resolved_at: new Date().toISOString(),
      notes: notes || null
    } as any).where(and(eq(importErrors.id, errorId), eq(importErrors.user_id, String(userId))));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error al marcar como resuelto:', error);
    return NextResponse.json(
      { error: error.message || 'Error al marcar como resuelto' },
      { status: 500 }
    );
  }
}
