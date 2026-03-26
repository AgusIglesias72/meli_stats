import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers, invitations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// src/app/api/team/invitations/[id]/resend/route.ts
export async function POST(
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
      .select({ id: invitations.id, store_id: invitations.store_id, email: invitations.email, token: invitations.token, role: invitations.role })
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

    // Verificar si el usuario tiene rol suficiente para reenviar invitaciones
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to resend invitations' }, { status: 403 });
    }

    // Extender la fecha de expiración (7 días más desde ahora)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Actualizar la fecha de expiración
    await db
      .update(invitations)
      .set({
        expires_at: expiryDate,
        updated_at: new Date()
      })
      .where(eq(invitations.id, invitationId));

    // TODO: Reenviar el email con el enlace de invitación
    // Esta parte requeriría un servicio de envío de emails

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      invitation_link: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${invitationInfo.token}`
    });
  } catch (error) {
    console.error('Error resending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
