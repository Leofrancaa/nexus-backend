// src/controllers/inviteCodeController.ts
import { Request, Response } from 'express'
import prisma from '../database/prisma'
import crypto from 'crypto'

const generateInviteCode = (): string => {
    return crypto.randomBytes(16).toString('hex').toUpperCase()
}

export const createInviteCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id
        const { expiresInDays } = req.body

        const code = generateInviteCode()

        let expiresAt: Date | null = null
        if (expiresInDays) {
            expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays))
        }

        const invite = await prisma.inviteCode.create({
            data: {
                code,
                created_by: userId,
                expires_at: expiresAt,
            },
            select: { id: true, code: true, expires_at: true, created_at: true },
        })

        res.status(201).json({
            success: true,
            message: 'Código de convite criado com sucesso',
            data: invite,
        })
    } catch (error) {
        console.error('Erro ao criar código de convite:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao criar código de convite',
        })
    }
}

export const validateInviteCode = async (req: Request, res: Response) => {
    try {
        const { code } = req.body

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite é obrigatório',
            })
        }

        const invite = await prisma.inviteCode.findFirst({
            where: { code: code.toUpperCase() },
        })

        if (!invite) {
            return res.status(404).json({
                success: false,
                message: 'Código de convite inválido',
            })
        }

        if (invite.is_used) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite já foi utilizado',
            })
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Código de convite expirado',
            })
        }

        res.json({
            success: true,
            message: 'Código de convite válido',
            data: { valid: true },
        })
    } catch (error) {
        console.error('Erro ao validar código de convite:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao validar código de convite',
        })
    }
}

export const listInviteCodes = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id

        const invites = await prisma.inviteCode.findMany({
            where: { created_by: userId },
            include: {
                user: {
                    select: { nome: true, email: true },
                },
            },
            orderBy: { created_at: 'desc' },
        })

        const data = invites.map(invite => ({
            id: invite.id,
            code: invite.code,
            is_used: invite.is_used,
            expires_at: invite.expires_at,
            created_at: invite.created_at,
            used_at: invite.used_at,
            used_by_name: invite.user?.nome ?? null,
            used_by_email: invite.user?.email ?? null,
        }))

        res.json({ success: true, data })
    } catch (error) {
        console.error('Erro ao listar códigos de convite:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao listar códigos de convite',
        })
    }
}

export const markInviteCodeAsUsed = async (code: string, userId: number): Promise<boolean> => {
    try {
        const result = await prisma.inviteCode.updateMany({
            where: { code: code.toUpperCase(), is_used: false },
            data: { is_used: true, used_by: userId, used_at: new Date() },
        })

        return result.count > 0
    } catch (error) {
        console.error('Erro ao marcar código como usado:', error)
        return false
    }
}

export const deleteInviteCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id
        const { id } = req.params

        const result = await prisma.inviteCode.deleteMany({
            where: { id: parseInt(id), created_by: userId, is_used: false },
        })

        if (result.count === 0) {
            return res.status(404).json({
                success: false,
                message: 'Código não encontrado ou não pode ser deletado',
            })
        }

        res.json({
            success: true,
            message: 'Código de convite deletado com sucesso',
        })
    } catch (error) {
        console.error('Erro ao deletar código de convite:', error)
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar código de convite',
        })
    }
}
