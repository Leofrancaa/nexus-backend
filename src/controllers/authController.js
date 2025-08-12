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

        const isProd = process.env.NODE_ENV === 'production'
        const cookieOptions = isProd
            ? { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: TOKEN_TTL_MS }
            : { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: TOKEN_TTL_MS }

        res
            .cookie('token', token, cookieOptions)
            .status(200)
            .json({ message: 'Login realizado com sucesso', user: { id: user.id, nome: user.nome, email: user.email } })
    } catch (error) {
        console.error('[loginUser]', error)
        return res.status(500).json({ error: 'Erro ao fazer login.' })
    }
}

export const logoutUser = async (_req, res) => {
    const isProd = process.env.NODE_ENV === 'production'
    const clearOpts = isProd
        ? { httpOnly: true, secure: true, sameSite: 'none', path: '/' }
        : { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }

    res.clearCookie('token', clearOpts).status(200).json({ message: 'Logout realizado com sucesso' })
}
