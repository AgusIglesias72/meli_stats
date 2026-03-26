// src/app/api/team/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, storeUsers, invitations } from '@/lib/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// POST: Envía una invitación a un nuevo miembro
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener datos del cuerpo
    const { store_id, email, role } = await request.json();

    if (!store_id || !email || !role) {
      return NextResponse.json({ error: 'Store ID, email and role are required' }, { status: 400 });
    }

    // Validar el rol
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    // Verificar si el usuario tiene permisos para invitar
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, store_id)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para invitar
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to invite team members' }, { status: 403 });
    }

    // Verificar si el email ya está registrado como usuario en esta tienda
    const existingStoreUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingStoreUser && existingStoreUser.length > 0) {
      const existingMember = await db
        .select({ id: storeUsers.id })
        .from(storeUsers)
        .where(and(eq(storeUsers.user_id, existingStoreUser[0].id), eq(storeUsers.store_id, store_id)))
        .limit(1);

      if (existingMember && existingMember.length > 0) {
        return NextResponse.json({ error: 'User is already a member of this store' }, { status: 409 });
      }
    }

    // Verificar si ya hay una invitación pendiente para este email en esta tienda
    const existingInvitation = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(
        eq(invitations.email, email),
        eq(invitations.store_id, store_id),
        isNull(invitations.used_at),
        gt(invitations.expires_at, new Date())
      ))
      .limit(1);

    if (existingInvitation && existingInvitation.length > 0) {
      return NextResponse.json({ error: 'An invitation for this email is already pending' }, { status: 409 });
    }

    // Generar token único para la invitación
    const token = crypto.randomBytes(32).toString('hex');

    // Establecer fecha de expiración (7 días)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Crear la invitación en la base de datos
    const [invitation] = await db
      .insert(invitations)
      .values({
        store_id: store_id,
        email: email,
        token: token,
        role: role,
        expires_at: expiryDate
      })
      .returning();

    // TODO: Enviar email con el enlace de invitación
    // Esta parte requeriría un servicio de envío de emails como SendGrid, Mailchimp, etc.
    // Por ahora, solo simularemos que el email se ha enviado

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        invitation_link: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${token}`
      }
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
