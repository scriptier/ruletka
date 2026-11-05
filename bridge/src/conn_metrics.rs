//! Bounded connectivity funnel extras (country / ICE path / relay rung).
//! No personal data — ISO country codes and coarse path labels only.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Keep at most this many named countries; the rest fold into "other".
pub const COUNTRY_TOP_N: usize = 16;

/// Allowed ICE path labels reported by clients (getStats).
pub const ICE_PATH_LABELS: &[&str] = &[
    "host",
    "srflx",
    "prflx",
    "relay_udp",
    "relay_tcp",
    "relay_tls",
    "unknown",
];

/// Relay-only retry ladder rungs (web + mobile).
pub const RELAY_RUNG_LABELS: &[&str] = &[
    "initial",
    "all_relays",
    "turns_443",
    "turn_udp",
    "none",
];

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ConnFunnelExtras {
    /// match_ok counts by ISO country (top N + "other").
    #[serde(default)]
    pub match_ok_by_country: HashMap<String, u64>,
    /// match_fail_ice counts by ISO country (top N + "other").
    #[serde(default)]
    pub match_fail_ice_by_country: HashMap<String, u64>,
    /// Selected candidate pair kind (host / srflx / relay_udp / …).
    #[serde(default)]
    pub match_ok_by_ice_path: HashMap<String, u64>,
    /// Which relay retry rung connected (or "initial" / "none").
    #[serde(default)]
    pub match_ok_by_rung: HashMap<String, u64>,
}

/// Normalize a country code to XX or "other".
pub fn normalize_country(code: &str) -> String {
    let c = code.trim().to_ascii_uppercase();
    if c.len() == 2 && c.chars().all(|ch| ch.is_ascii_alphabetic()) {
        c
    } else {
        "other".into()
    }
}

/// Normalize ice_path from client; unknown strings → "unknown".
pub fn normalize_ice_path(raw: &str) -> String {
    let s = raw.trim().to_ascii_lowercase().replace('-', "_");
    if ICE_PATH_LABELS.contains(&s.as_str()) {
        s
    } else {
        "unknown".into()
    }
}

/// Normalize relay rung from client.
pub fn normalize_rung(raw: &str) -> String {
    let s = raw.trim().to_ascii_lowercase().replace('-', "_");
    if RELAY_RUNG_LABELS.contains(&s.as_str()) {
        s
    } else {
        "none".into()
    }
}

/// Increment a top-N map. New keys beyond capacity go to "other".
pub fn bump_top_n(map: &mut HashMap<String, u64>, key: &str, n: usize) {
    let k = if key == "other" {
        "other".to_string()
    } else {
        key.to_string()
    };
    if let Some(v) = map.get_mut(&k) {
        *v = v.saturating_add(1);
        return;
    }
    let named = map.keys().filter(|x| x.as_str() != "other").count();
    if named < n {
        map.insert(k, 1);
    } else {
        let other = map.entry("other".into()).or_insert(0);
        *other = other.saturating_add(1);
    }
}

pub fn bump_fixed(map: &mut HashMap<String, u64>, key: &str) {
    let e = map.entry(key.to_string()).or_insert(0);
    *e = e.saturating_add(1);
}

/// Classify a browser/RN getStats local candidate into an ice_path label.
/// `cand_type`: host|srflx|prflx|relay
/// `protocol`: udp|tcp
/// `url` / `relayProtocol`: optional turns:/turn: hint for TLS vs plain
pub fn classify_ice_path(cand_type: &str, protocol: &str, url_or_relay: &str) -> String {
    let t = cand_type.trim().to_ascii_lowercase();
    let p = protocol.trim().to_ascii_lowercase();
    let u = url_or_relay.trim().to_ascii_lowercase();
    match t.as_str() {
        "host" => "host".into(),
        "srflx" => "srflx".into(),
        "prflx" => "prflx".into(),
        "relay" => {
            if u.starts_with("turns:") || p == "tls" || u.contains("transport=tls") {
                "relay_tls".into()
            } else if p == "tcp" || u.contains("transport=tcp") {
                "relay_tcp".into()
            } else {
                "relay_udp".into()
            }
        }
        _ => "unknown".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn country_normalize() {
        assert_eq!(normalize_country("ru"), "RU");
        assert_eq!(normalize_country("CA"), "CA");
        assert_eq!(normalize_country(""), "other");
        assert_eq!(normalize_country("USA"), "other");
    }

    #[test]
    fn top_n_folds_overflow_to_other() {
        let mut m = HashMap::new();
        for i in 0..COUNTRY_TOP_N {
            let code = format!(
                "{}{}",
                (b'A' + (i as u8 / 26)) as char,
                (b'A' + (i as u8 % 26)) as char
            );
            bump_top_n(&mut m, &code, COUNTRY_TOP_N);
        }
        assert_eq!(m.len(), COUNTRY_TOP_N);
        bump_top_n(&mut m, "ZZ", COUNTRY_TOP_N);
        assert_eq!(m.get("other"), Some(&1));
        assert!(!m.contains_key("ZZ"));
        // existing key still increments
        bump_top_n(&mut m, "AA", COUNTRY_TOP_N);
        assert_eq!(m.get("AA"), Some(&2));
    }

    #[test]
    fn classify_paths() {
        assert_eq!(classify_ice_path("host", "udp", ""), "host");
        assert_eq!(classify_ice_path("srflx", "udp", ""), "srflx");
        assert_eq!(
            classify_ice_path("relay", "udp", "turn:ruletka.vip:3478"),
            "relay_udp"
        );
        assert_eq!(
            classify_ice_path("relay", "tcp", "turn:ruletka.vip:3478?transport=tcp"),
            "relay_tcp"
        );
        assert_eq!(
            classify_ice_path("relay", "udp", "turns:ruletka.vip:443?transport=tcp"),
            "relay_tls"
        );
        assert_eq!(classify_ice_path("relay", "tls", ""), "relay_tls");
    }

    #[test]
    fn normalize_labels() {
        assert_eq!(normalize_ice_path("Relay-UDP"), "relay_udp");
        assert_eq!(normalize_ice_path("weird"), "unknown");
        assert_eq!(normalize_rung("turns-443"), "turns_443");
        assert_eq!(normalize_rung("nope"), "none");
    }
}
