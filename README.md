# Chatbot WhatsApp — Fase 1

Registra automáticamente a cada nuevo usuario que escriba al bot y notifica al número administrador.

## Requisitos

- Node.js 18+
- MySQL 8+ / MariaDB 10.6+
- Una cuenta de WhatsApp vinculada al bot

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales de BD y el número del bot

# 3. Crear la base de datos y la tabla
mysql -u root -p < sql/schema.sql
```

## Uso

```bash
# Producción
npm start

# Desarrollo (recarga automática)
npm run dev
```

Al iniciar por primera vez aparecerá un QR en la terminal.  
Escanéalo desde **WhatsApp → Dispositivos vinculados**.

## Estructura

```
src/
  index.js                     ← Punto de entrada, cliente WhatsApp
  handlers/
    messageHandler.js           ← Lógica principal del flujo
  repositories/
    userRepository.js           ← Consultas a MySQL
  services/
    notificationService.js      ← Envío de notificación al bot
  config/
    database.js                 ← Pool de conexiones MySQL
sql/
  schema.sql                    ← Script de creación de tablas
```

## Flujo (Fase 1)

1. Usuario escribe al bot.
2. Se consulta si el número existe en `users`.
3. Si **no existe** → se inserta nombre + teléfono → se notifica al número del bot.
4. Si **ya existe** → no se hace nada.
# chatbot_user_ws
