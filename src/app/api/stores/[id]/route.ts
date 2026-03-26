// src/app/api/stores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stores, storeUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const authUserId = (await cookies()).get('auth_user_id')?.value;

    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = (await params).id;

    // Verificar si el usuario tiene acceso a esta tienda
    const [userAccess] = await db
      .select({ role: storeUsers.role })
      .from(storeUsers)
      .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, storeId)))
      .limit(1);

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
    }

    // Obtener la información de la tienda
    const [storeInfo] = await db
      .select({
        id: stores.id,
        store_id: stores.store_id,
        name: stores.name,
        ml_user_id: stores.ml_user_id,
        token_expiry: stores.token_expiry,
        created_at: stores.created_at,
        updated_at: stores.updated_at,
        seller_first_name: stores.seller_first_name,
        seller_last_name: stores.seller_last_name,
        seller_email: stores.seller_email,
        seller_identification_number: stores.seller_identification_number,
      })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (!storeInfo) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      store: storeInfo,
      user_role: userAccess.role
    });
  } catch (error) {
    console.error('Error getting store information:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// src/app/api/stores/[id]/route.ts - Método PATCH
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      // Verificar autenticación
      const authUserId = (await cookies()).get('auth_user_id')?.value;

      if (!authUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const storeId = (await params).id;

      // Obtener datos a actualizar
      const {
        name,
        seller_first_name,
        seller_last_name,
        seller_email,
        seller_identification_number
      } = await request.json();

      // Verificar si el usuario tiene acceso a esta tienda
      const [userAccess] = await db
        .select({ role: storeUsers.role })
        .from(storeUsers)
        .where(and(eq(storeUsers.user_id, authUserId), eq(storeUsers.store_id, storeId)))
        .limit(1);

      if (!userAccess) {
        return NextResponse.json({ error: 'Access denied to this store' }, { status: 403 });
      }

      // Verificar si el usuario tiene permisos para actualizar (owner o admin)
      if (!['owner', 'admin'].includes(userAccess.role!)) {
        return NextResponse.json({ error: 'You do not have permission to update store information' }, { status: 403 });
      }

      // Actualizar la información de la tienda
      const [updatedStore] = await db
        .update(stores)
        .set({
          name: name,
          seller_first_name: seller_first_name,
          seller_last_name: seller_last_name,
          seller_email: seller_email,
          seller_identification_number: seller_identification_number,
          updated_at: new Date()
        })
        .where(eq(stores.id, storeId))
        .returning();

      if (!updatedStore) {
        console.error('Error updating store');
        return NextResponse.json({ error: 'Error updating store' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        store: updatedStore
      });
    } catch (error) {
      console.error('Error updating store:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
