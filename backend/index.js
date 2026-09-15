// backend/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('🔑 GEMINI_API_KEY carregada:', process.env.GEMINI_API_KEY ? '✅ Sim' : '❌ Não');

admin.initializeApp();
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lista de modelos em ordem de preferência (fallback)
const MODELOS_DISPONIVEIS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
];

/**
 * Tenta analisar o vídeo com fallback entre modelos
 */
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

exports.analisarVideo = functions.https.onCall(async (data, context) => {
    console.log('📥 Função analisarVideo chamada');
    
    const { videoUrl } = data;
    if (!videoUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'URL do vídeo é obrigatória');
    }

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
        `;

        const { texto, modelo } = await analisarComFallback(prompt, videoUrl);
        
        // Salvar no Firestore
        const docRef = await db.collection('analises').add({
            videoUrl: videoUrl,
            analise: texto,
            modeloUsado: modelo,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
            success: true,
            message: `Análise concluída (modelo: ${modelo})`,
            analise: texto,
            modelo: modelo,
            id: docRef.id
        };

    } catch (error) {
        console.error('❌ Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

console.log('✅ Functions carregadas!');