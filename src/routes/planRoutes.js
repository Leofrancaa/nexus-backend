import express from "express";
import {
    handleCreatePlan,
    handleGetPlans,
    handleUpdatePlan,
    handleDeletePlan,
    handleAddContribution,
} from "../controllers/planController.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authenticateToken, handleCreatePlan);
router.post("/:id/contribute", authenticateToken, handleAddContribution);
router.get("/", authenticateToken, handleGetPlans);
router.put("/:id", authenticateToken, handleUpdatePlan);
router.delete("/:id", authenticateToken, handleDeletePlan);

export default router;
