# Configuración de Vercel Cron Jobs

## Variable de Entorno Requerida

Agregar en Vercel Dashboard → Settings → Environment Variables:

```
CRON_SECRET=tu-secret-aleatorio-seguro-aqui
```

**Importante:** Genera un valor seguro y único, por ejemplo:
- Usando un generador de passwords
- O con este comando: `openssl rand -base64 32`
- Ejemplo: `KJ8xPmR5tN3QWz7uL9vFgA2eBcDhS4nY6iMjXaVp1wO=`

## Configuración del Cron en vercel.json

El archivo `vercel.json` ya está configurado con:

```json
{
  "crons": [
    {
      "path": "/api/cron/export-dimensions",
      "schedule": "0 */4 * * *"
    }
  ]
}
```

## Cómo Funciona

1. **Vercel Cron automático**: Vercel agrega automáticamente el header `Authorization: Bearer ${CRON_SECRET}` cuando ejecuta el cron
2. **Llamadas manuales**: Siguen funcionando con `Authorization: Bearer 140d1804-a2f2-48a7-b0e6-0284ca6df415`

## Verificación

Una vez configurado el `CRON_SECRET`:

1. El cron se ejecutará automáticamente cada 4 horas
2. Vercel Dashboard → Functions → Crons → Click en "Run Now" para probar
3. Ver logs en Functions → Logs

## Horarios de Ejecución

El cron está configurado para ejecutarse:
- 00:00
- 04:00
- 08:00
- 12:00
- 16:00
- 20:00

(Todos los horarios en UTC)