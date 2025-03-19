import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Obtener el código de autorización de la URL
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.redirect(new URL('/auth/error?error=no_code', request.url));
    }

    // Intercambiar el código por un token de acceso
    const response = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.MERCADOLIBRE_APP_ID || '',
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY || '',
        code,
        redirect_uri: process.env.MERCADOLIBRE_REDIRECT_URI || ''
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error exchanging code for token:', errorData);
      return NextResponse.redirect(new URL('/auth/error?error=token_exchange', request.url));
    }

    const data = await response.json();
    
    // Obtener información del usuario
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${data.access_token}`
      }
    });

    if (!userResponse.ok) {
      console.error('Error fetching user data');
      return NextResponse.redirect(new URL('/auth/error?error=user_fetch', request.url));
    }

    const userData = await userResponse.json();

    // Calcular la fecha de expiración del token
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + data.expires_in);

    // Guardar o actualizar la información del usuario en la base de datos
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', userData.id)
      .single();

    if (existingUser) {
      // Actualizar usuario existente
      await supabase
        .from('users')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expiry: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userData.id);
    } else {
      // Crear nuevo usuario
      await supabase
        .from('users')
        .insert({
          user_id: userData.id,
          email: userData.email,
          nickname: userData.nickname,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expiry: expiryDate.toISOString()
        });
    }

    // Establecer una cookie para mantener la sesión del usuario
    (await cookies()).set('ml_user_id', userData.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    // Redireccionar al dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(new URL('/auth/error?error=server_error', request.url));
  }
}