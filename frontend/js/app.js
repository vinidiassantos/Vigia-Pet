// frontend/js/app.js
// 👇 CORREÇÃO AQUI: Tudo sendo importado do seu firebase-config.js na versão correta
import { db, collection, addDoc } from './firebase-config.js';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const vigiarBtn = document.getElementById('vigiarBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const controlsRow = document.getElementById('controlsRow');
const timerOverlay = document.getElementById('timerOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const behaviorText = document.getElementById('behaviorText');
const iaContent = document.getElementById('iaContent');
const iaPlaceholder = document.getElementById('iaPlaceholder');
const iaCategoryBadge = document.getElementById('iaCategoryBadge');
const iaRacaBadge = document.getElementById('iaRacaBadge'); 
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

// ==========================================
// INICIALIZAÇÃO E TELEMETRIA (ITEM 2)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    initCamera();
    updateStatsUI();

    // Salva a telemetria no Firebase
    const so = obterSistemaOperacional();
    await salvarTelemetria(so);

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

function obterSistemaOperacional() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return 'iOS';
    if (/android/i.test(userAgent)) return 'Android';
    if (/windows phone/i.test(userAgent)) return 'Windows Phone';
    return 'Desktop/Outro';
}

async function salvarTelemetria(sistemaOperacional) {
    try {
        await addDoc(collection(db, "telemetria_acessos"), {
            sistema_operacional: sistemaOperacional,
            data_acesso: new Date().toISOString(),
            origem: "web_app"
        });
        console.log("📱 Telemetria salva no Firebase:", sistemaOperacional);
    } catch (error) {
        console.warn("Erro ao salvar telemetria:", error);
    }
}

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
    
    // Esconde o bloco de produtos de análises anteriores
    document.getElementById('blocoProdutos').style.display = 'none';

    feedbackContainer.style.display = 'none';
    feedbackButtons.style.display = 'flex';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'none';
    feedbackComment.value = "";

    vigiarBtn.style.display = 'none';
    controlsRow.style.display = 'grid';
    timerOverlay.style.display = 'flex';
    behaviorText.textContent = "GRAVANDO VÍDEO";
    
    iaContent.innerHTML = '';
    iaPlaceholder.style.display = 'block';
    iaPlaceholder.textContent = "Analisando raça e comportamento...";
    
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
    const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1]; // Qualidade 0.6
    framesColetados.push(base64Image);
}

