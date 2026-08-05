// Substitua com suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO_ID",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

export function initFirebase() {
    console.log('✅ Firebase conectado!');
    return true;
}

export async function saveBehavior(behavior) {
    console.log(`📊 Comportamento salvo: ${behavior}`);
    return { id: Date.now() };
}

export async function getHistory() {
    return [
        { behavior: 'dormindo', timestamp: new Date() },
        { behavior: 'comendo', timestamp: new Date() }
    ];
}