import { pool } from '../database/index'
import { QueryResult } from 'pg'
import { createErrorResponse } from '../utils/helper'

type SupportedCurrency = 'BRL' | 'USD' | 'EUR' | 'GBP'

interface CurrencyInfo {
    code: SupportedCurrency
    name: string
    symbol: string
    decimal_places: number
    is_default: boolean
}

export class CurrencyService {
    private static readonly SUPPORTED_CURRENCIES: CurrencyInfo[] = [
        {
            code: 'BRL',
            name: 'Real Brasileiro',
            symbol: 'R$',
            decimal_places: 2,
            is_default: true
        },
        {
            code: 'USD',
            name: 'Dólar Americano',
            symbol: '$',
            decimal_places: 2,
            is_default: false
        },
        {
            code: 'EUR',
            name: 'Euro',
            symbol: '€',
            decimal_places: 2,
            is_default: false
        },
        {
            code: 'GBP',
            name: 'Libra Esterlina',
            symbol: '£',
            decimal_places: 2,
            is_default: false
        }
    ]

    /**
     * Atualiza a moeda do usuário
     */
    static async updateUserCurrency(
        userId: number,
        currency: SupportedCurrency
    ): Promise<{ message: string; currency: SupportedCurrency }> {
        // Validar se a moeda é suportada
        const isSupported = this.SUPPORTED_CURRENCIES.some(c => c.code === currency)
        if (!isSupported) {
            throw createErrorResponse(
                `Moeda '${currency}' não suportada. Moedas disponíveis: ${this.SUPPORTED_CURRENCIES.map(c => c.code).join(', ')}`,
                400
            )
        }

        await pool.query(
            'UPDATE users SET currency = $1, updated_at = NOW() WHERE id = $2',
            [currency, userId]
        )

        return {
            message: `Moeda atualizada para ${currency} com sucesso.`,
            currency
        }
    }

    /**
     * Busca a moeda atual do usuário
     */
    static async getUserCurrency(userId: number): Promise<{
        currency: SupportedCurrency
        currency_info: CurrencyInfo
    }> {
        const result: QueryResult<{ currency: string }> = await pool.query(
            'SELECT currency FROM users WHERE id = $1',
            [userId]
        )

        const userCurrency = (result.rows[0]?.currency || 'BRL') as SupportedCurrency
        const currencyInfo = this.SUPPORTED_CURRENCIES.find(c => c.code === userCurrency) || this.SUPPORTED_CURRENCIES[0]

        return {
            currency: userCurrency,
            currency_info: currencyInfo
        }
    }

    /**
     * Lista todas as moedas suportadas
     */
    static getSupportedCurrencies(): CurrencyInfo[] {
        return [...this.SUPPORTED_CURRENCIES]
    }

    /**
     * Busca informações de uma moeda específica
     */
    static getCurrencyInfo(currency: SupportedCurrency): CurrencyInfo | null {
        return this.SUPPORTED_CURRENCIES.find(c => c.code === currency) || null
    }

    /**
     * Formata um valor monetário de acordo com a moeda
     */
    static formatCurrency(
        value: number,
        currency: SupportedCurrency,
        locale: string = 'pt-BR'
    ): string {
        const currencyInfo = this.getCurrencyInfo(currency)
        if (!currencyInfo) {
            return value.toString()
        }

        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: currencyInfo.decimal_places,
                maximumFractionDigits: currencyInfo.decimal_places
            }).format(value)
        } catch (error) {
            // Fallback manual se Intl.NumberFormat falhar
            return `${currencyInfo.symbol} ${value.toFixed(currencyInfo.decimal_places)}`
        }
    }

    /**
     * Converte valores entre moedas (simulado - em produção integraria com API de câmbio)
     */
    static async convertCurrency(
        amount: number,
        fromCurrency: SupportedCurrency,
        toCurrency: SupportedCurrency
    ): Promise<{
        original_amount: number
        original_currency: SupportedCurrency
        converted_amount: number
        converted_currency: SupportedCurrency
        exchange_rate: number
        conversion_date: string
    }> {
        if (fromCurrency === toCurrency) {
            return {
                original_amount: amount,
                original_currency: fromCurrency,
                converted_amount: amount,
                converted_currency: toCurrency,
                exchange_rate: 1,
                conversion_date: new Date().toISOString()
            }
        }

        // Taxas de câmbio simuladas (em produção viria de uma API como exchangerate-api.com)
        const exchangeRates: Record<string, number> = {
            'BRL-USD': 0.20,   // 1 BRL = 0.20 USD
            'USD-BRL': 5.00,   // 1 USD = 5.00 BRL
            'BRL-EUR': 0.18,   // 1 BRL = 0.18 EUR
            'EUR-BRL': 5.55,   // 1 EUR = 5.55 BRL
            'BRL-GBP': 0.16,   // 1 BRL = 0.16 GBP
            'GBP-BRL': 6.25,   // 1 GBP = 6.25 BRL
            'USD-EUR': 0.92,   // 1 USD = 0.92 EUR
            'EUR-USD': 1.09,   // 1 EUR = 1.09 USD
            'USD-GBP': 0.82,   // 1 USD = 0.82 GBP
            'GBP-USD': 1.22,   // 1 GBP = 1.22 USD
            'EUR-GBP': 0.86,   // 1 EUR = 0.86 GBP
            'GBP-EUR': 1.16,   // 1 GBP = 1.16 EUR
        }

        const rateKey = `${fromCurrency}-${toCurrency}`
        const exchangeRate = exchangeRates[rateKey]

        if (!exchangeRate) {
            throw createErrorResponse(
                `Taxa de câmbio não disponível para conversão de ${fromCurrency} para ${toCurrency}`,
                400
            )
        }

        const convertedAmount = amount * exchangeRate

        return {
            original_amount: amount,
            original_currency: fromCurrency,
            converted_amount: Math.round(convertedAmount * 100) / 100, // Arredondar para 2 casas decimais
            converted_currency: toCurrency,
            exchange_rate: exchangeRate,
            conversion_date: new Date().toISOString()
        }
    }

    /**
     * Busca estatísticas de gastos do usuário formatadas na moeda dele
     */
    static async getUserFinancialSummary(userId: number): Promise<{
        currency: SupportedCurrency
        total_income: string
        total_expenses: string
        current_balance: string
        this_month_income: string
        this_month_expenses: string
        this_month_balance: string
    }> {
        const { currency } = await this.getUserCurrency(userId)

        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        const result = await pool.query(
            `SELECT 
        COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = $1), 0) as total_income,
        COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = $1), 0) as total_expenses,
        COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3), 0) as month_income,
        COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3), 0) as month_expenses`,
            [userId, currentMonth, currentYear]
        )

        const data = result.rows[0]
        const totalIncome = Number(data.total_income)
        const totalExpenses = Number(data.total_expenses)
        const monthIncome = Number(data.month_income)
        const monthExpenses = Number(data.month_expenses)

        return {
            currency,
            total_income: this.formatCurrency(totalIncome, currency),
            total_expenses: this.formatCurrency(totalExpenses, currency),
            current_balance: this.formatCurrency(totalIncome - totalExpenses, currency),
            this_month_income: this.formatCurrency(monthIncome, currency),
            this_month_expenses: this.formatCurrency(monthExpenses, currency),
            this_month_balance: this.formatCurrency(monthIncome - monthExpenses, currency)
        }
    }
}