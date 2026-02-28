import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApp, getApps } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { 
  initializeAuth, 
  browserSessionPersistence, 
  getReactNativePersistence 
} from "firebase/auth"; 
import { Platform } from "react-native";
// --- 1. DOCTOR PROJECT CONFIG (Hackathon) ---
const doctorConfig = {
  apiKey: "AIzaSyAhntk5YieucC7MRqepYySC00eEDVO5AZQ",
  authDomain: "hackathon-442d5.firebaseapp.com",
  projectId: "hackathon-442d5",
  storageBucket: "hackathon-442d5.firebasestorage.app",
  messagingSenderId: "798980569168",
  appId: "1:798980569168:web:f4aa374ce0ad14a59ab955",
  measurementId: "G-PRLK6MR60Q"
};

// --- 2. MANAGER PROJECT CONFIG (Managers) ---
const managerConfig = {
 apiKey: "AIzaSyCTsfeJWunv2mtdDfmNJipByybV1du-IFg",
  authDomain: "management-c5ed8.firebaseapp.com",
  projectId: "management-c5ed8",
  storageBucket: "management-c5ed8.firebasestorage.app",
  messagingSenderId: "274219109875",
  appId: "1:274219109875:web:d7d51cef0ea22e9ed8d686",
  measurementId: "G-SD69V5LPBC"
};

// -----------------------------------------------------------------
// INITIALIZE DOCTOR PROJECT (Stored in variables: app, db, auth)
// -----------------------------------------------------------------
const app = getApps().length === 0 ? initializeApp(doctorConfig) : getApp();

let db;
try {
  // experimentalForceLongPolling fixes the 5-minute loading hang
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
} catch (e) {
  db = getFirestore(app);
}

const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web' ? browserSessionPersistence : getReactNativePersistence(AsyncStorage)
});

// -----------------------------------------------------------------
// INITIALIZE MANAGER PROJECT (Stored in variables: app2, db2, auth2)
// -----------------------------------------------------------------
// We name this "managerApp" so it doesn't clash with the Doctor project
const app2 = getApps().find(a => a.name === "managerApp") 
            || initializeApp(managerConfig, "managerApp");

let db2;
try {
  db2 = initializeFirestore(app2, { experimentalForceLongPolling: true });
} catch (e) {
  db2 = getFirestore(app2);
}

const auth2 = initializeAuth(app2, {
  persistence: Platform.OS === 'web' ? browserSessionPersistence : getReactNativePersistence(AsyncStorage)
});

// Export all variables to use in your screens
export { db, auth, app, db2, auth2, app2 };
