import { getFinanceData } from '../services/financeService.js';

export const fetchMarketData = async (req, res) => {
    try {
        const data = await getFinanceData();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar dados do mercado.' });
    }
};
