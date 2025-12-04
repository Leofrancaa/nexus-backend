// src/controllers/authController.ts
import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../database/index'
import {
    User,
    LoginRequest,
    RegisterRequest,
    AuthResponse,
    QueryResult
} from '../types/index'
import { generateResetToken, sendPasswordResetEmail } from '../services/emailService'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const registerUser = async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>): Promise<void> => {
    try {
        const { nome, email, senha } = req.body

        console.log('[registerUser] Iniciando registro para:', email)

        // Validação de entrada
        if (!nome || !email || !senha) {
            res.status(400).json({
                success: false,
                message: 'Nome, e-mail e senha são obrigatórios.',
                error: 'Nome, e-mail e senha são obrigatórios.'
            } as any)
            return
        }

        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: 'Email inválido.',
                error: 'Email inválido.'
            } as any)
            return
        }

        // Validação de senha
        if (senha.length < 6) {
            res.status(400).json({
                success: false,
                message: 'Senha deve ter pelo menos 6 caracteres.',
                error: 'Senha deve ter pelo menos 6 caracteres.'
            } as any)
            return
        }

        // Verificar se usuário já existe
        const existsResult: QueryResult<{ id: number }> = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        )

        if (existsResult.rowCount && existsResult.rowCount > 0) {
            res.status(409).json({
                success: false,
                message: 'E-mail já cadastrado.',
                error: 'E-mail já cadastrado.'
            } as any)
            return
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(senha, 12)

        // Inserir usuário
        const result: QueryResult<Omit<User, 'senha'>> = await pool.query(
            `INSERT INTO users (nome, email, senha, currency, accepted_terms, accepted_terms_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, nome, email, currency, created_at, updated_at`,
            [nome, email.toLowerCase(), hashedPassword, 'BRL', true]
        )

        const user = result.rows[0]

        // Gerar token JWT (7 dias de validade)
        const token = jwt.sign(
            { id: user.id, nome: user.nome, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        console.log('[registerUser] Token gerado:', token ? 'SUCCESS' : 'FAILED', token ? token.length : 0)

        const response = {
            success: true,
            message: 'Usuário registrado com sucesso',
            user,
            token
        }

        console.log('[registerUser] Enviando resposta:', {
            success: response.success,
            hasUser: !!response.user,
            hasToken: !!response.token,
            tokenLength: response.token ? response.token.length : 0
        })

        res.status(201).json(response)
    } catch (error) {
        console.error('[registerUser] Erro:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao registrar usuário.'
        } as any)
    }
}

export const loginUser = async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse>): Promise<void> => {
    try {
        const { email, senha } = req.body

        console.log('[loginUser] Iniciando login para:', email)
        console.log('[loginUser] JWT_SECRET definido:', !!JWT_SECRET)

        // Validação de entrada
        if (!email || !senha) {
            console.log('[loginUser] Erro: Campos obrigatórios não preenchidos')
            res.status(400).json({
                success: false,
                message: 'E-mail e senha são obrigatórios.',
                error: 'E-mail e senha são obrigatórios.'
            } as any)
            return
        }

        // Buscar usuário
        console.log('[loginUser] Buscando usuário no banco...')
        const result: QueryResult<User> = await pool.query(
            'SELECT id, nome, email, senha, currency, created_at, updated_at FROM users WHERE email = $1',
            [email.toLowerCase()]
        )

        if (result.rowCount === 0) {
            console.log('[loginUser] Usuário não encontrado')
            res.status(400).json({
                success: false,
                message: 'Credenciais inválidas.',
                error: 'E-mail ou senha incorretos.'
            } as any)
            return
        }

        const user = result.rows[0]
        console.log('[loginUser] Usuário encontrado:', { id: user.id, email: user.email })

        // Verificar senha
        if (!user.senha) {
            console.log('[loginUser] Erro: Usuário sem senha no banco')
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: 'Dados do usuário inconsistentes.'
            } as any)
            return
        }

        console.log('[loginUser] Verificando senha...')
        const isPasswordCorrect = await bcrypt.compare(senha, user.senha)

        if (!isPasswordCorrect) {
            console.log('[loginUser] Senha incorreta')
            res.status(401).json({
                success: false,
                message: 'Credenciais inválidas.',
                error: 'E-mail ou senha incorretos.'
            } as any)
            return
        }

        console.log('[loginUser] Senha correta, gerando token...')

        // Gerar token JWT (7 dias de validade)
        const token = jwt.sign(
            { id: user.id, nome: user.nome, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        console.log('[loginUser] Token gerado:', token ? 'SUCCESS' : 'FAILED')
        console.log('[loginUser] Token length:', token ? token.length : 0)
        console.log('[loginUser] Token preview:', token ? token.substring(0, 20) + '...' : 'N/A')

        // Remover senha do retorno
        const { senha: _, ...userWithoutPassword } = user

        const response = {
            success: true,
            message: 'Login realizado com sucesso',
            user: userWithoutPassword,
            token
        }

        console.log('[loginUser] Preparando resposta:', {
            success: response.success,
            hasUser: !!response.user,
            hasToken: !!response.token,
            tokenLength: response.token ? response.token.length : 0,
            userKeys: response.user ? Object.keys(response.user) : []
        })

        console.log('[loginUser] Enviando resposta com status 200...')
        res.status(200).json(response)
        console.log('[loginUser] Resposta enviada com sucesso!')

    } catch (error) {
        console.error('[loginUser] Erro inesperado:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao fazer login.'
        } as any)
    }
}

export const logoutUser = async (req: Request, res: Response): Promise<void> => {
    console.log('[logoutUser] Processando logout')
    // Com Bearer token, o logout é feito no frontend removendo o token
    // Não há necessidade de invalidar no servidor (stateless)
    res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso. Remova o token do cliente.'
    })
}

