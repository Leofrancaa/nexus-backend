// src/controllers/authController.ts
import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../database/prisma'
import {
    User,
    LoginRequest,
    RegisterRequest,
    AuthResponse,
} from '../types/index'
import { generateResetToken, sendPasswordResetEmail } from '../services/emailService'
import { markInviteCodeAsUsed } from './inviteCodeController'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const registerUser = async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>): Promise<void> => {
    try {
        const { nome, email, senha, inviteCode } = req.body

        console.log('[registerUser] Iniciando registro para:', email)

        if (!nome || !email || !senha) {
            res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios.', error: 'Nome, e-mail e senha são obrigatórios.' } as any)
            return
        }

        if (!inviteCode) {
            res.status(400).json({ success: false, message: 'Código de convite é obrigatório.', error: 'Código de convite é obrigatório.' } as any)
            return
        }

        const invite = await prisma.inviteCode.findFirst({
            where: { code: inviteCode.toUpperCase() }
        })

        if (!invite) {
            res.status(400).json({ success: false, message: 'Código de convite inválido.', error: 'Código de convite inválido.' } as any)
            return
        }

        if (invite.is_used) {
            res.status(400).json({ success: false, message: 'Este código de convite já foi utilizado.', error: 'Este código de convite já foi utilizado.' } as any)
            return
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            res.status(400).json({ success: false, message: 'Este código de convite expirou.', error: 'Este código de convite expirou.' } as any)
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, message: 'Email inválido.', error: 'Email inválido.' } as any)
            return
        }

        if (senha.length < 6) {
            res.status(400).json({ success: false, message: 'Senha deve ter pelo menos 6 caracteres.', error: 'Senha deve ter pelo menos 6 caracteres.' } as any)
            return
        }

        const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

        if (existingUser) {
            res.status(409).json({ success: false, message: 'E-mail já cadastrado.', error: 'E-mail já cadastrado.' } as any)
            return
        }

        const hashedPassword = await bcrypt.hash(senha, 12)

        const user = await prisma.user.create({
            data: {
                nome,
                email: email.toLowerCase(),
                senha: hashedPassword,
                currency: 'BRL',
                accepted_terms: true,
                accepted_terms_at: new Date(),
            },
            select: { id: true, nome: true, email: true, currency: true, created_at: true, updated_at: true }
        })

        await markInviteCodeAsUsed(inviteCode.toUpperCase(), user.id)

        const token = jwt.sign(
            { id: user.id, nome: user.nome, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        console.log('[registerUser] Token gerado:', token ? 'SUCCESS' : 'FAILED')

        res.status(201).json({ success: true, message: 'Usuário registrado com sucesso', user, token })
    } catch (error) {
        console.error('[registerUser] Erro:', error)
        res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Erro ao registrar usuário.' } as any)
    }
}

export const loginUser = async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse>): Promise<void> => {
    try {
        const { email, senha } = req.body

        console.log('[loginUser] Iniciando login para:', email)

        if (!email || !senha) {
            res.status(400).json({ success: false, message: 'E-mail e senha são obrigatórios.', error: 'E-mail e senha são obrigatórios.' } as any)
            return
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, nome: true, email: true, senha: true, currency: true, created_at: true, updated_at: true }
        })

        if (!user) {
            res.status(400).json({ success: false, message: 'Credenciais inválidas.', error: 'E-mail ou senha incorretos.' } as any)
            return
        }

        if (!user.senha) {
            res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Dados do usuário inconsistentes.' } as any)
            return
        }

        const isPasswordCorrect = await bcrypt.compare(senha, user.senha)

        if (!isPasswordCorrect) {
            res.status(401).json({ success: false, message: 'Credenciais inválidas.', error: 'E-mail ou senha incorretos.' } as any)
            return
        }

        const token = jwt.sign(
            { id: user.id, nome: user.nome, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        const { senha: _, ...userWithoutPassword } = user

        console.log('[loginUser] Login realizado com sucesso para:', email)

        res.status(200).json({ success: true, message: 'Login realizado com sucesso', user: userWithoutPassword, token })
    } catch (error) {
        console.error('[loginUser] Erro inesperado:', error)
        res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Erro ao fazer login.' } as any)
    }
}

