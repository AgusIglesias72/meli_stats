// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, stores, storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Determinar si estamos en flujo de login o conexión de tienda adicional
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    let userId;

    if (authUserId) {
      // El usuario ya está autenticado, estamos conectando una tienda adicional
      userId = authUserId;
    } else {
      // Flujo de login/registro - buscar o crear usuario
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.user_id, userData.id))
        .limit(1);

      if (existingUser) {
        // Usuario existe, actualizar sus datos
        userId = existingUser.id;
        await db
          .update(users)
          .set({
            email: userData.email,
            nickname: userData.nickname,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            identification: userData.identification?.number || '',
            updated_at: new Date()
          })
          .where(eq(users.id, userId));
      } else {
        // Crear nuevo usuario
        const [newUser] = await db
          .insert(users)
          .values({
            user_id: userData.id,
            email: userData.email,
            nickname: userData.nickname,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            identification: userData.identification?.number || '',
            created_at: new Date()
          })
          .returning();

        if (!newUser) {
          console.error('Error creating user');
          return NextResponse.redirect(new URL('/auth/error?error=user_creation', request.url));
        }

        userId = newUser.id;
      }
    }

    // Verificar si la tienda ya existe
    const [existingStore] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.store_id, userData.id))
      .limit(1);

    let storeId;

    if (existingStore) {
      // Actualizar tienda existente
      const [updatedStore] = await db
        .update(stores)
        .set({
          name: userData.nickname || `Tienda ${userData.id}`,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate,
          seller_first_name: userData.first_name || '',
          seller_last_name: userData.last_name || '',
          seller_email: userData.email || '',
          seller_identification_number: userData.identification?.number || '',
          updated_at: new Date()
        })
        .where(eq(stores.id, existingStore.id))
        .returning();

      if (!updatedStore) {
        console.error('Error updating store');
        return NextResponse.redirect(new URL('/auth/error?error=store_update', request.url));
      }

      storeId = updatedStore.id;
    } else {
      // Crear nueva tienda
      const [newStore] = await db
        .insert(stores)
        .values({
          store_id: userData.id,
          name: userData.nickname || `Tienda ${userData.id}`,
          ml_user_id: userData.id,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate,
          seller_first_name: userData.first_name || '',
          seller_last_name: userData.last_name || '',
          seller_email: userData.email || '',
          seller_identification_number: userData.identification?.number || '',
          created_at: new Date()
        })
        .returning();

      if (!newStore) {
        console.error('Error creating store');
        return NextResponse.redirect(new URL('/auth/error?error=store_creation', request.url));
      }

      storeId = newStore.id;
    }

    // Verificar si el usuario ya tiene acceso a esta tienda
    const [existingAccess] = await db
      .select({ id: storeUsers.id })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, userId), eq(storeUsers.store_id, storeId)))
      .limit(1);

    if (!existingAccess) {
      // Conectar usuario con la tienda como propietario
      await db
        .insert(storeUsers)
        .values({
          user_id: userId,
          store_id: storeId,
          role: 'owner',
          created_at: new Date()
        });
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
