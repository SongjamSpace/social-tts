import { initializeApp, getApps, cert, applicationDefault, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FB_PROJECT_ID;
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  let credential;
  if (keyJson) {
    try {
      const key = JSON.parse(keyJson) as Record<string, unknown>;
      credential = cert(key);
    } catch (e) {
      console.error("[firebase-admin] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e);
    }
  }
  if (!credential) {
    try {
      credential = applicationDefault();
    } catch {
      // GOOGLE_APPLICATION_CREDENTIALS not set or invalid; Firestore calls will fail
    }
  }

  app = initializeApp({
    projectId,
    ...(credential && { credential }),
  });
  return app;
}

export function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}
