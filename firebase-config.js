import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCwYE0zVL7aCNzH3ma9rr7-bReVmHFKNOw",
  authDomain: "blackbox-9023b.firebaseapp.com",
  databaseURL: "https://blackbox-9023b-default-rtdb.firebaseio.com",
  projectId: "blackbox-9023b",
  storageBucket: "blackbox-9023b.firebasestorage.app",
  messagingSenderId: "703288341721",
  appId: "1:703288341721:web:dd1b2629872b6e46a53ac8",
  measurementId: "G-FNMQ1PJ6X1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);         // Firestore – rider profiles
const rtdb = getDatabase(app);        // Realtime Database – ESP32 telemetry

export { auth, db, rtdb };

