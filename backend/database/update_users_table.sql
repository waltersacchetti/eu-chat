-- Script para actualizar la tabla eu_chat_users con campos de verificación de email
-- Ejecutar en la base de datos RDS

-- Agregar campos de verificación de email
ALTER TABLE eu_chat_users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON eu_chat_users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON eu_chat_users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON eu_chat_users(email_verified);

-- Verificar la estructura actualizada
\d eu_chat_users;
