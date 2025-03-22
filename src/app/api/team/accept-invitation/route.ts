// src/app/api/team/accept-invitation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// POST: Acepta una invitación y crea la relación usuario-tienda
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Obtener el email del usuario actual
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', authUserId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verificar si el email del usuario coincide con el de la invitación
    if (userData.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({ 
        error: 'This invitation was sent to a different email address' 
      }, { status: 403 });
    }

    // Verificar si el usuario ya es miembro de esta tienda
    const { data: existingMember } = await supabase
      .from('store_users')
      .select('id')
      .eq('user_id', authUserId)
      .eq('store_id', invitation.store_id)
      .limit(1);

    if (existingMember && existingMember.length > 0) {
      return NextResponse.json({ error: 'You are already a member of this store' }, { status: 409 });
    }

    // Comenzar una transacción
    // Nota: Supabase no soporta transacciones en la API, así que haremos esto en dos pasos

    // 1. Crear la relación usuario-tienda
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .insert({
        user_id: authUserId,
        store_id: invitation.store_id,
        role: invitation.role
      })
      .select()
      .single();

    if (storeUserError) {
      console.error('Error creating store user relationship:', storeUserError);
      return NextResponse.json({ error: 'Error accepting invitation' }, { status: 500 });
    }

    // 2. Marcar la invitación como utilizada
    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        used_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      // Si hay un error aquí, la relación usuario-tienda ya se creó,
      // pero no es crítico si la invitación no se marca como utilizada
    }

    // Obtener información de la tienda para la respuesta
    const { data: storeInfo, error: storeError } = await supabase
      .from('stores')
      .select('id, name, store_id')
      .eq('id', invitation.store_id)
      .single();

    if (storeError) {
      console.error('Error fetching store info:', storeError);
    }

    // Establecer esta tienda como la seleccionada actualmente
    (await cookies()).set('selected_store_id', invitation.store_id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    // Establecer el ML user ID para esta tienda
    if (storeInfo?.store_id) {
      (await cookies()).set('ml_user_id', storeInfo.store_id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      store: storeInfo || { id: invitation.store_id },
      role: invitation.role
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}