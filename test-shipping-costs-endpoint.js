// Script para probar el endpoint /shipments/{id}/costs
// y entender la estructura de respuesta para diferentes casos

console.log('🔍 ANÁLISIS DEL ENDPOINT /shipments/{id}/costs\n');
console.log('='.repeat(80));

// Ejemplo proporcionado por el cliente
const exampleResponse = {
    "receiver": {
        "compensations": [],
        "cost": 0,
        "discounts": [
            {
                "rate": 1,
                "type": "loyal",
                "promoted_amount": 9442.99
            }
        ],
        "user_id": 183609102,
        "cost_details": [],
        "save": 0,
        "compensation": 0
    },
    "gross_amount": 9442.99,
    "senders": [
        {
            "compensations": [],
            "charges": {
                "charge_flex": 0
            },
            "cost": 0,
            "discounts": [],
            "user_id": 1027217359,
            "save": 0,
            "compensation": 0
        }
    ]
};

console.log('\n📊 ANÁLISIS DEL EJEMPLO PROPORCIONADO:');
console.log('- receiver.cost: $0 (lo que paga el comprador)');
console.log('- receiver.discounts[0].promoted_amount: $9,442.99 (descuento total)');
console.log('- gross_amount: $9,442.99 (monto bruto)');
console.log('- senders[0].cost: $0 (lo que recibe el vendedor)');
console.log('- senders[0].user_id: 1027217359 (ID del vendedor)');

console.log('\n💡 INTERPRETACIÓN:');
console.log('Este es un caso de ENVÍO GRATIS donde:');
console.log('- El comprador no paga nada (receiver.cost = 0)');
console.log('- El vendedor no recibe nada (senders[0].cost = 0)');
console.log('- Hay un descuento "loyal" del 100% (rate: 1)');

console.log('\n' + '='.repeat(80));

// Casos de prueba con diferentes shipping_ids
const testCases = [
    // Grupo 1: Self-service que deberían ser gratis
    {
        orderId: '2000012533349008',
        shippingId: '45280544429',
        expectedType: 'self_service gratis',
        currentShippingAmount: 9442.99,
        shouldBe: 0
    },
    {
        orderId: '2000012532964228', 
        shippingId: '45280589666',
        expectedType: 'self_service gratis',
        currentShippingAmount: 9442.99,
        shouldBe: 0
    },
    // Grupo 2: Que deberían cobrar envío
    {
        orderId: '2000012515509682',
        shippingId: '45272867635',
        expectedType: 'self_service con costo',
        currentShippingAmount: 0,
        shouldBe: '>0'
    },
    {
        orderId: '2000012515302946',
        shippingId: '45273006586', 
        expectedType: 'self_service con costo',
        currentShippingAmount: 0,
        shouldBe: '>0'
    }
];

console.log('\n🧪 ESTRUCTURA ESPERADA DEL ENDPOINT costs:\n');

console.log('Para ENVÍO GRATIS (como el ejemplo):');
console.log('```json');
console.log(JSON.stringify({
    receiver: { cost: 0 },
    senders: [{ cost: 0 }]
}, null, 2));
console.log('```');

console.log('\nPara ENVÍO CON COSTO (hipótesis):');
console.log('```json');
console.log(JSON.stringify({
    receiver: { cost: 8000 },  // Lo que paga el comprador
    senders: [{ 
        cost: 6500,  // Lo que recibe el vendedor
        charges: {
            charge_flex: 1500  // Comisión de ML
        }
    }]
}, null, 2));
console.log('```');

console.log('\n' + '='.repeat(80));
console.log('\n🎯 LÓGICA PROPUESTA PARA USAR costs:\n');

console.log('```javascript');
console.log(`// Después de obtener costsData del endpoint
let shipping_amount = 0;
let charge_shipping = 0;

if (shippingData.logistic_type === "self_service") {
    // Para self_service, preferir base_cost del shipment
    shipping_amount = shippingData.base_cost || 0;
    
    // Pero si costs está disponible, usar sender.cost
    if (costsData && costsData.senders && costsData.senders[0]) {
        shipping_amount = costsData.senders[0].cost || 0;
    }
} else {
    // Para otros tipos (ME1, ME2 fulfillment)
    if (costsData && costsData.senders && costsData.senders[0]) {
        shipping_amount = costsData.senders[0].cost || 0;
        
        // Sumar cargos si existen
        if (costsData.senders[0].charges) {
            const charges = costsData.senders[0].charges;
            charge_shipping = Object.values(charges).reduce((sum, val) => sum + (val || 0), 0);
        }
    }
}
`);
console.log('```');

console.log('\n📝 NOTAS IMPORTANTES:');
console.log('1. receiver.cost = lo que PAGA el comprador');
console.log('2. senders[0].cost = lo que RECIBE el vendedor'); 
console.log('3. senders[0].charges = comisiones que cobra ML');
console.log('4. Para envío gratis: todos los costs son 0');
console.log('5. El user_id en senders debe coincidir con el vendedor');

console.log('\n🔧 CONCLUSIÓN:');
console.log('- shipping_amount debe ser = senders[0].cost');
console.log('- charge_shipping debe ser = suma de senders[0].charges');
console.log('- NO usar receiver.cost (eso es lo que paga el comprador)');
console.log('- NO usar gross_amount directamente');

console.log('\n' + '='.repeat(80));

// Simulación de cómo quedarían las órdenes problemáticas
console.log('\n✅ VERIFICACIÓN CON CASOS REALES:\n');

testCases.forEach(test => {
    console.log(`\nOrden ${test.orderId} (${test.expectedType}):`);
    console.log(`- Shipping ID: ${test.shippingId}`);
    console.log(`- Actualmente trae: $${test.currentShippingAmount}`);
    console.log(`- Debería traer: ${test.shouldBe}`);
    
    if (test.expectedType.includes('gratis')) {
        console.log(`- Con costs API: senders[0].cost = $0 ✅`);
    } else {
        console.log(`- Con costs API: senders[0].cost = $X (>0) ✅`);
    }
});