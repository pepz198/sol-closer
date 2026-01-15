// Key untuk localStorage per wallet
export const getHistoryKey = (publicKey) => {
  return `tx_history_${publicKey}`;
};

// Load history dari localStorage
export const loadHistory = (publicKey) => {
  if (!publicKey) return [];
  
  try {
    const key = getHistoryKey(publicKey);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to load history:", err);
    return [];
  }
};

// Tambah transaksi baru ke history
export const addHistory = (publicKey, entry) => {
  if (!publicKey) return;

  try {
    const key = getHistoryKey(publicKey);
    const current = loadHistory(publicKey);
    
    const newEntry = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      ...entry,
    };

    // Simpan max 100 transaksi terakhir
    const updated = [newEntry, ...current].slice(0, 100);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save history:", err);
  }
};

// Clear semua history
export const clearHistory = (publicKey) => {
  if (!publicKey) return;
  
  try {
    const key = getHistoryKey(publicKey);
    localStorage.removeItem(key);
  } catch (err) {
    console.error("Failed to clear history:", err);
  }
};
