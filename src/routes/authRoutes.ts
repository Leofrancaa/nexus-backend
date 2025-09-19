import { Router } from 'express'
import { registerUser, loginUser, logoutUser } from '../controllers/authController.js'

const router = Router()

// POST /auth/register - Registrar novo usuário
router.post('/register', registerUser)

// POST /auth/login - Login do usuário
router.post('/login', loginUser)

// POST /auth/logout - Logout do usuário (opcional, já que é stateless)
router.post('/logout', logoutUser)

export default router