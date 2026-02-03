import { ImportedOBJModel, SerializedGeometry } from './objImporter';

const DB_NAME = 'flipnote-obj-library';
const DB_VERSION = 1;
const STORE_NAME = 'models';

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// Generate unique ID
const generateId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Save a model to the library
export const saveModel = async (
  name: string,
  fileName: string,
  geometry: SerializedGeometry
): Promise<ImportedOBJModel> => {
  const db = await initDB();
  
  const model: ImportedOBJModel = {
    id: generateId(),
    name,
    fileName,
    geometry,
    createdAt: Date.now(),
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(model);
    
    request.onsuccess = () => resolve(model);
    request.onerror = () => reject(request.error);
  });
};

// Save multiple models
export const saveModels = async (
  models: { name: string; fileName: string; geometry: SerializedGeometry }[]
): Promise<ImportedOBJModel[]> => {
  const savedModels: ImportedOBJModel[] = [];
  
  for (const model of models) {
    const saved = await saveModel(model.name, model.fileName, model.geometry);
    savedModels.push(saved);
  }
  
  return savedModels;
};

// Get all models from the library
export const getAllModels = async (): Promise<ImportedOBJModel[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const models = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(models);
    };
    request.onerror = () => reject(request.error);
  });
};

// Get a single model by ID
export const getModelById = async (id: string): Promise<ImportedOBJModel | null> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

// Delete a model from the library
export const deleteModel = async (id: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Clear all models from the library
export const clearAllModels = async (): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Check if a model with the same filename already exists
export const modelExistsByFileName = async (fileName: string): Promise<boolean> => {
  const models = await getAllModels();
  return models.some(m => m.fileName.toLowerCase() === fileName.toLowerCase());
};
