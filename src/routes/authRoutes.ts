import { Router } from 'express'
import { registerUser, loginUser, logoutUser, changePassword, requestPasswordReset, resetPassword } from '../controllers/authController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// POST /auth/register - Registrar novo usuário
router.post('/register', registerUser)

// POST /auth/login - Login do usuário
router.post('/login', loginUser)

// POST /auth/logout - Logout do usuário (opcional, já que é stateless)
router.post('/logout', logoutUser)

// POST /auth/change-password - Alterar senha do usuário autenticado
router.post('/change-password', authenticateToken, changePassword)

// POST /auth/request-password-reset - Solicitar recuperação de senha
router.post('/request-password-reset', requestPasswordReset)

// POST /auth/reset-password - Redefinir senha com token
router.post('/reset-password', resetPassword)

export default router