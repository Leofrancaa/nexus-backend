import express from 'express';
import { getMarketData } from '../controllers/financeController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/market', authenticateToken, getMarketData);

export default router;
