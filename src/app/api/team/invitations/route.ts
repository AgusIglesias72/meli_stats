// src/app/api/team/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// GET: Obtiene todas las invitaciones pendientes para una tienda
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener el ID de la tienda de los parámetros
    const searchParams = request.nextUrl.searchParams;
    const storeId = searchParams.get('store_id');
    
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario tiene acceso a esta tienda
    const { data: userAccess, error: accessError } = await supabase
      .from('store_users')
      .select('role')
      .eq('user_id', authUserId)
      .eq('store_id', storeId)
      .single();

    if (accessError || !userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Verificar si el usuario tiene rol suficiente para ver invitaciones
    if (!['owner', 'admin'].includes(userAccess.role)) {
      return NextResponse.json({ error: 'You do not have permission to view invitations' }, { status: 403 });
    }

    // Obtener todas las invitaciones pendientes
    const { data: invitations, error: invitationsError } = await supabase
      .from('invitations')
      .select('*')
      .eq('store_id', storeId)
      .is('used_at', null) // Solo invitaciones no utilizadas
      .gt('expires_at', new Date().toISOString()) // Solo invitaciones no expiradas
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return NextResponse.json({ error: 'Error fetching invitations' }, { status: 500 });
    }

    return NextResponse.json({
      invitations: invitations
    });
  } catch (error) {
    console.error('Error processing invitations request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}