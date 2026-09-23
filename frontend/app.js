import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "sua-api-key-simulada",
    projectId: "vigia-pet"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Conecta o frontend ao emulador local rodando na porta 9200
connectFunctionsEmulator(functions, "127.0.0.1", 9200);

// Teste rápido para validar se a função está respondendo:
export async function testarBackendLocal() {
    try {
        const testeFn = httpsCallable(functions, 'teste');
        const res = await testeFn();
        console.log("Resposta do Emulador Local:", res.data);
        alert(res.data.message);
    } catch (err) {
        console.error("Erro ao chamar emulador:", err);
    }
}