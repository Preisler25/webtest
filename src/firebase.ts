import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyALcQXGshu0qWpuJXkJdn3QL_u8gradD9k',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'fluencypilot.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'fluencypilot',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'fluencypilot.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '788946891730',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    '1:788946891730:web:replace-with-your-web-app-id',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
