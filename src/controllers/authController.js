import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../database/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000 // 2h

export const registerUser = async (req, res) => {
    const { nome, email, senha } = req.body || {}

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' })
    }

    try {
        // checa se já existe
        const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
        if (exists.rowCount > 0) {
            return res.status(409).json({ error: 'E-mail já cadastrado.' })
        }

        const hashedPassword = await bcrypt.hash(senha, 10)

        const result = await pool.query(
            'INSERT INTO users (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
            [nome, email, hashedPassword]
        )

        return res.status(201).json(result.rows[0])
    } catch (error) {
        console.error('[registerUser]', error)
        return res.status(500).json({ error: 'Erro ao registrar usuário.' })
    }
}

export const loginUser = async (req, res) => {
    const { email, senha } = req.body || {}
    if (!email || !senha) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
    }

    try {
        const result = await pool.query('SELECT id, nome, email, senha FROM users WHERE email = $1', [email])
        const user = result.rows[0]
        if (!user) return res.status(400).json({ error: 'Usuário não encontrado.' })

        const isPasswordCorrect = await bcrypt.compare(senha, user.senha)
        if (!isPasswordCorrect) return res.status(401).json({ error: 'Senha incorreta.' })

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '2h' })

        // 🍪 Configurações de cookie específicas para iOS Safari
        const isProd = process.env.NODE_ENV === 'production'

        // iOS Safari é mais rigoroso com cookies
        const cookieOptions = isProd ? {
            httpOnly: true,
            secure: true,
            sameSite: 'none', // Necessário para cross-site em produção
            path: '/',
            maxAge: TOKEN_TTL_MS,
            domain: undefined // Deixar undefined para funcionar com subdomínios
        } : {
            httpOnly: true,
            secure: false, // HTTP em desenvolvimento
            sameSite: 'lax', // Mais permissivo em desenvolvimento
            path: '/',
            maxAge: TOKEN_TTL_MS
        }

        // 📱 Headers adicionais para PWA/iOS
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')

        // 🔄 Resposta com cookie E token no body (fallback para iOS)
        res
            .cookie('token', token, cookieOptions)
            .status(200)
            .json({
                message: 'Login realizado com sucesso',
                user: { id: user.id, nome: user.nome, email: user.email },
                token: token // 🔑 Enviamos o token também no body para iOS
            })
    } catch (error) {
        console.error('[loginUser]', error)
        return res.status(500).json({ error: 'Erro ao fazer login.' })
    }
}

export const logoutUser = async (_req, res) => {
    const isProd = process.env.NODE_ENV === 'production'

    // 🧹 Limpar cookie de forma compatível com iOS
    const clearOpts = isProd ? {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: undefined
    } : {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/'
    }

    res
        .clearCookie('token', clearOpts)
        .status(200)
        .json({ message: 'Logout realizado com sucesso' })

    // 📱 Headers para garantir que o logout funcione no PWA
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
}