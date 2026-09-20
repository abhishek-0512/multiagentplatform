// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBjeLU9bLoyTqMBB-hAhRGcPoEBZQ6GydY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "multiagentplatform-d8af3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "multiagentplatform-d8af3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "multiagentplatform-d8af3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "981329447373",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:981329447373:web:559518ace87e11999e1c84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const auth=getAuth(app)
export const googleProvider=new GoogleAuthProvider()
googleProvider.setCustomParameters({
  prompt: "select_account"
})