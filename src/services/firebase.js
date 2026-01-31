import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDN0zwDiK0MveXRkykgkhG-p-oqBvanF7U",
  authDomain: "websitelerico.firebaseapp.com",
  projectId: "websitelerico",
  storageBucket: "websitelerico.firebasestorage.app",
  messagingSenderId: "848484251740",
  appId: "1:848484251740:web:a7692eeef83ca05e3b4e99",
  measurementId: "G-9V22FDX9N0",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
