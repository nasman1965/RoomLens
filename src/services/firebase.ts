// ─────────────────────────────────────────────────────────────────────────────
// Firebase configuration for RoomLensPro
//
// Setup instructions:
//   1. Go to https://console.firebase.google.com
//   2. Create a project called "roomlenspro"
//   3. Add a Web app (</> icon) → copy the firebaseConfig object
//   4. Enable Authentication → Email/Password provider
//   5. Create a Firestore Database → start in production mode → choose region
//   6. Enable Storage (for photos / floor plan PDFs)
//   7. Copy your config values into .env:
//
//   EXPO_PUBLIC_FIREBASE_API_KEY=...
//   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
//   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
//   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
//   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
//   EXPO_PUBLIC_FIREBASE_APP_ID=...
//
// FREE tier limits (Spark plan):
//   • Auth:      unlimited users
//   • Firestore: 50K reads / 20K writes / 20K deletes per day
//   • Storage:   5 GB total, 1 GB/day download
//   • No credit card required
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // @ts-ignore — React Native specific
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? 'YOUR_API_KEY',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? 'your-project.firebaseapp.com',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? 'your-project-id',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? 'your-project.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? '1:000000000000:web:xxxx',
};

// Initialise Firebase app only once (hot-reload safety)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth with AsyncStorage persistence so sessions survive app restarts
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialised (fast-refresh)
  auth = getAuth(app);
}

const db      = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
