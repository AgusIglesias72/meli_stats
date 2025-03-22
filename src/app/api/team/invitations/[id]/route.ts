// src/app/api/team/invitations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
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

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información de la invitación
    const { data: invitationInfo, error: invitationError } = await supabase
      .from('invitations')
      .select('id, store_id')
      .eq('id', invitationId)
      .single();

    if (invitationError || !invitationInfo) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', invitationInfo.store_id)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para cancelar invitaciones
    if (!['owner', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'You do not have permission to cancel invitations' }, { status: 403 });
    }

    // Eliminar la invitación
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (deleteError) {
      console.error('Error canceling invitation:', deleteError);
      return NextResponse.json({ error: 'Error canceling invitation' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}