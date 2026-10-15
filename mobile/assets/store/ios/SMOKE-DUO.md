# GF / TestFlight duo smoke — one page

Two-person check: **you** on TestFlight (iPhone), **partner** on a computer
at `https://ruletka.vip`. Read this before you start, not mid-call.

## 1. Install

- TestFlight → ruletka → install **0.1.477 (5)**.
- If TestFlight only offers **(4)**, do **not** test — that build is stale.
  Open TestFlight → Redeem / refresh, or wait for the invite email; do not
  report bugs against (4).

## 2. Before you call

- Accept the 18+ rules once.
- Grant **camera + microphone** when iOS asks (Settings → ruletka if you
  fat-fingered Deny).
- Partner opens **one tab** at `https://ruletka.vip` (Chrome or Firefox).
  Two tabs on the same computer = it matches itself, not you.

## 3. Start

- Both sides tap **Start** at roughly the same time.
- Expect both cameras + audio within ~3–5s. If stuck &gt;15s, Retry once
  before reporting.

## 4. What the layout should look like

| Phone orientation | Expected |
|---|---|
| **Portrait** (normal, phone upright) | Partner tile fills the **top**, your own camera dock sits **bottom** |
| **Landscape** (phone on its side) | Partner **left**, you **right** (**L \| R**) |

If it's flipped, mirrored, or one tile is missing on rotate, that's a bug —
note which orientation and screenshot before rotating back.

## 5. Reading a black / frozen partner tile

- **Black tile + no image ever** = normal connect failure (see fail table
  below), not a codec bug.
- **"Recvonly"** in any debug/meta text next to the partner tile means
  **they denied or turned off their camera** — not a bug on your end. Ask
  the partner to grant camera in their browser and tap the camera icon on;
  don't file a connect bug for this.

## Fail quick table

| Symptom | Likely cause | Action |
|---|---|---|
| TestFlight shows (4) not (5) | Stale build on your device | Refresh TestFlight, do not test (4) |
| No camera prompt at all | Old install / permission stuck | Reinstall from TestFlight |
| Partner never appears, no "Recvonly" | Normal connect miss | Retry once, then report with time + Wi‑Fi/LTE |
| Partner tile says/looks Recvonly | Partner's cam is off/denied | Partner fixes camera, not a report |
| Two tiles swapped or wrong side on rotate | Layout bug | Screenshot in that orientation, report |

## Report format

`0.1.477 (5) · [portrait/landscape] · [Wi‑Fi/LTE] · what you saw · screenshot`
