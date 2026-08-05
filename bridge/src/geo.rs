//! Approximate country/city from connect IP (hub-side only).
//!
//! Multi-provider lookup + majority vote (city-level IP DBs often disagree —
//! e.g. TELUS Calgary fibre mis-tagged as Edmonton on some free DBs).
//! Private / loopback addresses are skipped — no fake location.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Resolved approximate location for a peer (public fields only).
#[derive(Debug, Clone, Default)]
pub struct GeoLoc {
    /// ISO 3166-1 alpha-2 (e.g. "CA").
    pub code: String,
    /// English country name (e.g. "Canada").
    pub country: String,
    /// City name when known (e.g. "Calgary").
    pub city: String,
    /// Region / state / province when known (e.g. "Alberta") — optional display fallback.
    pub region: String,
}

#[derive(Clone)]
struct CacheEntry {
    loc: GeoLoc,
    at: Instant,
}

fn geo_cache() -> &'static Mutex<HashMap<IpAddr, CacheEntry>> {
    static CELL: OnceLock<Mutex<HashMap<IpAddr, CacheEntry>>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(HashMap::new()))
}

/// City DB noise moves; shorter TTL so bad cities don't stick all day.
const CACHE_TTL: Duration = Duration::from_secs(2 * 3600);
const MAX_CACHE: usize = 4096;

/// True for addresses we should not look up (LAN, loopback, link-local, etc.).
pub fn is_non_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_broadcast()
                || v4.is_unspecified()
                || v4.is_documentation()
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_unique_local()
                || v6.is_unicast_link_local()
        }
    }
}

/// Best-effort geo lookup. Cached; returns None for private IPs or failures.
pub async fn lookup(ip: IpAddr) -> Option<GeoLoc> {
    if is_non_public_ip(ip) {
        return None;
    }

    if let Some(hit) = cache_get(ip) {
        return Some(hit);
    }

    let loc = resolve_multi(ip).await?;
    if loc.code.is_empty() {
        return None;
    }
    cache_put(ip, loc.clone());
    Some(loc)
}

fn cache_get(ip: IpAddr) -> Option<GeoLoc> {
    let mut map = geo_cache().lock().ok()?;
    let ent = map.get(&ip)?;
    if ent.at.elapsed() > CACHE_TTL {
        map.remove(&ip);
        return None;
    }
    Some(ent.loc.clone())
}

fn cache_put(ip: IpAddr, loc: GeoLoc) {
    let Ok(mut map) = geo_cache().lock() else {
        return;
    };
    if map.len() >= MAX_CACHE {
        let cutoff = Instant::now() - CACHE_TTL;
        map.retain(|_, e| e.at > cutoff);
        if map.len() >= MAX_CACHE {
            map.clear();
        }
    }
    map.insert(
        ip,
        CacheEntry {
            loc,
            at: Instant::now(),
        },
    );
}

/// Parallel free providers → vote on country + city.
async fn resolve_multi(ip: IpAddr) -> Option<GeoLoc> {
    let (a, b, c, d) = tokio::join!(
        fetch_ip_api(ip),
        fetch_ipwho(ip),
        fetch_ipinfo(ip),
        fetch_freeipapi(ip),
    );

    let mut hits: Vec<ProviderHit> = [a, b, c, d].into_iter().flatten().collect();
    if hits.is_empty() {
        return None;
    }

    // Soft boost: ISP/org/hostname often encodes real city (TELUS-FIBRE-CLGRAB13 → Calgary)
    apply_org_city_hints(&mut hits);

    merge_hits(&hits)
}

#[derive(Debug, Clone)]
struct ProviderHit {
    /// Higher = prefer when votes tie (ipinfo/ipwho tend to beat old MaxMind mirrors).
    weight: u8,
    code: String,
    country: String,
    city: String,
    region: String,
    /// Extra text for city hints (org / isp / hostname).
    hint_blob: String,
}

fn normalize_code(raw: &str) -> String {
    raw.trim()
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .take(2)
        .collect::<String>()
        .to_uppercase()
}

fn clean_place(raw: &str) -> String {
    raw.trim().chars().take(64).collect()
}

