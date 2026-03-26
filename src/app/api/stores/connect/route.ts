// src/app/api/stores/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

// POST: Conecta una nueva tienda de Mercado Libre
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener datos de la solicitud
    const {
      code,
      redirect_uri = process.env.NEXT_PUBLIC_MERCADOLIBRE_REDIRECT_URI
    } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    // Obtener tokens de Mercado Libre usando el código de autorización
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
        redirect_uri: redirect_uri || ''
      })
    });

    if (!mlResponse.ok) {
      const errorData = await mlResponse.json();
      console.error('Error exchanging code for token:', errorData);
      return NextResponse.json({
        error: 'Error connecting to Mercado Libre API',
        details: errorData
      }, { status: 500 });
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
      return NextResponse.json({
        error: 'Error fetching user data from Mercado Libre'
      }, { status: 500 });
    }

    const userData = await userResponse.json();

    // Calcular la fecha de expiración del token
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + mlData.expires_in);

    // Verificar si la tienda ya existe
    const existingStore = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.store_id, userData.id))
      .limit(1);

    let storeId;

    if (existingStore && existingStore.length > 0) {
      // Si la tienda ya existe, actualizarla
      const [updatedStore] = await db
        .update(stores)
        .set({
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate,
          updated_at: new Date()
        })
        .where(eq(stores.id, existingStore[0].id))
        .returning();

      if (!updatedStore) {
        console.error('Error updating store');
        return NextResponse.json({ error: 'Error updating store' }, { status: 500 });
      }

      storeId = updatedStore.id;

      // Verificar si el usuario ya tiene acceso a esta tienda
      const existingAccess = await db
        .select({ id: storeUsers.id, role: storeUsers.role })
        .from(storeUsers)
        .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, storeId)))
        .limit(1);

      if (!existingAccess || existingAccess.length === 0) {
        // Si el usuario no tiene acceso, darle acceso como propietario
        await db
          .insert(storeUsers)
          .values({
            user_id: authUserId,
            store_id: storeId,
            role: 'owner'
          });
      }
    } else {
      // Si la tienda no existe, crearla
      const [newStore] = await db
        .insert(stores)
        .values({
          store_id: userData.id,
          name: userData.nickname || `Tienda ${userData.id}`,
          ml_user_id: userData.id,
          access_token: mlData.access_token,
          refresh_token: mlData.refresh_token,
          token_expiry: expiryDate
        })
        .returning();

      if (!newStore) {
        console.error('Error creating store');
        return NextResponse.json({ error: 'Error creating store' }, { status: 500 });
      }

      storeId = newStore.id;

      // Dar acceso al usuario como propietario
      await db
        .insert(storeUsers)
        .values({
          user_id: authUserId,
          store_id: storeId,
          role: 'owner'
        });
    }

    // Establecer cookies para mantener la sesión
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

    return NextResponse.json({
      success: true,
      message: existingStore && existingStore.length > 0 ? 'Store updated successfully' : 'Store connected successfully',
      store_id: storeId
    });
  } catch (error) {
    console.error('Error connecting store:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
