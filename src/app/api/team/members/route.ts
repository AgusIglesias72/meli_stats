// src/app/api/team/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Interfaces para tipar los datos
interface UserData {
  id: string;
  email: string;
}

interface StoreUserData {
  id: string;
  role: string;
  created_at: string;
  user: UserData;
}

interface FormattedMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

// GET: Obtiene todos los miembros de una tienda
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

    // Obtener todos los miembros de la tienda con sus roles
    const { data: members, error: membersError } = await supabase
      .from('store_users')
      .select(`
        id,
        role,
        created_at,
        user:user_id (
          id,
          email
        )
      `)
      .eq('store_id', storeId);

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return NextResponse.json({ error: 'Error fetching team members' }, { status: 500 });
    }

    // Formatear los datos para la respuesta
    const formattedMembers: FormattedMember[] = (members as unknown as StoreUserData[]).map(member => ({
      id: member.id,
      user_id: member.user?.id || '',
      email: member.user?.email || '',
      role: member.role,
      created_at: member.created_at
    }));

    return NextResponse.json({
      members: formattedMembers
    });
  } catch (error) {
    console.error('Error processing team members request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}