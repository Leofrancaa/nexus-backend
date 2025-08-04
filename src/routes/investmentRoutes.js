import express from 'express';
import {
    createInvestment,
    getInvestments,
    getInvestmentStats,
} from '../controllers/investmentController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/stats', authenticateToken, getInvestmentStats);
router.post('/', authenticateToken, createInvestment);
router.get('/', authenticateToken, getInvestments);

export default router;
