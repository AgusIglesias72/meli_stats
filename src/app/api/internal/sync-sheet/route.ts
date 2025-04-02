// src/app/api/internal/sync-sheet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncItemToSheet } from '@/lib/syncItemToSheet';

export async function POST(req: NextRequest) {
  try {
    const itemData = await req.json();
    await syncItemToSheet(itemData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en /api/internal/sync-sheet:', error);
    return NextResponse.json({ error: 'Falló la sincronización con Sheets' }, { status: 500 });
  }
}
