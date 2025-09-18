import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../database/index.js'
import {
    User,
    LoginRequest,
    RegisterRequest,
    AuthResponse,
    QueryResult
} from '../types/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const registerUser = async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>): Promise<void> => {
    try {
        const { nome, email, senha } = req.body

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
            `INSERT INTO users (nome, email, senha, currency) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, nome, email, currency, created_at, updated_at`,
            [nome, email.toLowerCase(), hashedPassword, 'BRL']
        )

        const user = result.rows[0]

        // Gerar token JWT (24 horas de validade)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        )

        res.status(201).json({
            success: true,
            message: 'Usuário registrado com sucesso',
            user,
            token
        })
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

        // Validação de entrada
        if (!email || !senha) {
            res.status(400).json({
                success: false,
                message: 'E-mail e senha são obrigatórios.',
                error: 'E-mail e senha são obrigatórios.'
            } as any)
            return
        }

        // Buscar usuário
        const result: QueryResult<User> = await pool.query(
            'SELECT id, nome, email, senha, currency, created_at, updated_at FROM users WHERE email = $1',
            [email.toLowerCase()]
        )

        if (result.rowCount === 0) {
            res.status(400).json({
                success: false,
                message: 'Credenciais inválidas.',
                error: 'E-mail ou senha incorretos.'
            } as any)
            return
        }

        const user = result.rows[0]

        // Verificar senha
        if (!user.senha) {
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: 'Dados do usuário inconsistentes.'
            } as any)
            return
        }

        const isPasswordCorrect = await bcrypt.compare(senha, user.senha)
        if (!isPasswordCorrect) {
            res.status(401).json({
                success: false,
                message: 'Credenciais inválidas.',
                error: 'E-mail ou senha incorretos.'
            } as any)
            return
        }

        // Gerar token JWT (24 horas de validade)
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        )

        // Remover senha do retorno
        const { senha: _, ...userWithoutPassword } = user

        res.status(200).json({
            success: true,
            message: 'Login realizado com sucesso',
            user: userWithoutPassword,
            token
        })
    } catch (error) {
        console.error('[loginUser] Erro:', error)
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: 'Erro ao fazer login.'
        } as any)
    }
}

export const logoutUser = async (req: Request, res: Response): Promise<void> => {
    // Com Bearer token, o logout é feito no frontend removendo o token
    // Não há necessidade de invalidar no servidor (stateless)
    res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso. Remova o token do cliente.'
    })
}