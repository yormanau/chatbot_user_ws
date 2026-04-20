# Documentación Técnica — Bot WhatsApp

## 1. Descripción general

Sistema en **Node.js** compuesto por dos partes integradas:

1. **Bot de WhatsApp** — registra automáticamente a cualquier persona que envíe un mensaje al número configurado.
2. **Panel web de administración** — permite gestionar usuarios, crear facturas, consultar productos y visualizar analítica de ventas.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js |
| Framework HTTP | Express 5 |
| Base de datos | MySQL 8 (driver `mysql2/promise`) |
| Bot WhatsApp | `whatsapp-web.js` (Puppeteer) |
| Tiempo real | Socket.io 4 |
| Generación QR | `qrcode` + `qrcode-terminal` |
| Autenticación | Cookie httpOnly (`cookie-parser`) |
| Variables de entorno | `dotenv` |
| Contenedor | Docker |

---

## 3. Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Conexión MySQL |
| `ALLOWED_NUMBERS` | Números autorizados para conectar el bot (separados por coma) |
| `APP_USER` | Usuario del panel web |
| `APP_PIN` | PIN del panel web (también valor de la cookie de sesión) |
| `PORT` | Puerto del servidor (por defecto `3000`) |
| `NODE_ENV` | `production` activa `RemoteAuth` con MySQL; en otro caso usa `LocalAuth` |
| `RAILWAY_ENVIRONMENT` | Presente en Railway, fuerza modo producción |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta al ejecutable de Chrome en producción |

---

## 4. Arquitectura MVC

```
src/
├── index.js                    Punto de entrada
├── config/
│   ├── database.js             Pool de conexiones MySQL
│   └── migrate.js              Ejecuta schema.sql al iniciar
├── routes/
│   ├── api.js                  Definición de rutas REST
│   └── web.js                  Rutas HTML + QR
├── middleware/
│   └── auth.js                 requireAuth + helper toStr
├── controllers/
│   ├── authController.js       Login, check, logout
│   ├── statusController.js     Estado del bot
│   ├── whatsappController.js   Conectar/desconectar/reiniciar
│   ├── userController.js       CRUD de usuarios
│   ├── productController.js    Listado y búsqueda de productos
│   ├── invoiceController.js    CRUD de facturas
│   └── analyticsController.js  Analítica básica y avanzada
├── models/
│   ├── userModel.js            Queries SQL de usuarios
│   ├── productModel.js         Queries SQL de productos
│   ├── invoiceModel.js         Queries SQL de facturas
│   ├── analyticsModel.js       Queries SQL de analítica
│   └── settingsModel.js        Lectura/escritura de app_settings
├── services/
│   ├── whatsappServices.js     Ciclo de vida del cliente WhatsApp
│   └── notificationService.js  Envío de mensaje de confirmación al bot
├── handlers/
│   └── messageHandler.js       Procesa mensajes entrantes de WhatsApp
├── repositories/
│   └── userRepository.js       existsByPhone + registerUser (usados por el handler)
├── store/
│   └── MySQLStore.js           Adaptador de sesión WhatsApp para MySQL
└── utils/
    ├── dateHelpers.js           Conversión DD/MM/YYYY ↔ YYYY-MM-DD
    └── normalizeNames.js        Title Case con excepciones en español
```

### Flujo de responsabilidades por capa

```
Route → Controller → Model → Base de datos
         (valida,     (SQL puro,
          formatea,    retorna datos
          responde)    crudos)
```

---

## 5. Base de datos

### `users`
Usuarios registrados, ya sea por el bot o manualmente desde el panel.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT UNSIGNED PK | Identificador |
| `phone` | VARCHAR(20) UNIQUE | Número de teléfono |
| `name` | VARCHAR(100) | Nombre del contacto |
| `create_at` | DATETIME | Fecha de registro |
| `email` | VARCHAR(255) | Opcional |
| `ciudad` | VARCHAR(100) | Opcional |
| `birth_date` | DATE | Opcional |
| `gender` | VARCHAR(50) | `M` / `F` / valor libre |

### `products`
Catálogo de productos. Se puebla automáticamente la primera vez que aparece un nombre de producto en una factura.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `name` | VARCHAR(200) UNIQUE | |
| `created_at` | DATETIME | |

### `invoices`
Encabezado de cada compra.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `user_id` | INT UNSIGNED FK | Referencia a `users` (CASCADE DELETE) |
| `total` | DECIMAL(12,2) | Suma de ítems |
| `created_at` | DATETIME | |

### `invoice_items`
Líneas de producto por factura.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `invoice_id` | INT UNSIGNED FK | Referencia a `invoices` (CASCADE DELETE) |
| `product_id` | INT UNSIGNED FK | Referencia a `products` (SET NULL si se elimina) |
| `product_name` | VARCHAR(200) | Nombre en el momento de la venta |
| `price` | DECIMAL(12,2) | |
| `quantity` | SMALLINT UNSIGNED | |

