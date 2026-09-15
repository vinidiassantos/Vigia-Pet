// backend/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

// ============================================
// CARREGAR VARIÁVEIS DE AMBIENTE
// ============================================
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('🔑 GEMINI_API_KEY carregada:', process.env.GEMINI_API_KEY ? '✅ Sim' : '❌ Não');

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERRO: Chave do Gemini não encontrada!');
    console.log('📁 Verifique o arquivo .env em:', path.resolve(__dirname, '.env'));
}

// ============================================
// INICIALIZAR FIREBASE ADMIN
// ============================================
admin.initializeApp();
const db = admin.firestore();

// ============================================
// INICIALIZAR GEMINI
// ============================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ============================================
// LISTA DE MODELOS PARA FALLBACK
// ============================================
const MODELOS_DISPONIVEIS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
];

// ============================================
// FUNÇÃO AUXILIAR: ANALISAR COM FALLBACK
// ============================================
async function analisarComFallback(prompt, videoUrl) {
    let ultimoErro = null;

    for (const nomeModelo of MODELOS_DISPONIVEIS) {
        try {
            console.log(`🔄 Tentando modelo: ${nomeModelo}`);
            
            const model = genAI.getGenerativeModel({ model: nomeModelo });
            
            const result = await model.generateContent([
                prompt,
                {
                    fileData: {
                        mimeType: "video/mp4",
                        fileUri: videoUrl
                    }
                }
            ]);

            const response = await result.response;
            const texto = response.text();
            
            console.log(`✅ Sucesso com modelo: ${nomeModelo}`);
            return { texto, modelo: nomeModelo };

        } catch (error) {
            console.warn(`⚠️ Modelo ${nomeModelo} falhou: ${error.message}`);
            ultimoErro = error;
            
            // Se for erro de modelo indisponível, tenta o próximo
            if (error.message.includes('503') || 
                error.message.includes('404') || 
                error.message.includes('not available') ||
                error.message.includes('high demand')) {
                continue;
            }
            
            // Se for outro tipo de erro, lança imediatamente
            throw error;
        }
    }

    // Se nenhum modelo funcionou
    throw new Error(`Nenhum modelo disponível. Último erro: ${ultimoErro.message}`);
}

// ============================================
// CLOUD FUNCTION: ANALISAR VÍDEO
// ============================================
exports.analisarVideo = functions.https.onCall(async (data, context) => {
    console.log('📥 Função analisarVideo chamada');
    console.log('📦 Dados recebidos:', JSON.stringify(data));
    
    const { videoUrl, modoTeste } = data;
    
    if (!videoUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'URL do vídeo é obrigatória');
    }

    // ============================================
    // MODO DE TESTE: Retorna resposta rápida
    // ============================================
    if (modoTeste === true) {
        console.log('🧪 Modo de teste ativado');
        return {
            success: true,
            message: "Modo de teste - resposta simulada",
            analise: `🐾 ANÁLISE SIMULADA\n\nURL: ${videoUrl}\n\nComportamento: Comendo\nConfiança: 95%\n\nDica: Mantenha água fresca por perto.`,
            modelo: "teste",
            id: "teste-123"
        };
    }

    // ============================================
    // ANÁLISE REAL COM GEMINI
    // ============================================
    try {
        console.log('🎯 Analisando vídeo:', videoUrl);
        
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

        const { texto, modelo } = await analisarComFallback(prompt, videoUrl);
        
        // Salvar no Firestore
        let docId = null;
        try {
            const docRef = await db.collection('analises').add({
                videoUrl: videoUrl,
                analise: texto,
                modeloUsado: modelo,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            docId = docRef.id;
            console.log('💾 Análise salva no Firestore:', docId);
        } catch (dbError) {
            console.warn('⚠️ Erro ao salvar no Firestore:', dbError.message);
        }
        
        return {
            success: true,
            message: `Análise concluída (modelo: ${modelo})`,
            analise: texto,
            modelo: modelo,
            id: docId
        };

    } catch (error) {
        console.error('❌ Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// ============================================
// CLOUD FUNCTION: TESTE (DIAGNÓSTICO)
// ============================================
exports.teste = functions.https.onCall(async (data, context) => {
    console.log('📥 Função teste chamada');
    return {
        success: true,
        message: "Função de teste funcionando!",
        timestamp: new Date().toISOString()
    };
});

// ============================================
// CLOUD FUNCTION: PROCESSAR LOTE DE VÍDEOS
// ============================================
exports.processarLoteVideos = functions.https.onCall(async (data, context) => {
    console.log('📥 Função processarLoteVideos chamada');
    
    const { videoUrls } = data;
    if (!videoUrls || !Array.isArray(videoUrls)) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de URLs inválida');
    }

    const resultados = [];
    
    for (const url of videoUrls) {
        try {
            const prompt = `
            Analise este vídeo de pet e responda:
            1. Comportamento principal (Dormindo / Comendo / Agitado / Brincando / Outro)
            2. Descrição detalhada
            3. Dica para o dono
            `;
            
            const { texto, modelo } = await analisarComFallback(prompt, url);
            
            resultados.push({
                videoUrl: url,
                analise: texto,
                modelo: modelo,
                sucesso: true
            });
        } catch (error) {
            resultados.push({
                videoUrl: url,
                erro: error.message,
                sucesso: false
            });
        }
    }
    
    return {
        success: true,
        total: resultados.length,
        resultados: resultados
    };
});

// ============================================
// LOG FINAL
// ============================================
console.log('✅ Functions carregadas!');
console.log('📋 Funções disponíveis: analisarVideo, teste, processarLoteVideos');