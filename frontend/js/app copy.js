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

const feedbackContainer = document.getElementById('feedbackContainer');
const feedbackButtons = document.getElementById('feedbackButtons');
const btnThumbsUp = document.getElementById('btnThumbsUp');
const btnThumbsDown = document.getElementById('btnThumbsDown');
const feedbackCommentBox = document.getElementById('feedbackCommentBox');
const feedbackComment = document.getElementById('feedbackComment');
const btnSendFeedback = document.getElementById('btnSendFeedback');
const feedbackThanks = document.getElementById('feedbackThanks');

let stream = null;
let isRecording = false;
let isPaused = false;
let timeLeft = 30;
let timerInterval = null;
let lastAIResult = "";
let currentCategory = "atividade";

let stats = JSON.parse(localStorage.getItem('vigiapet_stats')) || { descanco: 0, alimentacao: 0, atividade: 0 };
const petEmojis = ['🐾', '💡', '🦴', '🎾', '🩺', '😴', '🍖'];

async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Erro na câmera:", err);
        alert("Permita o acesso à câmera para usar o Vigia Pet.");
    }
}

function updateStatsUI() {
    document.getElementById('sleepTime').textContent = `${Math.floor(stats.descanco / 60)}m`;
    document.getElementById('eatTime').textContent = `${Math.floor(stats.alimentacao / 60)}m`;
    document.getElementById('activeTime').textContent = `${Math.floor(stats.atividade / 60)}m`;
    localStorage.setItem('vigiapet_stats', JSON.stringify(stats));
}

vigiarBtn.addEventListener('click', () => {
    if (!stream) { alert("A câmera ainda não está pronta."); return; }

    isRecording = true;
    isPaused = false;
    timeLeft = 30;

    feedbackContainer.style.display = 'none';
    feedbackButtons.style.display = 'flex';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'none';
    feedbackComment.value = "";

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

async function finalizarGravacao() {
    clearInterval(timerInterval);
    isRecording = false;
    
    const tempoGravado = 30 - timeLeft;

    controlsRow.style.display = 'none';
    timerOverlay.style.display = 'none';
    behaviorText.textContent = "ANALISANDO";
    
    // Redimensiona a imagem para evitar timeout no Netlify
    const MAX_WIDTH = 640;
    const scale = MAX_WIDTH / video.videoWidth;
    
    canvas.width = MAX_WIDTH;
    canvas.height = video.videoHeight * scale;
    
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

    try {
        // Rota original do Netlify restaurada
        const response = await fetch('/.netlify/functions/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Image })
        });

        const text = await response.text();
        let data;
        
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("O servidor demorou muito para responder. Tente novamente.");
        }

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

function processarRespostaIA(texto, segundos) {
    currentCategory = "atividade";
    let badgeText = "ATIVIDADE";
    let badgeClass = "active";

    const txtLower = texto.toLowerCase();

    if (txtLower.includes("[categoria: descanso]") || txtLower.includes("[categoria: descanso")) { 
        currentCategory = "descanco"; badgeText = "DESCANSO"; badgeClass = "sleep"; 
    } else if (txtLower.includes("[categoria: alimentacao]") || txtLower.includes("[categoria: alimentação")) { 
        currentCategory = "alimentacao"; badgeText = "ALIMENTAÇÃO"; badgeClass = "eat"; 
    } else if (txtLower.includes("dormindo") || txtLower.includes("deitado") || txtLower.includes("relaxado")) {
        currentCategory = "descanco"; badgeText = "DESCANSO"; badgeClass = "sleep"; 
    } else if (txtLower.includes("comendo") || txtLower.includes("bebendo") || txtLower.includes("alimentando") || txtLower.includes("mastigando")) {
        currentCategory = "alimentacao"; badgeText = "ALIMENTAÇÃO"; badgeClass = "eat"; 
    }

    stats[currentCategory] += segundos;
    updateStatsUI();

    const textoLimpo = texto.replace(/\[CATEGORIA:.*?\]/gi, '').trim();
    
    behaviorText.textContent = "CONCLUÍDO";
    
    iaCategoryBadge.style.display = 'inline-block';
    iaCategoryBadge.textContent = badgeText;
    iaCategoryBadge.className = `ia-badge ${badgeClass}`;

    iaList.innerHTML = '';
    const paragrafos = textoLimpo.split('\n').filter(p => p.trim() !== '');
    
    paragrafos.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = 'ia-item';
        const textoFormatado = p.replace(/^[*-]\s*/, '').trim();
        const emoji = petEmojis[index % petEmojis.length];
        
        if (p.trim().startsWith('-') || p.trim().startsWith('*')) {
            li.innerHTML = `<span class="emoji">${emoji}</span> <span class="texto">${textoFormatado}</span>`;
        } else {
            li.innerHTML = `<span class="texto-destaque">${textoFormatado}</span>`;
            li.classList.add('diagnostico');
        }
        iaList.appendChild(li);
    });

    salvarHistorico(textoLimpo, currentCategory, segundos);
    feedbackContainer.style.display = 'block';
}

btnThumbsUp.addEventListener('click', () => salvarAvaliacao("positivo", ""));
btnThumbsDown.addEventListener('click', () => {
    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'flex';
});

btnSendFeedback.addEventListener('click', () => {
    const comentario = feedbackComment.value.trim();
    salvarAvaliacao("negativo", comentario);
});

function salvarAvaliacao(tipo, comentario) {
    const feedbackData = {
        tipo: tipo, comentario: comentario, categoriaIA: currentCategory,
        textoIA: lastAIResult, data: new Date().toISOString()
    };
    const feedbacks = JSON.parse(localStorage.getItem('vigiapet_feedbacks') || '[]');
    feedbacks.push(feedbackData);
    localStorage.setItem('vigiapet_feedbacks', JSON.stringify(feedbacks));
    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'block';
}

whatsappBtn.addEventListener('click', () => {
    if (!lastAIResult) { alert("Faça uma análise primeiro!"); return; }
    const textoLimpo = lastAIResult.replace(/\[CATEGORIA:.*?\]/gi, '');
    const texto = `*VIGIA PET - RELATÓRIO*\n\n${textoLimpo}\n\n*RESUMO:*\nDescanso: ${Math.floor(stats.descanco / 60)}m\nAlimentação: ${Math.floor(stats.alimentacao / 60)}m\nAtividade: ${Math.floor(stats.atividade / 60)}m`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
});

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

document.addEventListener('DOMContentLoaded', () => {
    initCamera();
    updateStatsUI();
});