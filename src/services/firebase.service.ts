// Import the functions you need from the SDKs you need
// import { getStripePayments } from "@stripe/firestore-stripe-payments";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
// import { getStripePayments } from "@invertase/firestore-stripe-payments";
import { getAnalytics, logEvent, Analytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE,
    measurementId: process.env.NEXT_PUBLIC_FB_MEASUREMENT_ID,
};

const hasMinimalConfig =
  typeof firebaseConfig.apiKey === "string" &&
  firebaseConfig.apiKey.length > 0 &&
  typeof firebaseConfig.projectId === "string" &&
  firebaseConfig.projectId.length > 0;

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;

if (hasMinimalConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.error("[firebase.service] initializeApp failed:", e);
    const fallback = initializeApp({
      apiKey: "dummy-key-for-fallback",
      projectId: "demo-fallback",
    });
    app = fallback;
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
} else {
  const fallback = initializeApp({
    apiKey: "dummy-key-for-fallback",
    projectId: "demo-fallback",
  });
  app = fallback;
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

let analytics: Analytics | null = null;
if (typeof window !== "undefined" && hasMinimalConfig) {
  try {
    analytics = getAnalytics(app);
  } catch {
    // ignore
  }
}

// const payments = getStripePayments(app, {
//   productsCollection: "products",
//   customersCollection: "customers",
// });

export const logFirebaseEvent = (
  eventName: string,
  eventParams?: { [key: string]: any }
) => {
  if (analytics) {
    logEvent(analytics, eventName, eventParams);
  } else {
    console.log("Firebase Analytics not initialized", eventName, eventParams);
  }
};

export { app, db, storage, auth };
