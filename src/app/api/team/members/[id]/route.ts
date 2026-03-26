// src/app/api/team/members/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// PATCH: Actualiza el rol de un miembro del equipo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const memberId = (await params).id;

    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener los datos del cuerpo
    const { role } = await request.json();

    if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    // Obtener información del miembro a actualizar
    const [memberInfo] = await db
      .select({ id: storeUsers.id, user_id: storeUsers.user_id, store_id: storeUsers.store_id, role: storeUsers.role })
      .from(storeUsers)
      .where(eq(storeUsers.id, memberId))
      .limit(1);

    if (!memberInfo) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verificar si el usuario que hace la petición tiene permisos
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, memberInfo.store_id!)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para actualizar
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to update team members' }, { status: 403 });
    }

    // No permitir cambiar el rol de un 'owner'
    if (memberInfo.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change the role of the owner' }, { status: 403 });
    }

    // Actualizar el rol del miembro
    const [updatedMember] = await db
      .update(storeUsers)
      .set({
        role: role,
        updated_at: new Date()
      })
      .where(eq(storeUsers.id, memberId))
      .returning();

    return NextResponse.json({
      success: true,
      member: updatedMember
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Elimina un miembro del equipo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const memberId = (await params).id;
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener información del miembro a eliminar
    const [memberInfo] = await db
      .select({ id: storeUsers.id, user_id: storeUsers.user_id, store_id: storeUsers.store_id, role: storeUsers.role })
      .from(storeUsers)
      .where(eq(storeUsers.id, memberId))
      .limit(1);

    if (!memberInfo) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verificar si el usuario que hace la petición tiene permisos
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, memberInfo.store_id!)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para eliminar
    if (!['owner', 'admin'].includes(userAccess.role!)) {
      return NextResponse.json({ error: 'You do not have permission to remove team members' }, { status: 403 });
    }

    // No permitir eliminar a un 'owner'
    if (memberInfo.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the owner of the store' }, { status: 403 });
    }

    // No permitir que un admin elimine a otro admin si no es owner
    if (userAccess.role === 'admin' && memberInfo.role === 'admin') {
      return NextResponse.json({ error: 'Admins cannot remove other admins' }, { status: 403 });
    }

    // Eliminar al miembro
    await db.delete(storeUsers).where(eq(storeUsers.id, memberId));

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
