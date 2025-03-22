// src/app/api/team/verify-invitation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// POST: Verifica los detalles de una invitación por token
export async function POST(request: NextRequest) {
  try {
    // Obtener el token de la invitación desde el cuerpo de la solicitud
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener información de la invitación
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('id, store_id, email, role, expires_at, used_at')
      .eq('token', token)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation token' }, { status: 404 });
    }

    // Verificar si la invitación ya fue utilizada
    if (invitation.used_at) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 409 });
    }

    // Verificar si la invitación ha expirado
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Obtener información de la tienda
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('name, store_id')
      .eq('id', invitation.store_id)
      .single();

    if (storeError) {
      console.error('Error fetching store info:', storeError);
      // Continuar aunque no se obtenga la info de la tienda
    }

    // Verificar si el usuario está autenticado (opcional)
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (authUserId) {
      // Si está autenticado, comprobar si su email coincide
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', authUserId)
        .single();

      if (!userError && userData) {
        // Verificar si el email del usuario coincide con el de la invitación
        if (userData.email.toLowerCase() !== invitation.email.toLowerCase()) {
          return NextResponse.json({ 
            warning: 'This invitation was sent to a different email address',
            invitationEmail: invitation.email,
            userEmail: userData.email
          });
        }

        // Verificar si el usuario ya es miembro de esta tienda
        const { data: existingMember } = await supabase
          .from('store_users')
          .select('id')
          .eq('user_id', authUserId)
          .eq('store_id', invitation.store_id)
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