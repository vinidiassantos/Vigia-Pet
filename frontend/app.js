// frontend/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 1. Configuração do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "vigia-pet.firebaseapp.com",
    projectId: "vigia-pet",
    storageBucket: "vigia-pet.appspot.com"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Seleção automática do endpoint (Local no emulador vs Produção)
const FUNCTION_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5001/vigia-pet/us-central1/analisarVideo"
    : "https://us-central1-vigia-pet.cloudfunctions.net/analisarVideo";

// Elementos da Interface
const videoElem = document.getElementById("video");
const vigiarBtn = document.getElementById("vigiarBtn");
const behaviorIcon = document.getElementById("behaviorIcon");
const behaviorText = document.getElementById("behaviorText");
const iaList = document.getElementById("iaList");

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

const ICONES = {
    "Dormindo": "😴",
    "Comendo": "🍖",
    "Agitado": "⚡",
    "Brincando": "🎾",
    "Bravo": "😠",
    "Estressado": "😰",
    "Outro": "🐾"
};

// 2. Inicializar a câmara sem forçarfacingMode (evita erro em webcams integradas)
async function iniciarCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
        videoElem.srcObject = mediaStream;
        atualizarOverlay("🔍", "Câmera Pronta");
    } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        atualizarOverlay("❌", "Erro Câmera");
        alert("Não foi possível acessar a câmara. Verifique as permissões do navegador ou se outra app está a usá-la.");
    }
}

// 3. Gravar clipe e acionar a análise da IA
async function iniciarMonitoramento() {
    if (isRecording || !mediaStream) return;
    
    isRecording = true;
    recordedChunks = [];
    vigiarBtn.disabled = true;
    atualizarOverlay("🎥", "Gravando (10s)...");

    try {
        mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp9' });
    } catch (e) {
        mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = async () => {
        try {
            atualizarOverlay("⏳", "Enviando Vídeo...");
            
            const blob = new Blob(recordedChunks, { type: "video/mp4" });
            const petId = "pet1";
            const videoStoragePath = `videos_pets/${petId}/${Date.now()}.mp4`;
            const storageRef = ref(storage, videoStoragePath);

            // Upload para o Firebase Storage
            await uploadBytes(storageRef, blob);

            atualizarOverlay("🤖", "Gemini Analisando...");

            // Enviar requisição para a Cloud Function
            const response = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ videoStoragePath, petId })
            });

            const resData = await response.json();

            if (resData.success && resData.data) {
                renderizarResultados(resData.data);
            } else {
                atualizarOverlay("⚠️", "Erro na Análise");
                alert("Falha na análise: " + (resData.error || "Erro desconhecido"));
            }

        } catch (error) {
            console.error("Erro de conexão com o backend:", error);
            atualizarOverlay("❌", "Erro de Conexão");
        } finally {
            isRecording = false;
            vigiarBtn.disabled = false;
        }
    };

    // Grava por 10 segundos
    mediaRecorder.start();
    setTimeout(() => {
        if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }, 10000);
}

// 4. Atualizar o texto e ícone sobrepostos na câmara
function atualizarOverlay(icone, texto) {
    if (behaviorIcon) behaviorIcon.innerText = icone;
    if (behaviorText) behaviorText.innerText = texto;
}

// 5. Preencher os dados retornados na seção "Dicas da IA"
function renderizarResultados(data) {
    const iconeComportamento = ICONES[data.comportamento] || "🐾";
    atualizarOverlay(iconeComportamento, data.comportamento);

    if (iaList) {
        iaList.innerHTML = `
            <li class="ia-item">🐾 <strong>Raça:</strong> ${data.racaProvavel || 'SRD / Misto'}</li>
            <li class="ia-item">📊 <strong>Descrição:</strong> ${data.descricao}</li>
            <li class="ia-item">💡 <strong>Dica:</strong> ${data.dica}</li>
        `;
    }

    if (data.alerta) {
        alert(`⚠️ ALERTA DO GEMINI: ${data.detalhesAlerta || 'Comportamento atípico detectado!'}`);
    }
}

// Event Listeners ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    iniciarCamera();

    if (vigiarBtn) {
        vigiarBtn.addEventListener("click", iniciarMonitoramento);
    }
});