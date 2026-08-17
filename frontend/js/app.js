// ============================================
// VIGIA PET - APP PRINCIPAL
// ============================================

// Elementos
const vigiarBtn = document.getElementById('vigiarBtn');
const statusText = document.getElementById('statusText');
const video = document.getElementById('video');
const cameraArea = document.getElementById('cameraArea');
const behaviorIcon = document.getElementById('behaviorIcon');
const behaviorText = document.getElementById('behaviorText');

let isVigiando = false;
let stream = null;

// ============================================
// FUNÇÃO PRINCIPAL: VIGIAR
// ============================================

async function toggleVigiar() {
    if (!isVigiando) {
        await iniciarVigiar();
    } else {
        pararVigiar();
    }
}

async function iniciarVigiar() {
    try {
        // Acessar câmera
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        video.srcObject = stream;
        await video.play();
        
        // Mostrar câmera
        cameraArea.style.display = 'block';
        
        // Atualizar estado
        isVigiando = true;
        vigiarBtn.classList.add('vigilando');
        vigiarBtn.querySelector('.text').textContent = 'PARAR';
        vigiarBtn.querySelector('.icon').textContent = '⏹️';
        statusText.textContent = '🔴 Vigilando...';
        statusText.className = 'status-text ativo';
        
        // Iniciar detecção simulada
        iniciarDetecao();
        
    } catch (error) {
        console.error('Erro na câmera:', error);
        alert('❌ Erro ao acessar a câmera. Verifique as permissões.');
    }
}

function pararVigiar() {
    // Parar câmera
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    video.srcObject = null;
    cameraArea.style.display = 'none';
    
    // Resetar estado
    isVigiando = false;
    vigiarBtn.classList.remove('vigilando');
    vigiarBtn.querySelector('.text').textContent = 'VIGIAR';
    vigiarBtn.querySelector('.icon').textContent = '📷';
    statusText.textContent = 'Toque para começar a vigiar';
    statusText.className = 'status-text';
    
    // Resetar comportamento
    behaviorIcon.textContent = '🔍';
    behaviorText.textContent = 'Analisando...';
}

// ============================================
// DETECÇÃO SIMULADA
// ============================================

let detecaoInterval = null;

function iniciarDetecao() {
    const behaviors = [
        { icon: '😴', text: 'Dormindo', type: 'dormindo' },
        { icon: '🍖', text: 'Comendo', type: 'comendo' },
        { icon: '🐕', text: 'Agitado', type: 'agitado' }
    ];
    
    let lastBehavior = '';
    
    detecaoInterval = setInterval(() => {
        if (!isVigiando) {
            clearInterval(detecaoInterval);
            return;
        }
        
        // Escolher comportamento aleatório
        const random = behaviors[Math.floor(Math.random() * behaviors.length)];
        
        // Evitar repetir o mesmo
        if (random.type === lastBehavior) return;
        lastBehavior = random.type;
        
        // Atualizar interface
        behaviorIcon.textContent = random.icon;
        behaviorText.textContent = random.text;
        
        // Atualizar estatísticas (simulação)
        atualizarEstatisticas(random.type);
        
        console.log(`🐾 Comportamento: ${random.text}`);
    }, 3000);
}

// ============================================
// ESTATÍSTICAS (SIMULAÇÃO)
// ============================================

let stats = { dormindo: 0, comendo: 0, agitado: 0 };

function atualizarEstatisticas(tipo) {
    stats[tipo] = (stats[tipo] || 0) + 1;
    
    const total = stats.dormindo + stats.comendo + stats.agitado;
    if (total === 0) return;
    
    // Calcular minutos (simulação)
    const sleepMin = Math.round((stats.dormindo / total) * 30);
    const eatMin = Math.round((stats.comendo / total) * 15);
    const activeMin = Math.round((stats.agitado / total) * 20);
    
    document.getElementById('sleepTime').textContent = `${sleepMin}h ${sleepMin % 60}m`;
    document.getElementById('eatTime').textContent = `${eatMin}h ${eatMin % 60}m`;
    document.getElementById('activeTime').textContent = `${activeMin}h ${activeMin % 60}m`;
}

// ============================================
// EVENTOS
// ============================================

vigiarBtn.addEventListener('click', toggleVigiar);

// ============================================
// EXPORTAR DADOS
// ============================================

document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {
        stats: stats,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vigia_pet_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// ============================================
// HISTÓRICO (SIMULAÇÃO)
// ============================================

document.getElementById('historyBtn').addEventListener('click', () => {
    alert('📊 Histórico:\n' + 
          `😴 Dormindo: ${stats.dormindo} vezes\n` +
          `🍖 Comendo: ${stats.comendo} vezes\n` +
          `🐕 Agitado: ${stats.agitado} vezes`);
});

console.log('🐾 VIGIA PET iniciado!');