import { Request, Response, NextFunction } from 'express'
import { CategoryService } from '../services/categoryService.js'
import {
    AuthenticatedRequest,
    CreateCategoryRequest,
    ApiError
} from '../types/index.js'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber
} from '../utils/helper.js'

/**
 * POST /api/categories - Criar categoria
 */
export const createCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const categoryData: CreateCategoryRequest = req.body

        const result = await CategoryService.createCategory(categoryData, userId)
        sendSuccessResponse(res, result, 'Categoria criada com sucesso.', 201)
    } catch (error) {
        console.error('Erro ao criar categoria:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar categoria.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/categories - Buscar categorias
 */
export const getCategories = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { tipo, tree } = req.query

        // Validar tipo se fornecido
        if (tipo && tipo !== 'despesa' && tipo !== 'receita') {
            sendErrorResponse(res, 'Tipo deve ser "despesa" ou "receita".', 400)
            return
        }

        // Se solicitou árvore hierárquica
        if (tree === 'true') {
            const categories = await CategoryService.getCategoryTree(
                userId,
                tipo as 'despesa' | 'receita' | undefined
            )
            sendSuccessResponse(res, categories, 'Árvore de categorias recuperada com sucesso.')
            return
        }

        // Lista simples
        const categories = await CategoryService.getCategoriesByUser(
            userId,
            tipo as 'despesa' | 'receita' | undefined
        )
        sendSuccessResponse(res, categories, 'Categorias recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar categorias:', error)
        sendErrorResponse(res, 'Erro ao buscar categorias.', 500, error)
    }
}

/**
 * GET /api/categories/:id - Buscar categoria por ID
 */
export const getCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const categoryId = toNumber(req.params.id)

        if (!categoryId) {
            sendErrorResponse(res, 'ID da categoria inválido.', 400)
            return
        }

        const category = await CategoryService.getCategoryById(categoryId, userId)
        if (!category) {
            sendErrorResponse(res, 'Categoria não encontrada.', 404)
            return
        }

        sendSuccessResponse(res, category, 'Categoria recuperada com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar categoria:', error)
        sendErrorResponse(res, 'Erro ao buscar categoria.', 500, error)
    }
}

/**
 * PUT /api/categories/:id - Atualizar categoria
 */
export const updateCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const categoryId = toNumber(req.params.id)
        const updateData: Partial<CreateCategoryRequest> = req.body

        if (!categoryId) {
            sendErrorResponse(res, 'ID da categoria inválido.', 400)
            return
        }

        const updatedCategory = await CategoryService.updateCategory(categoryId, updateData, userId)
        sendSuccessResponse(res, updatedCategory, 'Categoria atualizada com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar categoria.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/categories/:id - Deletar categoria
 */
export const deleteCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const categoryId = toNumber(req.params.id)

        if (!categoryId) {
            sendErrorResponse(res, 'ID da categoria inválido.', 400)
            return
        }

        const result = await CategoryService.deleteCategory(categoryId, userId)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao deletar categoria:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar categoria.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/categories/stats - Estatísticas de uso das categorias
 */
export const getCategoryStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const stats = await CategoryService.getCategoryStats(userId)
        sendSuccessResponse(res, stats, 'Estatísticas de categorias recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas de categorias:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas de categorias.', 500, error)
    }
}