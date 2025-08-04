import express from "express";
import {
    createIncome,
    getIncomes,
    getIncomesByMonth,
    updateIncome,
    deleteIncome,
    getIncomeStats,
    getResumoCategorias,
    getTotalByCategoria,
    getTotalIncomesMonth,
} from "../controllers/incomeController.js";

import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, createIncome);
router.get("/", authenticateToken, getIncomes);
router.get("/receitas/mes", authenticateToken, getIncomesByMonth); // ✅ nova rota
router.get("/stats", authenticateToken, getIncomeStats);
router.get("/resumo-categorias", authenticateToken, getResumoCategorias);
router.get("/receitas/total", authenticateToken, getTotalIncomesMonth);
router.get("/total-by-category/:categoryId", authenticateToken, getTotalByCategoria);
router.put("/:id", authenticateToken, updateIncome);
router.delete("/:id", authenticateToken, deleteIncome);

export default router;
