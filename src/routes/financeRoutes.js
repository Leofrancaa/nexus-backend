import express from 'express';
import { fetchMarketData } from '../controllers/financeController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/market', authenticateToken, fetchMarketData);

export default router;
