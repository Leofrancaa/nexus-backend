import { Request, Response, NextFunction } from 'express'
import { CardService } from '../services/cardService'
import {
    AuthenticatedRequest,
    CreateCardRequest,
    ApiError
} from '../types/index'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber,
    isPositiveNumber,
    isValidHexColor
} from '../utils/helper'

/**
 * POST /api/cards - Criar cartão
 */
export const createCard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const cardData: CreateCardRequest = req.body

        console.log('[CardController.createCard] Dados recebidos do cliente:', {
            body: req.body,
            userId
        })

        // Validações básicas
        if (!cardData.nome || !cardData.tipo || !cardData.numero) {
            console.log('[CardController.createCard] Validação falhou - campos obrigatórios faltando')
            sendErrorResponse(res, 'Nome, tipo e número são obrigatórios.', 400)
            return
        }

        // Validar tipo (aceitar com ou sem acento)
        const tiposValidos = ['crédito', 'débito', 'credito', 'debito']
        if (!tiposValidos.includes(cardData.tipo)) {
            sendErrorResponse(res, 'Tipo deve ser "crédito" ou "débito".', 400)
            return
        }

        // Normalizar tipo para formato com acento
        const tipoNormalizado = cardData.tipo === 'credito' ? 'crédito' :
                               cardData.tipo === 'debito' ? 'débito' :
                               cardData.tipo

        // Para cartão de crédito, validar campos obrigatórios
        if (tipoNormalizado === 'crédito') {
            if (!cardData.limite) {
                sendErrorResponse(res, 'Limite é obrigatório para cartões de crédito.', 400)
                return
            }

            if (!isPositiveNumber(cardData.limite)) {
                sendErrorResponse(res, 'Limite deve ser um número positivo.', 400)
                return
            }

            if (!cardData.dia_vencimento) {
                sendErrorResponse(res, 'Dia de vencimento é obrigatório para cartões de crédito.', 400)
                return
            }
        } else {
            // Para cartão de débito, definir limite padrão como 0
            cardData.limite = 0
        }

        if (cardData.cor && !isValidHexColor(cardData.cor)) {
            sendErrorResponse(res, 'Cor deve estar no formato hexadecimal válido.', 400)
            return
        }

        // Atualizar tipo normalizado no cardData
        cardData.tipo = tipoNormalizado

        console.log('[CardController.createCard] Chamando CardService com:', {
            cardData,
            userId
        })

        const result = await CardService.createCard(cardData, userId)

        console.log('[CardController.createCard] Cartão criado com sucesso:', result)

        sendSuccessResponse(res, result, 'Cartão criado com sucesso.', 201)
    } catch (error) {
        console.error('[CardController.createCard] ERRO:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar cartão.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/cards - Buscar cartões do usuário
 */
export const getCards = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const cards = await CardService.getCardsByUser(userId)
        sendSuccessResponse(res, cards, 'Cartões recuperados com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar cartões:', error)
        sendErrorResponse(res, 'Erro ao buscar cartões.', 500, error)
    }
}

/**
 * GET /api/cards/:id - Buscar cartão por ID
 */
export const getCard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const cardId = toNumber(req.params.id)

        if (!cardId) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        const card = await CardService.getCardById(cardId, userId)
        if (!card) {
            sendErrorResponse(res, 'Cartão não encontrado.', 404)
            return
        }

        sendSuccessResponse(res, card, 'Cartão recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar cartão:', error)
        sendErrorResponse(res, 'Erro ao buscar cartão.', 500, error)
    }
}

/**
 * PUT /api/cards/:id - Atualizar cartão
 */
export const updateCard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const cardId = toNumber(req.params.id)
        const updateData: Partial<CreateCardRequest> = req.body

        if (!cardId) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        // Validar campos se fornecidos
        if (updateData.limite !== undefined && !isPositiveNumber(updateData.limite)) {
            sendErrorResponse(res, 'Limite deve ser um número positivo.', 400)
            return
        }

        if (updateData.cor && !isValidHexColor(updateData.cor)) {
            sendErrorResponse(res, 'Cor deve estar no formato hexadecimal válido.', 400)
            return
        }

        const updatedCard = await CardService.updateCard(cardId, updateData, userId)
        sendSuccessResponse(res, updatedCard, 'Cartão atualizado com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar cartão:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar cartão.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/cards/:id - Deletar cartão
 */
export const deleteCard = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const cardId = toNumber(req.params.id)

        if (!cardId) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        const result = await CardService.deleteCard(cardId, userId)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao deletar cartão:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar cartão.',
            apiError.status || 500,
            apiError
        )
    }
}