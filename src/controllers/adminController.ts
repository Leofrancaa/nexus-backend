// src/controllers/adminController.ts
import { Request, Response } from 'express';
import { pool } from '../database/index';

// Listar todos os usuários (somente para admin)
export const listAllUsers = async (req: Request, res: Response) => {
    console.log('🔍 [adminController] listAllUsers chamado');
    try {
        const result = await pool.query(
            `SELECT
                id,
                nome,
                email,
                created_at,
                accepted_terms_at
             FROM users
             ORDER BY created_at DESC`
        );

        console.log('🔍 [adminController] Usuários encontrados:', result.rows.length);
        console.log('🔍 [adminController] Dados:', result.rows);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ [adminController] Erro ao listar usuários:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar usuários'
        });
    }
};
