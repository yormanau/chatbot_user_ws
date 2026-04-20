-- Tabla de usuarios registrados
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  phone    VARCHAR(20)     NOT NULL,
  name      VARCHAR(100)    NOT NULL,
  create_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_phone(phone),
  KEY idx_users_created_at (create_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla para almacenar sesiones de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  session_data LONGBLOB,
  created_at DATETIME,
  updated_at DATETIME,
  KEY idx_sessions_updated_at (updated_at)
);

-- Modificar la tabla whatsapp_sessions, columna session_data a LONGBLOB
ALTER TABLE whatsapp_sessions MODIFY session_data LONGBLOB;

-- Agregar campos opcionales a la tabla users
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN ciudad VARCHAR(100) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN birth_date DATE NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN gender VARCHAR(50) NULL DEFAULT NULL;

-- Product catalog (auto-populated from purchases)
CREATE TABLE IF NOT EXISTS products (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(200) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice header (one per purchase session)
CREATE TABLE IF NOT EXISTS invoices (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED  NOT NULL,
  total      DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_invoices_user_id (user_id),
  KEY idx_invoices_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Canal de registro de usuarios
CREATE TABLE IF NOT EXISTS channels (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50)      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_channel_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO channels (name) VALUES ('whatsapp'), ('manual');

ALTER TABLE users ADD COLUMN channel_id TINYINT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE users ADD KEY idx_users_channel_id (channel_id);

-- Configuración general de la aplicación (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
  `key`      VARCHAR(100) NOT NULL,
  `value`    TEXT         NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Métodos de pago
CREATE TABLE IF NOT EXISTS payment_methods (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50)      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_method_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO payment_methods (name) VALUES ('Efectivo'), ('Tarjeta'), ('Transferencia');

ALTER TABLE invoices ADD COLUMN payment_method_id TINYINT UNSIGNED NULL DEFAULT NULL;
ALTER TABLE invoices ADD KEY idx_invoices_payment_method_id (payment_method_id);
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_payment_method
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;

-- Invoice line items (one product per row)
CREATE TABLE IF NOT EXISTS invoice_items (
  id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  invoice_id   INT UNSIGNED      NOT NULL,
  product_id   INT UNSIGNED      NULL,
  product_name VARCHAR(200)      NOT NULL,
  price        DECIMAL(12,2)     NOT NULL,
  quantity     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice_id (invoice_id),
  KEY idx_invoice_items_product_id (product_id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)  ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
