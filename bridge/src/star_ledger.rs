//! Append-only star ledger: mint / spend / adjust with hash-chain + spend op_id idempotency.
//!
//! Design goals:
//! - Hub is still the authority (not a multi-party blockchain).
//! - Balances are derived from events; `star_counts` is a cache mirrored into friends.json.
//! - **Trust** (mod / public reputation) is derived only from peer rate-gifts
//!   (`mint:rate_partner`), not hour bonuses or admin grants.
//! - Client retries with the same `op_id` cannot double-spend.
//! - Restoring an old friends.json cannot inflate stars after ledger has recorded spends.
//!
//! Storage: JSONL at `data/star_ledger.jsonl` (next to friends.json by default).

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

pub const KIND_MINT: &str = "mint";
pub const KIND_SPEND: &str = "spend";
pub const KIND_ADJUST: &str = "adjust";

/// True when this mint/adjust should raise **trust** (peer social gifts only).
pub fn is_trust_mint_reason(reason: &str) -> bool {
    let r = reason.trim();
    r == "mint:rate_partner"
        || r.ends_with(":rate_partner")
        || r == "rate_partner"
        // Optional admin path to restore trust after investigation
        || r.starts_with("admin:trust")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StarEvent {
    pub seq: u64,
    pub id: String,
    /// mint | spend | adjust
    pub kind: String,
    /// Spender (spend) or empty
    #[serde(default)]
    pub from: String,
    /// Recipient of mint/adjust, or effect target for spend
    #[serde(default)]
    pub to: String,
    pub amount: u64,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub session: String,
    /// Client idempotency key for spends (empty = no dedupe)
    #[serde(default)]
    pub op_id: String,
    pub ts: u64,
    #[serde(default)]
    pub prev_hash: String,
    pub hash: String,
}

#[derive(Debug)]
pub enum SpendError {
    Insufficient { have: u64, need: u64 },
    /// Same op_id already applied; carry current from-balance for response
    AlreadyApplied { from_balance: u64 },
    Io(std::io::Error),
    Empty,
}

impl std::fmt::Display for SpendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpendError::Insufficient { have, need } => {
                write!(f, "need {need} stars (have {have})")
            }
            SpendError::AlreadyApplied { from_balance } => {
                write!(f, "op already applied (balance {from_balance})")
            }
            SpendError::Io(e) => write!(f, "ledger io: {e}"),
            SpendError::Empty => write!(f, "empty spend"),
        }
    }
}

/// In-memory tip + indexes; full history lives on disk as JSONL.
pub struct StarLedger {
    path: PathBuf,
    seq: u64,
    tip_hash: String,
    /// Spend op_ids already committed
    spent_ops: HashSet<String>,
    /// Cached balances (authoritative after load / each append)
    balances: HashMap<String, u64>,
    /// Trust scores: stars received via peer rate-gifts (not hour/admin mints)
    trust_scores: HashMap<String, u64>,
    /// Directed trust edges from|to when a peer gifted after a long chat
    trust_edges: HashSet<String>,
}

impl StarLedger {
    pub fn path_beside_friends(friends_path: &Path) -> PathBuf {
        friends_path
            .parent()
            .map(|p| p.join("star_ledger.jsonl"))
            .unwrap_or_else(|| PathBuf::from("data/star_ledger.jsonl"))
    }

    pub fn empty(path: PathBuf) -> Self {
        Self {
            path,
            seq: 0,
            tip_hash: String::new(),
            spent_ops: HashSet::new(),
            balances: HashMap::new(),
            trust_scores: HashMap::new(),
            trust_edges: HashSet::new(),
        }
    }

    pub fn seq(&self) -> u64 {
        self.seq
    }

    pub fn tip_hash(&self) -> &str {
        &self.tip_hash
    }

    pub fn balance(&self, user_id: &str) -> u64 {
        if user_id.is_empty() {
            return 0;
        }
        self.balances.get(user_id).copied().unwrap_or(0)
    }

    /// Public reputation / report-power score (peer gifts only).
    pub fn trust_for(&self, user_id: &str) -> u64 {
        if user_id.is_empty() {
            return 0;
        }
        self.trust_scores.get(user_id).copied().unwrap_or(0)
    }

    /// Distinct peers who gifted this user a post-chat star.
    pub fn trust_gifters(&self, user_id: &str) -> u32 {
        if user_id.is_empty() {
            return 0;
        }
        let suffix = format!("|{user_id}");
        self.trust_edges
            .iter()
            .filter(|e| e.ends_with(&suffix))
            .count() as u32
    }

    pub fn balances_snapshot(&self) -> HashMap<String, u64> {
        self.balances.clone()
    }

