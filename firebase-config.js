export const firebaseConfig={apiKey:"REPLACE_WITH_FIREBASE_API_KEY",authDomain:"REPLACE_WITH_PROJECT_ID.firebaseapp.com",databaseURL:"https://REPLACE_WITH_PROJECT_ID-default-rtdb.firebaseio.com",projectId:"REPLACE_WITH_PROJECT_ID",appId:"REPLACE_WITH_FIREBASE_APP_ID"};
export const firebaseConfigured=!Object.values(firebaseConfig).some(value=>!value||value.includes('REPLACE_WITH'));
