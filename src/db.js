/**
 * Stockage hors-ligne via IndexedDB
 * File d'attente de synchronisation avec Supabase au retour du réseau
 */

import { supabase } from './supabaseClient.js';

const DB_NAME = 'educ-ceb-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_changes';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingChange(tableName, action, payload) {
  const database = await openDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const change = {
    table_name: tableName,
    action,
    payload,
    created_at: new Date().toISOString(),
    processed: false
  };
  store.add(change);
  return tx.complete;
}

export async function getPendingChanges() {
  const database = await openDB();
  const tx = database.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingChange(id) {
  const database = await openDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return tx.complete;
}

export async function clearProcessedChanges() {
  const database = await openDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      req.result.forEach(change => {
        if (change.processed) store.delete(change.id);
      });
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function syncPendingChanges(user) {
  const changes = await getPendingChanges();
  for (const change of changes) {
    try {
      let result;
      const { table_name, action, payload } = change;

      if (action === 'insert') {
        result = await supabase.from(table_name).insert(payload);
      } else if (action === 'update') {
        const { id, ...updateData } = payload;
        result = await supabase.from(table_name).update(updateData).eq('id', id);
      } else if (action === 'delete') {
        result = await supabase.from(table_name).delete().eq('id', payload.id);
      }

      if (result.error) throw result.error;

      const database = await openDB();
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      change.processed = true;
      store.put(change);
      await tx.complete;
    } catch (err) {
      console.error(`Erreur sync ${change.table_name}:`, err.message);
    }
  }
  await clearProcessedChanges();
}

export function setupOnlineSync(onSyncComplete) {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await syncPendingChanges();
        if (onSyncComplete) onSyncComplete();
      }
    } catch (e) {
      console.error('Erreur sync auto:', e);
    }
  });
}