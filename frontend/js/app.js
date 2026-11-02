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
const iaRacaBadge = document.getElementById('iaRacaBadge'); // Novo elemento
const historyBtn = document.getElementById('historyBtn');
const whatsappBtn = document.getElementById('whatsappBtn');
const historyModal = document.getElementById('historyModal');
const closeModal = document.getElementById('closeModal');
const historyList = document.getElementById('historyList');
const vetReportBtn = document.getElementById('vetReportBtn');

// Modais
const consentModal = document.getElementById('consentModal');
const consentCheck = document.getElementById('consentCheck');
const btnAcceptConsent = document.getElementById('btnAcceptConsent');
const onboardingModal = document.getElementById('onboardingModal');

// Feedback
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
let timeLeft = 10; 
let timerInterval = null;
let lastAIResult = "";
let currentCategory = "atividade";
let alertTriggered = false;
let framesColetados = []; 

let stats = JSON.parse(localStorage.getItem('vigiapet_stats')) || { descanco: 0, alimentacao: 0, atividade: 0 };
const petEmojis = ['🐾', '💡', '🦴', '🎾', '🩺', '😴', '🍖'];

// ==========================================
// INICIALIZAÇÃO E FLUXO DE ONBOARDING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initCamera();
    updateStatsUI();

    const hasConsent = localStorage.getItem('vigiapet_consent');
    if (!hasConsent) {
        consentModal.style.display = 'flex';
    } else {
        checkOnboarding();
    }

    consentCheck.addEventListener('change', () => {
        btnAcceptConsent.disabled = !consentCheck.checked;
    });

    btnAcceptConsent.addEventListener('click', () => {
        localStorage.setItem('vigiapet_consent', 'true');
        consentModal.style.display = 'none';
        checkOnboarding();
    });
});

function checkOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('vigiapet_onboarding');
    if (!hasSeenOnboarding) {
        onboardingModal.style.display = 'flex';
        document.getElementById('onboardingStep1').style.display = 'block';
    }
}

window.nextOnboarding = function(step) {
    document.getElementById('onboardingStep1').style.display = 'none';
    document.getElementById('onboardingStep2').style.display = 'none';
    document.getElementById('onboardingStep3').style.display = 'none';
    document.getElementById('onboardingStep' + step).style.display = 'block';
};

window.finishOnboarding = function() {
    localStorage.setItem('vigiapet_onboarding', 'true');
    onboardingModal.style.display = 'none';
};

// ==========================================
// CÂMERA E ESTATÍSTICAS
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
    if (!localStorage.getItem('vigiapet_consent')) {
        consentModal.style.display = 'flex';
        return;
    }

    isRecording = true;
    isPaused = false;
    timeLeft = 10; 
    alertTriggered = false;
    framesColetados = []; 

    feedbackContainer.style.display = 'none';
    feedbackButtons.style.display = 'flex';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'none';
    feedbackComment.value = "";

    vigiarBtn.style.display = 'none';
    controlsRow.style.display = 'grid';
    timerOverlay.style.display = 'flex';
    behaviorText.textContent = "GRAVANDO VÍDEO";
    iaList.innerHTML = '<li class="ia-item placeholder">Analisando raça e comportamento...</li>';
    iaCategoryBadge.style.display = 'none';
    iaRacaBadge.style.display = 'none';
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft === 8 || timeLeft === 5 || timeLeft === 2) {
                capturarFrame();
            }

            if (timeLeft <= 0) finalizarGravacao();
        }
    }, 1000);
});

pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? "RETOMAR" : "PAUSAR";
    behaviorText.textContent = isPaused ? "PAUSADO" : "GRAVANDO VÍDEO";
});

stopBtn.addEventListener('click', finalizarGravacao);

function updateTimerDisplay() {
    timerDisplay.textContent = timeLeft;
}

function capturarFrame() {
    const MAX_WIDTH = 640;
    const scale = MAX_WIDTH / video.videoWidth;
    canvas.width = MAX_WIDTH;
    canvas.height = video.videoHeight * scale;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    framesColetados.push(base64Image);
}

