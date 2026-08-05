// Configuração do Firebase - SUBSTITUA COM SUAS CREDENCIAIS
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO_ID",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Importar Firebase (CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    limit, 
    getDocs,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let db;
let app;

export function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log('✅ Firebase conectado com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar Firebase:', error);
        return false;
    }
}

export async function saveBehavior(behavior) {
    try {
        const docRef = await addDoc(collection(db, 'behaviors'), {
            behavior: behavior,
            timestamp: serverTimestamp(),
            sessionId: sessionStorage.getItem('sessionId') || 'default',
            device: navigator.userAgent
        });
        console.log('✅ Comportamento salvo:', behavior);
        return docRef.id;
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        return null;
    }
}

export async function getHistory(limitCount = 100) {
    try {
        const q = query(
            collection(db, 'behaviors'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        const history = [];
        snapshot.forEach(doc => {
            history.push({ id: doc.id, ...doc.data() });
        });
        return history;
    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        return [];
    }
}

export function setupRealtime(callback) {
    try {
        const q = query(
            collection(db, 'behaviors'),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        
        onSnapshot(q, (snapshot) => {
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });
            callback(data);
        });
    } catch (error) {
        console.error('❌ Erro no realtime:', error);
    }
}