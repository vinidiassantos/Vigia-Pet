import { initFirebase, saveBehavior, getHistory } from './firebase-config.js';

let isMonitoring = false;
const video = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

console.log('🚀 VIGIA PET iniciado!');

// Inicializar Firebase test
initFirebase();

// Eventos
startBtn.addEventListener('click', startMonitoring);
stopBtn.addEventListener('click', stopMonitoring);

async function startMonitoring() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = ;
        await video.play();
        
        isMonitoring = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        document.getElementById('behaviorText').textContent = 'Monitorando...';
        document.getElementById('behaviorIcon').textContent = '👀';
        
        await saveBehavior('iniciou_monitoramento');
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao acessar câmera');
    }
}

function stopMonitoring() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    isMonitoring = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    document.getElementById('behaviorText').textContent = 'Pausado';
    document.getElementById('behaviorIcon').textContent = '⏸️';
}