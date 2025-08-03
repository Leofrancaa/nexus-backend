import express from 'express';
import {
    createExpense,
    getExpenses,
    getExpensesByMonth,
    updateExpense,
    deleteExpense,
    getExpenseHistory,
    getTotalByCategoria,
    getTotalExpensesMonth,
    getExpenseStats,
    getResumoCategorias
} from '../controllers/expenseController.js';

import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, createExpense);
router.get('/', authenticateToken, getExpenses);
router.get('/despesas/mes', authenticateToken, getExpensesByMonth); // ✅ nova rota
router.get('/history/:id', authenticateToken, getExpenseHistory);
router.get('/total-by-category/:categoryId', authenticateToken, getTotalByCategoria);
router.get('/despesas/total', authenticateToken, getTotalExpensesMonth);
router.get('/stats', authenticateToken, getExpenseStats);
router.get("/resumo-categorias", authenticateToken, getResumoCategorias);
router.put('/:id', authenticateToken, updateExpense);
router.delete('/:id', authenticateToken, deleteExpense);

export default router;
