import express from 'express'
import {
  createThreshold,
  getThresholds,
  updateThreshold,
  deleteThreshold
} from '../controllers/thresholdController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createThreshold)
router.get('/', authenticateToken, getThresholds)
router.put('/:id', authenticateToken, updateThreshold)
router.delete('/:id', authenticateToken, deleteThreshold)

export default router
