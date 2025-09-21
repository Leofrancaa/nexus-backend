import { Pool, PoolConfig } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20, // máximo de conexões no pool
    idleTimeoutMillis: 30000, // tempo limite para conexões ociosas
    connectionTimeoutMillis: 10000, // tempo limite para estabelecer conexão
}

export const pool = new Pool(poolConfig)

// Event listeners para monitoramento
pool.on('connect', (client) => {
    console.log('🔗 Nova conexão estabelecida com o banco de dados')
})

pool.on('error', (err) => {
    console.error('❌ Erro inesperado no pool de conexões:', err)
    process.exit(-1)
})

// Função para testar a conexão
export const testConnection = async (): Promise<boolean> => {
    try {
        const client = await pool.connect()
        const result = await client.query('SELECT NOW()')
        client.release()
        console.log('✅ Conexão com banco de dados testada com sucesso:', result.rows[0].now)
        return true
    } catch (error) {
        console.error('❌ Erro ao conectar com o banco de dados:', error)
        return false
    }
}

// Função para fechar todas as conexões (útil para testes)
export const closePool = async (): Promise<void> => {
    await pool.end()
    console.log('🔚 Pool de conexões fechado')
}

export default pool