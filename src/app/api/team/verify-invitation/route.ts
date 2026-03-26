// src/app/api/team/verify-invitation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, stores, storeUsers, invitations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// POST: Verifica los detalles de una invitación por token
export async function POST(request: NextRequest) {
  try {
    // Obtener el token de la invitación desde el cuerpo de la solicitud
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Obtener información de la invitación
    const [invitation] = await db
      .select({ id: invitations.id, store_id: invitations.store_id, email: invitations.email, role: invitations.role, expires_at: invitations.expires_at, used_at: invitations.used_at })
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
    }

    // Verificar si la invitación ya fue utilizada
    if (invitation.used_at) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 409 });
    }

    // Verificar si la invitación ha expirado
    if (new Date(invitation.expires_at!) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Obtener información de la tienda
    let storeInfo: { name: string | null; store_id: string | null } | undefined;
    try {
      const [storeResult] = await db
        .select({ name: stores.name, store_id: stores.store_id })
        .from(stores)
        .where(eq(stores.id, invitation.store_id!))
        .limit(1);
      storeInfo = storeResult;
    } catch (storeError) {
      console.error('Error fetching store info:', storeError);
      // Continuar aunque no se obtenga la info de la tienda
    }

    // Verificar si el usuario está autenticado (opcional)
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (authUserId) {
      // Si está autenticado, comprobar si su email coincide
      const [userData] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, authUserId))
        .limit(1);

      if (userData) {
        // Verificar si el email del usuario coincide con el de la invitación
        if (userData.email!.toLowerCase() !== invitation.email!.toLowerCase()) {
          return NextResponse.json({
            warning: 'This invitation was sent to a different email address',
            invitationEmail: invitation.email,
            userEmail: userData.email
          });
        }

        // Verificar si el usuario ya es miembro de esta tienda
        const existingMember = await db
          .select({ id: storeUsers.id })
          .from(storeUsers)
          .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, invitation.store_id!)))
          .limit(1);

        if (existingMember && existingMember.length > 0) {
          return NextResponse.json({
            warning: 'You are already a member of this store',
            requiresAuth: false
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        storeName: storeInfo?.name || `Tienda ${storeInfo?.store_id || 'desconocida'}`,
        expiresAt: invitation.expires_at
      },
      requiresAuth: !authUserId // Indicar si el usuario necesita autenticarse
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
