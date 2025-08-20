# Análisis de Costos de Envío - Casos de Estudio

## 📋 Objetivo
Documentar casos reales para entender correctamente cómo interpretar los costos de envío desde las APIs de MercadoLibre y corregir la lógica actual.

---

## 🔍 Caso 1: Envío con descuento del vendedor

### Datos básicos:
- **Order ID**: 2000012572223910
- **Shipping ID**: 45298367753
- **Producto**: Silla Gamer - $189,737.90
- **Total pagado por comprador**: $183,321.64 (con descuento de $6,416.26)

### Datos del endpoint `/shipments/{id}/costs`:

**Receiver (comprador):**
- `cost`: 0 ARS (envío gratis para el comprador)
- Descuentos aplicados: $31,705.99 total

**Senders (vendedor):**
- `cost`: 28,015.49 ARS
- `charges.charge_flex`: 0 ARS
- Descuento aplicado: -28,015.50 ARS (50% mandatory)

### 🚨 **INSIGHT CLAVE**:
**CORRECCIÓN NECESARIA**: En este caso, el vendedor NO recibe los $28,015.49 por el envío. Al contrario, **se los cobran de la venta** como cargo por envío.

El `senders[0].cost` representa lo que el vendedor debe PAGAR por el envío, no lo que recibe.

### Lógica actual (INCORRECTA):
```javascript
// En meliOrders.ts:337
orderDetails.shipping_amount = senderData.cost || 0; // ❌ Incorrecto
```
Esto está registrando +$28,015.49 como ingreso por envío, cuando debería ser -$28,015.49 como costo.

### Campos adicionales a consultar:
- `shipping_mode`: (pendiente - obtener del GET /shipments/{id})
- `shipping_logistic_type`: (pendiente)
- `shipping_status`: (pendiente)

---

## 🔍 Caso 2: Envío pagado por el comprador

### Datos básicos:
- **Order ID**: 2000012571603712
- **Shipping ID**: 45298104263
- **Producto**: Set De Baño Kit 5 Piezas - $26,997.90
- **Total pagado por comprador**: $32,550.92
- **Shipping cost en payment**: $6,465.99

### Datos del endpoint `/shipments/{id}/costs`:

**Receiver (comprador):**
- `cost`: 6,465.99 ARS (el comprador SÍ paga envío)
- `cost_details[0].amount`: 6,465.99 ARS (monto que va al vendedor 1027217359)
- Descuento aplicado: -2,229 ARS (26% loyal discount)
- Costo bruto original: 8,694.99 ARS

**Senders (vendedor):**
- `cost`: 0 ARS
- `charges.charge_flex`: 0 ARS
- Sin descuentos aplicados

### 📊 **Cómo se registraría con la lógica actual**:

```javascript
// Con la lógica actual en meliOrders.ts:337
orderDetails.shipping_amount = senderData.cost || 0; // = 0 ARS
```

**Resultado actual**: `shipping_amount = 0 ARS` ❌

### 🎯 **Análisis CORRECTO**:
En este caso, el comprador paga $6,465.99 por envío y según `cost_details`, ese monto va directamente al vendedor (sender_id: 1027217359). 

**El vendedor SÍ RECIBE los $6,465.99** como ingreso por envío, aunque luego se le cobre como cargo por envío en otra parte del proceso.

### ✅ **Cómo debería registrarse**:
`shipping_amount = +6,465.99 ARS` (ingreso positivo para el vendedor)

### 🚨 **INSIGHT CLAVE - Caso 2**:
**CORRECCIÓN NECESARIA**: Hay que usar `receiver.cost_details[0].amount` cuando el vendedor corresponde al `sender_id`, NO solo `senders[0].cost`.

La lógica correcta sería:
```javascript
// Si receiver.cost_details existe y sender_id coincide con el vendedor
if (costsData.receiver.cost_details && costsData.receiver.cost_details[0].sender_id === vendedorId) {
  shipping_amount = +costsData.receiver.cost_details[0].amount; // Ingreso positivo
} else {
  shipping_amount = -senders[0].cost; // Costo negativo si el vendedor paga
}
```

---

## 🔍 Caso 3: Envío gratis para comprador, costo para vendedor (pack_order)

### Datos básicos:
- **Order ID**: 2000012567671914
- **Shipping ID**: 45296387991
- **Pack ID**: 2000008760838937 (orden agrupada)
- **Producto**: Escalera Plegable - $70,000.00
- **Total pagado por comprador**: $70,000.00
- **Shipping cost en payment**: $0.00 (envío gratis para comprador)
- **Tags especiales**: `pack_order`, `3x_campaign`, `d2c`

