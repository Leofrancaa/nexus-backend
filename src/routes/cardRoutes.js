import express from 'express'
import {
    createCard,
    getCards,
    updateCard,
    deleteCard
} from '../controllers/cardController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createCard)
router.get('/', authenticateToken, getCards)
router.put('/:id', authenticateToken, updateCard)
router.delete('/:id', authenticateToken, deleteCard)

export default router
