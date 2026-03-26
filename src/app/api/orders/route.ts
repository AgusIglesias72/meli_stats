// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, and, inArray, gte, lte, desc, count as drizzleCount } from 'drizzle-orm';

export const maxDuration = 10; // Máximo 59 segundos para procesar grandes cantidades de datos

/**
 * Función auxiliar para crear objetos de fecha según el parámetro de consulta
 */
function getDateRange(dateParam: string | null): { startDate: Date, endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (dateParam) {
    case 'last_date':
      // Último día (ayer)
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'last_week':
      // Encontrar el lunes de esta semana
      const today = now.getDay(); // 0 = domingo, 1 = lunes, etc.
      const daysFromMonday = today === 0 ? 6 : today - 1; // Si es domingo (0), retroceder 6 días

      // Ir al lunes de esta semana
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - daysFromMonday);
      thisMonday.setHours(0, 0, 0, 0);

      // El lunes de la semana pasada es 7 días antes del lunes de esta semana
      startDate = new Date(thisMonday);
      startDate.setDate(thisMonday.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);

      // El domingo de la semana pasada es 6 días después del lunes de la semana pasada
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'last_month':
      // Mes pasado completo
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);

      // Último día del mes pasado
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'month_to_date':
      // Desde el inicio del mes hasta hoy
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'last_30_days':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    default:
      // Por defecto, últimos 30 días
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
  }

  console.log('startDate', startDate);
  console.log('endDate', endDate);
  return { startDate, endDate };
}

/**
 * Construye las condiciones WHERE para la consulta de órdenes
 */
function buildWhereConditions(storeIds: string[], startDate: Date, endDate: Date, status: string | null) {
  const conditions = [
    inArray(orders.store_id, storeIds),
    gte(orders.date_created, startDate.toISOString()),
    lte(orders.date_created, endDate.toISOString()),
  ];

  if (status) {
    conditions.push(eq(orders.status, status));
  }

  return and(...conditions);
}

/**
 * GET: Obtiene órdenes para una tienda específica en un rango de fechas
 * Ahora con soporte para paginación para manejar grandes conjuntos de resultados
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

    // Parámetros de paginación
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    const getAllPages = searchParams.get('getAllPages') === 'true';

    // Obtener el rango de fechas según el parámetro
    const { startDate, endDate } = getDateRange(dateParam);

    // IDs de tiendas a consultar
    const storeIds = ['1027217359', '205076801'];

    // Construir condiciones WHERE
    const whereConditions = buildWhereConditions(storeIds, startDate, endDate, status);

    // Obtener el conteo total
    const [countResult] = await db.select({ value: drizzleCount() }).from(orders).where(whereConditions);
    const totalCount = countResult?.value || 0;

    // Calcular total de páginas
    const totalPages = Math.ceil(totalCount / pageSize);

    // Si se solicitan todas las páginas y hay más de una
    if (getAllPages && totalPages > 1) {
      return await getAllPaginatedOrders(
        whereConditions,
        totalCount,
        pageSize,
        startDate,
        endDate,
        dateParam
      );
    }

    // Si solo se solicita una página específica, aplicamos limit y offset
    const offset = (page - 1) * pageSize;
    const ordersData = await db.select().from(orders)
      .where(whereConditions)
      .orderBy(desc(orders.date_created))
      .limit(pageSize)
      .offset(offset);

    // Formatear órdenes
    const formattedOrders = formatOrders(ordersData || []);

    // Devolver las órdenes formateadas con información de paginación
    return NextResponse.json({
      success: true,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        parameter: dateParam || 'default'
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
    console.error('Error processing orders request:', error);
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
  whereConditions: any,
  totalCount: number,
  pageSize: number,
  startDate: Date,
  endDate: Date,
  dateParam: string | null
) {
  const totalPages = Math.ceil(totalCount / pageSize);
  let allOrders: any[] = [];

  // Obtener todas las páginas en secuencia
  for (let page = 1; page <= totalPages; page++) {
    const offset = (page - 1) * pageSize;
    try {
      const pageOrders = await db.select().from(orders)
        .where(whereConditions)
        .orderBy(desc(orders.date_created))
        .limit(pageSize)
        .offset(offset);

      if (pageOrders && pageOrders.length > 0) {
        allOrders = [...allOrders, ...pageOrders];
      }
    } catch (error) {
      console.error(`Error fetching orders page ${page}:`, error);
      continue; // Continuar con la siguiente página incluso si hay error
    }

  }

  // Formatear todas las órdenes
  const formattedOrders = formatOrders(allOrders);

  return NextResponse.json({
    success: true,
    date_range: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      parameter: dateParam || 'default'
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
