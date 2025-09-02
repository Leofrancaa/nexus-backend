import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

export const authenticateToken = (req, res, next) => {
    // 🔍 Múltiplas formas de obter o token (ORDEM ATUALIZADA PARA iOS)

    let token = null;

    // 1. Authorization Header (PRIORIDADE PARA iOS)
    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.slice(7);
    }

    // 2. Cookie (fallback)
    if (!token) {
        token = req.cookies?.token;
    }

    // 3. Body token (fallback adicional)
    if (!token && req.body?.token) {
        token = req.body.token;
    }

    // 4. Query params (último recurso)
    if (!token && req.query?.token) {
        token = req.query.token;
    }

    // 🚫 Se ainda não tem token
    if (!token) {
        console.log('[authMiddleware] Token não encontrado:', {
            hasAuthHeader: !!req.headers.authorization,
            cookies: !!req.cookies?.token,
            userAgent: req.headers['user-agent']?.substring(0, 50),
            path: req.path
        });

        return res.status(401).json({
            error: 'Token não fornecido.',
            debug: process.env.NODE_ENV === 'development' ? {
                hasAuthHeader: !!req.headers.authorization,
                hasCookie: !!req.cookies?.token,
                userAgent: req.headers['user-agent']?.substring(0, 50)
            } : undefined
        });
    }

    // ✅ Verificar token JWT
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('[authMiddleware] Token inválido:', {
                error: err.name,
                message: err.message,
                userAgent: req.headers['user-agent']?.substring(0, 50)
            });

            return res.status(403).json({
                error: 'Token inválido.',
                debug: process.env.NODE_ENV === 'development' ? {
                    tokenError: err.name,
                    message: err.message
                } : undefined
            });
        }

        // 🔑 Token válido
        req.user = user;
        next();
    });
};