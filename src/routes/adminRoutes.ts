// src/routes/adminRoutes.ts
import { Router } from 'express';
import { listAllUsers } from '../controllers/adminController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { isAdmin } from '../middlewares/adminMiddleware';

const router = Router();

// GET /admin/users - Listar todos os usuários (protegido - somente admin)
router.get('/users', authenticateToken, isAdmin, listAllUsers);

export default router;
