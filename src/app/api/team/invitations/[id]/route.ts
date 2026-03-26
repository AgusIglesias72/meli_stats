// src/app/api/team/invitations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, invitations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// DELETE: Cancela una invitación pendiente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const invitationId = (await params).id;

    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener información de la invitación
    const [invitationInfo] = await db
      .select({ id: invitations.id, store_id: invitations.store_id })
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1);

    if (!invitationInfo) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, invitationInfo.store_id!)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para cancelar invitaciones
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to cancel invitations' }, { status: 403 });
    }

    // Eliminar la invitación
    await db.delete(invitations).where(eq(invitations.id, invitationId));

    return NextResponse.json({
      success: true,
      message: 'Invitation canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