### Datos del endpoint `/shipments/{id}/costs`:

**Receiver (comprador):**
- `cost`: 0 ARS (envío gratis para el comprador)
- `cost_details`: [] (vacío - no paga nada)
- Descuentos aplicados: -19,274.51 + 61,301.50 = +42,027 ARS neto
- Costo bruto original: 164,629.98 ARS

**Senders (vendedor - ID: 205076801):**
- `cost`: 61,301.49 ARS (el vendedor PAGA este monto por envío)
- `charges.charge_flex`: 0 ARS
- Descuento aplicado: -61,301.50 ARS (50% mandatory)
- Save: 61,301.50 ARS

### 📊 **Cómo se registraría con la lógica actual**:

```javascript
// Con la lógica actual en meliOrders.ts:337
orderDetails.shipping_amount = senderData.cost || 0; // = 61,301.49 ARS
```

**Resultado actual**: `shipping_amount = +61,301.49 ARS` ❌

### ✅ **Cómo debería registrarse**:
`shipping_amount = -61,301.49 ARS` (costo que paga el vendedor)

### 🎯 **Análisis CORRECTO - Caso 3**:
- **Comprador paga**: $0 por envío (`shipping_cost: 0.00`)
- **Vendedor paga**: $61,301.49 por envío (`senders[0].cost`)
- **Bonificaciones**: Se manejan por separado (descuentos/promociones)
- **Registro**: Solo el costo bruto que paga el vendedor

### 🚨 **INSIGHT CLAVE - Caso 3**:
**CORRECCIÓN**: La lógica actual registra +61,301.49 cuando debería ser **-61,301.49**.

`senders[0].cost` representa lo que **paga el vendedor** por envío, por lo tanto debería ser negativo (costo), no positivo (ingreso).

## 📝 Próximos casos a analizar:
- [ ] Caso 4: Envío self_service vs fulfillment
- [ ] Caso 5: Envío con charges adicionales

---

## ✅ **IMPLEMENTACIÓN ACTUALIZADA - VERSIÓN FINAL**

### 🎯 **ACLARACIÓN IMPORTANTE:**
- **`shipping_amount`**: Lo que PAGA EL CLIENTE por el envío (ingreso para el vendedor)
- **`charge_shipping`**: Lo que PAGA EL VENDEDOR a MercadoLibre (cargos/comisiones)

## 🔧 **IMPLEMENTACIÓN REALIZADA**

### 📍 **Archivo modificado**: `src/lib/meliOrders.ts`
### 🎯 **Función**: `fetchOrderDetails()` - línea 338
### 📅 **Estado**: ✅ IMPLEMENTADO

---

### 💻 **Código implementado:**

**✅ CÓDIGO FINAL (línea 338):**
```javascript
// shipping_amount = lo que PAGA EL CLIENTE por el envío
// Buscar en receiver.cost para ver cuánto pagó el cliente
orderDetails.shipping_amount = costsData.receiver?.cost || 0;

// Si el vendedor paga costos de envío, se manejan en charge_shipping más abajo
```

---

### 📊 **Casos validados con la lógica FINAL:**

| **Caso** | **Cliente paga** | **shipping_amount** | **charge_shipping** | **Descripción** |
|----------|-----------------|---------------------|---------------------|-----------------|
| **Caso 1** | $0 | **0** | (vía payments) | Envío gratis para cliente |
| **Caso 2** | $6,465.99 | **6,465.99** | (vía payments) | Cliente paga envío |
| **Caso 3** | $0 | **0** | (vía payments) | Envío gratis (bonificado) |

---

### ⚠️ **Pendientes de verificar antes de implementar:**

1. **Campo seller_id**: ¿Es `orderData.seller.id` o está en otro lugar?
2. **Testing**: Probar con los 3 casos documentados
3. **Edge cases**: Verificar órdenes con múltiples senders/receivers

---

### 🔄 **Separación de responsabilidades confirmada:**
- **`shipping_amount`** (endpoint `/costs`): Flujo bruto de dinero por envío
- **`charge_shipping`** (endpoint `/payments`): Retenciones/cargos (YA FUNCIONA BIEN)

---

### 📝 **Próximos pasos cuando se retome:**
1. [ ] Verificar estructura exacta del `seller_id` en orderData
2. [ ] Implementar la lógica corregida
3. [ ] Probar con los 3 casos documentados
4. [ ] Validar que no se rompan otros flujos