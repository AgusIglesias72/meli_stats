// src/lib/meliOrders.ts
import { createServerSupabaseClient } from '@/lib/supabase';

interface OrderNotification {
  topic: string;
  resource: string;
  user_id: string | number;
  application_id: number;
  sent: string;
  received: string;
}

/**
 * Convierte un ISO string (p.ej. "2025-05-11T22:07:27.000-04:00")
 * a un ISO string en hora de Buenos Aires, SIN offset.
 */
function convertToBuenosAiresLocal(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida:', dateString);
      return dateString;
    }
  
    // “en-CA” da formato YYYY-MM-DD HH:mm:ss.sss
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year:   'numeric',
      month:  '2-digit',
      day:    '2-digit',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      // para incluir .SSS
      fractionalSecondDigits: 3,
      hour12: false
    }).format(date);
  
    // -> "2025-05-11 23:07:27.000"
    // simplemente sustituimos el espacio por “T”
    return formatted.replace(' ', 'T');
  }
  
  // --- Ejemplo de uso ---
  console.log(
    convertToBuenosAiresLocal("2025-05-11T22:07:27.000-04:00")
  );
  // → "2025-05-11T23:07:27.000"
  

/**
 * Procesa una notificación de orden de Mercado Libre
 */
export async function processOrderNotification(notification: OrderNotification): Promise<boolean> {
  try {
    // Extraer el ID de la orden del resource (formato: '/orders/123456789')
    const orderIdMatch = notification.resource.match(/\/orders\/(\d+)/);
    
    if (!orderIdMatch) {
      console.error(`Formato de resource inválido para orders: ${notification.resource}`);
      return false;
    }

    const orderId = orderIdMatch[1];
    const userId = notification.user_id.toString();

    // Obtener token de acceso para el usuario
    const supabase = createServerSupabaseClient();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, access_token, token_expiry')
      .eq('ml_user_id', userId)
      .single();

    if (storeError || !store) {
      console.error(`No se encontró la tienda para el usuario ${userId}:`, storeError);
      return false;
    }

    // Verificar si el token ha expirado
    if (new Date(store.token_expiry) < new Date()) {
      console.error(`Token expirado para la tienda ${store.id}`);
      return false;
    }

    // Obtener los detalles completos de la orden
    const orderDetails = await fetchOrderDetails(orderId, userId, store.access_token);
    
    if (!orderDetails) {
      console.error(`No se pudo obtener información de la orden ${orderId}`);
      return false;
    }

    // Guardar o actualizar la orden en la base de datos
    await saveOrderToDatabase(orderDetails, userId, store.id);
    
    return true;
  } catch (error) {
    console.error('Error procesando notificación de orden:', error);
    return false;
  }
}

/**
 * Procesa una notificación de envío de Mercado Libre
 */
export async function processShipmentNotification(notification: OrderNotification): Promise<boolean> {
  try {
    // Extraer el ID del envío del resource (formato: '/shipments/123456789')
    const shipmentIdMatch = notification.resource.match(/\/shipments\/(\d+)/);
    
    if (!shipmentIdMatch) {
      console.error(`Formato de resource inválido para shipments: ${notification.resource}`);
      return false;
    }

    const shipmentId = shipmentIdMatch[1];
    const userId = notification.user_id.toString();

    // Obtener token de acceso para el usuario
    const supabase = createServerSupabaseClient();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, access_token, token_expiry')
      .eq('ml_user_id', userId)
      .single();

    if (storeError || !store) {
      console.error(`No se encontró la tienda para el usuario ${userId}:`, storeError);
      return false;
    }

    // Verificar si el token ha expirado
    if (new Date(store.token_expiry) < new Date()) {
      console.error(`Token expirado para la tienda ${store.id}`);
      return false;
    }

    // Obtener los detalles del envío
    const shipmentDetails = await fetchShipmentDetails(shipmentId, store.access_token);
    
    if (!shipmentDetails || !shipmentDetails.order_id) {
      console.error(`No se pudo obtener información del envío ${shipmentId} o no tiene order_id`);
      return false;
    }

    // Actualizar la información de envío para la orden correspondiente
    await updateOrderShippingInfo(shipmentDetails.order_id, shipmentDetails, store.id);
    
    return true;
  } catch (error) {
    console.error('Error procesando notificación de envío:', error);
    return false;
  }
}

/**
 * Procesa una notificación de pago de Mercado Libre
 */
