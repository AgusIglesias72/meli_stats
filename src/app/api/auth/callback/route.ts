// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

// Método GET para manejar la redirección de Mercado Libre
export async function GET(request: NextRequest) {
  try {
    // Extraer el código de la URL
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    
    if (error) {
      console.error('Error en la autorización de Mercado Libre:', error);
      return NextResponse.redirect(new URL('/auth/error?error=' + error, request.url));
    }
    
    if (!code) {
      console.error('No se recibió código de autorización');
      return NextResponse.redirect(new URL('/auth/error?error=no_code', request.url));
    }

    // Intentar obtener el ID de usuario de la cookie (podría estar o no)
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    // Si no hay un auth_user_id, continuamos de todas formas porque lo vamos a crear en esta función

    // Obtener tokens de Mercado Libre
    const mlResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_MERCADOLIBRE_APP_ID || '',
        client_secret: process.env.NEXT_PUBLIC_MERCADOLIBRE_SECRET_KEY || '',
        code,
        redirect_uri: process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI || ''
      })
    });

    if (!mlResponse.ok) {
      console.error('Error exchanging code for token:', await mlResponse.text());
      return NextResponse.redirect(new URL('/auth/error?error=token_exchange', request.url));
    }

    const mlData = await mlResponse.json();
    console.log('ML OAuth response:', mlData);
    
    // Obtener información del usuario de Mercado Libre
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${mlData.access_token}`
      }
    });

    if (!userResponse.ok) {
      console.error('Error fetching user data from Mercado Libre');
      return NextResponse.redirect(new URL('/auth/error?error=user_fetch', request.url));
    }

    const userData = await userResponse.json();
    console.log('ML User data:', userData);

    // Calcular la fecha de expiración del token
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + mlData.expires_in);

    // Extraer los datos adicionales del usuario
    const firstName = userData.first_name || '';
    const lastName = userData.last_name || '';
    const email = userData.email || '';
    
    // Extraer el número de identificación
    let identificationNumber = '';
    if (userData.identification && userData.identification.number) {
      identificationNumber = userData.identification.number;
    }

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Verificar si el usuario ya existe en nuestra base de datos
    let userId = authUserId;
    if (!userId) {
      // Buscar si ya existe un usuario con este ID
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', userData.id)
        .limit(1);
        
      if (existingUser && existingUser.length > 0) {
        // Si el usuario ya existe, usamos su ID
        userId = existingUser[0].user_id;
      } else {
        // Si no existe, creamos un nuevo usuario
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            user_id: userData.id,
            email: userData.email,
            nickname: userData.nickname,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            identification: identificationNumber  || '',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (userError) {
          console.error('Error creating user:', userError);
          return NextResponse.redirect(new URL('/auth/error?error=user_creation', request.url));
        }
        
        userId = newUser.id;
      }
    }
    
    // Verificar si la tienda ya existe
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id')
      .eq('store_id', userData.id)
      .limit(1);
      
    let storeId;
    
    if (existingStore && existingStore.length > 0) {
      // Si la tienda ya existe, actualizarla
      const { data: updatedStore, error: updateError } = await supabase
        .from('stores')
        .update({
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStore[0].id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating store:', updateError);
        return NextResponse.redirect(new URL('/auth/error?error=store_update', request.url));
      }
      
      storeId = updatedStore.id;
      
      // Verificar si el usuario ya tiene acceso a esta tienda
      const { data: existingAccess } = await supabase
        .from('store_users')
        .select('id, role')
        .eq('user_id', userId)
        .eq('store_id', storeId)
        .limit(1);
        
      if (!existingAccess || existingAccess.length === 0) {
        // Si el usuario no tiene acceso, darle acceso como propietario
        const { error: accessError } = await supabase
          .from('store_users')
          .insert({
            user_id: userId,
            store_id: storeId,
            role: 'owner'
          });
          
        if (accessError) {
          console.error('Error granting access to store:', accessError);
          return NextResponse.redirect(new URL('/auth/error?error=access_grant', request.url));
        }
      }
    } else {
      // Si la tienda no existe, crearla
      const { data: newStore, error: storeError } = await supabase
        .from('stores')
        .insert({
          store_id: userData.id,
          name: userData.nickname || `Tienda ${userData.id}`,
          ml_user_id: userData.id,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate.toISOString(),
        })
        .select()
        .single();

      if (storeError) {
        console.error('Error creating store:', storeError);
        return NextResponse.redirect(new URL('/auth/error?error=store_creation', request.url));
      }
      
      storeId = newStore.id;
      
      // Dar acceso al usuario como propietario
      const { error: accessError } = await supabase
        .from('store_users')
        .insert({
          user_id: userId,
          store_id: storeId,
          role: 'owner'
        });
        
      if (accessError) {
        console.error('Error granting access to store:', accessError);
        return NextResponse.redirect(new URL('/auth/error?error=access_grant', request.url));
      }
    }

    // Establecer cookies para la sesión
    (await cookies()).set('auth_user_id', userId || '', {
      path: '/',
      maxAge: 60 * 60 * 24, // 1 día
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    (await cookies()).set('selected_store_id', storeId, {
      path: '/',
      maxAge: 60 * 60 * 24, // 1 día
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    (await cookies()).set('ml_user_id', userData.id, {
      path: '/',
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });

    // Redirigir al dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error in auth callback:', error);
    return NextResponse.redirect(new URL('/auth/error?error=server_error', request.url));
  }
}
