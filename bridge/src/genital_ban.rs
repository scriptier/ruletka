//! Auto-ban from the on-device genital detector (2026-11-04).
//!
//! The VIEWER's device runs NudeNet on the partner's incoming video and sends
//! `genital_hit` after 2 of 3 sampled frames agree. `SimpleHub` first checks
//! that the sender is really in a live stranger match with the target (see
//! `handle_genital_hit`), then feeds the hit here. This module is pure (no
//! sockets, no clock) so every rule is unit-tested.
//!
//! Ban paths:
//! * **Session path** — the same viewer confirms twice in the same match,
//!   at least `MIN_HIT_GAP_MS` apart, both from the real detector.
//!   Off for senior targets, mutual feuds, reporters with an overturned ban
//!   behind them, and reporters over their daily ban cap.
//! * **Cross path** — confirmed hits from at least 2 different reporter
//!   clusters (/24 or uid) within `HIT_TTL_MS`, at least one from the
//!   detector. `porn_only` (lite fallback) hits only count here.
//!
//! Ladder: 24 h → 7 d → permanent. The step is
//! `min(offenses, distinct reporter clusters over all offenses) - 1`, so one
//! person (or one /24) can never push anyone past 24 h.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

pub const HIT_TTL_MS: u64 = 30 * 60 * 1000;
pub const MIN_HIT_GAP_MS: u64 = 2_000;
pub const MIN_MATCH_AGE_MS: u64 = 2_000;
pub const REPORTER_RATE_PER_HOUR: usize = 10;
pub const REPORTER_BAN_CAP_24H: usize = 3;
pub const CLUSTER_BAN_CAP_24H: usize = 6;
pub const OFFENSE_TTL_SECS: u64 = 180 * 24 * 3600;
/// Server-side score floors (client thresholds are stricter; this only drops junk).
pub const MIN_DET_SCORE: f64 = 0.5;
pub const MIN_PORN_ONLY: f64 = 0.9;
pub const LADDER_SECS: [u64; 2] = [24 * 3600, 7 * 24 * 3600];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HitKind {
    Detector,
    PornOnly,
}

impl HitKind {
    pub fn parse(s: &str) -> Option<Self> {
        match s.trim() {
            "detector" => Some(Self::Detector),
            "porn_only" => Some(Self::PornOnly),
            _ => None,
        }
    }
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Detector => "detector",
            Self::PornOnly => "porn_only",
        }
    }
}

/// Score sanity on the server. Returns the reject reason, if any.
pub fn score_reject(kind: HitKind, det_score: f64, porn: f64, cls: &str) -> Option<&'static str> {
    let finite = |x: f64| x.is_finite() && (0.0..=1.0).contains(&x);
    if !finite(det_score) || !finite(porn) {
        return Some("bad_scores");
    }
    match kind {
        HitKind::Detector => {
            if cls != "MALE_GENITALIA_EXPOSED" && cls != "FEMALE_GENITALIA_EXPOSED" {
                return Some("bad_class");
            }
            if det_score < MIN_DET_SCORE {
                return Some("low_score");
            }
        }
        HitKind::PornOnly => {
            if porn < MIN_PORN_ONLY {
                return Some("low_score");
            }
        }
    }
    None
}

#[derive(Debug, Clone)]
pub struct Hit {
    pub reporter_uid: String,
    pub reporter_cluster: String,
    pub session_id: String,
    pub kind: HitKind,
    pub at_ms: u64,
}

