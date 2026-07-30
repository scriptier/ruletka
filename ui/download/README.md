# Helper downloads

Shell/PowerShell helpers (`rulet-helper*`) live in this folder and are part of the source tree.

**Prebuilt `roulette-bridge-*` binaries are not committed** (see root `.gitignore`).  
Build or CI-attach them; always publish **`SHA256SUMS`** next to downloads.

## Build + checksums (maintainers)

```bash
# Refresh native Linux binary + SHA256SUMS for whatever is in ui/download/
./scripts/build-helpers.sh --build

# Only recompute checksums (binaries already present)
./scripts/build-helpers.sh

# Optional: GPG-sign the sums file
SIGN=1 ./scripts/build-helpers.sh
```

## Verify (users)

```bash
# After downloading artifacts into the same folder as SHA256SUMS:
sha256sum -c SHA256SUMS

# If SHA256SUMS.asc is published:
gpg --verify SHA256SUMS.asc SHA256SUMS
```

On Windows (PowerShell):

```powershell
Get-FileHash .\roulette-bridge-windows-amd64.exe -Algorithm SHA256
# Compare to the line in SHA256SUMS
```

## Releases

Push a version tag to trigger `.github/workflows/release-helpers.yml`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Code signing notes

| Trust layer | Status |
|-------------|--------|
| SHA256SUMS | **Yes** — always publish with helpers |
| GPG signature of sums | Optional (`SIGN=1`) if operator has a key |
| Apple Developer ID / notarization | Not automated (needs paid Apple account) |
| Windows Authenticode | Not automated (needs cert) |

Until Apple/Microsoft signing is set up, first-run OS warnings are expected. Users who trust your site/GitHub release can allow the binary after checksum verification.

Production deploy (`scripts/deploy/push.sh`) stages whatever binaries are present into `/download/` on the server, including `SHA256SUMS` when available.
