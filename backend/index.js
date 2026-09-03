// index.js - Ponto de entrada das Cloud Functions
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { analisarVideoYoutube, analisarLoteVideos } = require('./video-analyzer');

// Inicializar Firebase Admin
admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function para analisar um vídeo
 * Chamada via: https://us-central1-SEU_PROJETO.cloudfunctions.net/analisarVideo
 */
exports.analisarVideo = functions.https.onCall(async (data, context) => {
    // Verificar autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Usuário não autenticado'
        );
    }

    const { videoUrl } = data;
    if (!videoUrl) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'URL do vídeo é obrigatória'
        );
    }

    try {
        // Analisar o vídeo
        const analise = await analisarVideoYoutube(videoUrl);
        
        // Salvar no Firestore
        const docRef = await db.collection('analises').add({
            videoUrl: videoUrl,
            analise: analise,
            userId: context.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            id: docRef.id,
            analise: analise
        };
    } catch (error) {
        console.error('Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Cloud Function para processar lista de vídeos
 */
exports.processarLoteVideos = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { videoUrls } = data;
    if (!videoUrls || !Array.isArray(videoUrls)) {
        throw new functions.https.HttpsError('invalid-argument', 'Lista de URLs inválida');
    }

    try {
        const resultados = await analisarLoteVideos(videoUrls);
        
        // Salvar cada resultado no Firestore
        const batch = db.batch();
        for (const resultado of resultados) {
            const docRef = db.collection('analises').doc();
            batch.set(docRef, {
                ...resultado,
                userId: context.auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();

        return {
            success: true,
            total: resultados.length,
            resultados: resultados
        };
    } catch (error) {
        console.error('Erro:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});