// src/app/api/import-errors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { stores, importErrors } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Maneja la solicitud GET para obtener errores de importación
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener filtro de la URL
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all';

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

    // Consultar errores de importación
    const conditions = [eq(importErrors.user_id, String(userId))];

    // Aplicar filtro
    if (filter === 'resolved') {
      conditions.push(eq(importErrors.resolved, true));
    } else if (filter === 'unresolved') {
      conditions.push(eq(importErrors.resolved, false));
    }

    const errors = await db.select().from(importErrors).where(and(...conditions)).orderBy(desc(importErrors.created_at));

    return NextResponse.json({ errors: errors || [] });

  } catch (error: any) {
    console.error('Error en la API de errores de importación:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar errores de importación' },
      { status: 500 }
    );
  }
}
