// video-analyzer.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializar Gemini com a chave da API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Analisa um vídeo do YouTube usando Gemini
 * @param {string} videoUrl - URL do vídeo do YouTube
 * @returns {Promise<string>} - Análise do comportamento
 */
async function analisarVideoYoutube(videoUrl) {
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash-exp"  // Modelo otimizado para vídeo
        });
        
        const prompt = `
        Você é um especialista em comportamento animal.
        Analise este vídeo de um pet e responda em português:

        1. 🐾 QUAL É O COMPORTAMENTO PRINCIPAL?
           (Dormindo / Comendo / Agitado / Brincando / Outro)

        2. 📊 DESCRIÇÃO DETALHADA:
           Descreva o que está acontecendo no vídeo.

        3. 💡 DICA PARA O DONO:
           Dê uma dica prática e útil.

        4. ⚠️ ALERTA:
           Há algum sinal de estresse, doença ou perigo?
           (Sim/Não e explique)

        Seja específico e use uma linguagem que qualquer dono de pet entenda.
        `;

        // Gemini analisa o vídeo diretamente da URL
        const result = await model.generateContent([
            prompt,
            { mimeType: "video/mp4", data: videoUrl }
        ]);

        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error("Erro na análise do vídeo:", error);
        throw new Error(`Falha na análise: ${error.message}`);
    }
}

/**
 * Analisa vídeos em lote e monta base de conhecimento
 * @param {string[]} videoUrls - Lista de URLs
 * @returns {Promise<Object[]>} - Resultados com classificação
 */
async function analisarLoteVideos(videoUrls) {
    const resultados = [];
    
    for (const url of videoUrls) {
        try {
            const analise = await analisarVideoYoutube(url);
            
            // Extrair classificação da análise
            const classificacao = extrairClassificacao(analise);
            
            resultados.push({
                videoUrl: url,
                analise: analise,
                comportamento: classificacao.comportamento,
                alerta: classificacao.alerta,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`Erro no vídeo ${url}:`, error);
            resultados.push({
                videoUrl: url,
                erro: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    return resultados;
}

/**
 * Extrai classificação da análise
 */
function extrairClassificacao(analise) {
    // Procura por padrões na análise
    const comportamentos = ['dormindo', 'comendo', 'agitado', 'brincando'];
    let comportamento = 'desconhecido';
    
    for (const item of comportamentos) {
        if (analise.toLowerCase().includes(item)) {
            comportamento = item;
            break;
        }
    }
    
    const alerta = analise.toLowerCase().includes('alerta') || 
                   analise.toLowerCase().includes('perigo') ||
                   analise.toLowerCase().includes('estresse') ||
                   analise.toLowerCase().includes('doença');
    
    return { comportamento, alerta: alerta ? 'ALERT!' : 'All Clear' };
}

module.exports = {
    analisarVideoYoutube,
    analisarLoteVideos
};