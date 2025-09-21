// src/database/index.ts - CONFIGURAÇÃO PARA VERCEL

import { Pool } from 'pg'

// Verificar se DATABASE_URL está configurada
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set')
}

// Log para debug (remover depois)
console.log('DATABASE_URL configured:', process.env.DATABASE_URL.substring(0, 20) + '...')

// Pool configurado para Vercel (serverless)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    // Configurações específicas para serverless
    max: 1, // Máximo 1 conexão por instância serverless
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000, // 10 segundos timeout
    statement_timeout: 30000, // 30 segundos para queries
    query_timeout: 30000,
})

// Função de teste de conexão
export const testConnection = async (): Promise<boolean> => {
    try {
        console.log('Testing database connection...')
        const client = await pool.connect()
        const result = await client.query('SELECT NOW() as current_time, version() as postgres_version')
        client.release()

        console.log('✅ Database connected successfully:', {
            time: result.rows[0].current_time,
            version: result.rows[0].postgres_version.substring(0, 50) + '...'
        })

        return true
    } catch (error) {
        console.error('❌ Database connection failed:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            address: (error as any)?.address,
            port: (error as any)?.port
        })
        return false
    }
}

// Graceful shutdown para serverless
process.on('beforeExit', () => {
    console.log('Closing database pool...')
    pool.end()
})

export { pool }