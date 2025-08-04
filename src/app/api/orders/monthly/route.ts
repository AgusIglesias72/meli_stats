// src/app/api/orders/monthly/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const maxDuration = 30; // Aumentado para manejar meses con muchas órdenes
export const runtime = 'edge';

/**
 * Función auxiliar para obtener el rango de fechas para un mes específico
 */
function getMonthDateRange(yearMonth: string): { startDate: Date, endDate: Date } | null {
  // Validar formato YYYY-MM
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthRegex.test(yearMonth)) {
    return null;
  }

  const [year, month] = yearMonth.split('-').map(Number);
  
  // Primer día del mes a las 00:00:00
  const startDate = new Date(year, month - 1, 1);
  startDate.setHours(0, 0, 0, 0);
  
  // Último día del mes a las 23:59:59
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

/**
 * GET: Obtiene órdenes para un mes específico
 * Parámetro esperado: month=YYYY-MM (ej: 2025-03)
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
    const monthParam = searchParams.get('month'); // YYYY-MM
    const status = searchParams.get('status'); // opcional: filtrar por estado
    
    // Validar que se proporcione el mes
    if (!monthParam) {
      return NextResponse.json({ 
        error: 'Missing month parameter', 
        message: 'Please provide month in YYYY-MM format (e.g., 2025-03)' 
      }, { status: 400 });
    }

    // Obtener rango de fechas para el mes
    const dateRange = getMonthDateRange(monthParam);
    if (!dateRange) {
      return NextResponse.json({ 
        error: 'Invalid month format', 
        message: 'Month must be in YYYY-MM format (e.g., 2025-03)' 
      }, { status: 400 });
    }

    const { startDate, endDate } = dateRange;

    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    const getAllPages = searchParams.get('getAllPages') === 'true';

    // Crear cliente de Supabase
    const supabase = createServerSupabaseClient();
    
    // IDs de tiendas a consultar 
    const storeIds = ['1027217359', '205076801'];

    // Construir la consulta base
    let baseQuery = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .in('store_id', storeIds)
      .gte('date_created', startDate.toISOString())
      .lte('date_created', endDate.toISOString());

    // Filtrar por estado si se proporciona
    if (status) {
      baseQuery = baseQuery.eq('status', status);
    }

    // Primero, obtenemos el conteo total
    const { count, error: countError } = await baseQuery;

    if (countError) {
      console.error('Error counting orders:', countError);
      return NextResponse.json({ error: 'Error counting orders' }, { status: 500 });
    }

    // Calcular total de páginas
    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Si se solicitan todas las páginas y hay más de una
    if (getAllPages && totalPages > 1) {
      return await getAllPaginatedOrders(
        supabase, 
        baseQuery, 
        totalCount, 
        pageSize, 
        startDate, 
        endDate, 
        monthParam
      );
    }

    // Si solo se solicita una página específica
    const offset = (page - 1) * pageSize;
    const { data: orders, error: ordersError } = await baseQuery
      .order('date_created', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Error fetching orders from database' }, { status: 500 });
    }

    // Formatear órdenes
    const formattedOrders = formatOrders(orders || []);

    // Devolver las órdenes formateadas con información de paginación
    return NextResponse.json({
      success: true,
      month: monthParam,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      pagination: {
        page,
        pageSize,
        totalPages,
        totalCount,
        hasMore: page < totalPages
      },
      orders: formattedOrders,
      count: formattedOrders.length
    });
    
  } catch (error: any) {
    console.error('Error processing monthly orders request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Función auxiliar para obtener todas las páginas de órdenes en una sola respuesta
 */
async function getAllPaginatedOrders(
  supabase: any, 
  baseQuery: any, 
  totalCount: number, 
  pageSize: number,
  startDate: Date,
  endDate: Date,
  monthParam: string
) {
  const totalPages = Math.ceil(totalCount / pageSize);
  let allOrders: any[] = [];

  // Obtener todas las páginas en secuencia con logging mejorado
  for (let page = 1; page <= totalPages; page++) {
    const offset = (page - 1) * pageSize;
    
    // Log de progreso cada 10 páginas
    if (page % 10 === 0 || page === 1 || page === totalPages) {
      console.log(`Processing page ${page}/${totalPages} (${allOrders.length} orders so far)`);
    }
    
    const { data: pageOrders, error: ordersError } = await baseQuery
      .order('date_created', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (ordersError) {
      console.error(`Error fetching orders page ${page}:`, ordersError);
      continue;
    }

    if (pageOrders && pageOrders.length > 0) {
      allOrders = [...allOrders, ...pageOrders];
    }

    // Límite de seguridad aumentado para meses con muchas órdenes
    if (allOrders.length >= 50000) {
      console.warn(`Reached limit of 50000 orders, stopping pagination at page ${page} of ${totalPages}`);
      console.warn(`Total orders found: ${totalCount}, returned: ${allOrders.length}`);
      break;
    }
  }

  // Formatear todas las órdenes
  const formattedOrders = formatOrders(allOrders);

  return NextResponse.json({
    success: true,
    month: monthParam,
    date_range: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    pagination: {
      getAllPages: true,
      totalPages,
      totalCount,
      returnedCount: formattedOrders.length,
      isComplete: formattedOrders.length === totalCount
    },
    orders: formattedOrders,
    count: formattedOrders.length
  });
}

/**
 * Función auxiliar para formatear órdenes para la respuesta
 */
function formatOrders(orders: any[]) {
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
  return orders.map(order => {
    return {
      id: `${order.id}`,
      date_created: order.date_created,
      status: order.status,
      pack_id: order.pack_id,
      store_id: order.store_id,
      buyer_name: order.buyer_name,
      doc_number: order.doc_number,
      item_id: order.item_id,
      variation_id: order.variation_id,
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
      financing_fee: order.financing_fee,
      charge_uncategorized: order.charge_uncategorized,
      installments: order.installments,
      money_release_date: formatDate(order.money_release_date),
      charge_types: order.charge_types,
      created_at: formatDate(order.created_at),
      updated_at: formatDate(order.updated_at),
      // Al buffer date este hay que agregarle 12hs
      buffer_date: order.buffer_date
    };
  });
}