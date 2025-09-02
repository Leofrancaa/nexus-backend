import express from 'express'
import { registerUser, loginUser, forgotPassword, performReset } from '../controllers/authController.js'

const router = express.Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/forgot', forgotPassword);
router.post('/reset', performReset);

export default router




