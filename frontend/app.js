// frontend/js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "vigia-pet.firebaseapp.com",
    projectId: "vigia-pet",
    storageBucket: "vigia-pet.appspot.com"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

// Seleção dinâmica do Endpoint (Local Emulador x Produção Cloud Functions)
const FUNCTION_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5001/vigia-pet/us-central1/analisarVideo"
    : "https://us-central1-vigia-pet.cloudfunctions.net/analisarVideo";

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

// 1. Inicializar Câmera com verificação segura de elementos
async function iniciarCamera() {
    try {
        const videoElem = document.getElementById("video");
        if (!videoElem) {
            console.error("Elemento <video id='video'> não foi encontrado no HTML.");
            return;
        }

        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        videoElem.srcObject = mediaStream;
        atualizarOverlay("🔍", "Câmera Pronta");
    } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        atualizarOverlay("❌", "Erro Câmera");
        alert("Não foi possível acessar a câmera. Verifique se o navegador tem permissão ou se outra aplicação está utilizando a câmera.");
    }
}

// 2. Gravar vídeo e acionar análise da IA Gemini
async function iniciarMonitoramento() {
    if (isRecording || !mediaStream) return;

    const vigiarBtn = document.getElementById("vigiarBtn");
    isRecording = true;
    recordedChunks = [];
    
    if (vigiarBtn) {
        vigiarBtn.disabled = true;
    }

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

            // Requisição POST para o backend
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
            console.error("Erro na integração:", error);
            atualizarOverlay("❌", "Erro Conexão");
        } finally {
            isRecording = false;
            if (vigiarBtn) {
                vigiarBtn.disabled = false;
            }
        }
    };

    // Inicia gravação de 10 segundos
    mediaRecorder.start();
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    }, 10000);
}

// 3. Função auxiliar para atualizar overlays sem gerar erro de 'null'
function atualizarOverlay(icone, texto) {
    const behaviorIcon = document.getElementById("behaviorIcon");
    const behaviorText = document.getElementById("behaviorText");

    if (behaviorIcon) {
        behaviorIcon.textContent = icone;
    }
    if (behaviorText) {
        behaviorText.textContent = texto;
    }
}

// 4. Renderizar resposta da IA no Dashboard
function renderizarResultados(data) {
    const iconeComportamento = ICONES[data.comportamento] || "🐾";
    atualizarOverlay(iconeComportamento, data.comportamento);

    const iaList = document.getElementById("iaList");
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

// 5. Inicialização após o carregamento completo do DOM
document.addEventListener("DOMContentLoaded", () => {
    iniciarCamera();

    const vigiarBtn = document.getElementById("vigiarBtn");
    if (vigiarBtn) {
        // Remove event listeners antigos clonando o nó
        const btnLimpo = vigiarBtn.cloneNode(true);
        if (vigiarBtn.parentNode) {
            vigiarBtn.parentNode.replaceChild(btnLimpo, vigiarBtn);
        }
        btnLimpo.addEventListener("click", iniciarMonitoramento);
    }
});