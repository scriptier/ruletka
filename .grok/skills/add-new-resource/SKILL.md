---
name: add-new-resource
description: >
  Uniform entry funnel for any new resource (URL, paste, screenshot path, PDF
  path, note, video link). Saves the original untouched into knowledge/raw/,
  writes a short wiki summary so future sessions know what is in raw without
  reading the whole dump, updates index.md + log.md. Marchese skill-library
  pattern: same pipeline every time. Use when user says add-new-resource,
  /add-new-resource, new resource, save this, file this screenshot, file this
  video, or drops a source to keep.
metadata:
  short-description: "Save raw + wiki card for any new resource"
  triggers:
    - add-new-resource
    - /add-new-resource
    - new resource
    - save this
    - file this screenshot
    - file this video
---

# /add-new-resource — Marchese resource pipeline (entry funnel)

Uniform **entry funnel** for every new resource. Same steps every time; no special cases that skip raw or wiki.

| Layer | Path | This skill does |
|-------|------|-----------------|
| **Raw** | `knowledge/raw/` | Immutable dump of the **original, untouched** source |
| **Wiki** | `knowledge/wiki/` | Short summary card so agents need not re-read raw |
| **Deeper ingest** | skill `knowledge-ingest` | Optional later: multi-page compound into symptom/concept pages |

This skill is **not** full Karpathy Ingest depth. It is the **always-on funnel**: capture → summarize → catalog. Deeper wiki synthesis = `/knowledge-ingest` or `/knowledge-compound`.

**Schema:** `knowledge/SCHEMA.md`. **Do not thrash ICE** or edit production media code on a resource-only turn.

## Inputs (accept any)

| Kind | Examples | How to capture |
|------|----------|----------------|
| URL | article, docs, YouTube, tweet | Fetch or quote key text; store URL in frontmatter |
| Paste | chat note, av_path, error log | Full paste body into raw body |
| Screenshot / image path | `tasks/foo.png`, absolute path | Note/copy path; describe; markdown dump + source frontmatter |
| PDF path | local PDF | Note path; extract title + outline or key pages if tools allow |
| Note | human sentence / bullet list | Dump as-is under dated slug |
| Video | YouTube/watch link | URL + title + short transcript/takeaways if available |

If the user only pastes and does not name a slug, invent a short kebab slug from the title/topic.

## Steps (always all six)

### 1. Accept resource

- Take path, URL, paste, or attachment description from the user.
- Read enough to title it (title, one-line what it is, date).
- Do **not** start coding or ICE thrash.

### 2. Normalize slug + write raw dump (immutable)

Write **only a new file** under `knowledge/raw/`:

```text
knowledge/raw/YYYY-MM-DD-slug.md
```

- `YYYY-MM-DD` = today (UTC or local session date; be consistent within the day).
- `slug` = lowercase kebab, short (`one-way-video`, `marchese-7zZy1QTvokM`, `screenshot-geo-ru`).
- **Never edit** an existing `raw/` file. Collision → new slug suffix (`-2`, `-b`) or new dated file.
- Body = **original content** as far as practical (full paste, quoted fetch, or faithful dump). Do not “improve” the source in raw.

**Text / URL / paste:** use frontmatter from `references/TEMPLATE.md` (raw section) + full body.

**Image / screenshot / PDF (binary):**

1. Prefer leaving the binary where it is **or** copy under a stable path if the user wants it in-repo (do not invent large binary moves unless asked).
2. Always write a **markdown sidecar dump** in `knowledge/raw/YYYY-MM-DD-slug.md` with:
   - frontmatter `source_path:` absolute or repo-relative path to the binary
   - `source_type: image|pdf|other`
   - short visual/content description so agents can search without opening the binary
3. If only a path is given and the file is unreadable, still write the raw dump with path + “binary not inlined”.

Templates: `references/TEMPLATE.md`.

### 3. Extract 3–7 bullet takeaways + repo surfaces

From the resource, list **3–7** bullets max:

- What it claims / shows / teaches
- Relevance to freenet-roulette / ruletka (connect, mobile, agentic, locks, etc.)
- Links to **repo surfaces** when obvious:
  - skills: `.grok/skills/*`, `/av-fix-loop`, `/spec`, …
  - locks: `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`
  - specs: `knowledge/specs/*`
  - wiki concepts already indexed
  - scripts: `./scripts/av-verify.sh`, …

Mark anything unproven as **unverified**. Do not invent scorecard results.

### 4. Write / update wiki summary

Prefer **one catalog page** unless the resource deserves a dedicated concept/symptom page:

| Choice | When |
|--------|------|
| **`knowledge/wiki/resources.md`** | Default — append a resource card (catalog) |
| **Topic page** (existing) | Strong fit (e.g. already have `one-way-video.md`) — append short section + link to raw |
| **New concept page** | Only if durable method/concept (e.g. Marchese video → `marchese-karpathy-method.md`) |

Resource card fields (see TEMPLATE): title, date, type, raw path, source URL/path, 3–7 takeaways, related surfaces.

Keep wiki **short**. Prefer links over duplicating full plans or full raw text.

### 5. Update index.md + append log.md

**Always:**

1. `knowledge/wiki/index.md`  
   - If `resources.md` is new: add a row to the catalog table.  
   - If a new dedicated wiki page was created: add a row.  
   - One line per page.

2. `knowledge/wiki/log.md` — append only:

```text
## [YYYY-MM-DD] resource | <short title>
- Raw: `raw/YYYY-MM-DD-slug.md`
- Wiki: `resources.md` (or other page) — one-line why
```

Use op tag `resource` for this funnel (distinct from `ingest` / `compound` / `lint`).

### 6. Report paths

Reply to the human with:

```text
RAW:  knowledge/raw/YYYY-MM-DD-slug.md
WIKI: knowledge/wiki/resources.md  (or dedicated page)
+ one-line summary of what was filed
```

Optional: “Deeper multi-page ingest: `/knowledge-ingest`.”

## Rules

1. **Every** new file goes through the same funnel: raw → wiki summary → index → log.  
2. **raw/ is immutable** after write — no in-place edits of old dumps.  
3. Originals stay **untouched** in spirit: raw holds the dump; wiki holds interpretation.  
4. Locks **outrank** wiki if a resource contradicts them — note conflict on the wiki card; do not silently override locks.  
5. **Resource-only turn:** no ICE thrash, no unprompted APK, no `push.sh`.  
6. Do not claim connect PASS from a blog/video without scorecard/human smoke.

## Related

| Skill / op | Role |
|------------|------|
| **`add-new-resource`** (this) | Uniform entry funnel — always first capture |
| `knowledge-ingest` | Deeper Ingest: one source → multiple wiki pages / symptom structure |
| `knowledge-compound` | Batch scorecards + raw → wiki after A/V hops |
| `knowledge-query` | Answer from wiki first |
| `knowledge-health` | Lint stale / contradictions |
| `karpathy-method` / `spec` | Spec → Verifier → Environment; Layer 3 environment grows via this funnel |

References: `references/TEMPLATE.md` · schema: `knowledge/SCHEMA.md` · method: `knowledge/wiki/karpathy-method.md`, `knowledge/wiki/marchese-karpathy-method.md`.
