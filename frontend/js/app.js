// frontend/js/app.js

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const vigiarBtn = document.getElementById('vigiarBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const controlsRow = document.getElementById('controlsRow');
const timerOverlay = document.getElementById('timerOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const behaviorText = document.getElementById('behaviorText');
const iaList = document.getElementById('iaList');
const iaCategoryBadge = document.getElementById('iaCategoryBadge');
const historyBtn = document.getElementById('historyBtn');
const whatsappBtn = document.getElementById('whatsappBtn');
const historyModal = document.getElementById('historyModal');
const closeModal = document.getElementById('closeModal');
const historyList = document.getElementById('historyList');

// Elementos de Feedback
const feedbackContainer = document.getElementById('feedbackContainer');
const btnCorrect = document.getElementById('btnCorrect');
const btnIncorrect = document.getElementById('btnIncorrect');
const feedbackCommentBox = document.getElementById('feedbackCommentBox');
const feedbackComment = document.getElementById('feedbackComment');
const btnSendFeedback = document.getElementById('btnSendFeedback');
const feedbackThanks = document.getElementById('feedbackThanks');
const feedbackButtons = document.getElementById('feedbackButtons');

const cameraWrapper = document.querySelector('.camera-wrapper');

let stream = null;
let isRecording = false;
let isPaused = false;
let timeLeft = 30;
let timerInterval = null;
let lastAIResult = "";
let currentCategory = "atividade";

let stats = JSON.parse(localStorage.getItem('vigiapet_stats')) || { descanco: 0, alimentacao: 0, atividade: 0 };

const petEmojis = ['🐾', '💡', '🦴', '🎾', '🩺', '😴', '🍖'];

// ==========================================
// CÂMERA
// ==========================================
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        cameraWrapper.classList.add('active');
    } catch (err) {
        console.error("Erro na câmera:", err);
        alert("Permita o acesso à câmera para usar o Vigia Pet.");
    }
}

// ==========================================
// ATUALIZAR UI DAS ESTATÍSTICAS
// ==========================================
function updateStatsUI() {
    document.getElementById('sleepTime').textContent = `${Math.floor(stats.descanco / 60)}m`;
    document.getElementById('eatTime').textContent = `${Math.floor(stats.alimentacao / 60)}m`;
    document.getElementById('activeTime').textContent = `${Math.floor(stats.atividade / 60)}m`;
    localStorage.setItem('vigiapet_stats', JSON.stringify(stats));
}

// ==========================================
// CONTROLE DE GRAVAÇÃO
// ==========================================
vigiarBtn.addEventListener('click', () => {
    if (!stream) { alert("A câmera ainda não está pronta."); return; }

    isRecording = true;
    isPaused = false;
    timeLeft = 30;

    feedbackContainer.style.display = 'none';
    feedbackButtons.style.display = 'flex';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'none';

    vigiarBtn.style.display = 'none';
    controlsRow.style.display = 'grid';
    timerOverlay.style.display = 'flex';
    behaviorText.textContent = "GRAVANDO";
    iaList.innerHTML = '<li class="ia-item placeholder">Capturando imagem...</li>';
    iaCategoryBadge.style.display = 'none';
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) finalizarGravacao();
        }
    }, 1000);
});

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "RETOMAR" : "PAUSAR";
    behaviorText.textContent = isPaused ? "PAUSADO" : "GRAVANDO";
});

stopBtn.addEventListener('click', finalizarGravacao);

function updateTimerDisplay() {
    timerDisplay.textContent = timeLeft;
}

// ==========================================
// FINALIZAR E ENVIAR PARA IA
// ==========================================
async function finalizarGravacao() {
    clearInterval(timerInterval);
    isRecording = false;
    
    const tempoGravado = 30 - timeLeft;

    controlsRow.style.display = 'none';
    timerOverlay.style.display = 'none';
    behaviorText.textContent = "ANALISANDO";
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
        const response = await fetch('/.netlify/functions/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Image })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro desconhecido");

        lastAIResult = data.result;
        processarRespostaIA(data.result, tempoGravado);

    } catch (error) {
        console.error("Erro na análise:", error);
        alert("Erro ao analisar: " + error.message);
        behaviorText.textContent = "ERRO";
    } finally {
        vigiarBtn.style.display = 'flex';
    }
}

