import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer token

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido.' })
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido.' })

        req.user = user // inclui { id, email }
        next()
    })
}
