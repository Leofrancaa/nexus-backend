import yahooFinance from 'yahoo-finance2';

const getSelicFromBCB = async () => {
    try {
        const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json';
        const response = await fetch(url);
        const data = await response.json();

        const selic = parseFloat(data[0]?.valor.replace(',', '.'));

        return {
            nome: 'Taxa Selic',
            preco: selic,
            variacao: null,
            moeda: '%',
        };
    } catch (err) {
        console.warn('Erro ao buscar Selic:', err.message);
        return {
            nome: 'Taxa Selic',
            preco: null,
            variacao: null,
            moeda: '%',
            erro: true,
        };
    }
};

export const getFinanceData = async () => {
    try {
        const symbols = {
            dolar: 'USDBRL=X',
            euro: 'EURBRL=X',
            bitcoin: 'BTC-USD',
            ethereum: 'ETH-USD',
            solana: 'SOL-USD',
            ibovespa: '^BVSP',
            // Remover ^SELIC por enquanto – Yahoo não fornece esse dado corretamente
            bradesco: 'BBDC4.SA',
            petrobras: 'PETR4.SA',
            vale: 'VALE3.SA',
        };

        const results = {};

        for (const [key, symbol] of Object.entries(symbols)) {
            try {
                const quote = await yahooFinance.quote(symbol);
                results[key] = {
                    nome: quote?.shortName || symbol,
                    preco: quote?.regularMarketPrice ?? null,
                    variacao: quote?.regularMarketChangePercent ?? null,
                    moeda: quote?.currency ?? null,
                };
            } catch (err) {
                console.warn(`Erro ao buscar ${symbol}:`, err.message);
                results[key] = {
                    nome: symbol,
                    preco: null,
                    variacao: null,
                    moeda: null,
                    erro: true,
                };
            }
        }

        const selicData = await getSelicFromBCB();
        results['selic'] = selicData;

        return results;
    } catch (error) {
        console.error('Erro ao buscar dados financeiros:', error);
        throw error;
    }



};

