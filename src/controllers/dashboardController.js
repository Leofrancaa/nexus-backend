import { getSaldoAtual } from '../utils/finance/getSaldoAtual.js'
import { getTotaisMensais } from '../utils/finance/getTotaisMensais.js'
import { getComparativoMensal } from '../utils/finance/getComparativoMensal.js'
import { getInvestimentosTotais } from '../utils/finance/getInvestimentosTotais.js'
import { getGastosPorCategoria } from '../utils/finance/getGastosPorCategoria.js'
import { getGastosPorCartao } from '../utils/finance/getGastosPorCartao.js'
import { getSaldoFuturo } from '../utils/finance/getSaldoFuturo.js'
import { getCartoesEstourados } from '../utils/finance/getCartoesEstourados.js'
import { getResumoAnual } from '../utils/finance/getResumoAnual.js'
import { getTopCategoriasGasto } from '../utils/finance/getTopCategoriasGasto.js'
import { getParcelasPendentes } from '../utils/finance/getParcelasPendentes.js'
import { getCartoesAVencer } from '../utils/finance/getCartoesAVencer.js'


export const getDashboardData = async (req, res) => {
    const user_id = req.user.id
    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    try {
        const saldo = await getSaldoAtual(user_id)
        const totaisMensais = await getTotaisMensais(user_id, ano)
        const comparativo = await getComparativoMensal(user_id, mes, ano)
        const investimentos = await getInvestimentosTotais(user_id)
        const porCategoria = await getGastosPorCategoria(user_id, mes, ano)
        const porCartao = await getGastosPorCartao(user_id, mes, ano)
        const saldoFuturo = await getSaldoFuturo(user_id)
        const cartoesEstourados = await getCartoesEstourados(user_id)
        const resumoAnual = await getResumoAnual(user_id, ano)
        const topCategorias = await getTopCategoriasGasto(user_id, mes, ano)
        const parcelasPendentes = await getParcelasPendentes(user_id)
        const cartoesAVencer = await getCartoesAVencer(user_id, mes, ano)


        res.json({
            saldo,
            saldoFuturo,
            totaisMensais,
            resumoAnual,
            comparativo,
            investimentos,
            gastosPorCategoria: porCategoria,
            topCategorias,
            gastosPorCartao: porCartao,
            parcelasPendentes,
            cartoesEstourados,
            cartoesAVencer
        })
    } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err)
        res.status(500).json({ error: 'Erro ao carregar dados do dashboard.' })
    }
}
