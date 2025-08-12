import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const authenticateToken = (req, res, next) => {
    // prioriza cookie; se não houver, tenta Authorization: Bearer xxx
    const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null

    const token = req.cookies?.token || bearer
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido.' })
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido.' })
        req.user = user // { id, email }
        next()
    })
}
