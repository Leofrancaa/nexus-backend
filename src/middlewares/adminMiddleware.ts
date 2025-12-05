// src/middlewares/adminMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { pool } from '../database/index';

const ADMIN_EMAIL = 'nexusfintool1962@gmail.com';

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 [adminMiddleware] Verificando permissões de admin...');
    try {
        const userId = (req as any).userId; // ID do usuário autenticado (do authenticateToken)
        console.log('🔍 [adminMiddleware] userId:', userId);

        if (!userId) {
            console.log('❌ [adminMiddleware] userId não encontrado');
            return res.status(401).json({
                success: false,
                message: 'Não autenticado'
            });
        }

        // Verificar se o usuário é admin
        const result = await pool.query(
            'SELECT email FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            console.log('❌ [adminMiddleware] Usuário não encontrado no banco');
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        const userEmail = result.rows[0].email;
        console.log('🔍 [adminMiddleware] Email do usuário:', userEmail);
        console.log('🔍 [adminMiddleware] Email admin esperado:', ADMIN_EMAIL);

        if (userEmail !== ADMIN_EMAIL) {
            console.log('❌ [adminMiddleware] Usuário não é admin');
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Você não tem permissão de administrador.'
            });
        }

        // Se chegou aqui, é admin
        console.log('✅ [adminMiddleware] Usuário é admin, prosseguindo...');
        next();
    } catch (error) {
        console.error('❌ [adminMiddleware] Erro ao verificar permissões de admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar permissões'
        });
    }
};
