# Mercado Libre Manager

Una aplicación para gestionar productos de Mercado Libre, con autenticación OAuth y almacenamiento en Supabase.

## Características

- Autenticación con Mercado Libre usando OAuth
- Almacenamiento de datos en Supabase (PostgreSQL)
- Gestión de productos de Mercado Libre
- Interfaz moderna construida con Next.js y Tailwind CSS

## Requisitos previos

- Node.js 18.0 o superior
- Cuenta en [Supabase](https://supabase.com)
- Aplicación registrada en [Mercado Libre Developers](https://developers.mercadolibre.com.ar)

## Configuración

### 1. Configurar Supabase

1. Crea un nuevo proyecto en Supabase
2. Ve a SQL Editor y ejecuta los siguientes scripts para crear las tablas necesarias:

```sql
-- Tabla de Usuarios
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR NOT NULL UNIQUE,
  email VARCHAR,
  nickname VARCHAR,
  access_token VARCHAR NOT NULL,
  refresh_token VARCHAR NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX idx_users_user_id ON users(user_id);

-- Tabla de Items
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  site_id VARCHAR,
  title VARCHAR,
  seller_id VARCHAR,
  category_id VARCHAR,
  official_store_id VARCHAR,
  price DECIMAL,
  base_price DECIMAL,
  currency_id VARCHAR,
  available_quantity INTEGER,
  permalink VARCHAR,
  thumbnail VARCHAR,
  status VARCHAR,
  regular_amount DECIMAL,
  amount DECIMAL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Restricción de unicidad para item_id y user_id
  CONSTRAINT unique_item_per_user UNIQUE(item_id, user_id)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_items_item_id ON items(item_id);
CREATE INDEX idx_items_user_id ON items(user_id);
```

3. Obtén la URL de Supabase y las claves API (anon key y service role key) desde la sección Project Settings > API

### 2. Configurar Mercado Libre

1. Regístrate como desarrollador en [Mercado Libre Developers](https://developers.mercadolibre.com.ar)
2. Crea una nueva aplicación
3. Configura la URL de redirección a `http://localhost:3000/api/auth/callback` (para desarrollo) o tu dominio en producción
4. Obtén el App ID y Secret Key de tu aplicación

### 3. Configurar el proyecto

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Copia el archivo `.env.local.example` a `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
4. Edita el archivo `.env.local` y completa las variables con tus credenciales de Supabase y Mercado Libre

## Desarrollo

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) con tu navegador para ver el resultado.

## Despliegue en Vercel

La forma más sencilla de desplegar esta aplicación es utilizando [Vercel](https://vercel.com), la plataforma de los creadores de Next.js.

1. Sube tu código a un repositorio de GitHub
2. Importa el proyecto en Vercel
3. Configura las variables de entorno en Vercel
4. Despliega la aplicación

## Licencia

[MIT](LICENSE)