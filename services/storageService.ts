import { Project, ProjectStatus } from "../types";

const DB_NAME = 'ScriptLiftDB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_FILES = 'files';

// Open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Save a new project and its file
export const saveProject = async (project: Project, file: File | Blob): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_FILES], 'readwrite');
  
  tx.objectStore(STORE_PROJECTS).put(project);
  tx.objectStore(STORE_FILES).put({ id: project.id, blob: file });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Update project metadata (e.g. status change, transcription result)
export const updateProject = async (project: Project): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).put(project);
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Get all projects (metadata only)
export const getAllProjects = async (): Promise<Project[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const store = tx.objectStore(STORE_PROJECTS);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort by newest first
      const projects = request.result as Project[];
      resolve(projects.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => reject(request.error);
  });
};

// Get the actual audio file blob
export const getProjectFile = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readonly');
  const store = tx.objectStore(STORE_FILES);
  
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error);
  });
};

// Delete a project
export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_FILES], 'readwrite');
  
  tx.objectStore(STORE_PROJECTS).delete(id);
  tx.objectStore(STORE_FILES).delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// Cleanup expired projects (older than 14 days)
export const cleanupExpiredProjects = async (): Promise<number> => {
  const db = await openDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_FILES], 'readwrite');
  const store = tx.objectStore(STORE_PROJECTS);
  const fileStore = tx.objectStore(STORE_FILES);
  
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const projects = request.result as Project[];
      let deletedCount = 0;

      projects.forEach(p => {
        if (p.expiresAt < now) {
          store.delete(p.id);
          fileStore.delete(p.id);
          deletedCount++;
        }
      });
      
      resolve(deletedCount);
    };
    request.onerror = () => reject(request.error);
  });
};

// Calculate total storage used in bytes by iterating over all stored files
export const getStorageUsage = async (): Promise<number> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readonly');
  const store = tx.objectStore(STORE_FILES);
  let totalSize = 0;

  return new Promise((resolve, reject) => {
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const fileData = cursor.value;
        if (fileData.blob) {
            totalSize += fileData.blob.size;
        }
        cursor.continue();
      } else {
        resolve(totalSize);
      }
    };
    request.onerror = () => reject(request.error);
  });
};