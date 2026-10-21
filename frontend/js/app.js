import { db, collection, addDoc, serverTimestamp } from './firebase-config.js';
import { analisarComportamentoPet } from './gemini-service.js';

// Elementos
const vigiarBtn = document.getElementById('vigiarBtn');
const btnText = document.getElementById('btn-text');
const statusText = document.getElementById('connectionStatus');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const cameraArea = document.getElementById('cameraArea');
const behaviorIcon = document.getElementById('behaviorIcon');
const behaviorText = document.getElementById('behaviorText');
const iaList = document.getElementById('iaList');
const resultContainer = document.getElementById('result-container');
const resultContent = document.getElementById('result-content');

let stream = null;
let isAnalysing = false;
let stats = { dormindo: 0, comendo: 0, agitado: 0 };

// 1. Liga a câmera automaticamente ao carregar
async function iniciarCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        if (video) {
            video.srcObject = stream;
            await video.play();
        }
        if (cameraArea) cameraArea.classList.add('active');
    } catch (error) {
        console.error('Erro ao acessar a câmera:', error);
        alert('❌ Por favor, permita o acesso à câmera para o Vigia Pet funcionar.');
    }
}

// 2. Captura um frame da câmera e transforma em arquivo de imagem
function capturarFrame() {
    if (!video || video.readyState !== 4) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Converte a imagem do canvas para DataURL (Base64)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    // Converte DataURL para File para enviar ao serviço do Gemini
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], "frame_pet.jpg", { type: mime });
}

// 3. Ação do Botão: Captura imagem da câmera e envia para a IA
async function executarAnaliseVisivel() {
    if (isAnalysing) return;
    
    if (!stream) {
        await iniciarCamera();
    }

    const imagemCapturada = capturarFrame();
    if (!imagemCapturada) {
        alert("Aguarde a câmera carregar antes de analisar.");
        return;
    }

    isAnalysing = true;
    if (vigiarBtn) vigiarBtn.disabled = true;
    if (btnText) btnText.textContent = "ANALISANDO VÍDEO...";
    if (behaviorText) behaviorText.textContent = "IA Analisando imagem...";
    if (behaviorIcon) behaviorIcon.textContent = "🧠";

    try {
        const promptVisao = "Analise o comportamento do pet presente nesta imagem da câmera. Identifique se ele está descansando, comendo, brincando ou agitado e forneça diagnósticos práticos.";
        
        // Chamada direta para o Gemini com a foto capturada da vídeo-chamada
        const respostaAI = await analisarComportamentoPet(promptVisao, imagemCapturada);
        
        atualizarInterfaceIA(respostaAI);
        
        // Salva registro no Firebase
        salvarComportamento("analise_camera");
        
    } catch (error) {
        console.error("Erro na análise da imagem:", error);
        if (behaviorText) behaviorText.textContent = "Erro ao analisar";
    } finally {
        isAnalysing = false;
        if (vigiarBtn) vigiarBtn.disabled = false;
        if (btnText) btnText.textContent = "VIGIAR / ANALISAR";
    }
}

// 4. Atualiza a interface com a resposta da IA
function atualizarInterfaceIA(textoAnalisado) {
    if (resultContent) resultContent.innerText = textoAnalisado;
    if (resultContainer) resultContainer.classList.remove('hidden');

    if (iaList) {
        const linhas = textoAnalisado
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .slice(0, 3);

        if (linhas.length > 0) {
            iaList.innerHTML = '';
            linhas.forEach(linha => {
                const li = document.createElement('li');
                li.className = 'ia-item';
                li.innerHTML = `💡 ${linha.replace(/^[*•-]\s*/, '')}`;
                iaList.appendChild(li);
            });
        }
    }

    if (behaviorIcon) behaviorIcon.textContent = "✅";
    if (behaviorText) behaviorText.textContent = "Análise Concluída";
}

// Salva no Firebase
async function salvarComportamento(tipo) {
    try {
        await addDoc(collection(db, 'behaviors'), {
            petId: 'pet-padrao',
            behavior: tipo,
            timestamp: serverTimestamp(),
            device: navigator.userAgent || 'desconhecido'
        });
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
    }
}

// Eventos
if (vigiarBtn) {
    vigiarBtn.addEventListener('click', executarAnaliseVisivel);
}

// Inicializa a câmera automaticamente ao carregar
document.addEventListener('DOMContentLoaded', iniciarCamera);