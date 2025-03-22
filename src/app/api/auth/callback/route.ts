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

    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.redirect(new URL('/login', request.url));
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
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY || '',
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
          seller_first_name: firstName,
          seller_last_name: lastName,
          seller_email: email,
          seller_identification_number: identificationNumber,
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
        .eq('user_id', authUserId)
        .eq('store_id', storeId)
        .limit(1);
        
      if (!existingAccess || existingAccess.length === 0) {
        // Si el usuario no tiene acceso, darle acceso como propietario
        const { error: accessError } = await supabase
          .from('store_users')
          .insert({
            user_id: authUserId,
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
          seller_first_name: firstName,
          seller_last_name: lastName,
          seller_email: email,
          seller_identification_number: identificationNumber
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
          user_id: authUserId,
          store_id: storeId,
          role: 'owner'
        });
        
      if (accessError) {
        console.error('Error granting access to store:', accessError);
        return NextResponse.redirect(new URL('/auth/error?error=access_grant', request.url));
      }
    }

    // Establecer cookies para la sesión
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

// Mantener el método POST para posibles usos futuros
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;
    
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Obtener código de autorización
    const { code } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
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
        client_secret: process.env.MERCADOLIBRE_SECRET_KEY || '',
        code,
        redirect_uri: process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI || ''
      })
    });

    if (!mlResponse.ok) {
      console.error('Error exchanging code for token:', await mlResponse.text());
      return NextResponse.json({ error: 'Error connecting to Mercado Libre API' }, { status: 500 });
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
      return NextResponse.json({ error: 'Error fetching user data from Mercado Libre' }, { status: 500 });
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
    
    // Crear la tienda en Supabase con los datos adicionales
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .insert({
        store_id: userData.id,
        name: userData.nickname || `Tienda ${userData.id}`,
        ml_user_id: userData.id,
        access_token: mlData.access_token,
        refresh_token: mlData.refresh_token,
        token_expiry: expiryDate.toISOString(),
        seller_first_name: firstName,
        seller_last_name: lastName,
        seller_email: email,
        seller_identification_number: identificationNumber
      })
      .select()
      .single();

    if (storeError) {
      console.error('Error creating store:', storeError);
      return NextResponse.json({ error: 'Error creating store' }, { status: 500 });
    }
    
    console.log('Store created:', store);
    
    // Crear relación usuario-tienda (propietario)
    const { data: storeUser, error: storeUserError } = await supabase
      .from('store_users')
      .insert({
        user_id: authUserId,
        store_id: store.id,
        role: 'owner'
      })
      .select()
      .single();
      
    if (storeUserError) {
      console.error('Error creating store-user relationship:', storeUserError);
      return NextResponse.json({ error: 'Error creating store-user relationship' }, { status: 500 });
    }
    
    console.log('Store-user relationship created:', storeUser);

    // Establecer cookies para la sesión
    (await cookies()).set('selected_store_id', store.id, {
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

    return NextResponse.json({
      success: true,
      message: 'Store connected successfully',
      store_id: store.id
    });
  } catch (error) {
    console.error('Error in auth callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}