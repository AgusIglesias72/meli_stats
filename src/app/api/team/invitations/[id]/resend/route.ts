// src/app/api/team/invitations/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { params } = context;
    const invitationId = params.id;
    
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
      .select('id, store_id, email, token, role')
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

    // Verificar si el usuario tiene rol suficiente para reenviar invitaciones
    if (!['owner', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'You do not have permission to resend invitations' }, { status: 403 });
    }

    // Extender la fecha de expiración (7 días más desde ahora)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Actualizar la fecha de expiración
    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        expires_at: expiryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json({ error: 'Error resending invitation' }, { status: 500 });
    }

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