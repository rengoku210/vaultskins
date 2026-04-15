import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFnMkU2KnG1wm-b_GwlFvEru53rntU0yo",
  authDomain: "vaultskins-marketplace0.firebaseapp.com",
  projectId: "vaultskins-marketplace0",
  storageBucket: "vaultskins-marketplace0.firebasestorage.app",
  messagingSenderId: "201466979926",
  appId: "1:201466979926:web:e070432d6fc7c2d87b7df7",
  measurementId: "G-PEP895D368"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (Only works in browser environment)
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// Export auth and db instances for use in components
export const auth = getAuth(app);
export const db = getFirestore(app);
export { analytics };
export default app;