export const logoutUser = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ success: true, message: 'Logout realizado com sucesso. Remova o token do cliente.' })
}

export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id
        const { senhaAtual, novaSenha } = req.body

        if (!senhaAtual || !novaSenha) {
            res.status(400).json({ success: false, message: 'Senha atual e nova senha são obrigatórias.', error: 'Senha atual e nova senha são obrigatórias.' })
            return
        }

        if (novaSenha.length < 6) {
            res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 6 caracteres.', error: 'A nova senha deve ter pelo menos 6 caracteres.' })
            return
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, senha: true }
        })

        if (!user) {
            res.status(404).json({ success: false, message: 'Usuário não encontrado.', error: 'Usuário não encontrado.' })
            return
        }

        if (!user.senha) {
            res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Dados do usuário inconsistentes.' })
            return
        }

        const isPasswordCorrect = await bcrypt.compare(senhaAtual, user.senha)

        if (!isPasswordCorrect) {
            res.status(401).json({ success: false, message: 'Senha atual incorreta.', error: 'Senha atual incorreta.' })
            return
        }

        const hashedPassword = await bcrypt.hash(novaSenha, 12)

        await prisma.user.update({
            where: { id: userId },
            data: { senha: hashedPassword }
        })

        res.status(200).json({ success: true, message: 'Senha alterada com sucesso.' })
    } catch (error) {
        console.error('[changePassword] Erro:', error)
        res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Erro ao alterar senha.' })
    }
}

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body

        if (!email) {
            res.status(400).json({ success: false, message: 'Email é obrigatório.', error: 'Email é obrigatório.' })
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, message: 'Email inválido.', error: 'Email inválido.' })
            return
        }

        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, nome: true, email: true }
        })

        if (!user) {
            res.status(200).json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
            return
        }

        const resetToken = generateResetToken()
        const resetExpires = new Date(Date.now() + 3600000)

        await prisma.user.update({
            where: { id: user.id },
            data: { reset_password_token: resetToken, reset_password_expires: resetExpires }
        })

        try {
            await sendPasswordResetEmail(user.email, resetToken, user.nome)
        } catch (emailError) {
            console.error('[requestPasswordReset] Erro ao enviar email:', emailError)
            await prisma.user.update({
                where: { id: user.id },
                data: { reset_password_token: null, reset_password_expires: null }
            })
            res.status(500).json({ success: false, message: 'Erro ao enviar email de recuperação. Tente novamente mais tarde.', error: 'Erro ao enviar email.' })
            return
        }

        res.status(200).json({ success: true, message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' })
    } catch (error) {
        console.error('[requestPasswordReset] Erro:', error)
        res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Erro ao processar solicitação.' })
    }
}

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, novaSenha } = req.body

        if (!token || !novaSenha) {
            res.status(400).json({ success: false, message: 'Token e nova senha são obrigatórios.', error: 'Token e nova senha são obrigatórios.' })
            return
        }

        if (novaSenha.length < 6) {
            res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 6 caracteres.', error: 'A nova senha deve ter pelo menos 6 caracteres.' })
            return
        }

        const user = await prisma.user.findFirst({
            where: {
                reset_password_token: token,
                reset_password_expires: { gt: new Date() }
            },
            select: { id: true, email: true, nome: true }
        })

        if (!user) {
            res.status(400).json({ success: false, message: 'Token inválido ou expirado.', error: 'Token inválido ou expirado.' })
            return
        }

        const hashedPassword = await bcrypt.hash(novaSenha, 12)

        await prisma.user.update({
            where: { id: user.id },
            data: { senha: hashedPassword, reset_password_token: null, reset_password_expires: null }
        })

        console.log('[resetPassword] Senha redefinida com sucesso para usuário:', user.email)

        res.status(200).json({ success: true, message: 'Senha redefinida com sucesso. Você já pode fazer login.' })
    } catch (error) {
        console.error('[resetPassword] Erro:', error)
        res.status(500).json({ success: false, message: 'Erro interno do servidor', error: 'Erro ao redefinir senha.' })
    }
}
