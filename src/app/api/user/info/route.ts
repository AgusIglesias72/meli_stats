// src/app/api/user/info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;
    
    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener información adicional si es necesario
    const supabase = createServerSupabaseClient();
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, nickname')
      .eq('user_id', mlUserId)
      .single();

    if (error) {
      console.error('Error fetching user data:', error);
    }

    // Devolver información básica del usuario
    return NextResponse.json({
      user_id: mlUserId,
      email: userData?.email || null,
      nickname: userData?.nickname || null
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}