/// Facts the hub knows about this reporter/target pair.
#[derive(Debug, Clone, Copy, Default)]
pub struct Guards {
    /// Target is a senior (trust >= 250): needs the cross path.
    pub target_senior: bool,
    /// The target reported this reporter (report or genital hit) recently.
    pub mutual_feud: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Decision {
    /// Rejected before counting (rate limit, …).
    Reject(&'static str),
    /// Counted; no ban yet. Reason is a short hint for logs / client.
    Counted(&'static str),
    Ban(Ban),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Ban {
    /// 1 = 24 h, 2 = 7 d, 3 = permanent
    pub level: u32,
    /// 0 when permanent
    pub secs: u64,
    pub permanent: bool,
    /// "session" | "cross"
    pub path: &'static str,
    pub reporter_clusters: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Offense {
    pub at: u64,
    pub level: u32,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub reporter_uids: Vec<String>,
    #[serde(default)]
    pub reporter_clusters: Vec<String>,
    #[serde(default)]
    pub overturned: bool,
}

/// Persisted part (offense history). Hits / rates are memory-only on purpose:
/// a hub restart forgets half-finished evidence instead of banning on stale hits.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OffenseBook {
    #[serde(default)]
    pub offenses: HashMap<String, Vec<Offense>>,
}

#[derive(Debug, Default)]
pub struct GenitalLedger {
    pub book: OffenseBook,
    /// target uid → recent hits
    hits: HashMap<String, Vec<Hit>>,
    /// reporter uid → hit times (rate limit)
    rate: HashMap<String, VecDeque<u64>>,
    /// reporter uid → times their hits triggered a ban
    triggered_by_uid: HashMap<String, VecDeque<u64>>,
    /// reporter cluster → times its hits triggered a ban
    triggered_by_cluster: HashMap<String, VecDeque<u64>>,
}

fn prune(q: &mut VecDeque<u64>, now_ms: u64, window_ms: u64) {
    while q.front().is_some_and(|t| now_ms.saturating_sub(*t) >= window_ms) {
        q.pop_front();
    }
}

impl GenitalLedger {
    pub fn with_book(book: OffenseBook) -> Self {
        Self { book, ..Default::default() }
    }

    /// Reporter uids that were behind an offense an admin overturned.
    pub fn reporter_overturned(&self, reporter_uid: &str) -> bool {
        self.book
            .offenses
            .values()
            .flatten()
            .any(|o| o.overturned && o.reporter_uids.iter().any(|u| u == reporter_uid))
    }

    /// Did `target` send a genital hit about `reporter` in the hit window?
    pub fn reported_back(&self, target_uid: &str, reporter_uid: &str, now_ms: u64) -> bool {
        self.hits.get(reporter_uid).is_some_and(|v| {
            v.iter().any(|h| h.reporter_uid == target_uid && now_ms.saturating_sub(h.at_ms) < HIT_TTL_MS)
        })
    }

    fn cap_reached(&mut self, uid: &str, cluster: &str, now_ms: u64) -> bool {
        let day = 24 * 3600 * 1000;
        let u = self.triggered_by_uid.entry(uid.to_string()).or_default();
        prune(u, now_ms, day);
        let u_n = u.len();
        let c = self.triggered_by_cluster.entry(cluster.to_string()).or_default();
        prune(c, now_ms, day);
        u_n >= REPORTER_BAN_CAP_24H || c.len() >= CLUSTER_BAN_CAP_24H
    }

    /// Count one validated hit and decide. `now_secs` is used for the offense log.
    pub fn record(&mut self, target_uid: &str, hit: Hit, guards: Guards, now_ms: u64) -> Decision {
        // Reporter rate limit (per uid).
        let q = self.rate.entry(hit.reporter_uid.clone()).or_default();
        prune(q, now_ms, 3600 * 1000);
        if q.len() >= REPORTER_RATE_PER_HOUR {
            return Decision::Reject("rate");
        }
        q.push_back(now_ms);

        let overturned = self.reporter_overturned(&hit.reporter_uid);
        let capped = self.cap_reached(&hit.reporter_uid, &hit.reporter_cluster, now_ms);

        let list = self.hits.entry(target_uid.to_string()).or_default();
        list.retain(|h| now_ms.saturating_sub(h.at_ms) < HIT_TTL_MS);
        list.push(hit.clone());

        // Session path: same reporter, same match, two detector hits >= gap apart.
        let solo_ok = !guards.target_senior && !guards.mutual_feud && !overturned && !capped;
        let session_hits: Vec<&Hit> = list
            .iter()
            .filter(|h| {
                h.reporter_uid == hit.reporter_uid
                    && h.session_id == hit.session_id
                    && h.kind == HitKind::Detector
            })
            .collect();
        let session_ready = hit.kind == HitKind::Detector
            && session_hits.len() >= 2
            && session_hits
                .iter()
                .any(|h| now_ms.saturating_sub(h.at_ms) >= MIN_HIT_GAP_MS);

        // Cross path: >= 2 distinct clusters, at least one detector hit. Capped
        // or overturned reporters still count as a voice here (others must agree).
        let mut clusters: HashSet<&str> = HashSet::new();
        let mut any_detector = false;
        for h in list.iter() {
            if guards.mutual_feud && h.reporter_uid == hit.reporter_uid {
                continue;
            }
            clusters.insert(h.reporter_cluster.as_str());
            any_detector |= h.kind == HitKind::Detector;
        }
        let cross_ready = clusters.len() >= 2 && any_detector;

        let path = if cross_ready {
            "cross"
        } else if session_ready && solo_ok {
            "session"
        } else {
            return Decision::Counted(if session_ready {
                if guards.target_senior {
                    "needs_second_reporter_senior"
                } else if guards.mutual_feud {
                    "needs_second_reporter_feud"
                } else if overturned {
                    "needs_second_reporter_overturned"
                } else {
                    "needs_second_reporter_cap"
                }
            } else {
                "counted"
            });
        };

        let mut reporter_uids: Vec<String> = list.iter().map(|h| h.reporter_uid.clone()).collect();
        reporter_uids.sort();
        reporter_uids.dedup();
        let mut reporter_clusters: Vec<String> = if path == "cross" {
            clusters.iter().map(|s| s.to_string()).collect()
        } else {
            vec![hit.reporter_cluster.clone()]
        };
        reporter_clusters.sort();
        if path == "session" {
            reporter_uids = vec![hit.reporter_uid.clone()];
        }
        // The evidence is spent: clear hits on this target.
        self.hits.remove(target_uid);
        for u in &reporter_uids {
            self.triggered_by_uid.entry(u.clone()).or_default().push_back(now_ms);
        }
        for c in &reporter_clusters {
            self.triggered_by_cluster.entry(c.clone()).or_default().push_back(now_ms);
        }

        let now_secs = now_ms / 1000;
        let (level, secs, permanent) = self.next_level(target_uid, &reporter_clusters, now_secs);
        self.book.offenses.entry(target_uid.to_string()).or_default().push(Offense {
            at: now_secs,
            level,
            path: path.to_string(),
            reporter_uids,
            reporter_clusters: reporter_clusters.clone(),
            overturned: false,
        });
        Decision::Ban(Ban { level, secs, permanent, path, reporter_clusters })
    }

    /// Level for a new offense: (level 1..3, secs, permanent).
    pub fn next_level(&mut self, target_uid: &str, new_clusters: &[String], now_secs: u64) -> (u32, u64, bool) {
        let prior: Vec<&Offense> = self
            .book
            .offenses
            .get(target_uid)
            .map(|v| {
                v.iter()
                    .filter(|o| !o.overturned && now_secs.saturating_sub(o.at) < OFFENSE_TTL_SECS)
                    .collect()
            })
            .unwrap_or_default();
        let count = prior.len() + 1;
        let mut clusters: HashSet<&str> = new_clusters.iter().map(|s| s.as_str()).collect();
        for o in &prior {
            clusters.extend(o.reporter_clusters.iter().map(|s| s.as_str()));
        }
        let idx = count.min(clusters.len()).saturating_sub(1).min(2);
        match idx {
            0 => (1, LADDER_SECS[0], false),
            1 => (2, LADDER_SECS[1], false),
            _ => (3, 0, true),
        }
    }

    /// Admin unban: mark offenses whose ban is still running (or all recent ones) overturned.
    /// Returns how many were marked.
    pub fn overturn_recent(&mut self, target_uid: &str, now_secs: u64) -> usize {
        let mut n = 0;
        if let Some(v) = self.book.offenses.get_mut(target_uid) {
            for o in v.iter_mut().filter(|o| !o.overturned) {
                let running = o.level >= 3
                    || now_secs < o.at.saturating_add(LADDER_SECS[(o.level.max(1) as usize - 1).min(1)]);
                if running {
                    o.overturned = true;
                    n += 1;
                }
            }
        }
        n
    }

    pub fn latest_active(&self, target_uid: &str) -> Option<&Offense> {
        self.book.offenses.get(target_uid).and_then(|v| v.iter().rev().find(|o| !o.overturned))
    }

    /// Drop offenses older than the TTL (keeps file small).
    pub fn gc(&mut self, now_secs: u64) {
        self.book.offenses.retain(|_, v| {
            v.retain(|o| now_secs.saturating_sub(o.at) < OFFENSE_TTL_SECS);
            !v.is_empty()
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const T: &str = "target";

    fn hit(uid: &str, cluster: &str, sid: &str, kind: HitKind, at_ms: u64) -> Hit {
        Hit {
            reporter_uid: uid.into(),
            reporter_cluster: cluster.into(),
            session_id: sid.into(),
            kind,
            at_ms,
        }
    }
    fn det(uid: &str, sid: &str, at: u64) -> Hit {
        hit(uid, &format!("uid:{uid}"), sid, HitKind::Detector, at)
    }
    const BASE: u64 = 1_800_000_000_000;

    #[test]
    fn two_hits_same_session_ban_24h() {
        let mut l = GenitalLedger::default();
        assert_eq!(l.record(T, det("a", "s1", BASE), Guards::default(), BASE), Decision::Counted("counted"));
        match l.record(T, det("a", "s1", BASE + 3000), Guards::default(), BASE + 3000) {
            Decision::Ban(b) => {
                assert_eq!((b.level, b.secs, b.permanent, b.path), (1, 86_400, false, "session"));
            }
            d => panic!("{d:?}"),
        }
        assert_eq!(l.book.offenses[T].len(), 1);
    }

    #[test]
    fn hits_too_close_do_not_ban() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        assert_eq!(
            l.record(T, det("a", "s1", BASE + 500), Guards::default(), BASE + 500),
            Decision::Counted("counted")
        );
    }

    #[test]
    fn hits_in_different_sessions_from_one_reporter_do_not_ban() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        assert_eq!(
            l.record(T, det("a", "s2", BASE + 60_000), Guards::default(), BASE + 60_000),
            Decision::Counted("counted")
        );
    }

    #[test]
    fn porn_only_cannot_ban_alone() {
        let mut l = GenitalLedger::default();
        let p = |at| hit("a", "uid:a", "s1", HitKind::PornOnly, at);
        l.record(T, p(BASE), Guards::default(), BASE);
        assert_eq!(l.record(T, p(BASE + 5000), Guards::default(), BASE + 5000), Decision::Counted("counted"));
        // Two porn-only reporters still need a detector hit.
        let q = hit("b", "uid:b", "s9", HitKind::PornOnly, BASE + 9000);
        assert_eq!(l.record(T, q, Guards::default(), BASE + 9000), Decision::Counted("counted"));
        // A detector hit from a third reporter completes the cross path.
        let d = det("c", "s10", BASE + 12_000);
        assert!(matches!(l.record(T, d, Guards::default(), BASE + 12_000), Decision::Ban(Ban { path: "cross", .. })));
    }

    #[test]
    fn cross_path_two_reporters_one_hit_each() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        match l.record(T, det("b", "s2", BASE + 600_000), Guards::default(), BASE + 600_000) {
            Decision::Ban(b) => {
                assert_eq!(b.path, "cross");
                assert_eq!(b.reporter_clusters.len(), 2);
            }
            d => panic!("{d:?}"),
        }
    }

    #[test]
    fn same_cluster_counts_once_on_cross_path() {
        let mut l = GenitalLedger::default();
        l.record(T, hit("a", "net:1.2.3", "s1", HitKind::Detector, BASE), Guards::default(), BASE);
        let d = l.record(T, hit("b", "net:1.2.3", "s2", HitKind::Detector, BASE + 1000), Guards::default(), BASE + 1000);
        assert_eq!(d, Decision::Counted("counted"));
    }

    #[test]
    fn hits_expire_after_30_min() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        let later = BASE + HIT_TTL_MS + 1;
        assert_eq!(l.record(T, det("b", "s2", later), Guards::default(), later), Decision::Counted("counted"));
    }

    #[test]
    fn senior_target_needs_second_reporter() {
        let mut l = GenitalLedger::default();
        let g = Guards { target_senior: true, mutual_feud: false };
        l.record(T, det("a", "s1", BASE), g, BASE);
        assert_eq!(
            l.record(T, det("a", "s1", BASE + 3000), g, BASE + 3000),
            Decision::Counted("needs_second_reporter_senior")
        );
        assert!(matches!(l.record(T, det("b", "s2", BASE + 9000), g, BASE + 9000), Decision::Ban(_)));
    }

    #[test]
    fn mutual_feud_blocks_solo_and_does_not_count_feuder() {
        let mut l = GenitalLedger::default();
        let g = Guards { target_senior: false, mutual_feud: true };
        l.record(T, det("a", "s1", BASE), g, BASE);
        assert_eq!(
            l.record(T, det("a", "s1", BASE + 3000), g, BASE + 3000),
            Decision::Counted("needs_second_reporter_feud")
        );
    }

    #[test]
    fn reported_back_detects_feud() {
        let mut l = GenitalLedger::default();
        // b reported a
        l.record("a", det("b", "s1", BASE), Guards::default(), BASE);
        assert!(l.reported_back("b", "a", BASE + 10));
        assert!(!l.reported_back("c", "a", BASE + 10));
        assert!(!l.reported_back("b", "a", BASE + HIT_TTL_MS + 1));
    }

    #[test]
    fn reporter_rate_limit() {
        let mut l = GenitalLedger::default();
        for i in 0..REPORTER_RATE_PER_HOUR as u64 {
            let t = format!("t{i}");
            let d = l.record(&t, det("a", &format!("s{i}"), BASE + i), Guards::default(), BASE + i);
            assert!(matches!(d, Decision::Counted(_)), "{d:?}");
        }
        let d = l.record("tx", det("a", "sx", BASE + 100), Guards::default(), BASE + 100);
        assert_eq!(d, Decision::Reject("rate"));
        let later = BASE + 3600 * 1000 + 200;
        assert!(matches!(l.record("ty", det("a", "sy", later), Guards::default(), later), Decision::Counted(_)));
    }

    #[test]
    fn reporter_ban_cap_per_day() {
        let mut l = GenitalLedger::default();
        let mut t = BASE;
        for i in 0..REPORTER_BAN_CAP_24H {
            let target = format!("v{i}");
            let sid = format!("s{i}");
            l.record(&target, det("a", &sid, t), Guards::default(), t);
            t += 3000;
            assert!(matches!(l.record(&target, det("a", &sid, t), Guards::default(), t), Decision::Ban(_)));
            t += 3000;
        }
        l.record("v9", det("a", "s9", t), Guards::default(), t);
        t += 3000;
        assert_eq!(
            l.record("v9", det("a", "s9", t), Guards::default(), t),
            Decision::Counted("needs_second_reporter_cap")
        );
    }

    #[test]
    fn ladder_24h_7d_permanent_with_distinct_reporters() {
        let mut l = GenitalLedger::default();
        let mut t = BASE;
        let mut levels = vec![];
        for r in ["a", "b", "c"] {
            let sid = format!("s-{r}");
            l.record(T, det(r, &sid, t), Guards::default(), t);
            t += 3000;
            match l.record(T, det(r, &sid, t), Guards::default(), t) {
                Decision::Ban(b) => levels.push((b.level, b.secs, b.permanent)),
                d => panic!("{d:?}"),
            }
            t += 2 * 24 * 3600 * 1000; // next offense after the first ban ended
        }
        assert_eq!(levels, vec![(1, 86_400, false), (2, 7 * 86_400, false), (3, 0, true)]);
    }

    #[test]
    fn same_reporter_cannot_escalate_past_24h() {
        let mut l = GenitalLedger::default();
        let mut t = BASE;
        for _ in 0..3 {
            l.record(T, det("a", &format!("s{t}"), t), Guards::default(), t);
            t += 3000;
            match l.record(T, det("a", &format!("s{}", t - 3000), t), Guards::default(), t) {
                Decision::Ban(b) => assert_eq!(b.level, 1),
                d => panic!("{d:?}"),
            }
            t += 2 * 24 * 3600 * 1000;
        }
    }

    #[test]
    fn overturned_offense_is_skipped_and_reporter_loses_solo() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        assert!(matches!(l.record(T, det("a", "s1", BASE + 3000), Guards::default(), BASE + 3000), Decision::Ban(_)));
        assert_eq!(l.overturn_recent(T, BASE / 1000 + 10), 1);
        assert!(l.latest_active(T).is_none());
        assert!(l.reporter_overturned("a"));
        // a's next solo pair on someone else does not ban
        let t = BASE + 10_000;
        l.record("x", det("a", "s5", t), Guards::default(), t);
        assert_eq!(
            l.record("x", det("a", "s5", t + 3000), Guards::default(), t + 3000),
            Decision::Counted("needs_second_reporter_overturned")
        );
        // b bans T: overturned offense does not count → level 1
        l.record(T, det("b", "s7", t), Guards::default(), t);
        match l.record(T, det("b", "s7", t + 3000), Guards::default(), t + 3000) {
            Decision::Ban(b) => assert_eq!(b.level, 1),
            d => panic!("{d:?}"),
        }
    }

    #[test]
    fn score_floor() {
        assert_eq!(score_reject(HitKind::Detector, 0.3, 0.0, "MALE_GENITALIA_EXPOSED"), Some("low_score"));
        assert_eq!(score_reject(HitKind::Detector, 0.9, 0.0, "FEMALE_BREAST_EXPOSED"), Some("bad_class"));
        assert_eq!(score_reject(HitKind::Detector, f64::NAN, 0.0, "MALE_GENITALIA_EXPOSED"), Some("bad_scores"));
        assert_eq!(score_reject(HitKind::Detector, 0.7, 0.0, "FEMALE_GENITALIA_EXPOSED"), None);
        assert_eq!(score_reject(HitKind::PornOnly, 0.0, 0.85, ""), Some("low_score"));
        assert_eq!(score_reject(HitKind::PornOnly, 0.0, 0.95, ""), None);
        assert_eq!(HitKind::parse("detector"), Some(HitKind::Detector));
        assert_eq!(HitKind::parse("x"), None);
    }

    #[test]
    fn offense_book_roundtrip_and_gc() {
        let mut l = GenitalLedger::default();
        l.record(T, det("a", "s1", BASE), Guards::default(), BASE);
        l.record(T, det("a", "s1", BASE + 3000), Guards::default(), BASE + 3000);
        let json = serde_json::to_string(&l.book).unwrap();
        let book: OffenseBook = serde_json::from_str(&json).unwrap();
        let mut l2 = GenitalLedger::with_book(book);
        assert_eq!(l2.book.offenses[T].len(), 1);
        l2.gc(BASE / 1000 + OFFENSE_TTL_SECS + 10);
        assert!(l2.book.offenses.is_empty());
    }
}
