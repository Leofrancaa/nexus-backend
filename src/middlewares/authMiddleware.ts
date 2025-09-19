import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { AuthUser, AuthenticatedRequest } from '../types/index.js'

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_inseguro'

interface JWTPayload {
    id: number
    email: string
    iat: number
    exp: number
}

export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Apenas Authorization Header com Bearer token
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                error: 'Token de autorização não fornecido. Use: Authorization: Bearer <token>'
            })
            return
        }

        const token = authHeader.slice(7) // Remove 'Bearer '

        if (!token) {
            res.status(401).json({
                error: 'Token não fornecido no header Authorization.'
            })
            return
        }

        // Verificar token JWT
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                console.log('[authMiddleware] Token inválido:', {
                    error: err.name,
                    message: err.message,
                    userAgent: req.headers['user-agent']?.substring(0, 50)
                })

                res.status(403).json({
                    error: 'Token inválido ou expirado.'
                })
                return
            }

            // Type assertion para o payload do JWT
            const payload = decoded as JWTPayload

            // Adicionar user ao request
            const authUser: AuthUser = {
                id: payload.id,
                email: payload.email
            }

                // Extender o objeto Request com o usuário autenticado
                ; (req as AuthenticatedRequest).user = authUser

            next()
        })
    } catch (error) {
        console.error('[authMiddleware] Erro inesperado:', error)
        res.status(500).json({
            error: 'Erro interno do servidor durante autenticação.'
        })
    }
}