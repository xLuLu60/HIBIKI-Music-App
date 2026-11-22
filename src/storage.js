export function openDatabase(name, trackStore) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDB.open(name, 1);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(trackStore)) {
        database.createObjectStore(trackStore, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || Error('Ouverture de la bibliothèque impossible.'));
    request.onblocked = () => reject(Error('Ferme les autres onglets HIBIKI puis réessaie.'));
  });
}

export function getAll(database, store) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = database.transaction(store).objectStore(store).getAll();
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || Error('Lecture de la bibliothèque impossible.'));
  });
}

export function put(database, store, value) {
  return new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || Error('Écriture dans la bibliothèque impossible.'));
    transaction.onabort = () => reject(transaction.error || Error('Écriture annulée.'));
  });
}

export function del(database, store, key) {
  return new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction(store, 'readwrite');
      transaction.objectStore(store).delete(key);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || Error('Suppression de la bibliothèque impossible.'));
    transaction.onabort = () => reject(transaction.error || Error('Suppression annulée.'));
  });
}
