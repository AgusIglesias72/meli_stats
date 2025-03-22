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

    // Calcular la fecha de expiración del token
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + mlData.expires_in);

    // Crear conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Determinar si estamos en flujo de login o conexión de tienda adicional
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    let userId;
    
    if (authUserId) {
      // El usuario ya está autenticado, estamos conectando una tienda adicional
      userId = authUserId;
    } else {
      // Flujo de login/registro - buscar o crear usuario
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('user_id', userData.id)
        .single();
        
      if (existingUser) {
        // Usuario existe, actualizar sus datos
        userId = existingUser.id;
        await supabase
          .from('users')
          .update({
            email: userData.email,
            nickname: userData.nickname,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            identification: userData.identification?.number || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } else {
        // Crear nuevo usuario
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            user_id: userData.id,
            email: userData.email,
            nickname: userData.nickname,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            identification: userData.identification?.number || '',
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
      .single();
      
    let storeId;
    
    if (existingStore) {
      // Actualizar tienda existente
      const { data: updatedStore, error: updateError } = await supabase
        .from('stores')
        .update({
          name: userData.nickname || `Tienda ${userData.id}`,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate.toISOString(),
          seller_first_name: userData.first_name || '',
          seller_last_name: userData.last_name || '',
          seller_email: userData.email || '',
          seller_identification_number: userData.identification?.number || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStore.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating store:', updateError);
        return NextResponse.redirect(new URL('/auth/error?error=store_update', request.url));
      }
      
      storeId = updatedStore.id;
    } else {
      // Crear nueva tienda
      const { data: newStore, error: storeError } = await supabase
        .from('stores')
        .insert({
          store_id: userData.id,
          name: userData.nickname || `Tienda ${userData.id}`,
          ml_user_id: userData.id,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate.toISOString(),
          seller_first_name: userData.first_name || '',
          seller_last_name: userData.last_name || '',
          seller_email: userData.email || '',
          seller_identification_number: userData.identification?.number || '',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (storeError) {
        console.error('Error creating store:', storeError);
        return NextResponse.redirect(new URL('/auth/error?error=store_creation', request.url));
      }
      
      storeId = newStore.id;
    }
    
    // Verificar si el usuario ya tiene acceso a esta tienda
    const { data: existingAccess } = await supabase
      .from('store_users')
      .select('id')
      .eq('user_id', userId)
      .eq('store_id', storeId)
      .single();
    
    if (!existingAccess) {
      // Conectar usuario con la tienda como propietario
      const { error: accessError } = await supabase
        .from('store_users')
        .insert({
          user_id: userId,
          store_id: storeId,
          role: 'owner',
          created_at: new Date().toISOString()
        });
        
      if (accessError) {
        console.error('Error granting access to store:', accessError);
        return NextResponse.redirect(new URL('/auth/error?error=access_grant', request.url));
      }
    }

    // Establecer cookies para la sesión
    (await cookies()).set('auth_user_id', userId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    (await cookies()).set('selected_store_id', storeId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
  
    (await cookies()).set('ml_user_id', userData.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
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