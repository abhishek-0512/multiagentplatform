// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "multiagentplatform-d8af3.firebaseapp.com",
  projectId: "multiagentplatform-d8af3",
  storageBucket: "multiagentplatform-d8af3.firebasestorage.app",
  messagingSenderId: "981329447373",
  appId: "1:981329447373:web:559518ace87e11999e1c84",
  measurementId: "G-HB6YY5K5Y9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider=new GoogleAuthProvider()