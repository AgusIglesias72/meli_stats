// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const maxDuration = 59; // Máximo 59 segundos para procesar grandes cantidades de datos

/**
 * Función auxiliar para crear objetos de fecha según el parámetro de consulta
 */
function getDateRange(dateParam: string | null): { startDate: Date, endDate: Date } {
  const now = new Date();
  const endDate = new Date(now);
  const startDate = new Date(now);

  // Ajustar a la zona horaria de Argentina (GMT-3)
  //const argentinaOffset = -3 * 60; // -3 horas en minutos
  //const offsetMinutes = now.getTimezoneOffset() - argentinaOffset;
  
  //endDate.setMinutes(endDate.getMinutes() + offsetMinutes);
  //startDate.setMinutes(startDate.getMinutes() + offsetMinutes);
  
  // Establecer endDate a las 23:59:59 del día actual
  endDate.setHours(23, 59, 59, 999);

  switch (dateParam) {
    case 'last_date':
      // Último día (ayer)
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      break;
      
    case 'last_week':
      // Última semana
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
      
    case 'month_to_date':
      // Desde el inicio del mes hasta hoy
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      break;
      
    default:
      // Por defecto, últimos 30 días
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

/**
 * GET: Obtiene órdenes para una tienda específica en un rango de fechas
 */
export async function GET(request: NextRequest) {
  try {
     // Verificar clave de API para seguridad
     const authHeader = request.headers.get('Authorization');
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     
     const apiKey = authHeader.split(' ')[1];
     if (apiKey !== process.env.NEXT_PUBLIC_API_SECRET_KEY) {
       return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
     }
    // Obtener parámetros de la URL
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date_range'); // 'last_date', 'last_week', 'month_to_date'
    const status = searchParams.get('status'); // opcional: filtrar por estado

    // Crear cliente de Supabase
    const supabase = createServerSupabaseClient();
    
    // Obtener el rango de fechas según el parámetro
    const { startDate, endDate } = getDateRange(dateParam);
    
    // Consultar las tiendas que queremos (IDs específicos)
    const storeIds = ['1027217359', '205076801'];

    // Consultar órdenes directamente de la tabla
    let query = supabase
      .from('orders')
      .select('*')
      .in('store_id', storeIds)
      .gte('date_created', startDate.toISOString())
      .lte('date_created', endDate.toISOString())
      .order('date_created', { ascending: false });

    // Filtrar por estado si se proporciona
    if (status) {
      query = query.eq('status', status);
    }

    // Ejecutar la consulta
    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Error fetching orders from database' }, { status: 500 });
    }

    // Formatear fechas para Argentina (GMT-3)
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return null;
      
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    // Procesar y formatear órdenes para hacerlas más amigables para Google Sheets
    const formattedOrders = orders?.map(order => {
      return {
        id: `${order.id}`,
        date_created: formatDate(order.date_created),
        status: order.status,
        pack_id: `${order.pack_id}`,
        store_id: `${order.store_id}`,
        buyer_name: order.buyer_name,
        doc_number: order.doc_number,
        item_id: `${order.item_id}`,
        seller_sku: order.seller_sku,
        quantity: order.quantity,
        item_title: order.item_title,
        unit_price: order.unit_price,
        variation_attributes: order.variation_attributes,
        shipping_id: order.shipping_id,
        shipping_mode: order.shipping_mode,
        shipping_logistic_type: order.shipping_logistic_type,
        shipping_status: order.shipping_status,
        total_paid_amount: order.total_paid_amount,
        transaction_amount: order.transaction_amount,
        shipping_amount: order.shipping_amount,
        coupon_amount: order.coupon_amount,
        net_received_amount: order.net_received_amount,
        charge_shipping: order.charge_shipping,
        charge_coupon: order.charge_coupon,
        charge_flat_fee: order.charge_flat_fee,
        charge_meli_percentage_fee: order.charge_meli_percentage_fee,
        charge_tax_withholding_debitos_creditos: order.charge_tax_withholding_debitos_creditos,
        charge_other_taxes: order.charge_other_taxes,
        financing_add_on_fee: order.financing_add_on_fee,
        charge_uncategorized: order.charge_uncategorized,
        installments: order.installments,
        money_release_date: formatDate(order.money_release_date),
        charge_types: order.charge_types,
        created_at: formatDate(order.created_at),
        updated_at: formatDate(order.updated_at)
      };
    }) || [];

    // Devolver las órdenes formateadas
    return NextResponse.json({
      success: true,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        parameter: dateParam || 'default'
      },
      orders: formattedOrders,
      count: formattedOrders.length
    });
    
  } catch (error: any) {
    console.error('Error processing orders request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    }, { status: 500 });
  }
}