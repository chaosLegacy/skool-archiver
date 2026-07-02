const DB_NAME = "skool-archiver";
const DB_VERSION = 1;

export const STORES = {
  lessons: "lessons", // key: `${jobId}:${lessonId}` -> ExtractedLesson
  files: "files" // key: `${jobId}:${lessonId}:${kind}:${name}` -> Blob
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.lessons)) {
        db.createObjectStore(STORES.lessons);
      }
      if (!db.objectStoreNames.contains(STORES.files)) {
        db.createObjectStore(STORES.files);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

const IDB_TIMEOUT_MS = 15000;

/** IndexedDB transactions have no built-in timeout, and a stuck one (rare,
 *  but real — a service worker can be suspended/resumed mid-transaction, or
 *  a transaction can get stuck behind contention from many concurrent
 *  reads/writes) means the surrounding promise just never resolves or
 *  rejects. That's indistinguishable from a genuine hang with no error ever
 *  surfacing. Racing every operation against a timeout turns that into a
 *  normal, catchable failure instead of a silent freeze. */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`IndexedDB ${label} timed out after ${IDB_TIMEOUT_MS}ms`));
    }, IDB_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return withTimeout(
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    }),
    `get(${store})`
  );
}

export async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return withTimeout(
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
    `set(${store})`
  );
}

export async function idbDeletePrefix(store: string, prefix: string): Promise<void> {
  const db = await openDb();
  return withTimeout(
    new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const cursorReq = tx.objectStore(store).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    }),
    `deletePrefix(${store})`
  );
}
