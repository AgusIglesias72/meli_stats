// src/app/api/internal/sync-sheet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncItemToSheet, syncItemToSheetBackup } from '@/lib/syncItemToSheet';

export const maxDuration = 4; // Era 59, ahora 10 segundos máximo
//export const runtime = 'edge';


export async function POST(req: NextRequest) {
  try {
    const itemData = await req.json();
    const result = await syncItemToSheet(itemData);

    if (!result.success) {
      // Vamos a enviar la misma solicitud a la función de backup
      const resultBackup = await syncItemToSheetBackup(itemData);

      if (!resultBackup.success) {
        console.error('Error en /api/internal/sync-sheet:', resultBackup.message);
        return NextResponse.json({ error: 'Falló la sincronización con Sheets' }, { status: 500 });
      }

      return NextResponse.json({ success: true, resultBackup });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error en /api/internal/sync-sheet:', error);
    return NextResponse.json({ error: 'Falló la sincronización con Sheets' }, { status: 500 });
  }
}