fn city_key(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || *c == '-')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn merge_hits(hits: &[ProviderHit]) -> Option<GeoLoc> {
    // --- country code (weighted majority) ---
    let mut code_votes: HashMap<String, u32> = HashMap::new();
    for h in hits {
        if h.code.len() != 2 {
            continue;
        }
        *code_votes.entry(h.code.clone()).or_default() += h.weight as u32;
    }
    let code = code_votes
        .into_iter()
        .max_by_key(|(_, v)| *v)
        .map(|(c, _)| c)
        .filter(|c| c.len() == 2)?;

    let country = hits
        .iter()
        .filter(|h| h.code == code && !h.country.is_empty())
        .max_by_key(|h| h.weight)
        .map(|h| h.country.clone())
        .unwrap_or_else(|| code.clone());

    let region = hits
        .iter()
        .filter(|h| h.code == code && !h.region.is_empty())
        .max_by_key(|h| h.weight)
        .map(|h| h.region.clone())
        .unwrap_or_default();

    // --- city (weighted majority among same country) ---
    let mut city_votes: HashMap<String, (u32, String)> = HashMap::new();
    for h in hits {
        if h.code != code {
            continue;
        }
        let city = clean_place(&h.city);
        if city.is_empty() {
            continue;
        }
        let key = city_key(&city);
        if key.is_empty() {
            continue;
        }
        let e = city_votes.entry(key).or_insert((0, city.clone()));
        e.0 += h.weight as u32;
        // Keep nicest display form from highest-weight source later
        if h.weight >= 2 {
            e.1 = city;
        }
    }

    let city = city_votes
        .into_iter()
        .max_by_key(|(_, (v, _))| *v)
        .map(|(_, (_, display))| display)
        .unwrap_or_default();

    // If nobody agreed on a city, try hint blob (ISP name) as last resort
    let city = if city.is_empty() {
        hint_city_from_blob(
            &hits
                .iter()
                .map(|h| h.hint_blob.as_str())
                .collect::<Vec<_>>()
                .join(" "),
        )
        .unwrap_or_default()
    } else {
        city
    };

    Some(GeoLoc {
        code,
        country,
        city,
        region,
    })
}

/// Known ISP site codes / substrings → city (Canada + common).
/// Only used as a **tie-break / empty-city** hint, not sole source of truth.
fn hint_city_from_blob(blob: &str) -> Option<String> {
    let u = blob.to_ascii_uppercase();
    // TELUS / Shaw / Rogers style
    let pairs = [
        ("CLGRAB", "Calgary"),
        ("CLGR", "Calgary"),
        ("CALGARY", "Calgary"),
        ("EDMNAB", "Edmonton"),
        ("EDMONTON", "Edmonton"),
        ("VANCBC", "Vancouver"),
        ("VANCOUVER", "Vancouver"),
        ("TRNTO", "Toronto"),
        ("TORONTO", "Toronto"),
        ("MTRLPQ", "Montreal"),
        ("MONTREAL", "Montreal"),
        ("OTTWA", "Ottawa"),
        ("OTTAWA", "Ottawa"),
        ("WPGMB", "Winnipeg"),
        ("WINNIPEG", "Winnipeg"),
        ("REGNSK", "Regina"),
        ("SASKATOON", "Saskatoon"),
        ("HFXNS", "Halifax"),
        ("HALIFAX", "Halifax"),
    ];
    for (needle, city) in pairs {
        if u.contains(needle) {
            return Some(city.to_string());
        }
    }
    None
}

/// When providers disagree, boost the city that matches ISP/org hints.
fn apply_org_city_hints(hits: &mut [ProviderHit]) {
    let blob: String = hits
        .iter()
        .map(|h| h.hint_blob.as_str())
        .collect::<Vec<_>>()
        .join(" ");
    let Some(hint_city) = hint_city_from_blob(&blob) else {
        return;
    };
    let hk = city_key(&hint_city);
    for h in hits.iter_mut() {
        if !h.city.is_empty() && city_key(&h.city) == hk {
            // Already correct — slightly prefer this provider
            h.weight = h.weight.saturating_add(2);
        } else if h.city.is_empty() {
            h.city = hint_city.clone();
            h.weight = h.weight.saturating_add(1);
        } else if city_key(&h.city) != hk {
            // Contradicts ISP site code (classic Edmonton-vs-Calgary) — demote
            h.weight = h.weight.saturating_sub(1).max(1);
        }
    }
}

// ── providers ──────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
struct IpApiResp {
    #[serde(default)]
    status: String,
    #[serde(default, rename = "countryCode")]
    country_code: String,
    #[serde(default)]
    country: String,
    #[serde(default)]
    city: String,
    #[serde(default, rename = "regionName")]
    region_name: String,
    #[serde(default)]
    isp: String,
    #[serde(default)]
    org: String,
    #[serde(default)]
    as_name: String,
    #[serde(default, rename = "as")]
    as_field: String,
}

async fn fetch_ip_api(ip: IpAddr) -> Option<ProviderHit> {
    let url = format!(
        "http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,isp,org,as"
    );
    let client = http_client()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: IpApiResp = resp.json().await.ok()?;
    if body.status != "success" {
        return None;
    }
    let code = normalize_code(&body.country_code);
    if code.len() != 2 {
        return None;
    }
    let hint = format!(
        "{} {} {} {}",
        body.isp, body.org, body.as_field, body.as_name
    );
    Some(ProviderHit {
        weight: 2, // often good country; weaker city on some ISPs
        code,
        country: clean_place(&body.country),
        city: clean_place(&body.city),
        region: clean_place(&body.region_name),
        hint_blob: hint,
    })
}

#[derive(serde::Deserialize)]
struct IpWhoResp {
    #[serde(default)]
    success: bool,
    #[serde(default)]
    country: String,
    #[serde(default)]
    country_code: String,
    #[serde(default)]
    city: String,
    #[serde(default)]
    region: String,
    #[serde(default)]
    connection: Option<IpWhoConn>,
}

