/**
 * Device identity for ruletka.vip
 *
 * - Existing users keep their localStorage user_id (friends/blocks stay valid).
 * - New installs prefer a key-derived id from a non-extractable ECDSA P-256 key in IndexedDB.
 * - Public key material is never uploaded; only the derived user_id is sent to the bridge.
 */
(function (global) {
  const ID_KEY = "nextface-user-v1";
  const IDB_NAME = "rulet-identity-v1";
  const IDB_STORE = "keys";
  const IDB_KEY = "device";

  function randomUuid() {
    return (
      global.crypto?.randomUUID?.() ||
      "u-" + Math.random().toString(16).slice(2) + Date.now().toString(16)
    );
  }

  function loadLegacy() {
    try {
      const raw = JSON.parse(localStorage.getItem(ID_KEY) || "{}");
      if (!raw.user_id) {
        raw.user_id = randomUuid();
        raw.name = raw.name || "";
        localStorage.setItem(ID_KEY, JSON.stringify(raw));
      }
      if (raw.name == null) raw.name = "";
      return raw;
    } catch {
      return { user_id: "u-" + Date.now(), name: "" };
    }
  }

  function saveLegacy(partial) {
    const cur = loadLegacy();
    const next = { ...cur, ...partial };
    if (typeof next.name === "string") {
      next.name = next.name.trim().slice(0, 32);
    }
    localStorage.setItem(ID_KEY, JSON.stringify(next));
    return next;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("no indexedDB"));
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("idb open failed"));
    });
  }

  function idbGet(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(db, key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function sha256Hex(buf) {
    const dig = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(dig)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Ensure a device key exists. Prefer keeping legacy user_id if already present
   * so friend graphs don't break. New installs get k-prefixed hash id.
   */
  async function ensureDeviceIdentity() {
    const legacy = loadLegacy();
    if (!global.crypto?.subtle || !global.indexedDB) {
      return {
        user_id: legacy.user_id,
        name: legacy.name || "",
        crypto: false,
        migrated: false,
      };
    }

    try {
      const db = await openDb();
      let row = await idbGet(db, IDB_KEY);
      if (!row?.publicKey || !row?.privateKey) {
        const pair = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign", "verify"]
        );
        const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
        const hash = await sha256Hex(spki);
        const derivedId = "k" + hash.slice(0, 32);
        // Keep existing user_id if already established (friends/blocks)
        const keepLegacy =
          legacy.user_id &&
          !String(legacy.user_id).startsWith("u-fresh") &&
          legacy.user_id.length >= 8 &&
          !!localStorage.getItem(ID_KEY);
        const user_id = keepLegacy ? legacy.user_id : derivedId;
        row = {
          user_id,
          derivedId,
          publicKey: pair.publicKey,
          privateKey: pair.privateKey,
          created: Date.now(),
        };
        await idbPut(db, IDB_KEY, row);
        if (!keepLegacy) {
          saveLegacy({ user_id, name: legacy.name || "" });
        } else {
          saveLegacy({ cryptoBound: true, derivedId });
        }
      } else if (row.user_id && row.user_id !== legacy.user_id) {
        // Prefer the IDB-bound id if we have one
        saveLegacy({ user_id: row.user_id, name: legacy.name || "" });
      }

      return {
        user_id: row.user_id || legacy.user_id,
        name: legacy.name || "",
        crypto: true,
        derivedId: row.derivedId || null,
      };
    } catch (e) {
      console.warn("[identity] crypto path failed", e);
      return {
        user_id: legacy.user_id,
        name: legacy.name || "",
        crypto: false,
        migrated: false,
      };
    }
  }

  function loadIdentity() {
    return loadLegacy();
  }

  function saveIdentity(partial) {
    return saveLegacy(partial);
  }

  async function clearDeviceKeys() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) {}
  }

  global.RuletIdentity = {
    loadIdentity,
    saveIdentity,
    ensureDeviceIdentity,
    clearDeviceKeys,
    ID_KEY,
  };
})(typeof window !== "undefined" ? window : globalThis);
