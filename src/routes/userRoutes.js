// src/routes/userRoutes.js
import express from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/me", authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

export default router;