#[derive(serde::Deserialize, Default)]
struct IpWhoConn {
    #[serde(default)]
    org: String,
    #[serde(default)]
    isp: String,
}

async fn fetch_ipwho(ip: IpAddr) -> Option<ProviderHit> {
    let url = format!("https://ipwho.is/{ip}");
    let client = http_client()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: IpWhoResp = resp.json().await.ok()?;
    if !body.success {
        return None;
    }
    let code = normalize_code(&body.country_code);
    if code.len() != 2 {
        return None;
    }
    let conn = body.connection.unwrap_or_default();
    let hint = format!("{} {}", conn.org, conn.isp);
    Some(ProviderHit {
        weight: 3,
        code,
        country: clean_place(&body.country),
        city: clean_place(&body.city),
        region: clean_place(&body.region),
        hint_blob: hint,
    })
}

#[derive(serde::Deserialize)]
struct IpInfoResp {
    #[serde(default)]
    country: String,
    #[serde(default)]
    city: String,
    #[serde(default)]
    region: String,
    #[serde(default)]
    org: String,
    #[serde(default)]
    hostname: String,
    #[serde(default)]
    postal: String,
}

async fn fetch_ipinfo(ip: IpAddr) -> Option<ProviderHit> {
    // Free no-auth tier (rate-limited); fine for multi-source consensus
    let url = format!("https://ipinfo.io/{ip}/json");
    let client = http_client()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: IpInfoResp = resp.json().await.ok()?;
    let code = normalize_code(&body.country);
    if code.len() != 2 {
        return None;
    }
    // Country name not always present — leave empty for merge to fill from others
    let hint = format!("{} {} {}", body.org, body.hostname, body.postal);
    Some(ProviderHit {
        weight: 3,
        code,
        country: String::new(),
        city: clean_place(&body.city),
        region: clean_place(&body.region),
        hint_blob: hint,
    })
}

#[derive(serde::Deserialize)]
struct FreeIpApiResp {
    #[serde(default, rename = "countryCode")]
    country_code: String,
    #[serde(default, rename = "countryName")]
    country_name: String,
    #[serde(default)]
    city_name: Option<String>,
    #[serde(default, rename = "cityName")]
    city_name_alt: Option<String>,
    #[serde(default)]
    city: Option<String>,
    #[serde(default, rename = "regionName")]
    region_name: Option<String>,
    #[serde(default)]
    zip_code: Option<String>,
}

async fn fetch_freeipapi(ip: IpAddr) -> Option<ProviderHit> {
    let url = format!("https://free.freeipapi.com/api/json/{ip}");
    let client = http_client()?;
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body: FreeIpApiResp = resp.json().await.ok()?;
    let code = normalize_code(&body.country_code);
    if code.len() != 2 {
        return None;
    }
    let city = body
        .city
        .or(body.city_name)
        .or(body.city_name_alt)
        .unwrap_or_default();
    let region = body.region_name.unwrap_or_default();
    let hint = body.zip_code.unwrap_or_default();
    Some(ProviderHit {
        weight: 2,
        code,
        country: clean_place(&body.country_name),
        city: clean_place(&city),
        region: clean_place(&region),
        hint_blob: hint,
    })
}

fn http_client() -> Option<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("ruletka-bridge-geo/1.1")
        .build()
        .ok()
}

/// Parse client IP from proxy headers, falling back to the TCP peer.
pub fn client_ip_from_headers(
    headers: &axum::http::HeaderMap,
    peer: std::net::SocketAddr,
) -> IpAddr {
    for key in ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"] {
        if let Some(v) = headers.get(key).and_then(|h| h.to_str().ok()) {
            let first = v.split(',').next().unwrap_or(v).trim();
            if let Ok(ip) = first.parse::<IpAddr>() {
                return ip;
            }
        }
    }
    peer.ip()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn telus_calgary_org_hint() {
        let c = hint_city_from_blob("TELUS-FIBRE-CLGRAB13 AS852 TELUS Communications");
        assert_eq!(c.as_deref(), Some("Calgary"));
    }

    #[test]
    fn merge_prefers_calgary_when_hint_and_majority() {
        let hits = vec![
            ProviderHit {
                weight: 2,
                code: "CA".into(),
                country: "Canada".into(),
                city: "Edmonton".into(),
                region: "Alberta".into(),
                hint_blob: "TELUS-FIBRE-CLGRAB13".into(),
            },
            ProviderHit {
                weight: 3,
                code: "CA".into(),
                country: "Canada".into(),
                city: "Calgary".into(),
                region: "Alberta".into(),
                hint_blob: "TELUS".into(),
            },
            ProviderHit {
                weight: 3,
                code: "CA".into(),
                country: "Canada".into(),
                city: "Calgary".into(),
                region: "Alberta".into(),
                hint_blob: String::new(),
            },
        ];
        let mut hits = hits;
        apply_org_city_hints(&mut hits);
        let loc = merge_hits(&hits).unwrap();
        assert_eq!(loc.code, "CA");
        assert_eq!(city_key(&loc.city), "calgary");
    }
}
