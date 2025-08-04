/**
 * Apps Script para cargar órdenes mensuales desde el API de MeLi Stats
 * Copiar este código en Google Apps Script (Extensiones > Apps Script)
 */

/**
 * Configuración global
 */
const API_CONFIG = {
  API_KEY: 'YOUR_API_KEY',
  API_URL: 'https://meli-stats.vercel.app/api/orders/monthly', // Cambiar a tu dominio
  PAGE_SIZE: 1000
};

/**
 * Menú personalizado en Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Órdenes Mensuales')
    .addItem('Cargar Mes Actual', 'fetchCurrentMonth')
    .addItem('Cargar Mes Anterior', 'fetchLastMonth')
    .addSeparator()
    .addItem('Cargar Mes Específico...', 'fetchSpecificMonth')
    .addSeparator()
    .addItem('Sincronizar Todos los Meses (2025)', 'syncAllMonths2025')
    .addToUi();
}

/**
 * Obtiene órdenes del mes actual
 */
function fetchCurrentMonth() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthName = getMonthNameInSpanish(yearMonth);
  fetchMonthlyOrders(yearMonth, monthName);
}

/**
 * Obtiene órdenes del mes anterior
 */
function fetchLastMonth() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthName = getMonthNameInSpanish(yearMonth);
  fetchMonthlyOrders(yearMonth, monthName);
}

/**
 * Permite al usuario ingresar un mes específico
 */
function fetchSpecificMonth() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Cargar Mes Específico',
    'Ingrese el mes en formato YYYY-MM (ej: 2025-03):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const yearMonth = response.getResponseText().trim();
    
    // Validar formato
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      ui.alert('Formato inválido. Use YYYY-MM (ej: 2025-03)');
      return;
    }
    
    const monthName = getMonthNameInSpanish(yearMonth);
    fetchMonthlyOrders(yearMonth, monthName);
  }
}

/**
 * Sincroniza todos los meses desde enero 2025 hasta el mes actual
 */
function syncAllMonths2025() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Sincronizar Todos los Meses',
    'Esto creará/actualizará una hoja por cada mes desde Enero 2025 hasta el mes actual. ¿Continuar?',
    ui.ButtonSet.YES_NO
  );
  
  if (result !== ui.Button.YES) return;
  
  const months = getMonthsToSync();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  ss.toast(`Sincronizando ${months.length} meses...`, 'Estado', 300);
  
  let successCount = 0;
  let errorCount = 0;
  
  months.forEach((yearMonth, index) => {
    try {
      ss.toast(`Procesando ${index + 1}/${months.length}: ${getMonthNameInSpanish(yearMonth)}...`, 'Estado', 60);
      const monthName = getMonthNameInSpanish(yearMonth);
      fetchMonthlyOrders(yearMonth, monthName, true); // true = modo silencioso
      successCount++;
      Utilities.sleep(1000); // Pausa de 1 segundo entre meses
    } catch (error) {
      console.error(`Error procesando ${yearMonth}:`, error);
      errorCount++;
    }
  });
  
  ss.toast(`Sincronización completada: ${successCount} exitosos, ${errorCount} con errores`, 'Finalizado', 10);
}

/**
 * Función principal para obtener órdenes de un mes específico
 */
function fetchMonthlyOrders(yearMonth, sheetName, silentMode = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Si no existe la hoja, crearla
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  // Limpiar hoja actual
  sheet.clear();
  
  if (!silentMode) {
    sheet.activate();
    ss.toast(`Cargando órdenes de ${sheetName}...`, 'Estado', 30);
  }
  
  try {
    // Configurar opciones de la solicitud HTTP
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    // Realizar solicitud con getAllPages=true para obtener todo de una vez
    const url = `${API_CONFIG.API_URL}?month=${yearMonth}&getAllPages=true`;
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Error en la API: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    
    if (!data.success) {
      throw new Error(data.error || 'Error desconocido en la respuesta');
    }
    
    // Si no hay órdenes, informar al usuario
    if (data.count === 0 || !data.orders || data.orders.length === 0) {
      sheet.getRange(1, 1).setValue(`No se encontraron órdenes para ${sheetName}`);
      if (!silentMode) {
        ss.toast(`No se encontraron órdenes para ${sheetName}`, 'Información', 5);
      }
      return;
    }
    
    // Crear encabezados
    const headers = [
      'ID',
      'Fecha de Creación',
      'Estado',
      'Pack ID',
      'ID Tienda',
      'Comprador',
      'DNI/CUIT',
      'ID Item',
      'ID Variante',
      'SKU',
      'Cantidad',
      'Título Item',
      'Precio Unitario',
      'Atributos de Variación',
      'ID Envío',
      'Modo de Envío',
      'Tipo Logístico',
      'Estado de Envío',
      'Monto Total Pagado',
      'Monto Transacción',
      'Monto Envío',
      'Monto Cupón',
      'Monto Neto Recibido',
      'Cargo Envío',
      'Cargo Cupón',
      'Cargo Tarifa Fija',
      'Cargo % MeLi',
      'Retención Deb/Cred',
      'Otros Impuestos',
      'Cargo Financiamiento Adicional',
      'Cargo Financiamiento',
      'Cargos Sin Categorizar',
      'Cuotas',
      'Fecha Liberación',
      'Tipos de Cargo',
      'Fecha Buffer'
    ];
    
    // Añadir encabezados
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground('#f3f3f3').setFontWeight('bold');
    
    // Procesar datos
    processOrdersData(sheet, data.orders, headers);
    
    if (!silentMode) {
      ss.toast(`Se cargaron ${data.orders.length} órdenes para ${sheetName}`, 'Éxito', 5);
    }
    
  } catch (error) {
    console.error('Error:', error);
    sheet.getRange(1, 1).setValue(`Error: ${error.message}`);
    sheet.getRange(1, 1).setFontColor('red');
    
    if (!silentMode) {
      SpreadsheetApp.getActiveSpreadsheet().toast(`Error: ${error.message}`, 'Error', 10);
    }
    throw error; // Re-lanzar para syncAllMonths
  }
}

