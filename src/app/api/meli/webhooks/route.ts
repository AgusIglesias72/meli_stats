import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Verificar la autenticación de la notificación mediante headers o firma (implementar en el futuro)
    // Por ahora, solo registramos la notificación para debugging

    // Obtener el cuerpo de la notificación
    const body = await request.json();
    
    // Crear una conexión a Supabase
    const supabase = createServerSupabaseClient();
    
    // Registrar la notificación para análisis (opcional)
    console.log('Notificación recibida de Mercado Libre:', body);
    
    // Puedes guardar la notificación en una tabla de log en Supabase
    // Solo como ejemplo, no es necesario implementar ahora
    /*
    await supabase
      .from('mercadolibre_notifications')
      .insert({
        notification_id: body.id,
        topic: body.topic,
        resource: body.resource,
        user_id: body.user_id,
        application_id: body.application_id,
        sent: body.sent,
        received: new Date().toISOString(),
        raw_data: body
      });
    */
    
    // Si la notificación es sobre un cambio de ítem, podemos actualizar nuestros datos
    if (body.topic === 'items') {
      // Procesar la actualización de items (implementar en el futuro)
      // Por ahora, solo confirmamos la recepción
    }

    // Responder a Mercado Libre que recibimos la notificación
    return NextResponse.json({ message: 'Notification received successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing MercadoLibre webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Mercado Libre envía una solicitud de verificación por GET al registrar el webhook
export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'Webhook endpoint active' }, { status: 200 });
}