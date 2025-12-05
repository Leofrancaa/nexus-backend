// src/routes/inviteCodeRoutes.ts
import { Router } from 'express';
import {
    createInviteCode,
    validateInviteCode,
    listInviteCodes,
    deleteInviteCode
} from '../controllers/inviteCodeController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { isAdmin } from '../middlewares/adminMiddleware';

const router = Router();

// POST /invite-codes - Criar novo código (protegido - somente admin)
router.post('/', authenticateToken, isAdmin, createInviteCode);

// POST /invite-codes/validate - Validar código (público - para o formulário de registro)
router.post('/validate', validateInviteCode);

// GET /invite-codes - Listar códigos (protegido - somente admin)
router.get('/', authenticateToken, isAdmin, listInviteCodes);

// DELETE /invite-codes/:id - Deletar código não usado (protegido - somente admin)
router.delete('/:id', authenticateToken, isAdmin, deleteInviteCode);

export default router;
