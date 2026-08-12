# Templates — add-new-resource

Copy skeletons into real files. Do not leave placeholders in committed dumps when content is known.

---

## A. Raw dump — text / URL / paste

Path: `knowledge/raw/YYYY-MM-DD-slug.md`

```markdown
---
title: <short human title>
date: YYYY-MM-DD
slug: <kebab-slug>
source_type: url | paste | note | video | other
source_url: <https://… or empty>
source_path: <repo or absolute path if from file; else empty>
captured_by: agent | human
skill: add-new-resource
---

# Raw: <title>

## Source
- Type: …
- URL / path: …
- Captured: YYYY-MM-DD

## Original (untouched)

<full paste, quoted fetch, transcript excerpt, or note body — do not rewrite for style>
```

---

## B. Raw dump — image / screenshot / PDF (binary + sidecar)

Path: `knowledge/raw/YYYY-MM-DD-slug.md`  
Binary stays at `source_path` (or a copy the human requested). Raw file is the searchable dump.

```markdown
---
title: <short human title>
date: YYYY-MM-DD
slug: <kebab-slug>
source_type: image | pdf | screenshot | other
source_url:
source_path: <absolute or repo-relative path to binary>
captured_by: agent | human
skill: add-new-resource
binary_inlined: false
---

# Raw: <title>

## Source
- Type: image | pdf | screenshot
- Path: `<source_path>`
- Captured: YYYY-MM-DD

## Description (for search without opening binary)

- What it shows (UI, error, diagram, doc page): …
- Notable text / labels visible: …
- Context (why filed): …

## Original

Binary not inlined. Open `source_path`. Do not edit this sidecar to “fix” the image; add a new dated raw file if a new capture arrives.
```

If the image is already in-repo (e.g. `tasks/screenshot-geo-ru.png`), set `source_path` to that repo path. Optional: embed a relative markdown image link for humans:

```markdown
![caption](../../tasks/screenshot-geo-ru.png)
```

(Adjust relative depth from `knowledge/raw/`.)

---

## C. Wiki resource card (append to catalog)

Prefer file: `knowledge/wiki/resources.md`

### First-time file header

```markdown
# Resources catalog

Short cards for sources filed via `/add-new-resource`.  
Raw originals live under `knowledge/raw/` (immutable). Deeper synthesis → `/knowledge-ingest`.

| Date | Title | Raw | Type |
|------|-------|-----|------|
| YYYY-MM-DD | [Title](#card-slug) | `raw/YYYY-MM-DD-slug.md` | url/image/… |
```

### Each new card (append)

```markdown
## <Title> {#card-slug}

- **Date:** YYYY-MM-DD
- **Type:** url | paste | note | video | image | pdf
- **Raw:** [`raw/YYYY-MM-DD-slug.md`](../raw/YYYY-MM-DD-slug.md)
- **Source:** <URL or path>
- **Related surfaces:** skills / locks / specs / wiki pages (links)

### Takeaways

1. …
2. …
3. …
4. …  <!-- 3–7 bullets -->

### Notes

- Unverified claims marked. Locks outrank this card if conflict.
```

---

## D. Wiki dedicated concept page (only when durable)

Use when the resource is a lasting method/concept (not a one-off paste).  
Example pattern: `knowledge/wiki/marchese-karpathy-method.md`.

```markdown
# <Concept title>

Source: <URL or path> — filed `raw/YYYY-MM-DD-slug.md`

## Core claim

…

## Practice here (repo map)

| Idea | In this repo |
|------|----------------|
| … | skill / lock / script |

## Related

- [resources](resources.md) · [index](index.md) · …

### Log

- YYYY-MM-DD: filed via add-new-resource; raw `raw/YYYY-MM-DD-slug.md`
```

After creating a new page: add one row to `knowledge/wiki/index.md`.

---

## E. index.md row

```markdown
| [resources](resources.md) | Catalog of filed sources (add-new-resource funnel) |
```

Or for a dedicated page:

```markdown
| [<page-slug>](<page-slug>.md) | <one-line summary> |
```

---

## F. log.md entry

```markdown
## [YYYY-MM-DD] resource | <short title>
- Raw: `raw/YYYY-MM-DD-slug.md`
- Wiki: `resources.md` — <one-line why>
```

If a dedicated page was also created:

```markdown
## [YYYY-MM-DD] resource | <short title>
- Raw: `raw/YYYY-MM-DD-slug.md`
- Wiki: `<page>.md` + `resources.md` catalog line
```
