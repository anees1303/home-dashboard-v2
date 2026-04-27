// =====================================================================
// FIREBASE CONFIGURATION
// =====================================================================
// Replace the values below with YOUR Firebase project config.
// Get these from: Firebase Console → Project Settings → Your apps → Config
// =====================================================================

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkN8OIWgnyVW0Ie1csf7nx_ze4NchDDVg",
  authDomain: "my-home-dashbaord.firebaseapp.com",
  projectId: "my-home-dashbaord",
  storageBucket: "my-home-dashbaord.firebasestorage.app",
  messagingSenderId: "881334942847",
  appId: "1:881334942847:web:18d9976b70d8194435d34a"
};

// Unique ID for your home project — keep this the same across all family devices
export const PROJECT_DOC_ID = "family-home-build-001";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