    pub fn trust_snapshot(&self) -> HashMap<String, u64> {
        self.trust_scores.clone()
    }

    pub fn has_spend_op(&self, op_id: &str) -> bool {
        !op_id.is_empty() && self.spent_ops.contains(op_id)
    }

    /// Load ledger; if empty, seed genesis adjust events from legacy star_counts.
    /// Ledger balances always win after genesis (friends.json alone cannot inflate).
    pub fn load_or_migrate(
        path: PathBuf,
        legacy_counts: &HashMap<String, u64>,
    ) -> std::io::Result<Self> {
        let mut ledger = Self::empty(path);
        ledger.replay_file()?;

        if ledger.seq == 0 {
            let mut entries: Vec<(String, u64)> = legacy_counts
                .iter()
                .filter(|(k, v)| !k.is_empty() && **v > 0)
                .map(|(k, v)| (k.clone(), *v))
                .collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            if !entries.is_empty() {
                tracing::info!(
                    users = entries.len(),
                    path = %ledger.path.display(),
                    "star ledger empty — seeding genesis from friends.json star_counts"
                );
                let ts = unix_now();
                for (uid, amt) in entries {
                    ledger.append_event(
                        KIND_ADJUST,
                        "",
                        &uid,
                        amt,
                        "genesis_snapshot",
                        "",
                        "",
                        ts,
                    )?;
                }
            }
        } else {
            // Drift report: friends.json is cache only
            let mut higher = 0u32;
            let mut lower = 0u32;
            let mut missing = 0u32;
            for (uid, &legacy) in legacy_counts {
                if uid.is_empty() {
                    continue;
                }
                let led = ledger.balance(uid);
                if legacy > led {
                    higher += 1;
                } else if legacy < led {
                    lower += 1;
                }
            }
            for uid in ledger.balances.keys() {
                if !legacy_counts.contains_key(uid) {
                    missing += 1;
                }
            }
            if higher + lower + missing > 0 {
                tracing::warn!(
                    ledger_seq = ledger.seq,
                    friends_higher_than_ledger = higher,
                    friends_lower_than_ledger = lower,
                    ledger_only_users = missing,
                    "star ledger is authority — overwriting star_counts cache from ledger"
                );
            } else {
                tracing::info!(
                    ledger_seq = ledger.seq,
                    tip = %ledger.tip_hash.chars().take(12).collect::<String>(),
                    users = ledger.balances.len(),
                    "star ledger loaded"
                );
            }
        }

        Ok(ledger)
    }

    fn replay_file(&mut self) -> std::io::Result<()> {
        if !self.path.exists() {
            return Ok(());
        }
        let f = File::open(&self.path)?;
        let reader = BufReader::new(f);
        let mut expected_seq = 0u64;
        let mut prev = String::new();
        let mut balances: HashMap<String, u64> = HashMap::new();
        let mut spent_ops: HashSet<String> = HashSet::new();
        let mut trust_scores: HashMap<String, u64> = HashMap::new();
        let mut trust_edges: HashSet<String> = HashSet::new();
        let mut line_no = 0u64;

        for line in reader.lines() {
            line_no += 1;
            let line = line?;
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let ev: StarEvent = match serde_json::from_str(line) {
                Ok(e) => e,
                Err(e) => {
                    tracing::error!(line_no, error = %e, "corrupt star ledger line — stopping replay");
                    break;
                }
            };
            expected_seq += 1;
            if ev.seq != expected_seq {
                tracing::error!(
                    line_no,
                    got = ev.seq,
                    expected = expected_seq,
                    "star ledger seq gap — stopping replay"
                );
                break;
            }
            if ev.prev_hash != prev {
                tracing::error!(
                    line_no,
                    seq = ev.seq,
                    "star ledger hash chain break — stopping replay"
                );
                break;
            }
            let recomputed = event_hash(
                ev.seq,
                &ev.id,
                &ev.kind,
                &ev.from,
                &ev.to,
                ev.amount,
                &ev.reason,
                &ev.session,
                &ev.op_id,
                ev.ts,
                &ev.prev_hash,
            );
            if recomputed != ev.hash {
                tracing::error!(line_no, seq = ev.seq, "star ledger hash mismatch — stopping replay");
                break;
            }
            apply_event_to_balances(&mut balances, &ev);
            apply_event_to_trust(&mut trust_scores, &mut trust_edges, &ev);
            if ev.kind == KIND_SPEND && !ev.op_id.is_empty() {
                spent_ops.insert(ev.op_id.clone());
            }
            prev = ev.hash.clone();
            self.seq = ev.seq;
            self.tip_hash = ev.hash;
        }

        self.balances = balances;
        self.spent_ops = spent_ops;
        self.trust_scores = trust_scores;
        self.trust_edges = trust_edges;
        Ok(())
    }

