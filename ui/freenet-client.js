/**
 * Thin Freenet node client for Chat Roulette (browser).
 *
 * Requires a local Freenet node and the published lobby contract key.
 * Uses dynamic import of @freenetorg/freenet-stdlib when available via import map
 * or CDN; otherwise reports offline and falls back to the local sim.
 *
 * Encoding note: our contracts use CBOR (ciborium). Encoding/decoding in the
 * browser needs a CBOR library — for the first Freenet integration we ship a
 * JSON-over-debug path only when the node is reached; production will use
 * pre-encoded CBOR from the Rust agent or a small wasm encoder.
 */

const DEFAULT_WS = () => {
  const q = new URLSearchParams(location.search);
  if (q.get("ws")) return q.get("ws");
  // Standalone UI often runs on :8787 while node is :7509
  if (location.port === "8787" || location.port === "8080") {
    return `ws://127.0.0.1:7509/v1/contract/command`;
  }
  return `ws://${location.host}/v1/contract/command`;
};

export class FreenetNodeClient {
  constructor({ onStatus, onLog } = {}) {
    this.api = null;
    this.onStatus = onStatus || (() => {});
    this.onLog = onLog || console.log;
    this.lobbyKey = null;
    this.connected = false;
  }

  async connect(wsUrl = DEFAULT_WS()) {
    this.onStatus("connecting");
    try {
      // Optional peer dependency — user may install via npm or import map.
      const mod = await import(
        /* webpackIgnore: true */ "@freenetorg/freenet-stdlib"
      ).catch(() => null);
      if (!mod) {
        this.onLog(
          "[freenet] @freenetorg/freenet-stdlib not available — use local sim, or serve UI through Freenet / install the package"
        );
        this.onStatus("offline");
        return false;
      }
      const { FreenetWsApi } = mod;
      const handler = {
        onContractPut: () => {},
        onContractGet: (r) => this.onLog("[freenet] get", r?.key),
        onContractUpdate: () => {},
        onContractUpdateNotification: (n) =>
          this.onLog("[freenet] update", n?.key),
        onContractNotFound: () => this.onLog("[freenet] not found"),
        onDelegateResponse: () => {},
        onErr: (e) => {
          this.onLog("[freenet] error", e?.cause || e);
          this.onStatus("error");
        },
        onOpen: () => {
          this.connected = true;
          this.onStatus("connected");
          this.onLog("[freenet] connected", wsUrl);
        },
      };
      this.api = new FreenetWsApi(new URL(wsUrl), handler, "");
      return true;
    } catch (e) {
      this.onLog("[freenet] connect failed", e);
      this.onStatus("error");
      return false;
    }
  }

  setLobbyKey(base58OrHex) {
    this.lobbyKeyRaw = base58OrHex?.trim() || null;
    this.onLog("[freenet] lobby key set", this.lobbyKeyRaw?.slice(0, 12));
  }

  disconnect() {
    this.api = null;
    this.connected = false;
    this.onStatus("disconnected");
  }
}

window.FreenetNodeClient = FreenetNodeClient;
window.freenetDefaultWs = DEFAULT_WS;
export { DEFAULT_WS as defaultWs };