// ==========================================
// FINALIZAR E ENVIAR PARA IA
// ==========================================
async function finalizarGravacao() {
    clearInterval(timerInterval);
    isRecording = false;
    
    if (framesColetados.length === 0) capturarFrame();

    const tempoGravado = 10 - timeLeft;

    controlsRow.style.display = 'none';
    timerOverlay.style.display = 'none';
    behaviorText.textContent = "ANALISANDO VÍDEO";
    
    try {
        const response = await fetch('/.netlify/functions/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagesBase64: framesColetados })
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error("Tempo esgotado. Tente novamente."); }
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
// PROCESSAR RESPOSTA E ALERTAS DE SAÚDE
// ==========================================
function processarRespostaIA(texto, segundos) {
    currentCategory = "atividade";
    let badgeText = "ATIVIDADE";
    let badgeClass = "active";
    let racaIdentificada = "Identificando...";

    // 1. Extrai a Categoria
    const txtLower = texto.toLowerCase();
    if (txtLower.includes("[categoria: descanso]") || txtLower.includes("dormindo") || txtLower.includes("deitado")) { 
        currentCategory = "descanco"; badgeText = "DESCANSO"; badgeClass = "sleep"; 
    } else if (txtLower.includes("[categoria: alimentacao]") || txtLower.includes("comendo") || txtLower.includes("bebendo")) { 
        currentCategory = "alimentacao"; badgeText = "ALIMENTAÇÃO"; badgeClass = "eat"; 
    }

    // 2. Extrai a Raça usando Regex
    const matchRaca = texto.match(/\[RACA:\s*(.*?)\]/i);
    if (matchRaca && matchRaca[1]) {
        racaIdentificada = matchRaca[1].trim();
    }

    // 3. Atualiza Estatísticas
    stats[currentCategory] += segundos;
    updateStatsUI();

    if (currentCategory === "atividade" && segundos >= 8 && !alertTriggered) {
        alertTriggered = true;
        setTimeout(() => {
            alert("⚠️ ALERTA DE SAÚDE: Seu pet está muito agitado por um longo período. Considere verificar se ele precisa de água ou passear!");
        }, 1000);
    }

    // 4. Limpa o texto retirando as tags para exibir bonitinho
    let textoLimpo = texto
        .replace(/\[CATEGORIA:.*?\]/gi, '')
        .replace(/\[RACA:.*?\]/gi, '')
        .trim();

    behaviorText.textContent = "CONCLUÍDO";
    
    // 5. Atualiza os Badges (Categoria e Raça)
    iaCategoryBadge.style.display = 'inline-block';
    iaCategoryBadge.textContent = badgeText;
    iaCategoryBadge.className = `ia-badge ${badgeClass}`;

    iaRacaBadge.style.display = 'inline-block';
    iaRacaBadge.textContent = racaIdentificada;

    // 6. Renderiza o texto formatado
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
            // Se não for tópico, é o diagnóstico ou a análise da raça
            li.innerHTML = `<span class="texto-destaque">${textoFormatado}</span>`;
            li.classList.add('diagnostico');
        }
        iaList.appendChild(li);
    });

    salvarHistorico(textoLimpo, currentCategory, segundos, racaIdentificada);
    feedbackContainer.style.display = 'block';
}

// ==========================================
// FEEDBACK
// ==========================================
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
        tipo: tipo,
        comentario: comentario,
        categoriaIA: currentCategory,
        textoIA: lastAIResult,
        data: new Date().toISOString(),
    };

    const feedbacks = JSON.parse(localStorage.getItem('vigiapet_feedbacks') || '[]');
    feedbacks.push(feedbackData);
    localStorage.setItem('vigiapet_feedbacks', JSON.stringify(feedbacks));

    fetch('/.netlify/functions/salvar-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
    }).catch((err) => {
        console.warn('Não foi possível enviar o feedback para o servidor:', err);
    });

    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'block';
}

// ==========================================
// RELATÓRIO PARA O VETERINÁRIO (DOWNLOAD TXT)
// ==========================================
vetReportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    if (historico.length === 0) {
        alert("Ainda não há histórico para gerar o relatório.");
        return;
    }

    let textoRelatorio = `RELATÓRIO VIGIA PET - PARA O VETERINÁRIO\n`;
    textoRelatorio += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    textoRelatorio += `--------------------------------------------------\n\n`;
    
    textoRelatorio += `RESUMO DE TEMPO (Total Acumulado):\n`;
    textoRelatorio += `- Descanso: ${Math.floor(stats.descanco / 60)} minutos\n`;
    textoRelatorio += `- Alimentação: ${Math.floor(stats.alimentacao / 60)} minutos\n`;
    textoRelatorio += `- Atividade: ${Math.floor(stats.atividade / 60)} minutos\n\n`;
    
    textoRelatorio += `HISTÓRICO DETALHADO (Últimas 10 análises):\n`;
    historico.forEach((item, index) => {
        textoRelatorio += `${index + 1}. Data: ${item.data} | Raça: ${item.raca || 'Não info.'} | Comportamento: ${item.categoria.toUpperCase()}\n`;
        textoRelatorio += `   Análise: ${item.texto.replace(/\n/g, ' ')}\n\n`;
    });

    const blob = new Blob([textoRelatorio], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_vet_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

// ==========================================
// WHATSAPP E HISTÓRICO (MODAL)
// ==========================================
whatsappBtn.addEventListener('click', () => {
    if (!lastAIResult) { alert("Faça uma análise primeiro!"); return; }
    const textoLimpo = lastAIResult.replace(/\[CATEGORIA:.*?\]/gi, '').replace(/\[RACA:.*?\]/gi, '');
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
            li.innerHTML = `<strong>${item.data}</strong><br>${item.raca || 'Raça não id.'} · ${item.categoria.toUpperCase()} · ${item.segundos}s`;
            historyList.appendChild(li);
        });
    }
    historyModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => { historyModal.style.display = 'none'; });

function salvarHistorico(texto, categoria, segundos, raca) {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historico.unshift({ data: new Date().toLocaleString('pt-BR'), texto, categoria, segundos, raca });
    if (historico.length > 10) historico.pop();
    localStorage.setItem('vigiapet_history', JSON.stringify(historico));
}