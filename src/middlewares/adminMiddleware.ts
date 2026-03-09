// src/middlewares/adminMiddleware.ts
import { Request, Response, NextFunction } from 'express'
import prisma from '../database/prisma'

const ADMIN_EMAIL = 'nexusfintool1962@gmail.com'

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 [adminMiddleware] Verificando permissões de admin...')
    try {
        const userId = (req as any).user?.id
        console.log('🔍 [adminMiddleware] userId:', userId)

        if (!userId) {
            console.log('❌ [adminMiddleware] userId não encontrado')
            return res.status(401).json({
                success: false,
                message: 'Não autenticado',
            })
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        })

        if (!user) {
            console.log('❌ [adminMiddleware] Usuário não encontrado no banco')
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado',
            })
        }

        console.log('🔍 [adminMiddleware] Email do usuário:', user.email)
        console.log('🔍 [adminMiddleware] Email admin esperado:', ADMIN_EMAIL)

        if (user.email !== ADMIN_EMAIL) {
            console.log('❌ [adminMiddleware] Usuário não é admin')
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Você não tem permissão de administrador.',
            })
        }

        console.log('✅ [adminMiddleware] Usuário é admin, prosseguindo...')
        next()
    } catch (error) {
        console.error('❌ [adminMiddleware] Erro ao verificar permissões de admin:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar permissões',
        })
    }
}
