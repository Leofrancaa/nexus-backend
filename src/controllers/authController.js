import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../database/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const registerUser = async (req, res) => {
    const { nome, email, senha } = req.body

    try {
        const hashedPassword = await bcrypt.hash(senha, 10)

        const result = await pool.query(
            'INSERT INTO users (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email',
            [nome, email, hashedPassword]
        )

        res.status(201).json(result.rows[0])
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Erro ao registrar usuário.' })
    }
}

export const loginUser = async (req, res) => {
    const { email, senha } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) return res.status(400).json({ error: 'Usuário não encontrado.' });

        const isPasswordCorrect = await bcrypt.compare(senha, user.senha);
        if (!isPasswordCorrect) return res.status(401).json({ error: 'Senha incorreta.' });

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        // ✅ Envia como cookie seguro
        res
            .cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 2 * 60 * 60 * 1000 // 2 horas
            })
            .json({ message: 'Login realizado com sucesso' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao fazer login.' });
    }
};
