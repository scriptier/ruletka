//! Ephemeral identities and signing for lobby / session records.

use crate::lobby::{Claim, LeaveMark, WaitingOffer};
use crate::session::SessionId;
use crate::types::{hash_bytes, PeerId, Preferences};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

const DOMAIN_OFFER: &[u8] = b"freenet-roulette/offer/v1";
const DOMAIN_CLAIM: &[u8] = b"freenet-roulette/claim/v1";
const DOMAIN_LEAVE: &[u8] = b"freenet-roulette/leave/v1";
const DOMAIN_MSG: &[u8] = b"freenet-roulette/msg/v1";

#[derive(Clone)]
pub struct Identity {
    signing: SigningKey,
    pub verifying: VerifyingKey,
    pub peer_id: PeerId,
}

impl std::fmt::Debug for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Identity")
            .field("peer_id", &self.peer_id.short_hex())
            .finish_non_exhaustive()
    }
}

impl Identity {
    /// Random ephemeral identity (requires `client` feature / OsRng).
    #[cfg(feature = "client")]
    pub fn generate() -> Self {
        use rand::rngs::OsRng;
        let signing = SigningKey::generate(&mut OsRng);
        Self::from_signing(signing)
    }

    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self::from_signing(SigningKey::from_bytes(&seed))
    }

    pub fn from_signing(signing: SigningKey) -> Self {
        let verifying = signing.verifying_key();
        let peer_id = PeerId::from_key_bytes(verifying.as_bytes());
        Self {
            signing,
            verifying,
            peer_id,
        }
    }

    pub fn verifying_key_bytes(&self) -> [u8; 32] {
        self.verifying.to_bytes()
    }

    fn sign_domain(&self, domain: &[u8], body: &[u8]) -> SignatureBytes {
        let mut msg = Vec::with_capacity(domain.len() + body.len());
        msg.extend_from_slice(domain);
        msg.extend_from_slice(body);
        let sig = self.signing.sign(&msg);
        SignatureBytes::from(sig.to_bytes())
    }

    pub fn make_offer(
        &self,
        version: u64,
        heartbeat_ms: u64,
        prefs: Preferences,
        session_seed: [u8; 32],
    ) -> WaitingOffer {
        let mut offer = WaitingOffer {
            peer_id: self.peer_id,
            verifying_key: self.verifying_key_bytes().to_vec(),
            version,
            heartbeat_ms,
            prefs,
            session_seed,
            sig: SignatureBytes::zeros(),
        };
        let body = offer.signing_body();
        offer.sig = self.sign_domain(DOMAIN_OFFER, &body);
        offer
    }

    pub fn make_claim(
        &self,
        target: PeerId,
        session_id: SessionId,
        created_ms: u64,
    ) -> Claim {
        let mut claim = Claim {
            claim_id: [0; 32],
            claimer: self.peer_id,
            target,
            session_id,
            created_ms,
            sig: SignatureBytes::zeros(),
        };
        let body = claim.signing_body();
        claim.sig = self.sign_domain(DOMAIN_CLAIM, &body);
        claim.claim_id = hash_bytes(&[
            b"claim/v1",
            &claim.claimer.0,
            &claim.target.0,
            &claim.session_id.0,
            &claim.created_ms.to_le_bytes(),
        ]);
        claim
    }

    pub fn make_leave(&self, version: u64, left_ms: u64) -> LeaveMark {
        let mut leave = LeaveMark {
            peer_id: self.peer_id,
            version,
            left_ms,
            sig: SignatureBytes::zeros(),
        };
        let body = leave.signing_body();
        leave.sig = self.sign_domain(DOMAIN_LEAVE, &body);
        leave
    }

    pub fn sign_message_body(&self, body: &[u8]) -> SignatureBytes {
        self.sign_domain(DOMAIN_MSG, body)
    }
}

/// 64-byte ed25519 signature (or zeros for unsigned test fixtures).
/// Stored as `Vec<u8>` for serde compatibility without `serde_bytes`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignatureBytes(pub Vec<u8>);

impl SignatureBytes {
    pub fn zeros() -> Self {
        Self(vec![0u8; 64])
    }

    pub fn as_array(&self) -> Option<[u8; 64]> {
        if self.0.len() != 64 {
            return None;
        }
        let mut a = [0u8; 64];
        a.copy_from_slice(&self.0);
        Some(a)
    }
}

impl Default for SignatureBytes {
    fn default() -> Self {
        Self::zeros()
    }
}

impl From<[u8; 64]> for SignatureBytes {
    fn from(value: [u8; 64]) -> Self {
        Self(value.to_vec())
    }
}

pub fn verify_offer(offer: &WaitingOffer) -> bool {
    if offer.verifying_key.len() != 32 {
        return false;
    }
    let mut key_bytes = [0u8; 32];
    key_bytes.copy_from_slice(&offer.verifying_key);
    let Ok(vk) = VerifyingKey::from_bytes(&key_bytes) else {
        return false;
    };
    if PeerId::from_key_bytes(&key_bytes) != offer.peer_id {
        return false;
    }
    verify_domain(&vk, DOMAIN_OFFER, &offer.signing_body(), &offer.sig)
}

pub fn verify_claim(claim: &Claim, claimer_vk: &VerifyingKey) -> bool {
    if PeerId::from_key_bytes(claimer_vk.as_bytes()) != claim.claimer {
        return false;
    }
    verify_domain(claimer_vk, DOMAIN_CLAIM, &claim.signing_body(), &claim.sig)
}

pub fn verify_leave(leave: &LeaveMark, vk: &VerifyingKey) -> bool {
    if PeerId::from_key_bytes(vk.as_bytes()) != leave.peer_id {
        return false;
    }
    verify_domain(vk, DOMAIN_LEAVE, &leave.signing_body(), &leave.sig)
}

fn verify_domain(vk: &VerifyingKey, domain: &[u8], body: &[u8], sig: &SignatureBytes) -> bool {
    let mut msg = Vec::with_capacity(domain.len() + body.len());
    msg.extend_from_slice(domain);
    msg.extend_from_slice(body);
    let Some(arr) = sig.as_array() else {
        return false;
    };
    let Ok(signature) = Signature::from_slice(&arr) else {
        return false;
    };
    vk.verify(&msg, &signature).is_ok()
}

/// Look up verifying key from an offer map for claim verification.
pub fn vk_from_offer(offer: &WaitingOffer) -> Option<VerifyingKey> {
    if offer.verifying_key.len() != 32 {
        return None;
    }
    let mut b = [0u8; 32];
    b.copy_from_slice(&offer.verifying_key);
    VerifyingKey::from_bytes(&b).ok()
}
