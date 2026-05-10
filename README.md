# WhatsApp CRM Bot

Panel de administración con bot de WhatsApp que registra clientes automáticamente y gestiona ventas, contactos y analítica para pequeños negocios.

## El problema que resuelve

Registrar clientes manualmente es lento y propenso a errores. Este sistema captura automáticamente a cualquier persona que escriba al WhatsApp del negocio, la almacena en una base de datos y la pone disponible de inmediato en un panel web para crear facturas, consultar historial de compras y analizar tendencias de ventas, todo desde un solo lugar.

## Demo / Screenshot

> Escanea el QR desde el panel, vincula tu WhatsApp y el bot empieza a registrar contactos al instante.

```
http://localhost:3000   →   Panel de administración
http://localhost:3000/qr  →  Vinculación del bot vía QR o código de 6 dígitos
```

<img width="1512" height="982" alt="Captura de pantalla 2026-05-09 a la(s) 8 38 04 p m" src="https://github.com/user-attachments/assets/d2aa1561-5b10-47ab-b38f-c109892f67be" />
<img width="1512" height="982" alt="Captura de pantalla 2026-05-09 a la(s) 8 38 17 p m" src="https://github.com/user-attachments/assets/e926abf2-91dd-4161-a3bb-c815632aa39a" />


## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| Base de datos | MySQL 8+ |
| Bot WhatsApp | whatsapp-web.js + Puppeteer |
| Tiempo real | Socket.io 4 |
| Frontend | HTML/CSS/JS vanilla (SPA) |
| Contenedor | Docker (con Chromium embebido) |

## Cómo correrlo localmente

**Prerrequisitos:** Node.js 22+, MySQL 8+, una cuenta de WhatsApp

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
```

Edita `.env` con tus valores:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=chatbot_db

ALLOWED_NUMBERS=5491112345678   # Número del admin (con código de país)
APP_USER=admin
APP_PIN=1234
```

```bash
# 3. Crear la base de datos
mysql -u root -p < sql/schema.sql

# 4. Iniciar en modo desarrollo (hot reload)
npm run dev
```

Abre `http://localhost:3000`, inicia sesión con `APP_USER` / `APP_PIN` y escanea el QR desde **WhatsApp → Dispositivos vinculados → Vincular dispositivo**.

> Si el QR no funciona, usa el endpoint de pairing code: `POST /api/whatsapp/pairing-code` con tu número y escribe el código de 6 dígitos directamente en WhatsApp.

### Con Docker

```bash
docker build -t whatsapp-crm .
docker run -d \
  -e DB_HOST=host.docker.internal \
  -e DB_USER=root \
  -e DB_PASSWORD=tu_password \
  -e DB_NAME=chatbot_db \
  -e APP_PIN=1234 \
  -p 3000:3000 \
  whatsapp-crm
```

## Funcionalidades principales

- **Registro automático** — Cualquier mensaje entrante registra al contacto si es nuevo
- **Panel de contactos** — Búsqueda, edición y eliminación de usuarios
- **Facturas** — Creación de facturas con líneas de productos, totales y método de pago
- **Analítica avanzada** — Ingresos por período, top productos, top clientes, ranking, combos, clientes inactivos
- **Control del bot** — Conectar, desconectar, reiniciar y monitorear el estado en tiempo real
- **Ajustes** — Logo, nombre del negocio y configuración general por clave-valor

## Estructura del proyecto

```
src/
├── index.js                  Punto de entrada
├── config/                   BD, migraciones y canales
├── controllers/              Lógica de negocio (7 controladores)
├── models/                   Queries SQL puras
├── routes/                   API REST y rutas HTML
├── services/                 Ciclo de vida de WhatsApp y notificaciones
├── handlers/                 Procesamiento de mensajes entrantes
├── repositories/             Acceso a datos de usuarios
├── store/                    Adaptador de sesión WhatsApp para MySQL
└── web/public/               Frontend SPA (HTML + JS)
sql/
└── schema.sql                DDL — 8 tablas
```
