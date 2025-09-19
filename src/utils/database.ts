import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'
import { pool } from '../database/index'
import { BaseQueryResult, CountResult, ExistsResult } from '../types/database'

/**
 * Wrapper tipado para queries do PostgreSQL
 */
export class DatabaseUtils {
    private static pool: Pool = pool

    /**
     * Executa uma query tipada
     */
    static async query<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<QueryResult<T>> {
        try {
            const result = await this.pool.query(text, params)
            return result
        } catch (error) {
            console.error('Database query error:', { text, params, error })
            throw error
        }
    }

    /**
     * Executa uma query com um cliente específico (para transações)
     */
    static async queryWithClient<T extends QueryResultRow>(
        client: PoolClient,
        text: string,
        params?: any[]
    ): Promise<QueryResult<T>> {
        try {
            const result = await client.query(text, params)
            return result
        } catch (error) {
            console.error('Database client query error:', { text, params, error })
            throw error
        }
    }

    /**
     * Executa múltiplas queries em uma transação
     */
    static async transaction<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.pool.connect()

        try {
            await client.query('BEGIN')
            const result = await callback(client)
            await client.query('COMMIT')
            return result
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Busca um único registro
     */
    static async findOne<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<T | null> {
        const result = await this.query<T>(text, params)
        return result.rows[0] || null
    }

    /**
     * Busca múltiplos registros
     */
    static async findMany<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<T[]> {
        const result = await this.query<T>(text, params)
        return result.rows
    }

    /**
     * Executa uma query de inserção e retorna o registro criado
     */
    static async insertOne<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<T> {
        const result = await this.query<T>(text, params)

        if (result.rows.length === 0) {
            throw new Error('Insert query did not return any rows')
        }

        return result.rows[0]
    }

    /**
     * Executa uma query de atualização e retorna o registro atualizado
     */
    static async updateOne<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<T | null> {
        const result = await this.query<T>(text, params)
        return result.rows[0] || null
    }

    /**
     * Executa uma query de exclusão e retorna o registro excluído
     */
    static async deleteOne<T extends QueryResultRow>(
        text: string,
        params?: any[]
    ): Promise<T | null> {
        const result = await this.query<T>(text, params)
        return result.rows[0] || null
    }

    /**
     * Verifica se um registro existe
     */
    static async exists(
        text: string,
        params?: any[]
    ): Promise<boolean> {
        const result = await this.query<ExistsResult>(
            `SELECT EXISTS(${text}) as exists`,
            params
        )
        return result.rows[0]?.exists || false
    }

    /**
     * Conta o número de registros
     */
    static async count(
        table: string,
        whereClause?: string,
        params?: any[]
    ): Promise<number> {
        const query = whereClause
            ? `SELECT COUNT(*) as count FROM ${table} WHERE ${whereClause}`
            : `SELECT COUNT(*) as count FROM ${table}`

        const result = await this.query<CountResult>(query, params)
        return parseInt(result.rows[0]?.count || '0', 10)
    }

    /**
     * Busca registros com paginação
     */
    static async paginate<T extends QueryResultRow>(
        text: string,
        params: any[] = [],
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: T[]; total: number; page: number; pages: number }> {
        const offset = (page - 1) * limit

        // Query para contar total de registros
        const countQuery = `SELECT COUNT(*) as count FROM (${text}) as count_query`
        const countResult = await this.query<CountResult>(countQuery, params)
        const total = parseInt(countResult.rows[0]?.count || '0', 10)

        // Query para buscar dados paginados
        const dataQuery = `${text} LIMIT ${params.length + 1} OFFSET ${params.length + 2}`
        const dataResult = await this.query<T>(dataQuery, [...params, limit, offset])

        return {
            data: dataResult.rows,
            total,
            page,
            pages: Math.ceil(total / limit)
        }
    }

    /**
     * Executa uma query de bulk insert
     */
    static async bulkInsert<T extends QueryResultRow>(
        table: string,
        columns: string[],
        values: any[][],
        conflictResolution?: string
    ): Promise<T[]> {
        if (values.length === 0) return []

        const placeholders = values
            .map((_, rowIndex) =>
                `(${columns.map((_, colIndex) => `${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
            )
            .join(', ')

        const flatValues = values.flat()
        const columnNames = columns.join(', ')

        let query = `INSERT INTO ${table} (${columnNames}) VALUES ${placeholders}`

        if (conflictResolution) {
            query += ` ${conflictResolution}`
        }

        query += ' RETURNING *'

        const result = await this.query<T>(query, flatValues)
        return result.rows
    }

    /**
     * Helper para construir cláusulas WHERE dinamicamente
     */
    static buildWhereClause(
        conditions: Record<string, any>
    ): { clause: string; params: any[] } {
        const entries = Object.entries(conditions).filter(([_, value]) => value !== undefined)

        if (entries.length === 0) {
            return { clause: '', params: [] }
        }

        const clause = entries
            .map(([key], index) => `${key} = ${index + 1}`)
            .join(' AND ')

        const params = entries.map(([_, value]) => value)

        return { clause: `WHERE ${clause}`, params }
    }

    /**
     * Helper para lidar com rowCount que pode ser null
     */
    static getRowCount(result: QueryResult<QueryResultRow>): number {
        return result.rowCount ?? 0
    }

    /**
     * Helper para verificar se uma query afetou linhas
     */
    static hasAffectedRows(result: QueryResult<QueryResultRow>): boolean {
        return (result.rowCount ?? 0) > 0
    }

    /**
     * Query simples com tipo genérico (para queries básicas)
     */
    static async queryGeneric(
        text: string,
        params?: any[]
    ): Promise<QueryResult<BaseQueryResult>> {
        try {
            const result = await this.pool.query(text, params)
            return result
        } catch (error) {
            console.error('Database query error:', { text, params, error })
            throw error
        }
    }
}

export default DatabaseUtils