export const changePassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id // ID do usuário autenticado vindo do middleware
        const { senhaAtual, novaSenha } = req.body

        console.log('[changePassword] Iniciando alteração de senha para usuário:', userId)

        // Validação de entrada
        if (!senhaAtual || !novaSenha) {
            res.status(400).json({
                success: false,
                message: 'Senha atual e nova senha são obrigatórias.',
                error: 'Senha atual e nova senha são obrigatórias.'
            })
            return
        }

        // Validação da nova senha
        if (novaSenha.length < 6) {
            res.status(400).json({
                success: false,
                message: 'A nova senha deve ter pelo menos 6 caracteres.',
                error: 'A nova senha deve ter pelo menos 6 caracteres.'
            })
            return
        }

        // Buscar usuário com senha
        const result: QueryResult<User> = await pool.query(
            'SELECT id, senha FROM users WHERE id = $1',
            [userId]
        )

        if (result.rowCount === 0) {
            res.status(404).json({
                success: false,
                message: 'Usuário não encontrado.',
                error: 'Usuário não encontrado.'
            })
            return
        }

        const user = result.rows[0]

        // Verificar senha atual
        if (!user.senha) {
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: 'Dados do usuário inconsistentes.'
            })
            return
        }

        const isPasswordCorrect = await bcrypt.compare(senhaAtual, user.senha)

        if (!isPasswordCorrect) {
            res.status(401).json({
                success: false,
                message: 'Senha atual incorreta.',
                error: 'Senha atual incorreta.'
            })
            return
        }

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(novaSenha, 12)

        // Atualizar senha no banco
        await pool.query(
            'UPDATE users SET senha = $1, updated_at = NOW() WHERE id = $2',
            [hashedPassword, userId]
        )

        console.log('[changePassword] Senha alterada com sucesso para usuário:', userId)

        res.status(200).json({
            success: true,
            message: 'Senha alterada com sucesso.'
        })
    } catch (error) {
        console.error('[changePassword] Erro:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao alterar senha.'
        })
    }
}

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body

        console.log('[requestPasswordReset] Solicitação de recuperação para:', email)

        // Validação de entrada
        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email é obrigatório.',
                error: 'Email é obrigatório.'
            })
            return
        }

        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            res.status(400).json({
                success: false,
                message: 'Email inválido.',
                error: 'Email inválido.'
            })
            return
        }

        // Buscar usuário
        const result: QueryResult<User> = await pool.query(
            'SELECT id, nome, email FROM users WHERE email = $1',
            [email.toLowerCase()]
        )

        // Por segurança, sempre retornar sucesso mesmo se o email não existir
        // Isso evita que atacantes descubram quais emails estão cadastrados
        if (result.rowCount === 0) {
            console.log('[requestPasswordReset] Email não encontrado, mas retornando sucesso por segurança')
            res.status(200).json({
                success: true,
                message: 'Se o email estiver cadastrado, você receberá um link de recuperação.'
            })
            return
        }

        const user = result.rows[0]

        // Gerar token de recuperação
        const resetToken = generateResetToken()
        const resetExpires = new Date(Date.now() + 3600000) // 1 hora

        // Salvar token no banco
        await pool.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [resetToken, resetExpires, user.id]
        )

        // Enviar email
        try {
            await sendPasswordResetEmail(user.email, resetToken, user.nome)
            console.log('[requestPasswordReset] Email enviado com sucesso para:', user.email)
        } catch (emailError) {
            console.error('[requestPasswordReset] Erro ao enviar email:', emailError)
            // Limpar token se falhou ao enviar email
            await pool.query(
                'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = $1',
                [user.id]
            )
            res.status(500).json({
                success: false,
                message: 'Erro ao enviar email de recuperação. Tente novamente mais tarde.',
                error: 'Erro ao enviar email.'
            })
            return
        }

        res.status(200).json({
            success: true,
            message: 'Se o email estiver cadastrado, você receberá um link de recuperação.'
        })
    } catch (error) {
        console.error('[requestPasswordReset] Erro:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao processar solicitação.'
        })
    }
}

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token, novaSenha } = req.body

        console.log('[resetPassword] Iniciando redefinição de senha com token')

        // Validação de entrada
        if (!token || !novaSenha) {
            res.status(400).json({
                success: false,
                message: 'Token e nova senha são obrigatórios.',
                error: 'Token e nova senha são obrigatórios.'
            })
            return
        }

        // Validação da nova senha
        if (novaSenha.length < 6) {
            res.status(400).json({
                success: false,
                message: 'A nova senha deve ter pelo menos 6 caracteres.',
                error: 'A nova senha deve ter pelo menos 6 caracteres.'
            })
            return
        }

        // Buscar usuário com token válido
        const result: QueryResult<User> = await pool.query(
            'SELECT id, email, nome FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        )

        if (result.rowCount === 0) {
            res.status(400).json({
                success: false,
                message: 'Token inválido ou expirado.',
                error: 'Token inválido ou expirado.'
            })
            return
        }

        const user = result.rows[0]

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(novaSenha, 12)

        // Atualizar senha e limpar token
        await pool.query(
            'UPDATE users SET senha = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = $2',
            [hashedPassword, user.id]
        )

        console.log('[resetPassword] Senha redefinida com sucesso para usuário:', user.email)

        res.status(200).json({
            success: true,
            message: 'Senha redefinida com sucesso. Você já pode fazer login.'
        })
    } catch (error) {
        console.error('[resetPassword] Erro:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao redefinir senha.'
        })
    }
}