import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined

export const firebaseConfigError: string | null = !apiKey
  ? 'Firebase keys are missing. Add VITE_FIREBASE_API_KEY and the other VITE_FIREBASE_* secrets to your GitHub repository settings (Settings → Secrets and variables → Actions), then redeploy.'
  : null

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY ?? '') as string,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '') as string,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '') as string,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '') as string,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '') as string,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID ?? '') as string,
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? '') as string,
}

const app = initializeApp(firebaseConfig)

if (!firebaseConfigError && firebaseConfig.measurementId) {
  void isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app)
    }
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
