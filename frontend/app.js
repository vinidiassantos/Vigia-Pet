// frontend/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

// Configuração do Firebase do seu projeto Vigia Pet
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "vigia-pet.firebaseapp.com",
    projectId: "vigia-pet",
    storageBucket: "vigia-pet.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const functions = getFunctions(app);

let mediaRecorder;
let recordedChunks = [];

// 1. Iniciar visualização da câmera
export async function iniciarCamera(elementVideoId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: true
        });
        const videoElement = document.getElementById(elementVideoId);
        videoElement.srcObject = stream;
        videoElement.play();
        return stream;
    } catch (err) {
        console.error("Erro ao acessar a câmera:", err);
        alert("Permissão para usar a câmera foi negada ou não é suportada.");
    }
}

// 2. Gravar vídeo e enviar para análise
export async function gravarEAnalisar(stream, petId, statusCallback) {
    recordedChunks = [];
    
    // Configura o gravador de vídeo
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        try {
            statusCallback("⏳ Fazendo upload do vídeo...");
            const blob = new Blob(recordedChunks, { type: "video/mp4" });
            
            // Define o caminho no Firebase Storage
            const videoPath = `videos_pets/${petId}/${Date.now()}.mp4`;
            const storageRef = ref(storage, videoPath);

            // Upload do arquivo para o Firebase Storage
            await uploadBytes(storageRef, blob);

            statusCallback("🤖 Processando com a Inteligência Artificial Gemini...");
            
            // Chama a Cloud Function
            const analisarVideoFn = httpsCallable(functions, 'analisarVideo');
            const result = await analisarVideoFn({
                videoPath: videoPath,
                petId: petId,
                modoTeste: false
            });

            statusCallback("✅ Análise concluída!");
            console.log("Resultado da Análise:", result.data);
            
            // Exibe a resposta na interface
            exibirResultado(result.data.analise);

        } catch (error) {
            console.error("Erro no envio/análise:", error);
            statusCallback("❌ Erro ao analisar vídeo.");
        }
    };

    // Grava por 10 segundos
    statusCallback("🎥 Gravando vídeo (10 segundos)...");
    mediaRecorder.start();
    setTimeout(() => {
        mediaRecorder.stop();
    }, 10000);
}

// 3. Exibir o resultado formatado no HTML
function exibirResultado(textoAnalise) {
    const container = document.getElementById("resultado-analise");
    if (container) {
        container.innerText = textoAnalise;
    }
}