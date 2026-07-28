export const firebaseConfig={
  apiKey:"AIzaSyBVr0hDZaYFaHbXd4eqXflHvWREG2KPq6Q",
  authDomain:"inclusive-health-open-house.firebaseapp.com",
  databaseURL:"REPLACE_WITH_FIREBASE_DATABASE_URL",
  projectId:"inclusive-health-open-house",
  appId:"1:101856084348:web:c82969c6a3c8821540e4f9"
};

export const firebaseConfigured=!Object.values(firebaseConfig).some(value=>!value||value.includes('REPLACE_WITH'));