// ==========================================
// PROCESSAR RESPOSTA DA IA E MOSTRAR FEEDBACK
// ==========================================
function processarRespostaIA(texto, segundos) {
    currentCategory = "atividade";
    let badgeText = "ATIVIDADE";
    let badgeClass = "active";

    if (texto.includes("[CATEGORIA: DESCANSO]")) { 
        currentCategory = "descanco"; badgeText = "DESCANSO"; badgeClass = "sleep"; 
    } else if (texto.includes("[CATEGORIA: ALIMENTACAO]")) { 
        currentCategory = "alimentacao"; badgeText = "ALIMENTAÇÃO"; badgeClass = "eat"; 
    }

    stats[currentCategory] += segundos;
    updateStatsUI();

    const textoLimpo = texto.replace(/\[CATEGORIA:.*?\]/g, '').trim();
    behaviorText.textContent = "CONCLUÍDO";
    
    iaCategoryBadge.style.display = 'inline-block';
    iaCategoryBadge.textContent = badgeText;
    iaCategoryBadge.className = `ia-badge ${badgeClass}`;

    iaList.innerHTML = '';
    const paragrafos = textoLimpo.split('\n').filter(p => p.trim() !== '');
    
    paragrafos.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'ia-item';
        const textoFormatado = p.replace(/^[*-]\s*/, '');
        const emoji = petEmojis[index % petEmojis.length];
        li.innerHTML = `<span class="emoji">${emoji}</span> <span class="texto">${textoFormatado}</span>`;
        iaList.appendChild(li);
    });

    salvarHistorico(textoLimpo, currentCategory, segundos);

    feedbackContainer.style.display = 'block';
}

// ==========================================
// LÓGICA DE FEEDBACK DO CLIENTE
// ==========================================
btnCorrect.addEventListener('click', () => {
    enviarFeedback("correto", "");
});

btnIncorrect.addEventListener('click', () => {
    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'flex';
});

btnSendFeedback.addEventListener('click', () => {
    const comentario = feedbackComment.value.trim();
    enviarFeedback("incorreto", comentario);
});

function enviarFeedback(tipo, comentario) {
    const feedbackData = {
        tipo: tipo,
        comentario: comentario,
        categoriaIA: currentCategory,
        textoIA: lastAIResult,
        data: new Date().toISOString()
    };

    const feedbacksAntigos = JSON.parse(localStorage.getItem('vigiapet_feedbacks') || '[]');
    feedbacksAntigos.push(feedbackData);
    localStorage.setItem('vigiapet_feedbacks', JSON.stringify(feedbacksAntigos));

    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'block';
    
    console.log("Feedback salvo:", feedbackData);
}

// ==========================================
// WHATSAPP
// ==========================================
whatsappBtn.addEventListener('click', () => {
    if (!lastAIResult) { alert("Faça uma análise primeiro!"); return; }
    
    const textoLimpo = lastAIResult.replace(/\[CATEGORIA:.*?\]/g, '');
    const texto = `*VIGIA PET - RELATÓRIO*\n\n${textoLimpo}\n\n*RESUMO:*\nDescanso: ${Math.floor(stats.descanco / 60)}m\nAlimentação: ${Math.floor(stats.alimentacao / 60)}m\nAtividade: ${Math.floor(stats.atividade / 60)}m`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
});

// ==========================================
// HISTÓRICO
// ==========================================
historyBtn.addEventListener('click', () => {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historyList.innerHTML = '';
    
    if (historico.length === 0) {
        historyList.innerHTML = '<li>Nenhuma análise registrada.</li>';
    } else {
        historico.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.data}</strong><br>${item.categoria.toUpperCase()} · ${item.segundos}s`;
            historyList.appendChild(li);
        });
    }
    historyModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => { historyModal.style.display = 'none'; });

function salvarHistorico(texto, categoria, segundos) {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historico.unshift({ data: new Date().toLocaleString('pt-BR'), texto, categoria, segundos });
    if (historico.length > 10) historico.pop();
    localStorage.setItem('vigiapet_history', JSON.stringify(historico));
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initCamera();
    updateStatsUI();
});