// ==========================================
// FINALIZAR E ENVIAR PARA IA
// ==========================================
async function finalizarGravacao() {
    if (!isRecording) return; // CADEADO: Evita dupla execução
    isRecording = false;

    clearInterval(timerInterval);
    
    if (framesColetados.length === 0) capturarFrame();
    const tempoGravado = 10 - timeLeft;

    controlsRow.style.display = 'none';
    timerOverlay.style.display = 'none';
    behaviorText.textContent = "ANALISANDO VÍDEO";
    
    try {
        const response = await fetch('/.netlify/functions/analisar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                imagesBase64: framesColetados.slice(-1), // Envia apenas 1 imagem (Economia de Tokens)
                sistema_operacional: obterSistemaOperacional() 
            })
        });

        const text = await response.text();
        let data;
        
        try { 
            data = JSON.parse(text); 
        } catch (e) { 
            throw new Error("O servidor demorou muito para responder ou retornou um erro."); 
        }
        
        if (data.error && data.error.includes("Rate limit reached")) {
            throw new Error("Muitas análises em pouco tempo. Aguarde 1 minuto e tente novamente.");
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

// ==========================================
// PROCESSAR RESPOSTA (MONTAGEM DOS BLOCOS)
// ==========================================
function processarRespostaIA(jsonString, segundos) {
    let analise;
    
    try {
        analise = JSON.parse(jsonString);
    } catch (e1) {
        try {
            let cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
            const start = cleanJson.indexOf('{');
            const end = cleanJson.lastIndexOf('}');
            if (start !== -1 && end !== -1) cleanJson = cleanJson.substring(start, end + 1);
            analise = JSON.parse(cleanJson);
        } catch (e2) {
            alert("A IA retornou um formato inválido. Tente novamente.");
            behaviorText.textContent = "ERRO NA IA";
            iaPlaceholder.textContent = "Não foi possível ler a resposta da IA.";
            return;
        }
    }

    if (analise.especie === "Nenhum" || analise.especie === "Nenhuma") {
        behaviorText.textContent = "NENHUM PET DETECTADO";
        iaPlaceholder.style.display = 'none';
        iaContent.innerHTML = `
            <div class="ia-block" style="border-left: 4px solid #ff4d4d; background-color: #fff5f5; margin-top: 15px;">
                <div class="ia-block-title" style="color: #cc0000;">⚠️ Atenção</div>
                <div class="ia-block-content">
                    <p>${analise.comportamento || 'Nenhum cachorro ou gato foi identificado. Aponte a câmera para o seu pet.'}</p>
                </div>
            </div>
        `;
        iaCategoryBadge.style.display = 'none';
        iaRacaBadge.style.display = 'none';
        return; 
    }

    const comportamentoLower = (analise.comportamento || "").toLowerCase();
    if (comportamentoLower.includes("dorm") || comportamentoLower.includes("deitad") || comportamentoLower.includes("descans")) {
        currentCategory = "descanco";
    } else if (comportamentoLower.includes("comend") || comportamentoLower.includes("bebend") || comportamentoLower.includes("aliment")) {
        currentCategory = "alimentacao";
    } else {
        currentCategory = "atividade";
    }

    stats[currentCategory] += segundos;
    updateStatsUI();

    if (currentCategory === "atividade" && segundos >= 8 && !alertTriggered) {
        alertTriggered = true;
        setTimeout(() => { alert("⚠️ ALERTA DE SAÚDE: Seu pet está muito agitado por um longo período."); }, 1000);
    }

    behaviorText.textContent = "CONCLUÍDO";
    
    iaCategoryBadge.style.display = 'inline-block';
    iaCategoryBadge.textContent = currentCategory.toUpperCase();
    iaCategoryBadge.className = `ia-badge ${currentCategory === 'descanco' ? 'sleep' : currentCategory === 'alimentacao' ? 'eat' : 'active'}`;

    iaRacaBadge.style.display = 'inline-block';
    iaRacaBadge.textContent = analise.raca || 'SRD';

    iaPlaceholder.style.display = 'none';
    iaContent.innerHTML = ''; 

    // Bloco 1: Espécie e Detalhes
    iaContent.innerHTML += `
        <div class="ia-block">
            <div class="ia-block-title">🐾 Identificação</div>
            <div class="ia-block-content">
                <p><strong>Espécie:</strong> ${analise.especie || 'Não identificada'}</p>
                <p><strong>Raça:</strong> ${analise.raca || 'SRD'}</p>
            </div>
        </div>
    `;

    // Bloco 2: Comportamento
    iaContent.innerHTML += `
        <div class="ia-block">
            <div class="ia-block-title">👀 O que ele está fazendo</div>
            <div class="ia-block-content">
                <p>${analise.comportamento || 'Comportamento não detalhado.'}</p>
            </div>
        </div>
    `;

    // Bloco 3: Análise Cruzada
    iaContent.innerHTML += `
        <div class="ia-block">
            <div class="ia-block-title">⚖️ Análise Cruzada (Raça x Comportamento)</div>
            <div class="ia-block-content">
                <p>${analise.analise_raca || 'Análise de raça não detalhada.'}</p>
            </div>
        </div>
    `;

    // Bloco 4: Dicas
    if (analise.dicas && analise.dicas.length > 0) {
        let dicasHtml = analise.dicas.map(dica => `<li>${dica}</li>`).join('');
        iaContent.innerHTML += `
            <div class="ia-block">
                <div class="ia-block-title">💡 Dicas de Cuidado</div>
                <div class="ia-block-content">
                    <ul class="ia-tips-list">${dicasHtml}</ul>
                </div>
            </div>
        `;
    }

    // Bloco 5: Tratamento
    if (analise.tratamento && analise.tratamento !== "Não se aplica") {
        iaContent.innerHTML += `
            <div class="ia-block">
                <div class="ia-block-title">🩺 Sugestão de Tratamento</div>
                <div class="ia-block-content" style="background-color: #f0f8ff; padding: 10px; border-left: 4px solid #007bff; border-radius: 4px;">
                    <p>${analise.tratamento}</p>
                </div>
            </div>
        `;
    }

    // Chama a função de monetização
    renderizarProdutos(jsonString);

    salvarHistorico(jsonString, currentCategory, segundos);
    feedbackContainer.style.display = 'block';
}

// ==========================================
// MONETIZAÇÃO (AFILIADOS) - ITEM 1
// ==========================================
const bancoProdutos = [
    { tag: 'ansiedade', nome: 'Brinquedo Interativo', preco: 'R$ 45,90', link: 'https://www.petz.com.br/busca?q=brinquedo' },
    { tag: 'pele', nome: 'Ração Pele e Pelo', preco: 'R$ 189,90', link: 'https://www.petz.com.br/busca?q=racao+pele' },
    { tag: 'articula', nome: 'Suplemento Articulações', preco: 'R$ 89,90', link: 'https://www.petz.com.br/busca?q=condroitina' },
    { tag: 'peso', nome: 'Ração Light', preco: 'R$ 150,00', link: 'https://www.petz.com.br/busca?q=racao+light' },
    { tag: 'geral', nome: 'Petiscos Naturais', preco: 'R$ 25,90', link: 'https://www.petz.com.br/busca?q=petiscos' }
];

function renderizarProdutos(textoIA) {
    const bloco = document.getElementById('blocoProdutos');
    const lista = document.getElementById('listaProdutos');
    lista.innerHTML = '';
    
    let produtosParaMostrar = [];
    const texto = textoIA.toLowerCase();

    if (texto.includes('ansiedade') || texto.includes('estresse') || texto.includes('agita')) produtosParaMostrar.push(bancoProdutos[0]);
    if (texto.includes('pele') || texto.includes('pelo') || texto.includes('coceira')) produtosParaMostrar.push(bancoProdutos[1]);
    if (texto.includes('articula') || texto.includes('osso') || texto.includes('idoso')) produtosParaMostrar.push(bancoProdutos[2]);
    if (texto.includes('peso') || texto.includes('obesidade')) produtosParaMostrar.push(bancoProdutos[3]);

    if (produtosParaMostrar.length === 0) produtosParaMostrar.push(bancoProdutos[4]);

    produtosParaMostrar.slice(0, 2).forEach(prod => {
        lista.innerHTML += `
            <div style="border: 1px solid #E2E8F0; padding: 10px; border-radius: 8px; text-align: center; background: #fff;">
                <h4 style="font-size: 13px; margin-bottom: 5px; height: 35px;">${prod.nome}</h4>
                <p style="color: #E53E3E; font-weight: bold; margin-bottom: 10px;">${prod.preco}</p>
                <a href="${prod.link}" target="_blank" style="background: #0056b3; color: white; padding: 6px 10px; border-radius: 4px; text-decoration: none; font-size: 12px; display:block;">Ver na Petz</a>
            </div>
        `;
    });
    bloco.style.display = 'block';
}

// ==========================================
// FEEDBACK E RELATÓRIOS (MANTIDOS)
// ==========================================
btnThumbsUp.addEventListener('click', () => salvarAvaliacao("positivo", ""));
btnThumbsDown.addEventListener('click', () => { feedbackButtons.style.display = 'none'; feedbackCommentBox.style.display = 'flex'; });
btnSendFeedback.addEventListener('click', () => { salvarAvaliacao("negativo", feedbackComment.value.trim()); });

function salvarAvaliacao(tipo, comentario) {
    const feedbackData = { tipo, comentario, categoriaIA: currentCategory, textoIA: lastAIResult, data: new Date().toISOString() };
    const feedbacks = JSON.parse(localStorage.getItem('vigiapet_feedbacks') || '[]');
    feedbacks.push(feedbackData);
    localStorage.setItem('vigiapet_feedbacks', JSON.stringify(feedbacks));

    fetch('/.netlify/functions/salvar-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
    }).catch((err) => console.warn('Erro ao enviar feedback:', err));

    feedbackButtons.style.display = 'none';
    feedbackCommentBox.style.display = 'none';
    feedbackThanks.style.display = 'block';
}

