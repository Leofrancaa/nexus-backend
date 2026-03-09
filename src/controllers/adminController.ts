// src/controllers/adminController.ts
import { Request, Response } from 'express'
import prisma from '../database/prisma'

export const listAllUsers = async (req: Request, res: Response) => {
    console.log('🔍 [adminController] listAllUsers chamado')
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                nome: true,
                email: true,
                created_at: true,
                accepted_terms_at: true,
            },
            orderBy: { created_at: 'desc' },
        })

        console.log('🔍 [adminController] Usuários encontrados:', users.length)
        console.log('🔍 [adminController] Dados:', users)

        res.json({ success: true, data: users })
    } catch (error) {
        console.error('❌ [adminController] Erro ao listar usuários:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao listar usuários',
        })
    }
}
