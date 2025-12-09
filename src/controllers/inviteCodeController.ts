// src/controllers/inviteCodeController.ts
import { Request, Response } from 'express';
import { pool } from '../database/index';
import crypto from 'crypto';

// Gerar código de convite aleatório
const generateInviteCode = (): string => {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
};

// Criar um novo código de convite (somente para admin)
export const createInviteCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id; // ID do usuário autenticado
        const { expiresInDays } = req.body; // Opcional: quantos dias até expirar

        // Gerar código único
        const code = generateInviteCode();

        // Calcular data de expiração se fornecida
        let expiresAt = null;
        if (expiresInDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));
        }

        const result = await pool.query(
            `INSERT INTO invite_codes (code, created_by, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, code, expires_at, created_at`,
            [code, userId, expiresAt]
        );

        res.status(201).json({
            success: true,
            message: 'Código de convite criado com sucesso',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao criar código de convite:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar código de convite'
        });
    }
};

// Validar código de convite (público - usado no registro)
export const validateInviteCode = async (req: Request, res: Response) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite é obrigatório'
            });
        }

        const result = await pool.query(
            `SELECT id, code, is_used, expires_at
             FROM invite_codes
             WHERE code = $1`,
            [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Código de convite inválido'
            });
        }

        const inviteCode = result.rows[0];

        // Verificar se já foi usado
        if (inviteCode.is_used) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite já foi utilizado'
            });
        }

        // Verificar se expirou
        if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite expirado'
            });
        }

        res.json({
            success: true,
            message: 'Código de convite válido',
            data: { valid: true }
        });
    } catch (error) {
        console.error('Erro ao validar código de convite:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao validar código de convite'
        });
    }
};

// Listar todos os códigos de convite (somente para admin)
export const listInviteCodes = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        const result = await pool.query(
            `SELECT
                ic.id,
                ic.code,
                ic.is_used,
                ic.expires_at,
                ic.created_at,
                ic.used_at,
                u.nome as used_by_name,
                u.email as used_by_email
             FROM invite_codes ic
             LEFT JOIN users u ON ic.used_by = u.id
             WHERE ic.created_by = $1
             ORDER BY ic.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Erro ao listar códigos de convite:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar códigos de convite'
        });
    }
};

// Marcar código como usado (chamado internamente no registro)
export const markInviteCodeAsUsed = async (code: string, userId: number): Promise<boolean> => {
    try {
        const result = await pool.query(
            `UPDATE invite_codes
             SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP
             WHERE code = $2 AND is_used = false
             RETURNING id`,
            [userId, code.toUpperCase()]
        );

        return result.rows.length > 0;
    } catch (error) {
        console.error('Erro ao marcar código como usado:', error);
        return false;
    }
};

// Deletar código de convite não utilizado
export const deleteInviteCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        // Verificar se o código pertence ao usuário e não foi usado
        const result = await pool.query(
            `DELETE FROM invite_codes
             WHERE id = $1 AND created_by = $2 AND is_used = false
             RETURNING id`,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado ou não pode ser deletado'
            });
        }

        res.json({
            success: true,
            message: 'Código de convite deletado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar código de convite:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar código de convite'
        });
    }
};
