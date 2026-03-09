// src/routes/balanceCarryoverRoutes.ts
import { Router } from 'express'
import {
    checkCarryover,
    applyCarryover,
    undoCarryover,
    getCarryoverHistory,
} from '../controllers/balanceCarryoverController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()
router.use(authenticateToken)

router.get('/check', checkCarryover)
router.get('/history', getCarryoverHistory)
router.post('/apply', applyCarryover)
router.delete('/', undoCarryover)

export default router
