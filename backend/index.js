// backend/functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const GEMINI_KEY = process.env.GEMINI_API_KEY;

admin.initializeApp();
const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const MODELOS_DISPONIVEIS = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function analisarComFallback(prompt, videoStoragePath) {
    let ultimoErro = null;
    const bucket = admin.storage().bucket();
    const tempFilePath = path.join(os.tmpdir(), `pet_video_${Date.now()}.mp4`);
    
    await bucket.file(videoStoragePath).download({ destination: tempFilePath });

    const uploadResult = await ai.files.upload({
        file: tempFilePath,
        mimeType: 'video/mp4',
    });

    let fileState = await ai.files.get({ name: uploadResult.name });
    while (fileState.state === "PROCESSING") {
        await sleep(3000);
        fileState = await ai.files.get({ name: uploadResult.name });
    }

    if (fileState.state === "FAILED") {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        throw new Error("Falha no processamento do vídeo no Gemini.");
    }

    for (const nomeModelo of MODELOS_DISPONIVEIS) {
        try {
            const response = await ai.models.generateContent({
                model: nomeModelo,
                contents: [uploadResult, prompt]
            });

            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            await ai.files.delete({ name: uploadResult.name }).catch(() => {});

            return { texto: response.text, modelo: nomeModelo };
        } catch (error) {
            ultimoErro = error;
            if (error.message.includes('429') || error.message.includes('503')) {
                await sleep(5000);
            }
        }
    }

    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    await ai.files.delete({ name: uploadResult.name }).catch(() => {});
    throw new Error(`Todos os modelos falharam. Erro: ${ultimoErro ? ultimoErro.message : 'Desconhecido'}`);
}

exports.analisarVideo = functions.https.onCall(async (data, context) => {
    const { videoPath, petId, modoTeste } = data;
    
    if (modoTeste === true) {
        return {
            success: true,
            analise: "🐾 ANÁLISE SIMULADA\n\nComportamento: Comendo\nDica: Mantenha água fresca por perto.",
            modelo: "teste"
        };
    }

    if (!videoPath) {
        throw new functions.https.HttpsError('invalid-argument', 'O caminho do vídeo é obrigatório.');
    }

    try {
        const prompt = `
Você é um especialista em comportamento animal (cães e gatos).
Analise este vídeo de um pet e responda em português brasileiro:

1. 🐾 COMPORTAMENTO PRINCIPAL:
   Escolha UMA das opções: Dormindo / Comendo / Agitado / Brincando / Bravo / Outro

2. 📊 DESCRIÇÃO DETALHADA:
   Descreva o que está acontecendo no vídeo.

3. 💡 DICA PARA O DONO:
   Dê uma dica prática baseada no comportamento.

4. ⚠️ ALERTA:
   Há algum sinal de estresse, doença, dor ou perigo? (Sim/Não)
        `;

        const { texto, modelo } = await analisarComFallback(prompt, videoPath);
        
        const docRef = await db.collection('analises').add({
            petId: petId || 'desconhecidoS',
            videoPath,
            analise: texto,
            modeloUsado: modelo,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, analise: texto, modelo, id: docRef.id };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

exports.teste = functions.https.onCall(async () => {
    return { success: true, message: "Função ativa!" };
});