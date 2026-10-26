// frontend/js/app.js

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const vigiarBtn = document.getElementById('vigiarBtn');
const btnText = document.getElementById('btn-text');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const controlsRow = document.getElementById('controlsRow');
const timerOverlay = document.getElementById('timerOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const behaviorText = document.getElementById('behaviorText');
const behaviorIcon = document.getElementById('behaviorIcon');
const iaList = document.getElementById('iaList');
const iaCategoryBadge = document.getElementById('iaCategoryBadge');
const historyBtn = document.getElementById('historyBtn');
const whatsappBtn = document.getElementById('whatsappBtn');
const historyModal = document.getElementById('historyModal');
const closeModal = document.getElementById('closeModal');
const historyList = document.getElementById('historyList');

let stream = null;
let isRecording = false;
let isPaused = false;
let timeLeft = 30;
let timerInterval = null;
let lastAIResult = "";

// Estatísticas (segundos) persistidas
let stats = JSON.parse(localStorage.getItem('vigiapet_stats')) || { descanco: 0, alimentacao: 0, atividade: 0 };

// ==========================================
// CÂMERA
// ==========================================
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Erro na câmera:", err);
        alert("Permita o acesso à câmera para usar o Vigia Pet.");
    }
}

// ==========================================
// ATUALIZAR UI DAS ESTATÍSTICAS
// ==========================================
function updateStatsUI() {
    const total = stats.descanco + stats.alimentacao + stats.atividade || 1;
    
    document.getElementById('sleepTime').textContent = `${Math.floor(stats.descanco / 60)}m`;
    document.getElementById('eatTime').textContent = `${Math.floor(stats.alimentacao / 60)}m`;
    document.getElementById('activeTime').textContent = `${Math.floor(stats.atividade / 60)}m`;

    document.getElementById('sleepBar').style.width = `${(stats.descanco / total) * 100}%`;
    document.getElementById('eatBar').style.width = `${(stats.alimentacao / total) * 100}%`;
    document.getElementById('activeBar').style.width = `${(stats.atividade / total) * 100}%`;

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

    vigiarBtn.style.display = 'none';
    controlsRow.style.display = 'grid';
    timerOverlay.style.display = 'flex';
    behaviorText.textContent = "Gravando...";
    behaviorIcon.textContent = "🔴";
    iaList.innerHTML = '<li class="ia-item placeholder">💡 Capturando imagem...</li>';
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
    pauseBtn.textContent = isPaused ? "▶ Retomar" : "⏸ Pausar";
    behaviorText.textContent = isPaused ? "Pausado" : "Gravando...";
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
    behaviorText.textContent = "IA Analisando...";
    behaviorIcon.textContent = "🧠";

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
        behaviorText.textContent = "Erro";
        behaviorIcon.textContent = "❌";
    } finally {
        vigiarBtn.style.display = 'flex';
    }
}

// ==========================================
// PROCESSAR RESPOSTA DA IA
// ==========================================
function processarRespostaIA(texto, segundos) {
    let categoria = "atividade";
    let badgeText = "Atividade";
    let badgeColor = "#fb923c";

    if (texto.includes("[CATEGORIA: DESCANSO]")) { categoria = "descanco"; badgeText = "Descanso"; badgeColor = "#38bdf8"; }
    else if (texto.includes("[CATEGORIA: ALIMENTACAO]")) { categoria = "alimentacao"; badgeText = "Alimentação"; badgeColor = "#4ade80"; }

    stats[categoria] += segundos;
    updateStatsUI();

    const textoLimpo = texto.replace(/\[CATEGORIA:.*?\]/g, '').trim();
    
    behaviorText.textContent = "Análise Concluída";
    behaviorIcon.textContent = "✅";
    
    iaCategoryBadge.style.display = 'inline-block';
    iaCategoryBadge.textContent = badgeText;
    iaCategoryBadge.style.color = badgeColor;
    iaCategoryBadge.style.background = `${badgeColor}20`;

    iaList.innerHTML = '';
    const paragrafos = textoLimpo.split('\n').filter(p => p.trim() !== '');
    paragrafos.forEach(p => {
        const li = document.createElement('li');
        li.className = 'ia-item';
        li.textContent = `💡 ${p}`;
        iaList.appendChild(li);
    });

    salvarHistorico(textoLimpo, categoria, segundos);
}

// ==========================================
// WHATSAPP
// ==========================================
whatsappBtn.addEventListener('click', () => {
    if (!lastAIResult) { alert("Faça uma análise primeiro!"); return; }
    
    const textoLimpo = lastAIResult.replace(/\[CATEGORIA:.*?\]/g, '').trim();
    const texto = `🐾 *VIGIA PET - Relatório*\n\n${textoLimpo}\n\n📊 *Resumo:*\n😴 Descanso: ${Math.floor(stats.descanco / 60)}m\n🍖 Alimentação: ${Math.floor(stats.alimentacao / 60)}m\n🐕 Atividade: ${Math.floor(stats.atividade / 60)}m`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
});

// ==========================================
// HISTÓRICO
// ==========================================
historyBtn.addEventListener('click', () => {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historyList.innerHTML = '';
    
    if (historico.length === 0) {
        historyList.innerHTML = '<li>Nenhuma análise registrada ainda.</li>';
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