import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let app: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  app = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
  });
  return app;
}

export function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}