/**
 * Procesa los datos de órdenes y los agrega a la hoja
 */
function processOrdersData(sheet, orders, headers) {
  // Preparar datos - igual que en el script original
  const rows = orders.map(order => [
    order.id ? `${order.id}` : '',
    order.date_created || '',
    order.status || '',
    order.pack_id ? `${order.pack_id}` : '',
    order.store_id ? `${order.store_id}` : '',
    order.buyer_name || '',
    order.doc_number || '',
    order.item_id ? `${order.item_id}` : '',
    order.variation_id ? `${order.variation_id}` : '',
    order.seller_sku ? `${order.seller_sku}` : '',
    parseInt(order.quantity) || 0,
    order.item_title || '',
    order.unit_price || 0,
    order.variation_attributes || '',
    `${order.shipping_id}` || '',
    order.shipping_mode || '',
    order.shipping_logistic_type || '',
    order.shipping_status || '',
    order.total_paid_amount || 0,
    order.transaction_amount || 0,
    order.shipping_amount || 0,
    order.coupon_amount || 0,
    order.net_received_amount || 0,
    order.charge_shipping || 0,
    order.charge_coupon || 0,
    order.charge_flat_fee || 0,
    order.charge_meli_percentage_fee || 0,
    order.charge_tax_withholding_debitos_creditos || 0,
    order.charge_other_taxes || 0,
    order.financing_add_on_fee || 0,
    order.financing_fee || 0,
    order.charge_uncategorized || 0,
    order.installments || 0,
    order.money_release_date || '',
    order.charge_types || '',
    order.buffer_date || ''
  ]);
  
  // Escribir datos en la hoja
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // Formatear columnas de números con decimales
  const numberColumns = [13, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
  for (let i = 0; i < numberColumns.length; i++) {
    if (rows.length > 0) {
      sheet.getRange(2, numberColumns[i], rows.length, 1).setNumberFormat('#,##0.00');
    }
  }
  
  // Formatear columnas de números enteros
  const numberIntColumns = [11, 33];
  for (let i = 0; i < numberIntColumns.length; i++) {
    if (rows.length > 0) {
      sheet.getRange(2, numberIntColumns[i], rows.length, 1).setNumberFormat('0');
    }
  }
  
  // Formatear columnas de fecha
  const dateColumns = [2, 34, 36];
  for (let i = 0; i < dateColumns.length; i++) {
    if (rows.length > 0) {
      sheet.getRange(2, dateColumns[i], rows.length, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    }
  }
  
  // Formatear IDs como texto para evitar notación científica
  const idColumns = [1, 4, 8, 9, 15];
  for (let i = 0; i < idColumns.length; i++) {
    if (rows.length > 0) {
      sheet.getRange(2, idColumns[i], rows.length, 1).setNumberFormat('@');
    }
  }
  
  // Congelar fila de encabezado
  sheet.setFrozenRows(1);
  
  // Ajustar automáticamente el ancho de las columnas
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Obtiene el nombre del mes en español
 */
function getMonthNameInSpanish(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

/**
 * Obtiene todos los meses desde enero 2025 hasta el mes actual
 */
function getMonthsToSync() {
  const months = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Empezar desde enero 2025
  const startYear = 2025;
  const startMonth = 1;
  
  for (let year = startYear; year <= currentYear; year++) {
    const monthStart = year === startYear ? startMonth : 1;
    const monthEnd = year === currentYear ? currentMonth : 12;
    
    for (let month = monthStart; month <= monthEnd; month++) {
      months.push(`${year}-${month.toString().padStart(2, '0')}`);
    }
  }
  
  return months;
}