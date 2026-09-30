// frontend/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "vigia-pet.firebaseapp.com",
    projectId: "vigia-pet",
    storageBucket: "vigia-pet.appspot.com"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// URL da sua Cloud Function (ou http://127.0.0.1:5001/vigia-pet/us-central1/analisarVideo para testes locais)
const FUNCTION_URL = "https://us-central1-vigia-pet.cloudfunctions.net/analisarVideo";

export async function processarEAnalisarVideo(blobVideo, petId) {
    try {
        exibirStatus("⏳ Fazendo upload do clipe de vídeo...");
        
        // 1. Upload do vídeo para o Firebase Storage
        const videoStoragePath = `videos_pets/${petId}/${Date.now()}.mp4`;
        const storageRef = ref(storage, videoStoragePath);
        await uploadBytes(storageRef, blobVideo);

        exibirStatus("🤖 Analisando comportamento e raça com a IA Gemini...");

        // 2. Chamada HTTP para a Cloud Function
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoStoragePath, petId })
        });

        const resData = await response.json();

        if (resData.success) {
            exibirStatus("✅ Análise concluída!");
            atualizarDashboardUI(resData.data);
        } else {
            exibirStatus("❌ Falha na análise: " + resData.error);
        }

    } catch (error) {
        console.error("Erro na integração:", error);
        exibirStatus("❌ Erro de conexão ao analisar o vídeo.");
    }
}

function atualizarDashboardUI(data) {
    console.log("Resultado da Análise:", data);
    // Atualiza os elementos na tela do Vigia Pet
    if (document.getElementById("raca-pet")) document.getElementById("raca-pet").innerText = data.racaProvavel;
    if (document.getElementById("comportamento-pet")) document.getElementById("comportamento-pet").innerText = data.comportamento;
    if (document.getElementById("descricao-pet")) document.getElementById("descricao-pet").innerText = data.descricao;
    if (document.getElementById("dica-ia")) document.getElementById("dica-ia").innerText = data.dica;
}

function exibirStatus(mensagem) {
    const statusElem = document.getElementById("status-mensagem");
    if (statusElem) statusElem.innerText = mensagem;
}