### `whatsapp_sessions`
Sesión de WhatsApp serializada en `LONGBLOB` (ZIP binario). Solo se usa en producción con `RemoteAuth`.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | INT PK | |
| `session_id` | VARCHAR(255) UNIQUE | Identificador de la sesión |
| `session_data` | LONGBLOB | ZIP binario de la sesión |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

### `app_settings`
Tabla key-value para configuración persistente. Actualmente almacena `analytics_cfg` (JSON con configuración de tiers de clientes).

| Columna | Tipo |
|---|---|
| `key` | VARCHAR(100) PK |
| `value` | TEXT |
| `updated_at` | DATETIME (auto-update) |

---

## 6. Arranque del servidor (`index.js`)

1. Carga `.env`.
2. Ejecuta `runMigrations()` — aplica `sql/schema.sql` (idempotente con `IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS`).
3. Llama a `checkExistingSession()`:
   - **Local** — verifica que exista la carpeta `.wwebjs_auth/`.
   - **Producción** — consulta la tabla `whatsapp_sessions`.
   - Si hay sesión guardada, inicia el bot automáticamente sin esperar acción del usuario.
4. Levanta el servidor HTTP en el puerto configurado.
5. Maneja `SIGINT` / `SIGTERM` destruyendo el cliente WhatsApp antes de salir.

---

## 7. Ciclo de vida del bot WhatsApp (`whatsappServices.js`)

```
initWhatsApp(io)
      │
      ▼
  new Client()
  LocalAuth (dev) / RemoteAuth → MySQLStore (prod)
      │
   eventos
      ├── qr               → genera data URL del QR, disponible en /api/status
      ├── authenticated     → limpia QR de memoria
      ├── ready             → valida ALLOWED_NUMBERS
      │                        autorizado  → isConnected = true, emite 'whatsapp-ready'
      │                        no autorizado → logout, emite 'whatsapp-unauthorized'
      ├── disconnected      → desconexión involuntaria → reintenta en 5 s
      │                        desconexión manual      → no reintenta
      │                        número no autorizado    → no reintenta
      ├── message           → handleIncomingMessage(...)
      └── remote_session_saved → confirma guardado en MySQL
```

| Función | Descripción |
|---|---|
| `initWhatsApp(io)` | Crea e inicializa el cliente. Ignora llamadas duplicadas si ya hay instancia. |
| `stopWhatsApp()` | Logout + destroy + limpia archivos/MySQL de sesión + emite `whatsapp-stopped`. |
| `restartWhatsApp()` | Destroy sin logout + limpia sesión + vuelve a llamar `initWhatsApp`. |
| `checkExistingSession()` | Retorna `true` si hay sesión guardada (local o MySQL). |

---

## 8. Flujo de registro automático

```
Usuario envía un mensaje de WhatsApp
              │
              ▼
  messageHandler.handleIncomingMessage()
        │
        ├── Descarta mensajes de grupos (@g.us)
        ├── Descarta mensajes propios (fromMe)
        ├── Descarta mensajes con más de 30 segundos de antigüedad
        │
        ├── Obtiene teléfono y nombre del contacto
        │
        ├── existsByPhone() ──── ya existe ──→ ignora
        │
        └── registerUser()
              ├── Inserta en tabla users
              ├── notifyBot() → envía mensaje de confirmación al número del bot
              └── io.emit('user-registered') → actualiza el panel web en tiempo real
```

---

## 9. Autenticación del panel web

- **`POST /api/auth/login`** — compara `user` y `pin` con `APP_USER` / `APP_PIN`. Si son válidos, setea la cookie httpOnly `auth = APP_PIN` con vigencia de 7 días.
- **`GET /api/auth/check`** — responde `{ authenticated: true/false }`.
- **`POST /api/auth/logout`** — limpia la cookie.
- **Middleware `requireAuth`** — verifica `req.cookies.auth === APP_PIN`. En rutas API devuelve `401`; en rutas web redirige a `/login`.

---

## 10. API REST (`/api`)

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/login` | No | Inicia sesión |
| GET | `/auth/check` | No | Verifica sesión activa |
| POST | `/auth/logout` | No | Cierra sesión |

### Estado

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/status` | No | Estado del bot, QR data URL y segundos restantes del QR (TTL: 60 s) |

### WhatsApp

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/whatsapp/connect` | Sí | Inicia cliente WhatsApp |
| POST | `/whatsapp/disconnect` | Sí | Cierra sesión y limpia archivos |
| POST | `/whatsapp/restart` | No | Reinicia desde cero |

### Usuarios

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/users/search?q=` | Sí | Búsqueda por nombre o teléfono (máx. 10) |
| POST | `/users/register` | Sí | Registro manual con campos opcionales |
| GET | `/users/:id` | Sí | Detalle completo del usuario |
| PUT | `/users/:id` | Sí | Actualizar nombre |
| POST | `/users/:id/info` | Sí | Actualizar un campo opcional (`email`, `ciudad`, `birth_date`, `gender`) |
| DELETE | `/users/:id` | Sí | Eliminar usuario |
| GET | `/users/:id/invoices` | Sí | Facturas del usuario con sus ítems |