    /// Mint stars to `to` (earn / gift received). `from` empty for system mints.
    pub fn mint(
        &mut self,
        to: &str,
        amount: u64,
        reason: &str,
        session: &str,
    ) -> std::io::Result<(StarEvent, u64)> {
        self.mint_from("", to, amount, reason, session)
    }

    /// Peer rate-gift mint: records `from` for trust edges + balances.
    pub fn mint_from(
        &mut self,
        from: &str,
        to: &str,
        amount: u64,
        reason: &str,
        session: &str,
    ) -> std::io::Result<(StarEvent, u64)> {
        if to.is_empty() || amount == 0 {
            return Ok((
                StarEvent {
                    seq: self.seq,
                    id: String::new(),
                    kind: KIND_MINT.into(),
                    from: from.into(),
                    to: to.into(),
                    amount: 0,
                    reason: reason.into(),
                    session: session.into(),
                    op_id: String::new(),
                    ts: unix_now(),
                    prev_hash: self.tip_hash.clone(),
                    hash: self.tip_hash.clone(),
                },
                self.balance(to),
            ));
        }
        let ev = self.append_event(
            KIND_MINT,
            from,
            to,
            amount,
            reason,
            session,
            "",
            unix_now(),
        )?;
        Ok((ev, self.balance(to)))
    }

    /// Admin / special delta credit (positive only).
    pub fn adjust(
        &mut self,
        to: &str,
        amount: u64,
        reason: &str,
    ) -> std::io::Result<(StarEvent, u64)> {
        if to.is_empty() || amount == 0 {
            return self.mint(to, 0, reason, "");
        }
        let ev = self.append_event(
            KIND_ADJUST,
            "",
            to,
            amount,
            reason,
            "",
            "",
            unix_now(),
        )?;
        Ok((ev, self.balance(to)))
    }

    /// Burn `amount` from `from` (gift spend). `to` is effect target (metadata).
    pub fn spend(
        &mut self,
        from: &str,
        to: &str,
        amount: u64,
        reason: &str,
        op_id: &str,
        session: &str,
    ) -> Result<(StarEvent, u64), SpendError> {
        if from.is_empty() || amount == 0 {
            return Err(SpendError::Empty);
        }
        let op = op_id.trim();
        if !op.is_empty() && self.spent_ops.contains(op) {
            return Err(SpendError::AlreadyApplied {
                from_balance: self.balance(from),
            });
        }
        let have = self.balance(from);
        if have < amount {
            return Err(SpendError::Insufficient {
                have,
                need: amount,
            });
        }
        let ev = self
            .append_event(
                KIND_SPEND,
                from,
                to,
                amount,
                reason,
                session,
                op,
                unix_now(),
            )
            .map_err(SpendError::Io)?;
        Ok((ev, self.balance(from)))
    }

    #[allow(clippy::too_many_arguments)]
    fn append_event(
        &mut self,
        kind: &str,
        from: &str,
        to: &str,
        amount: u64,
        reason: &str,
        session: &str,
        op_id: &str,
        ts: u64,
    ) -> std::io::Result<StarEvent> {
        let seq = self.seq.saturating_add(1);
        let id = uuid::Uuid::new_v4().to_string();
        let prev_hash = self.tip_hash.clone();
        let hash = event_hash(
            seq, &id, kind, from, to, amount, reason, session, op_id, ts, &prev_hash,
        );
        let ev = StarEvent {
            seq,
            id,
            kind: kind.to_string(),
            from: from.to_string(),
            to: to.to_string(),
            amount,
            reason: reason.to_string(),
            session: session.to_string(),
            op_id: op_id.to_string(),
            ts,
            prev_hash,
            hash: hash.clone(),
        };

        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        let line = serde_json::to_string(&ev)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        f.write_all(line.as_bytes())?;
        f.write_all(b"\n")?;
        f.flush()?;

        apply_event_to_balances(&mut self.balances, &ev);
        apply_event_to_trust(&mut self.trust_scores, &mut self.trust_edges, &ev);
        if ev.kind == KIND_SPEND && !ev.op_id.is_empty() {
            self.spent_ops.insert(ev.op_id.clone());
        }
        self.seq = seq;
        self.tip_hash = hash;
        Ok(ev)
    }
}

