// Configuration Firebase de l'appli « Iloh Khurdan » (projet khurdans-afc03).
// Projet séparé de Journée RP (journal-rp) : rien ici ne touche l'appli du couple.
// Ces valeurs identifient le projet ; elles ne sont pas secrètes : la sécurité repose sur les règles Firestore.
// SDK chargé par balise <script type="module"> depuis le CDN Google, version proposée par la console :
//   https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js (+ firebase-auth.js, firebase-firestore.js)
export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/13.2.0";
// Hébergement : GitHub Pages du compte nonomisu (domaine autorisé dans Firebase Authentication).
export const PAGES_DOMAIN = "nonomisu.github.io";
export const firebaseConfig = {
  apiKey: "AIzaSyB96THcDj8l8ZJv7TiR-JoTOsZFYJc3K7E",
  authDomain: "khurdans-afc03.firebaseapp.com",
  projectId: "khurdans-afc03",
  storageBucket: "khurdans-afc03.firebasestorage.app",
  messagingSenderId: "834106405044",
  appId: "1:834106405044:web:bbe219932d6c44faba67e1",
};