### Productos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/products/list` | Sí | Lista paginada con estadísticas de ventas (veces vendido, precio promedio, ingresos) |
| GET | `/products/search?q=` | Sí | Autocomplete por nombre (máx. 8) |

### Facturas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/invoices` | Sí | Lista paginada con búsqueda y ordenamiento |
| GET | `/invoices/:id` | Sí | Detalle con ítems |
| POST | `/invoices` | Sí | Crear factura (transacción: inserta factura + ítems + upsert de productos) |

### Analítica básica

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/analytics/invoices?filter=` | Sí | Conteo y monto total de facturas (`all`, `today`, `week`, `month`) |
| GET | `/analytics/users?filter=` | Sí | Conteo de usuarios por período |
| GET | `/analytics/users/list` | Sí | Tabla de usuarios con filtro, búsqueda, ordenamiento y paginación |

### Analítica avanzada (`/analytics/adv/`)

| Ruta | Auth | Descripción |
|---|---|---|
| `revenue?from=&to=` | Sí | Ingresos, ticket promedio, proyección y comparación con período anterior equivalente |
| `trend?from=&to=&group=` | Sí | Tendencia de ventas agrupada por `day`, `week` o `month` |
| `by-weekday` | Sí | Ventas agrupadas por día de la semana |
| `by-hour` | Sí | Ventas agrupadas por hora del día |
| `top-products?from=&to=` | Sí | Top 5 por unidades y por ingresos, estrella del mes, productos inactivos (≥ 30 días sin venta) |
| `top-clients?from=&to=` | Sí | Top 5 clientes por frecuencia de compra y por gasto total |
| `client-ranking?days=` | Sí | Ranking completo de clientes ordenado por gasto |
| `combos` | Sí | Pares de productos comprados juntos con más frecuencia (top 10) |
| `inactive-clients?days=` | Sí | Clientes sin compras en los últimos N días |
| `config` (GET) | Sí | Obtener configuración de tiers de clientes |
| `config` (PUT) | Sí | Guardar configuración de tiers de clientes |

---

## 11. Eventos Socket.io (tiempo real)

| Evento | Emitido desde | Descripción |
|---|---|---|
| `user-registered` | `messageHandler`, `userController` | Nuevo usuario registrado (bot o manual) |
| `invoice-created` | `invoiceController` | Nueva factura creada |
| `whatsapp-ready` | `whatsappServices` | Bot conectado y listo para recibir mensajes |
| `whatsapp-stopped` | `whatsappServices` | Bot desconectado manualmente |
| `whatsapp-unauthorized` | `whatsappServices` | Número no autorizado intentó conectar |

---

## 12. Sesión de WhatsApp por entorno

| Entorno | Estrategia | Almacenamiento |
|---|---|---|
| Desarrollo (`NODE_ENV != production` y sin `RAILWAY_ENVIRONMENT`) | `LocalAuth` | Carpeta `.wwebjs_auth/` en disco |
| Producción | `RemoteAuth` | Tabla `whatsapp_sessions` en MySQL (ZIP binario en LONGBLOB) |

`MySQLStore` implementa la interfaz requerida por `RemoteAuth` de `whatsapp-web.js`:

| Método | Descripción |
|---|---|
| `sessionExists(options)` | Verifica si hay una sesión guardada para el `session_id` |
| `save(options)` | Lee el ZIP del disco y lo guarda/actualiza en MySQL |
| `extract(options)` | Lee el BLOB de MySQL y lo escribe en disco para que Puppeteer lo use |
| `delete(options)` | Elimina la sesión de MySQL |

---

## 13. Rutas web

| Ruta | Auth | Descripción |
|---|---|---|
| `GET /login` | No | Página de login |
| `GET /` | Sí | Panel principal de administración |
| `GET /perfil` | Sí | Vista de detalle de usuario |
| `GET /qr` | No | Imagen HTML del QR actual (sin autenticación para facilitar escaneo) |

Los archivos estáticos (JS, CSS, assets) se sirven desde `src/web/public/`.

---

## 14. Utilidades

### `normalizeNames(str)`
Convierte texto a Title Case respetando conectores del español.

```
"juan DE la rosa" → "Juan de la Rosa"
"MARIA DEL PILAR" → "Maria del Pilar"
```

Palabras que no se capitalizan: `de`, `del`, `la`, `los`, `las`, `y`, `e`.

### `formatDateToDisplay(date)`
Convierte `YYYY-MM-DD` (formato MySQL) a `DD/MM/YYYY` para mostrar en el frontend. Calcula en UTC para evitar desfases de zona horaria.

### `formatDateToSQL(date)`
Convierte `DD/MM/YYYY` (formato del frontend) a `YYYY-MM-DD` para persistir en MySQL.

### `toStr(v)`
Normaliza valores que `mysql2` puede devolver como `Uint8Array` o `Buffer` cuando se usa `charset: 'binary'`, convirtiéndolos a string UTF-8. Cubre los casos donde `Buffer.isBuffer()` falla.
