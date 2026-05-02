const admin = require('firebase-admin');

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    // Railway converts \n escape sequences to actual newlines inside env var values.
    // Re-escape them so JSON.parse can handle the private key correctly.
    serviceAccount = JSON.parse(raw.replace(/\n/g, '\\n'));
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Convert Firestore Timestamps to ISO strings for JSON serialization
function convertDoc(doc) {
  if (!doc.exists) return null;
  const data = doc.data();
  return { id: doc.id, ...convertTimestamps(data) };
}

function convertTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val && typeof val.toDate === 'function') result[key] = val.toDate().toISOString();
    else if (val && typeof val === 'object' && !Array.isArray(val)) result[key] = convertTimestamps(val);
    else result[key] = val;
  }
  return result;
}

function snapToArr(snap) {
  return snap.docs.map(convertDoc);
}

function toTimestamp(date) {
  if (!date) return null;
  return admin.firestore.Timestamp.fromDate(new Date(date));
}

module.exports = { db, admin, convertDoc, snapToArr, toTimestamp };
