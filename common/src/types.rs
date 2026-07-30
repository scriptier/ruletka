use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Stable peer identifier (hash of verifying key material).
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct PeerId(pub [u8; 32]);

impl PeerId {
    pub fn from_key_bytes(key: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(b"freenet-roulette/peer-id/v1");
        hasher.update(key);
        let digest = hasher.finalize();
        let mut id = [0u8; 32];
        id.copy_from_slice(&digest);
        Self(id)
    }

    pub fn from_seed(seed: &str) -> Self {
        Self::from_key_bytes(seed.as_bytes())
    }

    pub fn short_hex(&self) -> String {
        hex::encode(&self.0[..4])
    }
}

impl std::fmt::Display for PeerId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", hex::encode(self.0))
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Preferences {
    /// BCP-47 language tag, e.g. "en", "ru". Empty = any.
    pub lang: Option<String>,
    /// Free-form interest tags; empty = any. Match if intersection non-empty or both empty.
    pub tags: Vec<String>,
    pub wants_text: bool,
    pub wants_video: bool,
}

impl Preferences {
    pub fn text_only() -> Self {
        Self {
            lang: None,
            tags: vec![],
            wants_text: true,
            wants_video: false,
        }
    }

    /// Compatible if media modes overlap and (langs match or either is open)
    /// and (tags intersect or either side has no tags).
    pub fn compatible_with(&self, other: &Self) -> bool {
        let media_ok = (self.wants_text && other.wants_text)
            || (self.wants_video && other.wants_video);
        if !media_ok {
            return false;
        }

        let lang_ok = match (&self.lang, &other.lang) {
            (None, _) | (_, None) => true,
            (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
        };
        if !lang_ok {
            return false;
        }

        if self.tags.is_empty() || other.tags.is_empty() {
            return true;
        }
        self.tags
            .iter()
            .any(|t| other.tags.iter().any(|u| t.eq_ignore_ascii_case(u)))
    }
}

/// Hash helper used by match algorithm and session id derivation.
pub fn hash_bytes(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    for p in parts {
        hasher.update(p);
    }
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}
