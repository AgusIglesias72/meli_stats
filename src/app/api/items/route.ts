import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, items } from '@/lib/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { cookies } from 'next/headers';

export const maxDuration = 10; // Reduced from 59 to 10 seconds to save costs


export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;

    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener parámetros de paginación
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Obtener el usuario desde la base de datos
    const [userData] = await db.select({ id: users.id }).from(users).where(eq(users.user_id, Number(mlUserId))).limit(1);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Obtener el conteo total de items del usuario
    const [{ value: totalCount }] = await db.select({ value: count() }).from(items).where(eq(items.user_id, userData.id));

    // Obtener los items del usuario
    const itemsData = await db.select().from(items).where(eq(items.user_id, userData.id)).orderBy(desc(items.last_updated)).limit(limit).offset(offset);

    // Calcular información de paginación
    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      items: itemsData,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error processing list items request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