// Relatórios e Históricos
vetReportBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    if (historico.length === 0) { alert("Ainda não há histórico."); return; }

    let texto = `RELATÓRIO VIGIA PET\nGerado em: ${new Date().toLocaleString('pt-BR')}\n---\nTEMPO: Descanso ${Math.floor(stats.descanco/60)}m | Alimentação ${Math.floor(stats.alimentacao/60)}m | Atividade ${Math.floor(stats.atividade/60)}m\n---\n`;
    
    historico.forEach((item, index) => {
        let raca = "N/A", tratamento = "N/A";
        try { const p = JSON.parse(item.texto); raca = `${p.especie} - ${p.raca}`; tratamento = p.tratamento || "N/A"; } catch(e) {}
        texto += `${index + 1}. Data: ${item.data} | Raça: ${raca} | Cat: ${item.categoria.toUpperCase()}\nTratamento: ${tratamento}\n\n`;
    });

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `relatorio_${new Date().getTime()}.txt`; a.click();
});

whatsappBtn.addEventListener('click', () => {
    if (!lastAIResult) { alert("Faça uma análise primeiro!"); return; }
    let trat = "";
    try { const p = JSON.parse(lastAIResult); if(p.tratamento && p.tratamento !== "Não se aplica") trat = `\n*TRATAMENTO:*\n${p.tratamento}\n`; } catch(e) {}
    const texto = `*VIGIA PET*\n\n${lastAIResult}${trat}\n*RESUMO:*\nDescanso: ${Math.floor(stats.descanco/60)}m | Alimentação: ${Math.floor(stats.alimentacao/60)}m | Atividade: ${Math.floor(stats.atividade/60)}m`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
});

historyBtn.addEventListener('click', () => {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historyList.innerHTML = historico.length === 0 ? '<li>Nenhuma análise.</li>' : historico.map(i => `<li><strong>${i.data}</strong><br>${i.categoria.toUpperCase()} · ${i.segundos}s</li>`).join('');
    historyModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => { historyModal.style.display = 'none'; });

function salvarHistorico(texto, categoria, segundos) {
    const historico = JSON.parse(localStorage.getItem('vigiapet_history') || '[]');
    historico.unshift({ data: new Date().toLocaleString('pt-BR'), texto, categoria, segundos });
    if (historico.length > 10) historico.pop();
    localStorage.setItem('vigiapet_history', JSON.stringify(historico));
}