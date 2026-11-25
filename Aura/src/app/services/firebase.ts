import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

const app =
  getApps().length > 0 ? getApp() : initializeApp(environment.firebase);

/**
 * Firestore con auto-detección de long polling para evitar bloqueos
 * en redes móviles, Wi-Fi universitarios y Android WebView.
 */
export const firestoreDb: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
