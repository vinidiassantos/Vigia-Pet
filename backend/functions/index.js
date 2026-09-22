// backend/functions/index.js
// ============================================
// VIGIA PET - CLOUD FUNCTIONS COM GEMINI
// ============================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ============================================
// CARREGAR VARIÁVEIS DE AMBIENTE
// ============================================
dotenv.config({ path: path.resolve(__dirname, '.env') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;
console.log('🔑 GEMINI_API_KEY carregada:', GEMINI_KEY ? '✅ Sim' : '❌ Não');

// ============================================
// INICIALIZAR FIREBASE ADMIN E GEMINI
// ============================================
admin.initializeApp();
const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

// ============================================
// MODELOS EM ORDEM DE PREFERÊNCIA
// ============================================
const MODELOS_DISPONIVEIS = [
    "gemini-2.5-pro",   // Melhor qualidade
    "gemini-2.5-flash", // Rápido e capaz
    "gemini-3.6-flash", // Estável
    "gemini-3.5-flash"  // Alternativa
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// PROCESSAMENTO DE VÍDEO VIA GEMINI FILE API
// ============================================
async function analisarComFallback(prompt, videoStoragePath) {
    let ultimoErro = null;
    
    // 1. Baixar o arquivo do Firebase Storage para o diretório temporário
    const bucket = admin.storage().bucket();
    const tempFilePath = path.join(os.tmpdir(), `pet_video_${Date.now()}.mp4`);
    console.log('📥 Baixando arquivo do Storage para temporário...');
    await bucket.file(videoStoragePath).download({ destination: tempFilePath });

    // 2. Upload para a File API do Gemini
    console.log('📤 Fazendo upload do arquivo para a File API do Gemini...');
    const uploadResult = await ai.files.upload({
        file: tempFilePath,
        mimeType: 'video/mp4',
    });

    // 3. Aguardar o processamento do vídeo no servidor do Gemini
    let fileState = await ai.files.get({ name: uploadResult.name });
    while (fileState.state === "PROCESSING") {
        console.log('⏳ Gemini processando o vídeo...');
        await sleep(3000);
        fileState = await ai.files.get({ name: uploadResult.name });
    }

    if (fileState.state === "FAILED") {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw new Error("Falha no processamento do vídeo no servidor do Gemini.");
    }

    // 4. Execução dos modelos com Fallback
    for (const nomeModelo of MODELOS_DISPONIVEIS) {
        try {
            console.log(`🔄 Tentando modelo: ${nomeModelo}`);
            
            const response = await ai.models.generateContent({
                model: nomeModelo,
                contents: [uploadResult, prompt]
            });

            // Limpeza dos arquivos temporários após o sucesso
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            await ai.files.delete({ name: uploadResult.name }).catch(() => {});

            return { texto: response.text, modelo: nomeModelo };

        } catch (error) {
            console.warn(`⚠️ Modelo ${nomeModelo} falhou: ${error.message}`);
            ultimoErro = error;
            
            if (error.message.includes('429') || error.message.includes('503')) {
                await sleep(5000);
            }
        }
    }

    // Limpeza de emergência caso tudo falhe
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    await ai.files.delete({ name: uploadResult.name }).catch(() => {});

    throw new Error(`Todos os modelos falharam. Último erro: ${ultimoErro ? ultimoErro.message : 'Desconhecido'}`);
}

// ============================================
// CLOUD FUNCTION: ANALISAR VÍDEO
// ============================================
exports.analisarVideo = functions.https.onCall(async (data, context) => {
    console.log('📥 Função analisarVideo chamada');
    
    const { videoPath, petId, modoTeste } = data;
    
    if (modoTeste === true) {
        return {
            success: true,
            message: "Modo de teste - resposta simulada",
            analise: `🐾 ANÁLISE SIMULADA\n\nComportamento: Comendo\nConfiança: 95%\n\nDica: Mantenha água fresca por perto.`,
            modelo: "teste",
            id: "teste-123"
        };
    }

    if (!videoPath) {
        throw new functions.https.HttpsError('invalid-argument', 'O caminho do vídeo (videoPath) no Firebase Storage é obrigatório.');
    }

    try {
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

        const { texto, modelo } = await analisarComFallback(prompt, videoPath);
        
        // Salvar no Firestore
        let docId = null;
        try {
            const docRef = await db.collection('analises').add({
                petId: petId || 'desconhecido',
                videoPath: videoPath,
                analise: texto,
                modeloUsado: modelo,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
            docId = docRef.id;
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