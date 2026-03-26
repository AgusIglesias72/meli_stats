// src/app/api/team/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// Interfaces para tipar los datos
interface FormattedMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

// GET: Obtiene todos los miembros de una tienda
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda de los parámetros
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, storeId)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener todos los miembros de la tienda con sus roles
    const members = await db
      .select({
        id: storeUsers.id,
        role: storeUsers.role,
        created_at: storeUsers.created_at,
        user_id: users.id,
        email: users.email,
      })
      .from(storeUsers)
      .leftJoin(users, eq(storeUsers.user_id, users.id))
      .where(eq(storeUsers.store_id, storeId));

    // Formatear los datos para la respuesta
    const formattedMembers: FormattedMember[] = members.map(member => ({
      id: member.id,
      user_id: member.user_id || '',
      email: member.email || '',
      role: member.role || '',
      created_at: member.created_at?.toISOString() || ''
    }));

    return NextResponse.json({
      members: formattedMembers
    });
  } catch (error) {
    console.error('Error processing team members request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
