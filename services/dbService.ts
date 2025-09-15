import { AnalysisFinding } from '../types';

const DB_NAME = 'NetConfigDB';
const DB_VERSION = 1;
const STORE_NAME = 'findings';
let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (db) {
        return resolve(true);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
        console.error("Error opening DB");
        reject("Error opening DB");
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };
    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveFindings = (findings: AnalysisFinding[]): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let completed = 0;
    
    // First, clear existing findings to not have duplicates from previous analysis runs on same files
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject("Error clearing store");
    clearRequest.onsuccess = () => {
        if (findings.length === 0) {
            resolve(true);
            return;
        }
        findings.forEach(finding => {
            const putRequest = store.put(finding);
            putRequest.onsuccess = () => {
                completed++;
                if (completed === findings.length) resolve(true);
            };
            putRequest.onerror = () => reject("Error saving finding");
        });
    }
  });
};

export const getAllFindings = (): Promise<AnalysisFinding[]> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Error fetching findings");
  });
};

export const clearFindings = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject("DB not initialized");
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject("Error clearing findings");
    });
};