export async function processPaymentNotification(notification: OrderNotification): Promise<boolean> {
  try {
    // Extraer el ID del pago del resource (formato: '/payments/123456789' o collection/123456789)
    const paymentIdMatch = notification.resource.match(/\/payments\/(\d+)|collection\/(\d+)/);
    
    if (!paymentIdMatch) {
      console.error(`Formato de resource inválido para payments: ${notification.resource}`);
      return false;
    }

    const paymentId = paymentIdMatch[1];
    const userId = notification.user_id.toString();

    // Obtener token de acceso para el usuario
    const supabase = createServerSupabaseClient();

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, access_token, token_expiry')
      .eq('ml_user_id', userId)
      .single();

    if (storeError || !store) {
      console.error(`No se encontró la tienda para el usuario ${userId}:`, storeError);
      return false;
    }

    // Verificar si el token ha expirado
    if (new Date(store.token_expiry) < new Date()) {
      console.error(`Token expirado para la tienda ${store.id}`);
      return false;
    }

    // Obtener los detalles del pago
    const paymentDetails = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${store.access_token}`
      }
    });

    if (!paymentDetails.ok) {
      console.error(`Error al obtener información del pago ${paymentId}: ${paymentDetails.status}`);
      return false;
    }

    const paymentData = await paymentDetails.json();

    // Con el pago, obtener el order.id para eliminar la orden y volver a crearla
    // Usemos processOrderNotification para eliminar y crear la orden
    const success = await processOrderNotification({
      ...notification,
      resource: `/orders/${paymentData.order.id}`
    });

    if (!success) {
      console.error(`Error al procesar la notificación de pago ${paymentId}:`, paymentData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error procesando notificación de pago:', error);
    return false;
  }
} 

/**
 * Obtiene los detalles completos de una orden
 */
async function fetchOrderDetails(orderId: string, userId: string, accessToken: string): Promise<any> {
  try {
    // 1. Obtener información principal de la orden
    const orderResponse = await fetch(`https://api.mercadolibre.com/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!orderResponse.ok) {
      console.error(`Error al obtener la orden ${orderId}: ${orderResponse.status}`);
      return null;
    }

    const orderData = await orderResponse.json();

    // Extraer los datos básicos de la orden
    const orderDetails: any = {
        id: orderData.id,
        date_created: convertToBuenosAiresLocal(orderData.date_created),
        status: orderData.status,
        pack_id: orderData.pack_id || null,
      //items_count: orderData.order_items ? orderData.order_items.length : 0
    };

    // Procesar el primer item si existe
    if (orderData.order_items && orderData.order_items.length > 0) {
      const firstItem = orderData.order_items[0];
      
      orderDetails.quantity = firstItem.quantity || 0;
      orderDetails.item_id = firstItem.item ? firstItem.item.id : null;
      orderDetails.seller_sku = firstItem.item ? firstItem.item.seller_sku : null;
      orderDetails.variation_id = firstItem.item ? firstItem.item.variation_id : null;
      orderDetails.item_title = firstItem.item ? firstItem.item.title : null;
      orderDetails.unit_price = firstItem.unit_price || 0;
      
      // Procesar variation_attributes
      if (firstItem.item && firstItem.item.variation_attributes && 
          Array.isArray(firstItem.item.variation_attributes)) {
        
        const attributesText = firstItem.item.variation_attributes
          .map((attr: any) => `${attr.name}: ${attr.value_name}`)
          .join(', ');
        
        orderDetails.variation_attributes = attributesText;
      } else {
        orderDetails.variation_attributes = '';
      }
    } else {
      // Valores por defecto si no hay items
      orderDetails.quantity = 0;
      orderDetails.item_id = null;
      orderDetails.seller_sku = null;
      orderDetails.variation_id = null;
      orderDetails.item_title = null;
      orderDetails.unit_price = 0;
      orderDetails.variation_attributes = '';
    }

    // 2. Obtener información de facturación (doc_number)
    try {
      const billingResponse = await fetch(`https://api.mercadolibre.com/orders/${orderId}/billing_info`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (billingResponse.ok) {
        const billingData = await billingResponse.json();
        orderDetails.doc_number = billingData.billing_info && billingData.billing_info.doc_number ? 
                                billingData.billing_info.doc_number : '';
      } else {
        console.error(`Error al obtener información de facturación para orden ${orderId}: ${billingResponse.status}`);
        orderDetails.doc_number = '';
      }
    } catch (billingError) {
      console.error(`Error procesando información de facturación para orden ${orderId}:`, billingError);
      orderDetails.doc_number = '';
    }

    // 3. Obtener información de envío
    if (orderData.shipping && orderData.shipping.id) {
      try {
        const shippingId = orderData.shipping.id;
        const shippingResponse = await fetch(`https://api.mercadolibre.com/shipments/${shippingId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (shippingResponse.ok) {
          const shippingData = await shippingResponse.json();
          orderDetails.shipping_id = shippingData.id;
          orderDetails.shipping_mode = shippingData.mode || '';
          orderDetails.shipping_logistic_type = shippingData.logistic_type || '';
          orderDetails.shipping_status = shippingData.status || '';
        } else {
          console.error(`Error al obtener información de envío para orden ${orderId}: ${shippingResponse.status}`);
          orderDetails.shipping_id = orderData.shipping.id;
          orderDetails.shipping_mode = '';
          orderDetails.shipping_logistic_type = '';
          orderDetails.shipping_status = '';
        }
      } catch (shippingError) {
        console.error(`Error procesando información de envío para orden ${orderId}:`, shippingError);
        orderDetails.shipping_id = orderData.shipping.id;
        orderDetails.shipping_mode = '';
        orderDetails.shipping_logistic_type = '';
        orderDetails.shipping_status = '';
      }
    } else {
      orderDetails.shipping_id = null;
      orderDetails.shipping_mode = '';
      orderDetails.shipping_logistic_type = '';
      orderDetails.shipping_status = '';
    }

    // 4. Procesar información de pagos (MercadoPago)
    if (orderData.payments && orderData.payments.length > 0) {
      // Inicializar variables para acumular datos de pagos
      orderDetails.total_paid_amount = 0;
      orderDetails.transaction_amount = 0;
      orderDetails.net_received_amount = 0;
      orderDetails.shipping_amount = 0;
      orderDetails.coupon_amount = 0;
      orderDetails.financing_add_on_fee = 0;
      orderDetails.installments = 0;
      orderDetails.money_release_date = null;
      orderDetails.charge_flat_fee = 0;
      orderDetails.charge_meli_percentage_fee = 0;
      orderDetails.charge_shipping = 0;
      orderDetails.charge_tax_withholding_debitos_creditos = 0;
      orderDetails.charge_other_taxes = 0;
      orderDetails.charge_coupon = 0;
      orderDetails.charge_uncategorized = 0;
      
      // Array para almacenar todos los tipos de cargos
      const chargeTypes: string[] = [];
      
      // Procesar cada pago aprobado o autorizado
      for (const payment of orderData.payments) {
        if (payment.status === 'approved' || payment.status === 'authorized') {
          try {
            const paymentId = payment.id;
            const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json();
              
              // Sumar montos relevantes
              if (paymentData.transaction_details && paymentData.transaction_details.total_paid_amount) {
                orderDetails.total_paid_amount += paymentData.transaction_details.total_paid_amount;
              }
              
              if (paymentData.transaction_amount) {
                orderDetails.transaction_amount += paymentData.transaction_amount;
              }
              
              if (paymentData.transaction_details && paymentData.transaction_details.net_received_amount) {
                orderDetails.net_received_amount += paymentData.transaction_details.net_received_amount;
              }
              
              if (paymentData.shipping_amount) {
                orderDetails.shipping_amount += paymentData.shipping_amount;
              }
              
              if (paymentData.coupon_amount) {
                orderDetails.coupon_amount += paymentData.coupon_amount;
              }
              
              if (paymentData.installments) {
                orderDetails.installments = paymentData.installments;
              }
              
              if (paymentData.money_release_date) {
                orderDetails.money_release_date = convertToBuenosAiresLocal(paymentData.money_release_date);
              }
              
              // Procesar los detalles de cargos
              if (paymentData.charges_details && Array.isArray(paymentData.charges_details)) {
                paymentData.charges_details.forEach((charge: any) => {
                  // Añadir el tipo del cargo al array
                  if (charge.type && !chargeTypes.includes(charge.type)) {
                    chargeTypes.push(charge.type);
                  }
                  
                  // Obtener el monto del cargo
                  const amount = charge.amounts && charge.amounts.original ? charge.amounts.original : 0;
                  
                  // Clasificar y sumar según el tipo y nombre del cargo
                  if (charge.name === 'flat_fee') {
                    orderDetails.charge_flat_fee += amount;
                  } else if (charge.name === 'meli_percentage_fee') {
                    orderDetails.charge_meli_percentage_fee += amount;
                  } else if (charge.name === 'financing_add_on_fee') {
                    orderDetails.financing_add_on_fee += amount;
                  } else if (charge.type === 'shipping') {
                    orderDetails.charge_shipping += amount;
                  } else if (charge.name === 'tax_withholding_collector-debitos_creditos') {
                    orderDetails.charge_tax_withholding_debitos_creditos += amount;
                  } else if (charge.type === 'tax') {
                    orderDetails.charge_other_taxes += amount;
                  } else if (charge.type === 'coupon') {
                    orderDetails.charge_coupon += amount;
                  } else {
                    orderDetails.charge_uncategorized += amount;
                  }
                });
              }
            } else {
              console.error(`Error al obtener información de pago ${paymentId} para orden ${orderId}: ${paymentResponse.status}`);
            }
          } catch (paymentError) {
            console.error(`Error procesando información de pago para orden ${orderId}:`, paymentError);
          }
        }
      }
      
      // Guardar string con los tipos de todos los cargos
      orderDetails.charge_types = chargeTypes.join(', ');
    } else {
      // Valores por defecto si no hay pagos
      orderDetails.total_paid_amount = 0;
      orderDetails.transaction_amount = 0;
      orderDetails.net_received_amount = 0;
      orderDetails.shipping_amount = 0;
      orderDetails.coupon_amount = 0;
      orderDetails.financing_add_on_fee = 0;
      orderDetails.installments = 0;
      orderDetails.money_release_date = '';
      orderDetails.charge_flat_fee = 0;
      orderDetails.charge_meli_percentage_fee = 0;
      orderDetails.charge_shipping = 0;
      orderDetails.charge_tax_withholding_debitos_creditos = 0;
      orderDetails.charge_other_taxes = 0;
      orderDetails.charge_coupon = 0;
      orderDetails.charge_uncategorized = 0;
      orderDetails.charge_types = '';
    }

    // Extraer información del comprador
    if (orderData.buyer) {
      const firstName = orderData.buyer.first_name || '';
      const lastName = orderData.buyer.last_name || '';
      orderDetails.buyer_name = `${firstName} ${lastName}`.trim();
    } else {
      orderDetails.buyer_name = '';
    }

    return orderDetails;
  } catch (error) {
    console.error(`Error obteniendo detalles de la orden ${orderId}:`, error);
    return null;
  }
}

/**
 * Obtiene los detalles de un envío
 */
async function fetchShipmentDetails(shipmentId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      console.error(`Error al obtener envío ${shipmentId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error obteniendo detalles del envío ${shipmentId}:`, error);
    return null;
  }
}

/**
 * Guarda o actualiza una orden en la base de datos
 */
async function saveOrderToDatabase(orderDetails: any, userId: string, storeId: string): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar si la orden ya existe
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderDetails.id)
      .single();


    const now = new Date().toISOString();

    // Preparar el objeto completo para inserción/actualización
    const orderData = {
      ...orderDetails,
      store_id: userId,
      updated_at: convertToBuenosAiresLocal(now)
    };

    if (existingOrder) {
      // Actualizar orden existente
      const { error: updateError } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', orderDetails.id);

      if (updateError) {
        console.error(`Error actualizando orden ${orderDetails.id}:`, updateError);
        return false;
      }
    } else {
      // Insertar nueva orden
      orderData.created_at = convertToBuenosAiresLocal(now); // Solo para nuevas órdenes
      
      const { error: insertError } = await supabase
        .from('orders')
        .insert(orderData);

      if (insertError) {
        console.error(`Error insertando orden ${orderDetails.id}:`, insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(`Error guardando orden ${orderDetails.id} en la base de datos:`, error);
    return false;
  }
}

/**
 * Actualiza la información de envío para una orden
 */
async function updateOrderShippingInfo(orderId: string | number, shipmentDetails: any, storeId: string): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    
    // Actualizar solo los campos relacionados con el envío
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_id: shipmentDetails.id,
        shipping_mode: shipmentDetails.mode || '',
        shipping_logistic_type: shipmentDetails.logistic_type || '',
        shipping_status: shipmentDetails.status || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error(`Error actualizando información de envío para orden ${orderId}:`, updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error actualizando información de envío para orden ${orderId}:`, error);
    return false;
  }
}