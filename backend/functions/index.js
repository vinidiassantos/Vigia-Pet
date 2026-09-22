// backend/functions/index.js
// ============================================
// VIGIA PET - CLOUD FUNCTIONS COM GEMINI
// ============================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '.env') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
console.log('🔑 GEMINI_API_KEY carregada:', GEMINI_KEY ? '✅ Sim' : '❌ Não');

if (!GEMINI_KEY) {
    console.error('❌ ERRO: Chave do Gemini não encontrada no .env');
}

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// ============================================
// MODELOS EM ORDEM DE PREFERÊNCIA
// (com Gemini Plus, priorizar modelos Pro)
// ============================================
const MODELOS_DISPONIVEIS = [
    "gemini-2.5-pro",        // Melhor qualidade (Plus)
    "gemini-2.5-flash",      // Rápido e capaz
    "gemini-flash-latest",   // Sempre atualizado
    "gemini-pro-latest"      // Sempre atualizado
];

// ============================================
// FUNÇÃO DE ESPERA
// ============================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// ANÁLISE COM RETRY E FALLBACK
// ============================================
async function analisarComFallback(prompt, videoUrl) {
    let ultimoErro = null;
    const MAX_TENTATIVAS = 3;

    for (const nomeModelo of MODELOS_DISPONIVEIS) {
        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            try {
                console.log(`🔄 Tentando modelo: ${nomeModelo} (tentativa ${tentativa}/${MAX_TENTATIVAS})`);
                
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
                console.warn(`⚠️ Tentativa ${tentativa} falhou: ${error.message}`);
                ultimoErro = error;
                
                // Erro 503 - Alta demanda
                if (error.message.includes('503') || error.message.includes('high demand')) {
                    if (tentativa < MAX_TENTATIVAS) {
                        console.log(`⏳ Aguardando 5s...`);
                        await sleep(5000);
                    }
                    continue;
                }
                
                // Erro 429 - Cota excedida
                if (error.message.includes('429') || error.message.includes('quota')) {
                    if (tentativa < MAX_TENTATIVAS) {
                        console.log(`⏳ Aguardando 30s por cota...`);
                        await sleep(30000);
                    }
                    continue;
                }
                
                // Erro 404 - Modelo não disponível, tenta próximo
                if (error.message.includes('404') || error.message.includes('not available')) {
                    break;
                }
                
                // Outros erros - lança
                throw error;
            }
        }
    }

    throw new Error(`Todos os modelos falharam. Último erro: ${ultimoErro.message}`);
}

// ============================================
// CLOUD FUNCTION: ANALISAR VÍDEO
// ============================================
exports.analisarVideo = functions.https.onCall(async (data, context) => {
    console.log('📥 Função analisarVideo chamada');
    
    const { videoUrl, modoTeste } = data;
    
    if (!videoUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'URL do vídeo é obrigatória');
    }

    // Modo de teste (rápido)
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

    try {
        console.log('🎯 Analisando vídeo:', videoUrl);
        
        const prompt = `
Você é um especialista em comportamento animal, com foco em cães e gatos.
Analise este vídeo de um pet e responda em português brasileiro:

1. 🐾 COMPORTAMENTO PRINCIPAL:
   Escolha UMA das opções: Dormindo / Comendo / Agitado / Brincando / Bravo / Outro

2. 📊 DESCRIÇÃO DETALHADA:
   Descreva o que está acontecendo no vídeo de forma clara.

3. 💡 DICA PARA O DONO:
   Dê uma dica prática e útil baseada no comportamento observado.

4. ⚠️ ALERTA:
   Há algum sinal de estresse, doença, dor ou perigo? (Sim/Não)
   Se sim, explique o que você observou.

Responda de forma organizada, com títulos para cada seção.
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
// CLOUD FUNCTION: LISTAR ANÁLISES
// ============================================
exports.listarAnalises = functions.https.onCall(async (data, context) => {
    try {
        const snapshot = await db.collection('analises')
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        const analises = [];
        snapshot.forEach(doc => {
            analises.push({ id: doc.id, ...doc.data() });
        });
        
        return { success: true, analises };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

console.log('✅ Functions carregadas: analisarVideo, teste, listarAnalises');