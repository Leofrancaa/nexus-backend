import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const authenticateToken = (req, res, next) => {
    // 🔍 Múltiplas formas de obter o token (importante para iOS)

    // 1. Cookie (método preferido)
    let token = req.cookies?.token

    // 2. Authorization Header (fallback)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7)
    }

    // 3. Body token (fallback para PWA iOS que pode ter problemas com cookies)
    if (!token && req.body?.token) {
        token = req.body.token
    }

    // 4. Query params (último recurso - menos seguro)
    if (!token && req.query?.token) {
        token = req.query.token
    }

    // 🚫 Se ainda não tem token
    if (!token) {
        console.log('[authMiddleware] Token não encontrado:', {
            cookies: !!req.cookies?.token,
            authorization: !!req.headers.authorization,
            userAgent: req.headers['user-agent']?.substring(0, 50),
            path: req.path
        })

        return res.status(401).json({
            error: 'Token não fornecido.',
            debug: process.env.NODE_ENV === 'development' ? {
                hasCookie: !!req.cookies?.token,
                hasAuthHeader: !!req.headers.authorization,
                userAgent: req.headers['user-agent']?.substring(0, 50)
            } : undefined
        })
    }

    // ✅ Verificar token JWT
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('[authMiddleware] Token inválido:', {
                error: err.name,
                message: err.message,
                userAgent: req.headers['user-agent']?.substring(0, 50)
            })

            return res.status(403).json({
                error: 'Token inválido.',
                debug: process.env.NODE_ENV === 'development' ? {
                    tokenError: err.name,
                    message: err.message
                } : undefined
            })
        }

        // 🔑 Token válido - adicionar user ao request
        req.user = user // { id, email }
        next()
    })
}