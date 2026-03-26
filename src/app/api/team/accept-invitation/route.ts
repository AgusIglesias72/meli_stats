// src/app/api/team/accept-invitation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, stores, storeUsers, invitations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// POST: Acepta una invitación y crea la relación usuario-tienda
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({
        error: 'Unauthorized',
        requiresAuth: true
      }, { status: 401 });
    }

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

    // Obtener el email del usuario actual
    const [userData] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, authUserId))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar si el email del usuario coincide con el de la invitación
    if (userData.email!.toLowerCase() !== invitation.email!.toLowerCase()) {
      return NextResponse.json({
        error: 'This invitation was sent to a different email address. Please log in with the correct account.'
      }, { status: 403 });
    }

    // Verificar si el usuario ya es miembro de esta tienda
    const existingMember = await db
      .select({ id: storeUsers.id })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, invitation.store_id!)))
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      return NextResponse.json({ error: 'You are already a member of this store' }, { status: 409 });
    }

    // Crear la relación usuario-tienda
    const [storeUser] = await db
      .insert(storeUsers)
      .values({
        user_id: authUserId,
        store_id: invitation.store_id,
        role: invitation.role,
        created_at: new Date()
      })
      .returning();

    // Marcar la invitación como utilizada
    try {
      await db
        .update(invitations)
        .set({
          used_at: new Date(),
          updated_at: new Date()
        })
        .where(eq(invitations.id, invitation.id));
    } catch (updateError) {
      console.error('Error updating invitation status:', updateError);
      // Si hay un error aquí, la relación usuario-tienda ya se creó,
      // pero no es crítico si la invitación no se marca como utilizada
    }

    // Obtener información de la tienda para la respuesta
    let storeInfo: { id: string; name: string | null; store_id: string | null; ml_user_id: number | null } | undefined;
    try {
      const [storeResult] = await db
        .select({ id: stores.id, name: stores.name, store_id: stores.store_id, ml_user_id: stores.ml_user_id })
        .from(stores)
        .where(eq(stores.id, invitation.store_id!))
        .limit(1);
      storeInfo = storeResult;
    } catch (storeError) {
      console.error('Error fetching store info:', storeError);
    }

    // Establecer esta tienda como la seleccionada actualmente
    (await cookies()).set('selected_store_id', invitation.store_id!, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    // Establecer el ML user ID para esta tienda
    if (storeInfo?.ml_user_id) {
      (await cookies()).set('ml_user_id', String(storeInfo.ml_user_id), {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      store: storeInfo ? {
        id: storeInfo.id,
        name: storeInfo.name,
        store_id: storeInfo.store_id
      } : { id: invitation.store_id },
      role: invitation.role
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
