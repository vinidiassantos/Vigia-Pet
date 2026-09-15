// backend/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('🔑 GEMINI_API_KEY carregada:', process.env.GEMINI_API_KEY ? '✅ Sim' : '❌ Não');

if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERRO: Chave do Gemini não encontrada!');
    console.log('📁 Verifique o arquivo .env em:', path.resolve(__dirname, '.env'));
}

admin.initializeApp();
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.analisarVideo = functions.https.onCall(async (data, context) => {
    console.log('📥 Função analisarVideo chamada');
    console.log('📦 Dados recebidos:', JSON.stringify(data));
    
    const { videoUrl } = data;
    if (!videoUrl) {
        throw new functions.https.HttpsError('invalid-argument', 'URL do vídeo é obrigatória');
    }

    try {
        console.log('🎯 Analisando vídeo:', videoUrl);
        
        // ✅ USAR O MODELO CORRETO: gemini-3.6-flash
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        
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

        // Gemini analisa o vídeo diretamente da URL
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
        const textoAnalise = response.text();
        
        console.log('✅ Análise concluída!');
        
        // Salvar no Firestore
        const docRef = await db.collection('analises').add({
            videoUrl: videoUrl,
            analise: textoAnalise,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
            success: true,
            message: "Análise concluída!",
            analise: textoAnalise,
            id: docRef.id
        };

    } catch (error) {
        console.error('❌ Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

console.log('✅ Functions carregadas!');