import { Router } from 'express'
import {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    getCategoryStats
} from '../controllers/categoryController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/categories - Criar categoria
router.post('/', createCategory)

// GET /api/categories - Buscar categorias (com filtros opcionais)
router.get('/', getCategories)

// GET /api/categories/stats - Estatísticas de categorias
router.get('/stats', getCategoryStats)

// GET /api/categories/:id - Buscar categoria por ID
router.get('/:id', getCategory)

// PUT /api/categories/:id - Atualizar categoria
router.put('/:id', updateCategory)

// DELETE /api/categories/:id - Deletar categoria
router.delete('/:id', deleteCategory)

export default router