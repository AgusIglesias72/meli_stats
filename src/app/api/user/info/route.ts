// src/app/api/user/info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const mlUserId = (await cookies()).get('ml_user_id')?.value;

    if (!mlUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener información adicional si es necesario
    let userData: { id: string; email: string | null; nickname: string | null } | undefined;
    try {
      const [result] = await db
        .select({ id: users.id, email: users.email, nickname: users.nickname })
        .from(users)
        .where(eq(users.user_id, Number(mlUserId)))
        .limit(1);
      userData = result;
    } catch (err) {
      console.error('Error fetching user data:', err);
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
