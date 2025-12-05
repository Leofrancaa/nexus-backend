-- Migration: Create invite_codes table
-- Description: Table to store invite codes for user registration
-- Created: 2025-12-04

CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_used ON invite_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);

-- Comentários
COMMENT ON TABLE invite_codes IS 'Códigos de convite para registro de novos usuários';
COMMENT ON COLUMN invite_codes.code IS 'Código único de convite';
COMMENT ON COLUMN invite_codes.created_by IS 'ID do usuário que criou o código (admin)';
COMMENT ON COLUMN invite_codes.used_by IS 'ID do usuário que usou o código';
COMMENT ON COLUMN invite_codes.is_used IS 'Se o código já foi utilizado';
COMMENT ON COLUMN invite_codes.expires_at IS 'Data de expiração do código (NULL = nunca expira)';
COMMENT ON COLUMN invite_codes.used_at IS 'Data/hora em que o código foi utilizado';
