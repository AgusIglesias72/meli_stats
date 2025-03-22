// src/app/api/team/members/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
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

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información del miembro a actualizar
    const { data: memberInfo, error: memberError } = await supabase
      .from('store_users')
      .select('id, user_id, store_id, role')
      .eq('id', memberId)
      .single();

    if (memberError || !memberInfo) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verificar si el usuario que hace la petición tiene permisos
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', memberInfo.store_id)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para actualizar
    if (!['owner', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'You do not have permission to update team members' }, { status: 403 });
    }

    // No permitir cambiar el rol de un 'owner'
    if (memberInfo.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change the role of the owner' }, { status: 403 });
    }

    // Actualizar el rol del miembro
    const { data: updatedMember, error: updateError } = await supabase
      .from('store_users')
      .update({ 
        role: role,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating team member:', updateError);
      return NextResponse.json({ error: 'Error updating team member' }, { status: 500 });
    }

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

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información del miembro a eliminar
    const { data: memberInfo, error: memberError } = await supabase
      .from('store_users')
      .select('id, user_id, store_id, role')
      .eq('id', memberId)
      .single();

    if (memberError || !memberInfo) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verificar si el usuario que hace la petición tiene permisos
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', memberInfo.store_id)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para eliminar
    if (!['owner', 'admin'].includes(userAccess.role)) {
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
    const { error: deleteError } = await supabase
      .from('store_users')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      console.error('Error removing team member:', deleteError);
      return NextResponse.json({ error: 'Error removing team member' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}