fn apply_event_to_balances(balances: &mut HashMap<String, u64>, ev: &StarEvent) {
    match ev.kind.as_str() {
        KIND_MINT | KIND_ADJUST => {
            if ev.to.is_empty() || ev.amount == 0 {
                return;
            }
            let next = balances.get(&ev.to).copied().unwrap_or(0).saturating_add(ev.amount);
            balances.insert(ev.to.clone(), next);
        }
        KIND_SPEND => {
            if ev.from.is_empty() || ev.amount == 0 {
                return;
            }
            let have = balances.get(&ev.from).copied().unwrap_or(0);
            let next = have.saturating_sub(ev.amount);
            if next == 0 {
                balances.remove(&ev.from);
            } else {
                balances.insert(ev.from.clone(), next);
            }
        }
        _ => {}
    }
}

fn apply_event_to_trust(
    trust_scores: &mut HashMap<String, u64>,
    trust_edges: &mut HashSet<String>,
    ev: &StarEvent,
) {
    if ev.kind != KIND_MINT && ev.kind != KIND_ADJUST {
        return;
    }
    if !is_trust_mint_reason(&ev.reason) || ev.to.is_empty() || ev.amount == 0 {
        return;
    }
    let next = trust_scores
        .get(&ev.to)
        .copied()
        .unwrap_or(0)
        .saturating_add(ev.amount);
    trust_scores.insert(ev.to.clone(), next);
    if !ev.from.is_empty() && ev.from != ev.to {
        trust_edges.insert(format!("{}|{}", ev.from, ev.to));
    }
}

fn event_hash(
    seq: u64,
    id: &str,
    kind: &str,
    from: &str,
    to: &str,
    amount: u64,
    reason: &str,
    session: &str,
    op_id: &str,
    ts: u64,
    prev_hash: &str,
) -> String {
    let mut hasher = Sha256::new();
    let payload = format!(
        "{seq}|{id}|{kind}|{from}|{to}|{amount}|{reason}|{session}|{op_id}|{ts}|{prev_hash}"
    );
    hasher.update(payload.as_bytes());
    hex_encode(&hasher.finalize())
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0xf) as usize] as char);
    }
    s
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn mint_spend_roundtrip_and_idempotent_op() {
        let dir = std::env::temp_dir().join(format!("star_ledger_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("star_ledger.jsonl");
        let legacy = HashMap::new();
        let mut led = StarLedger::load_or_migrate(path.clone(), &legacy).unwrap();

        let (_, bal) = led.mint("alice", 10, "test_mint", "").unwrap();
        assert_eq!(bal, 10);
        assert_eq!(led.trust_for("alice"), 0); // hour/system mint ≠ trust
        let (_, bal) = led
            .mint_from("carol", "alice", 2, "mint:rate_partner", "")
            .unwrap();
        assert_eq!(bal, 12);
        assert_eq!(led.trust_for("alice"), 2);
        assert_eq!(led.trust_gifters("alice"), 1);
        let (_, bal) = led
            .spend("alice", "bob", 3, "gift:heart", "op-1", "")
            .unwrap();
        assert_eq!(bal, 9);
        assert_eq!(led.trust_for("alice"), 2); // spend does not burn trust
        match led.spend("alice", "bob", 3, "gift:heart", "op-1", "") {
            Err(SpendError::AlreadyApplied { from_balance }) => assert_eq!(from_balance, 9),
            other => panic!("expected AlreadyApplied, got {other:?}"),
        }
        match led.spend("alice", "bob", 100, "gift:fw", "op-2", "") {
            Err(SpendError::Insufficient { have, need }) => {
                assert_eq!(have, 9);
                assert_eq!(need, 100);
            }
            other => panic!("expected Insufficient, got {other:?}"),
        }

        // Reload preserves balances + trust + op_id
        let led2 = StarLedger::load_or_migrate(path, &HashMap::new()).unwrap();
        assert_eq!(led2.balance("alice"), 9);
        assert_eq!(led2.trust_for("alice"), 2);
        assert_eq!(led2.trust_gifters("alice"), 1);
        assert!(led2.has_spend_op("op-1"));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn genesis_from_legacy() {
        let dir = std::env::temp_dir().join(format!("star_ledger_gen_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("star_ledger.jsonl");
        let mut legacy = HashMap::new();
        legacy.insert("u1".into(), 42u64);
        let led = StarLedger::load_or_migrate(path.clone(), &legacy).unwrap();
        assert_eq!(led.balance("u1"), 42);
        assert!(led.seq() >= 1);
        // Second load does not re-genesis
        let led2 = StarLedger::load_or_migrate(path, &legacy).unwrap();
        assert_eq!(led2.balance("u1"), 42);
        assert_eq!(led2.seq(), led.seq());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
