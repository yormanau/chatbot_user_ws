-- -- Tabla de usuarios registrados
-- CREATE TABLE IF NOT EXISTS users (
--   id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
--   phone    VARCHAR(20)     NOT NULL,
--   name      VARCHAR(100)    NOT NULL,
--   create_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (id),
--   UNIQUE KEY uq_phone(phone)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -- Tabla para almacenar sesiones de WhatsApp
-- CREATE TABLE IF NOT EXISTS whatsapp_sessions (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   session_id VARCHAR(255) NOT NULL UNIQUE,
--   session_data LONGBLOB,
--   created_at DATETIME,
--   updated_at DATETIME
-- );

-- -- Modificar la tabla whatsapp_sessions, columna session_data a LONGBLOB
-- ALTER TABLE whatsapp_sessions MODIFY session_data LONGBLOB;

-- -- Agregar campos opcionales a la tabla users
-- ALTER TABLE users
--   ADD COLUMN IF NOT EXISTS email      VARCHAR(255) NULL DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS ciudad     VARCHAR(100) NULL DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS birth_date DATE         NULL DEFAULT NULL,
--   ADD COLUMN IF NOT EXISTS gender     VARCHAR(50)  NULL DEFAULT NULL;

-- -- Product catalog (auto-populated from purchases)
-- CREATE TABLE IF NOT EXISTS products (
--   id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
--   name       VARCHAR(200) NOT NULL,
--   created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (id),
--   UNIQUE KEY uq_product_name (name)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -- Invoice header (one per purchase session)
-- CREATE TABLE IF NOT EXISTS invoices (
--   id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
--   user_id    INT UNSIGNED  NOT NULL,
--   total      DECIMAL(12,2) NOT NULL DEFAULT 0,
--   created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (id),
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -- Canal de registro de usuarios
-- CREATE TABLE IF NOT EXISTS channels (
--   id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
--   name VARCHAR(50)      NOT NULL,
--   PRIMARY KEY (id),
--   UNIQUE KEY uq_channel_name (name)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INSERT IGNORE INTO channels (name) VALUES ('whatsapp'), ('manual');

-- ALTER TABLE users
--   ADD COLUMN IF NOT EXISTS channel_id TINYINT UNSIGNED NULL DEFAULT NULL;

-- -- Configuración general de la aplicación (key-value)
-- CREATE TABLE IF NOT EXISTS app_settings (
--   `key`      VARCHAR(100) NOT NULL,
--   `value`    TEXT         NULL,
--   updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--   PRIMARY KEY (`key`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -- Invoice line items (one product per row)
-- CREATE TABLE IF NOT EXISTS invoice_items (
--   id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
--   invoice_id   INT UNSIGNED      NOT NULL,
--   product_id   INT UNSIGNED      NULL,
--   product_name VARCHAR(200)      NOT NULL,
--   price        DECIMAL(12,2)     NOT NULL,
--   quantity     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
--   PRIMARY KEY (id),
--   FOREIGN KEY (invoice_id) REFERENCES invoices(id)  ON DELETE CASCADE,
--   FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de usuarios registrados
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  create_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phone(phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar sesiones de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  session_data LONGBLOB,
  created_at DATETIME,
  updated_at DATETIME
);

-- Asegurar tipo correcto
ALTER TABLE whatsapp_sessions MODIFY session_data LONGBLOB;

-- 👇 CORREGIDO (SIN IF NOT EXISTS)
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN ciudad VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN birth_date DATE NULL;
ALTER TABLE users ADD COLUMN gender VARCHAR(50) NULL;

-- Product catalog
CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_channel_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO channels (name) VALUES ('whatsapp'), ('manual');

-- 👇 agregar columna SIN IF
ALTER TABLE users ADD COLUMN channel_id TINYINT UNSIGNED NULL;

-- Invoice header
CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) NOT NULL,
  `value` TEXT,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invoice items
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;