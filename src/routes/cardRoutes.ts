import { Router } from 'express'
import {
    createCard,
    getCards,
    getCard,
    updateCard,
    deleteCard
} from '../controllers/cardController.js'
import {
    payInvoice,
    getAvailableInvoices,
    getPaymentHistory,
    cancelInvoicePayment,
    canPayInvoice
} from '../controllers/cardInvoiceController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/cards - Criar cartão
router.post('/', createCard)

// GET /api/cards - Buscar cartões do usuário
router.get('/', getCards)

// GET /api/cards/:id - Buscar cartão por ID
router.get('/:id', getCard)

// PUT /api/cards/:id - Atualizar cartão
router.put('/:id', updateCard)

// DELETE /api/cards/:id - Deletar cartão
router.delete('/:id', deleteCard)

// === Rotas de Faturas ===

// POST /api/cards/:id/pay-invoice - Pagar fatura
router.post('/:id/pay-invoice', payInvoice)

// GET /api/cards/:id/invoices - Listar faturas disponíveis
router.get('/:id/invoices', getAvailableInvoices)

// GET /api/cards/:id/payment-history - Histórico de pagamentos
router.get('/:id/payment-history', getPaymentHistory)

// GET /api/cards/:id/can-pay-invoice - Verificar se pode pagar fatura
router.get('/:id/can-pay-invoice', canPayInvoice)

// DELETE /api/cards/:id/cancel-payment - Cancelar pagamento
router.delete('/:id/cancel-payment', cancelInvoicePayment)

export default router