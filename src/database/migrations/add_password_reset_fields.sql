-- Adicionar campos para recuperação de senha
-- Execute este SQL no seu banco de dados PostgreSQL

ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;

-- Criar índice para melhorar performance nas buscas por token
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
