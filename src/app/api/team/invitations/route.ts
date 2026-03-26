// src/app/api/team/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, invitations } from '@/lib/db/schema';
import { eq, and, isNull, gt, desc } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET: Obtiene todas las invitaciones pendientes para una tienda
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

    // Verificar si el usuario tiene rol suficiente para ver invitaciones
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to view invitations' }, { status: 403 });
    }

    // Obtener todas las invitaciones pendientes
    const invitationsList = await db
      .select()
      .from(invitations)
      .where(and(
        eq(invitations.store_id, storeId),
        isNull(invitations.used_at), // Solo invitaciones no utilizadas
        gt(invitations.expires_at, new Date()) // Solo invitaciones no expiradas
      ))
      .orderBy(desc(invitations.created_at));

    return NextResponse.json({
      invitations: invitationsList
    });
  } catch (error) {
    console.error('Error processing invitations request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
