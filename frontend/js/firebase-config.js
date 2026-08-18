// 🔥 CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAuidFnEQ3Zke_wKi5dbD44JErLshi40Sc",
  authDomain: "vigia-pet.firebaseapp.com",
  projectId: "vigia-pet",
  storageBucket: "vigia-pet.firebasestorage.app",
  messagingSenderId: "763932392440",
  appId: "1:763932392440:web:39866711d132f48431740d",
  measurementId: "G-12V07LE6D7"
};

// Importar Firebase (CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp,
    getDocs,
    query,
    orderBy,
    where,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log('✅ Firebase conectado com sucesso!');

// Exportar
export { db, auth, collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, doc, getDoc, updateDoc, deleteDoc, onSnapshot };
export { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut };