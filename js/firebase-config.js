import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAiEE617Oy2xKSP76RIHY1qgxYyraxssvs",
    authDomain: "loyality-management-e083e.firebaseapp.com",
    projectId: "loyality-management-e083e",
    storageBucket: "loyality-management-e083e.firebasestorage.app",
    messagingSenderId: "131027720354",
    appId: "1:131027720354:web:e4103a30a504515d6a5ffb",
    measurementId: "G-1TMWENBSV9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);