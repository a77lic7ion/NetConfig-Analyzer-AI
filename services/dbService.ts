import { AnalysisFinding, Company, Site, SavedParsedConfig, SavedCliScript, ParsedConfigData, CliScriptResponse } from '../types';

const DB_NAME = 'NetConfigDB';
const DB_VERSION = 2; // Incremented version to trigger onupgradeneeded
const FINDINGS_STORE = 'findings';
const COMPANIES_STORE = 'companies';
const SITES_STORE = 'sites';
const SAVED_PARSED_CONFIGS_STORE = 'savedParsedConfigs';
const SAVED_CLI_SCRIPTS_STORE = 'savedCliScripts';

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
      if (!dbInstance.objectStoreNames.contains(FINDINGS_STORE)) {
        dbInstance.createObjectStore(FINDINGS_STORE, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(COMPANIES_STORE)) {
        dbInstance.createObjectStore(COMPANIES_STORE, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(SITES_STORE)) {
        const siteStore = dbInstance.createObjectStore(SITES_STORE, { keyPath: 'id' });
        siteStore.createIndex('companyId', 'companyId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains(SAVED_PARSED_CONFIGS_STORE)) {
        const configStore = dbInstance.createObjectStore(SAVED_PARSED_CONFIGS_STORE, { keyPath: 'id' });
        configStore.createIndex('siteId', 'siteId', { unique: false });
      }
      if (!dbInstance.objectStoreNames.contains(SAVED_CLI_SCRIPTS_STORE)) {
        const scriptStore = dbInstance.createObjectStore(SAVED_CLI_SCRIPTS_STORE, { keyPath: 'id' });
        scriptStore.createIndex('siteId', 'siteId', { unique: false });
      }
    };
  });
};

// --- Findings ---
export const saveFindings = (findings: AnalysisFinding[]): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!db) return reject("DB not initialized");
    const transaction = db.transaction([FINDINGS_STORE], 'readwrite');
    const store = transaction.objectStore(FINDINGS_STORE);
    const clearRequest = store.clear();
    clearRequest.onerror = () => reject("Error clearing store");
    clearRequest.onsuccess = () => {
        if (findings.length === 0) {
            resolve(true);
            return;
        }
        let completed = 0;
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
    const transaction = db.transaction([FINDINGS_STORE], 'readonly');
    const store = transaction.objectStore(FINDINGS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject("Error fetching findings");
  });
};

export const clearFindings = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject("DB not initialized");
      const transaction = db.transaction([FINDINGS_STORE], 'readwrite');
      const store = transaction.objectStore(FINDINGS_STORE);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject("Error clearing findings");
    });
};

// --- Companies ---

export const addCompany = (name: string): Promise<Company> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([COMPANIES_STORE], 'readwrite');
        const store = transaction.objectStore(COMPANIES_STORE);
        const company: Company = { id: `company-${Date.now()}`, name };
        const request = store.add(company);
        request.onsuccess = () => resolve(company);
        request.onerror = () => reject("Error adding company");
    });
};

export const getCompanies = (): Promise<Company[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([COMPANIES_STORE], 'readonly');
        const store = transaction.objectStore(COMPANIES_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Error fetching companies");
    });
};

export const deleteCompany = (companyId: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        if (!db) return reject("DB not initialized");
        try {
            const sites = await getSites(companyId);
            for (const site of sites) {
                await deleteSite(site.id);
            }
            const transaction = db.transaction([COMPANIES_STORE], 'readwrite');
            const store = transaction.objectStore(COMPANIES_STORE);
            const request = store.delete(companyId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject("Error deleting company");
        } catch (error) {
            reject(error);
        }
    });
};

// --- Sites ---

export const addSite = (name: string, companyId: string): Promise<Site> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SITES_STORE], 'readwrite');
        const store = transaction.objectStore(SITES_STORE);
        const site: Site = { id: `site-${Date.now()}`, name, companyId };
        const request = store.add(site);
        request.onsuccess = () => resolve(site);
        request.onerror = () => reject("Error adding site");
    });
};

export const getSites = (companyId: string): Promise<Site[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SITES_STORE], 'readonly');
        const store = transaction.objectStore(SITES_STORE);
        const index = store.index('companyId');
        const request = index.getAll(companyId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Error fetching sites");
    });
};

export const deleteSite = (siteId: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        if (!db) return reject("DB not initialized");
        try {
            const configs = await getSavedParsedConfigs(siteId);
            for (const config of configs) {
                await deleteSavedParsedConfig(config.id);
            }
            const scripts = await getSavedCliScripts(siteId);
            for (const script of scripts) {
                await deleteSavedCliScript(script.id);
            }
            const transaction = db.transaction([SITES_STORE], 'readwrite');
            const store = transaction.objectStore(SITES_STORE);
            const request = store.delete(siteId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject("Error deleting site");
        } catch (error) {
            reject(error);
        }
    });
};


// --- Saved Parsed Configs ---

export const saveParsedConfig = (config: ParsedConfigData, siteId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_PARSED_CONFIGS_STORE], 'readwrite');
        const store = transaction.objectStore(SAVED_PARSED_CONFIGS_STORE);
        const savedConfig: SavedParsedConfig = {
            ...config,
            id: `config-${Date.now()}`,
            siteId,
            savedAt: Date.now()
        };
        const request = store.add(savedConfig);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Error saving parsed config");
    });
};

export const getSavedParsedConfigs = (siteId: string): Promise<SavedParsedConfig[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_PARSED_CONFIGS_STORE], 'readonly');
        const store = transaction.objectStore(SAVED_PARSED_CONFIGS_STORE);
        const index = store.index('siteId');
        const request = index.getAll(siteId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Error fetching saved configs");
    });
};

export const deleteSavedParsedConfig = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_PARSED_CONFIGS_STORE], 'readwrite');
        const store = transaction.objectStore(SAVED_PARSED_CONFIGS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Error deleting saved config");
    });
};

// --- Saved CLI Scripts ---

export const saveCliScript = (script: CliScriptResponse, query: string, siteId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_CLI_SCRIPTS_STORE], 'readwrite');
        const store = transaction.objectStore(SAVED_CLI_SCRIPTS_STORE);
        const savedScript: SavedCliScript = {
            ...script,
            id: `script-${Date.now()}`,
            siteId,
            query,
            savedAt: Date.now()
        };
        const request = store.add(savedScript);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Error saving cli script");
    });
};

export const getSavedCliScripts = (siteId: string): Promise<SavedCliScript[]> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_CLI_SCRIPTS_STORE], 'readonly');
        const store = transaction.objectStore(SAVED_CLI_SCRIPTS_STORE);
        const index = store.index('siteId');
        const request = index.getAll(siteId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Error fetching saved scripts");
    });
};

export const deleteSavedCliScript = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const transaction = db.transaction([SAVED_CLI_SCRIPTS_STORE], 'readwrite');
        const store = transaction.objectStore(SAVED_CLI_SCRIPTS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Error deleting saved script");
    });
};
