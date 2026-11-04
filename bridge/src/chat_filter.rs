//! Stranger text-chat safety matcher (server side).
//!
//! Small and conservative on purpose. It only looks at one message (plus one
//! "asked about age recently" bit the caller keeps per sender) and sorts it into:
//!
//! - `Grooming`: an age question or a minor marker ("сколько тебе лет",
//!   "школьница", "мне 14") together with sexual words.
//! - `Explicit`: clearly sexual words or demands ("покажи сиськи", "send nudes").
//!   Everyday swearing ("пиздец", "блять") is NOT in the list.
//! - `ContactSwap`: pushes to move the chat off Ruletka (t.me links, @handles,
//!   phone numbers, e-mails, "го в тг", "whatsapp?").
//!
//! Text is folded before matching: lower case, ё→е, Latin lookalikes inside
//! Cyrillic words (`сeкс` with a Latin `e`), Cyrillic lookalikes and leetspeak
//! inside Latin words (`s3x`, `p0rn`), and repeated letters (`сееекс`).
//! Word lists go through the same fold, so they are written in plain spelling.
//!
//! Known gaps (kept out to avoid false positives): letters split by spaces or
//! dots ("с и с ь к и"), numbers written as words, images/voice.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatCategory {
    ContactSwap,
    Explicit,
    Grooming,
}

impl ChatCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            ChatCategory::ContactSwap => "contact_swap",
            ChatCategory::Explicit => "explicit",
            ChatCategory::Grooming => "grooming",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChatVerdict {
    /// `None` = deliver as usual.
    pub category: Option<ChatCategory>,
    /// Short rule name for the safety log (never the matched text).
    pub rule: &'static str,
    /// This message asks for age or mentions a minor. The caller remembers it
    /// for a few minutes so a later sexual message from the same sender counts
    /// as grooming.
    pub age_context: bool,
}

// ---------- word lists (plain spelling; folded at match time) ----------

/// Off-platform apps. Exact tokens.
const PLATFORM_EQ: &[&str] = &[
    "tg",
    "тг",
    "vk",
    "вк",
    "kik",
    "wechat",
    "снап",
    "снэп",
    "инста",
    "инсту",
    "инсте",
    "инсты",
    "insta",
    "ватс",
    "вотс",
];
/// Off-platform apps. Token prefixes.
const PLATFORM_PREFIX: &[&str] = &[
    "telegram",
    "телеграм",
    "телег",
    "whatsapp",
    "ватсап",
    "вотсап",
    "вацап",
    "viber",
    "вайбер",
    "snapchat",
    "снапчат",
    "instagram",
    "инстаграм",
    "discord",
    "дискорд",
    "skype",
    "скайп",
    "onlyfans",
    "онлифанс",
    "вконтакт",
    "signalapp",
];
/// Short app names that are also normal words ("oh snap"): only after these.
const PLATFORM_PAIRS: &[(&str, &str)] = &[("on", "snap"), ("my", "snap"), ("in", "snap")];
/// Long app names also matched with separators removed ("w h a t s a p p").
const PLATFORM_SQUASHED: &[&str] = &[
    "telegram",
    "телеграм",
    "whatsapp",
    "ватсап",
    "snapchat",
    "instagram",
    "инстаграм",
    "onlyfans",
];
/// Link markers checked on the lower-cased text with spaces removed.
const LINK_MARKERS: &[&str] = &[
    "t.me/",
    "telegram.me/",
    "telegram.dog/",
    "wa.me/",
    "chat.whatsapp.com",
    "instagram.com/",
    "vk.com/",
    "vk.me/",
    "discord.gg/",
    "discord.com/invite",
    "snapchat.com/add",
    "onlyfans.com",
    "fansly.com",
];
/// "Write me / add me / go to" words that make an app mention a push.
const PUSH_EQ: &[&str] = &[
    "го", "go", "dm", "msg", "my", "мой", "моя", "мою", "мне", "есть", "me", "hmu",
];
const PUSH_PREFIX: &[&str] = &[
    "пиш",
    "напиш",
    "добав",
    "кинь",
    "кинеш",
    "скинь",
    "скинеш",
    "скинуть",
    "кинуть",
    "дай",
    "давай",
    "перейд",
    "переход",
    "ищи",
    "найд",
    "ник",
    "write",
    "add",
    "text",
    "messag",
    "find",
    "follow",
    "contact",
];

/// Clearly sexual words. Exact tokens.
const EXPLICIT_EQ: &[&str] = &[
    "пососи",
    "соси",
    "выебу",
    "выебать",
    "отымею",
    "вирт",
    "виртом",
    "виртик",
    "анал",
    "tits",
    "titties",
    "boobs",
    "boobies",
    "pussy",
    "cock",
    "cum",
    "cumming",
    "nudes",
    "slut",
    "sluts",
    "whore",
    "whores",
    "wank",
    "blowjob",
    "handjob",
];
/// Clearly sexual words. Token prefixes.
const EXPLICIT_PREFIX: &[&str] = &[
    "сиськ",
    "сисек",
    "сисечк",
    "письк",
    "писечк",
    "минет",
    "отсос",
    "дроч",
    "подроч",
    "нюдс",
    "шлюх",
    "трахн",
    "трахат",
    "трахал",
    "трахаю",
    "трахаеш",
    "раздевайс",
    "разденьс",
    "разденеш",
    "пенис",
    "вагин",
    "клитор",
    "анальн",
    "оргазм",
    "порн",
    "мастурб",
    "porn",
    "masturb",
    "sexting",
    "dildo",
];
/// "Show …" + one of these within the next 3 words.
const SHOW_WORDS: &[&str] = &["покаж", "показывай", "show"];
const BODY_PREFIX: &[&str] = &[
    "груд",
    "сиськ",
    "жоп",
    "попк",
    "попочк",
    "член",
    "письк",
    "киск",
    "трусик",
    "лифчик",
    "сосок",
    "tits",
    "boobs",
    "pussy",
    "dick",
    "cock",
    "nipple",
];
/// Same, exact words only ("ass" must not match "assignment").
const BODY_EQ: &[&str] = &["попу", "соски", "ass", "butt", "boobies"];
/// Two-word explicit phrases (adjacent, prefix match on each word).
const EXPLICIT_PAIRS: &[(&str, &str)] = &[
    ("suck", "my"),
    ("jerk", "off"),
    ("get", "naked"),
    ("fuck", "me"),
];

/// Softer sexual words. Only count together with an age question or minor marker.
const SEXUAL_PREFIX: &[&str] = &[
    "секс",
    "sex",
    "голая",
    "голую",
    "голой",
    "голые",
    "голеньк",
    "naked",
    "nude",
    "интим",
    "пошл",
    "возбужд",
    "трусик",
    "panties",
    "lingerie",
    "девствен",
    "virgin",
    "раздева",
    "разден",
    "horny",
];
const SEXUAL_EQ: &[&str] = &["трусы", "трусах"];
/// Mild words that alone (without an age/minor word in the same message) are
/// not enough for the remembered-age-question case.
const MILD_PREFIX: &[&str] = &["секс", "sex"];

/// Age questions.
const HOW_MANY_EQ: &[&str] = &["сколько", "скока", "скоко", "скок", "ск", "скільки"];
const YEARS_EQ: &[&str] = &["лет", "годиков", "годков", "років"];
const AGE_PREFIX: &[&str] = &["возраст", "совершеннолет", "несовершеннолет"];
const AGE_PAIRS: &[(&str, &str)] = &[("how", "old"), ("what", "grade"), ("which", "grade")];
const AGE_WITH_EQ: &[&str] = &["your", "ur", "you", "u", "what", "whats"];
/// Minor markers.
const MINOR_PREFIX: &[&str] = &[
    "школьниц",
    "школьник",
    "малолет",
    "несовершеннолет",
    "лоли",
    "loli",
    "underage",
    "teen",
    "шкільн",
];
/// Raw words that turn a nearby 9–17 into an age.
const AGE_UNIT_AFTER: &[&str] = &[
    "лет",
    "годиков",
    "год",
    "года",
    "годика",
    "years",
    "year",
    "yo",
    "yrs",
    "y",
];
const AGE_WORD_BEFORE: &[&str] = &["мне", "im", "am", "m", "тебе", "ей", "ему"];
/// "мне 15 минут до дома" is not an age.
const NOT_AGE_AFTER: &[&str] = &[
    "минут",
    "мин",
    "секунд",
    "сек",
    "час",
    "часа",
    "часов",
    "км",
    "раз",
    "рублей",
    "руб",
    "min",
    "mins",
    "minutes",
    "hours",
    "hrs",
    "km",
    "times",
    "%",
];

// ---------- folding ----------

fn fold_char(c: char) -> char {
    let l = c.to_lowercase().next().unwrap_or(c);
    if l == 'ё' {
        'е'
    } else {
        l
    }
}

fn is_cyr(c: char) -> bool {
    ('\u{0400}'..='\u{04FF}').contains(&c)
}

fn lat_to_cyr(c: char) -> char {
    match c {
        'a' => 'а',
        'b' => 'в',
        'c' => 'с',
        'e' => 'е',
        'h' => 'н',
        'k' => 'к',
        'm' => 'м',
        'n' => 'п',
        'o' => 'о',
        'p' => 'р',
        'r' => 'г',
        't' => 'т',
        'u' => 'и',
        'x' => 'х',
        'y' => 'у',
        '0' => 'о',
        '3' => 'з',
        '4' => 'ч',
        '6' => 'б',
        '@' => 'а',
        _ => c,
    }
}

fn cyr_or_leet_to_lat(c: char) -> char {
    match c {
        'а' => 'a',
        'в' => 'b',
        'е' => 'e',
        'к' => 'k',
        'м' => 'm',
        'н' => 'h',
        'о' => 'o',
        'р' => 'p',
        'с' => 'c',
        'т' => 't',
        'у' => 'y',
        'х' => 'x',
        '0' => 'o',
        '1' => 'i',
        '3' => 'e',
        '4' => 'a',
        '5' => 's',
        '7' => 't',
        '@' => 'a',
        '$' => 's',
        _ => c,
    }
}

/// Fold one already lower-cased raw token: pick its script by majority, map
/// lookalikes/leet into that script, drop `_`, collapse repeated letters.
fn fold_token(raw: &str) -> String {
    let cyr = raw.chars().filter(|c| is_cyr(*c)).count();
    let lat = raw.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let mapped: Vec<char> = if cyr > 0 && cyr >= lat {
        raw.chars().map(lat_to_cyr).collect()
    } else if lat > 0 {
        raw.chars().map(cyr_or_leet_to_lat).collect()
    } else {
        raw.chars().collect()
    };
    let mut out = String::with_capacity(raw.len());
    let mut last: Option<char> = None;
    for c in mapped {
        if c == '_' || c == '$' || c == '@' {
            continue;
        }
        if last == Some(c) && c.is_alphabetic() {
            continue;
        }
        out.push(c);
        last = Some(c);
    }
    out
}

fn fold_text(s: &str) -> String {
    s.chars().map(fold_char).collect()
}

struct Text {
    /// Folded (lower, ё→е) text with whitespace removed, for link markers.
    nospace: String,
    /// Folded text as typed (for '@', '?', digits).
    lower: String,
    /// Lower-cased tokens before lookalike/leet mapping (for ages, handles).
    raw: Vec<String>,
    /// Fully folded tokens.
    toks: Vec<String>,
    /// All folded tokens joined, for spaced-out app names.
    squashed: String,
}

impl Text {
    fn new(body: &str) -> Self {
        let lower = fold_text(body);
        let nospace: String = lower.chars().filter(|c| !c.is_whitespace()).collect();
        let raw: Vec<String> = lower
            .split(|c: char| !(c.is_alphanumeric() || c == '_' || c == '@' || c == '$'))
            .filter(|t| !t.is_empty())
            .map(|t| t.to_string())
            .collect();
        let toks: Vec<String> = raw
            .iter()
            .map(|t| fold_token(t))
            .filter(|t| !t.is_empty())
            .collect();
        let squashed = toks.concat();
        Text {
            nospace,
            lower,
            raw,
            toks,
            squashed,
        }
    }

    fn any_eq(&self, words: &[&str]) -> bool {
        words.iter().any(|w| {
            let w = fold_token(&fold_text(w));
            self.toks.iter().any(|t| *t == w)
        })
    }

    fn any_prefix(&self, words: &[&str]) -> bool {
        words.iter().any(|w| {
            let w = fold_token(&fold_text(w));
            self.toks.iter().any(|t| t.starts_with(&w))
        })
    }

    /// `a` immediately followed by `b` (prefix match on both).
    fn pair(&self, a: &str, b: &str) -> bool {
        let a = fold_token(a);
        let b = fold_token(b);
        self.toks
            .windows(2)
            .any(|w| w[0].starts_with(&a) && w[1].starts_with(&b))
    }

    /// A word from `first` (prefix) followed within `gap` words by a word from
    /// `then_prefix` (prefix) or `then_eq` (exact).
    fn near(&self, first: &[&str], then_prefix: &[&str], then_eq: &[&str], gap: usize) -> bool {
        let fold =
            |l: &[&str]| -> Vec<String> { l.iter().map(|w| fold_token(&fold_text(w))).collect() };
        let first = fold(first);
        let then = fold(then_prefix);
        let then_eq = fold(then_eq);
        for (i, t) in self.toks.iter().enumerate() {
            if !first.iter().any(|f| t.starts_with(f.as_str())) {
                continue;
            }
            let end = (i + 1 + gap).min(self.toks.len());
            if self.toks[i + 1..end].iter().any(|n| {
                then.iter().any(|b| n.starts_with(b.as_str())) || then_eq.iter().any(|b| n == b)
            }) {
                return true;
            }
        }
        false
    }
}

// ---------- detectors ----------

fn has_link(t: &Text) -> bool {
    LINK_MARKERS.iter().any(|m| t.nospace.contains(m))
}

/// `@name` with 4+ Latin letters/digits/underscore, not part of an e-mail.
fn has_handle(t: &Text) -> bool {
    let chars: Vec<char> = t.lower.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if *c != '@' {
            continue;
        }
        if i > 0 && chars[i - 1].is_alphanumeric() {
            continue;
        }
        let n = chars[i + 1..]
            .iter()
            .take_while(|c| c.is_ascii_alphanumeric() || **c == '_')
            .count();
        if n >= 4 {
            return true;
        }
    }
    false
}

fn has_email(t: &Text) -> bool {
    let chars: Vec<char> = t.lower.chars().collect();
    for (i, c) in chars.iter().enumerate() {
        if *c != '@' || i == 0 || !chars[i - 1].is_ascii_alphanumeric() {
            continue;
        }
        let domain: String = chars[i + 1..]
            .iter()
            .take_while(|c| c.is_ascii_alphanumeric() || **c == '.' || **c == '-')
            .collect();
        if let Some(dot) = domain.rfind('.') {
            let tld = &domain[dot + 1..];
            if dot > 0 && tld.len() >= 2 && tld.chars().all(|c| c.is_ascii_alphabetic()) {
                return true;
            }
        }
    }
    false
}

/// 10+ digits in a row, allowing spaces, dashes, brackets and '+' between.
/// Dots and colons break a run, so dates and times do not add up.
fn has_phone(t: &Text) -> bool {
    let mut digits = 0usize;
    for c in t.lower.chars() {
        if c.is_ascii_digit() {
            digits += 1;
            if digits >= 10 {
                return true;
            }
        } else if matches!(c, ' ' | '-' | '(' | ')' | '+') {
            continue;
        } else {
            digits = 0;
        }
    }
    false
}

fn has_platform(t: &Text) -> bool {
    t.any_eq(PLATFORM_EQ)
        || t.any_prefix(PLATFORM_PREFIX)
        || PLATFORM_PAIRS.iter().any(|(a, b)| t.pair(a, b))
}

/// App name only visible with separators removed ("w h a t s a p p"): the
/// spacing itself is the dodge, so no push word is needed.
fn has_spaced_platform(t: &Text) -> bool {
    PLATFORM_SQUASHED
        .iter()
        .any(|w| t.squashed.contains(&fold_token(w)))
}

/// Latin token of 5+ with a digit or '_' ("anna_2005"): looks like a user name.
fn has_handle_like_word(t: &Text) -> bool {
    t.raw.iter().any(|w| {
        w.chars().count() >= 5
            && w.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            && w.chars().any(|c| c.is_ascii_alphabetic())
            && w.chars().any(|c| c.is_ascii_digit() || c == '_')
    })
}

fn contact_rule(t: &Text) -> Option<&'static str> {
    if has_link(t) {
        return Some("link");
    }
    if has_email(t) {
        return Some("email");
    }
    if has_handle(t) {
        return Some("handle");
    }
    if has_phone(t) {
        return Some("phone");
    }
    if has_platform(t) {
        let pushy = t.toks.len() <= 6
            || t.lower.contains('?')
            || t.any_eq(PUSH_EQ)
            || t.any_prefix(PUSH_PREFIX)
            || has_handle_like_word(t);
        if pushy {
            return Some("app");
        }
    } else if has_spaced_platform(t) {
        return Some("app_spaced");
    }
    None
}

fn explicit_rule(t: &Text) -> Option<&'static str> {
    if t.any_eq(EXPLICIT_EQ) || t.any_prefix(EXPLICIT_PREFIX) {
        return Some("explicit_word");
    }
    if t.near(SHOW_WORDS, BODY_PREFIX, BODY_EQ, 3) {
        return Some("show_body");
    }
    if EXPLICIT_PAIRS.iter().any(|(a, b)| t.pair(a, b)) {
        return Some("explicit_phrase");
    }
    None
}

fn sexual_soft(t: &Text) -> bool {
    t.any_prefix(SEXUAL_PREFIX) || t.any_eq(SEXUAL_EQ)
}

fn sexual_only_mild(t: &Text) -> bool {
    // Every soft sexual hit is a mild one ("sexy", "секси").
    let mild: Vec<String> = MILD_PREFIX.iter().map(|w| fold_token(w)).collect();
    let soft: Vec<String> = SEXUAL_PREFIX.iter().map(|w| fold_token(w)).collect();
    let mut any = false;
    for tok in &t.toks {
        if soft.iter().any(|s| tok.starts_with(s.as_str())) || t.any_eq(SEXUAL_EQ) {
            any = true;
            if !mild.iter().any(|m| tok.starts_with(m.as_str())) {
                return false;
            }
        }
    }
    any
}

fn age_question(t: &Text) -> bool {
    (t.any_eq(HOW_MANY_EQ) && t.any_eq(YEARS_EQ))
        || t.any_prefix(AGE_PREFIX)
        || AGE_PAIRS.iter().any(|(a, b)| t.pair(a, b))
        || (t.any_eq(&["age"]) && t.any_eq(AGE_WITH_EQ))
        || (t.any_prefix(&["класс"]) && t.any_eq(&["каком", "какой", "какому"]))
}

fn minor_age_number(s: &str) -> bool {
    matches!(s.parse::<u32>(), Ok(n) if (9..=17).contains(&n))
}

/// "мне 14", "14 лет", "14yo", "тебе 15?" — an age from 9 to 17.
fn minor_marker(t: &Text) -> bool {
    if t.any_prefix(MINOR_PREFIX) {
        return true;
    }
    for (i, w) in t.raw.iter().enumerate() {
        if minor_age_number(w) {
            let after = t.raw.get(i + 1).map(|s| s.as_str()).unwrap_or("");
            let before = if i > 0 { t.raw[i - 1].as_str() } else { "" };
            if AGE_UNIT_AFTER.contains(&after)
                || (AGE_WORD_BEFORE.contains(&before) && !NOT_AGE_AFTER.contains(&after))
            {
                return true;
            }
            continue;
        }
        // fused "14yo", "15лет", "13y"
        let digits: String = w.chars().take_while(|c| c.is_ascii_digit()).collect();
        if !digits.is_empty() && minor_age_number(&digits) {
            let rest = &w[digits.len()..];
            if ["yo", "y", "yrs", "лет", "л", "г"].contains(&rest) {
                return true;
            }
        }
    }
    false
}

/// Classify one stranger chat message.
/// `age_context_recent`: the same sender asked about age / mentioned a minor
/// in the last few minutes (caller keeps that per sender).
pub fn classify(body: &str, age_context_recent: bool) -> ChatVerdict {
    let t = Text::new(body);
    let age_q = age_question(&t);
    let minor = minor_marker(&t);
    let age_now = age_q || minor;
    let explicit = explicit_rule(&t);
    let soft = sexual_soft(&t);

    if (explicit.is_some() || soft) && age_now {
        return ChatVerdict {
            category: Some(ChatCategory::Grooming),
            rule: if minor { "minor+sexual" } else { "age+sexual" },
            age_context: true,
        };
    }
    // Earlier age question + now sexual: stronger words only, so "how old are
    // you?" … "you look sexy" between adults is not flagged.
    if age_context_recent && (explicit.is_some() || (soft && !sexual_only_mild(&t))) {
        return ChatVerdict {
            category: Some(ChatCategory::Grooming),
            rule: "age_earlier+sexual",
            age_context: false,
        };
    }
    if let Some(rule) = explicit {
        return ChatVerdict {
            category: Some(ChatCategory::Explicit),
            rule,
            age_context: age_now,
        };
    }
    if let Some(rule) = contact_rule(&t) {
        return ChatVerdict {
            category: Some(ChatCategory::ContactSwap),
            rule,
            age_context: age_now,
        };
    }
    ChatVerdict {
        category: None,
        rule: "",
        age_context: age_now,
    }
}

#[cfg(test)]
mod tests {
    use super::{classify, fold_token, ChatCategory};

    fn cat(s: &str) -> Option<ChatCategory> {
        classify(s, false).category
    }

    #[test]
    fn folds_case_yo_lookalikes_leet_and_repeats() {
        assert_eq!(fold_token("сёкс".replace('ё', "е").as_str()), "секс");
        // Latin c + e inside a Cyrillic word
        assert_eq!(fold_token("ceкс"), "секс");
        assert_eq!(fold_token("s3x"), "sex");
        assert_eq!(fold_token("p0rn"), "porn");
        assert_eq!(fold_token("сееееекс"), "секс");
        assert_eq!(fold_token("anna_2005"), "ana2os");
        assert_eq!(
            classify("СИСЬКИ", false).category,
            Some(ChatCategory::Explicit)
        );
        assert_eq!(
            classify("cиcьки", false).category,
            Some(ChatCategory::Explicit)
        );
    }

    #[test]
    fn clean_everyday_chat_passes() {
        for s in [
            "привет, как дела?",
            "мне 25 лет, я из Москвы",
            "сколько тебе лет?",
            "how old are you?",
            "я смотрю телевизор",
            "это пиздец конечно, блять",
            "ты из какого города?",
            "my phone died yesterday",
            "call me later lol",
            "анализ сдал, трахея болит",
            "пошли в кино",
            "I live in Essex",
            "звони 112 если что",
            "в 2024 году было холодно",
            "у меня 2 кота и 1 собака",
            "ты красивая",
            "you look sexy",
            "мне 15 минут до дома",
            "кончай уже, давай дальше",
            "в каком ты городе",
            "I am a student, first class",
            "my email is down today",
            "it is 9 years old, my car",
            "oh snap",
            "покажи попугая",
            "покажи, я соскучился",
            "show me your assignment",
            "show me your cat",
            "покажи кота",
            "скинь фотку",
            "твой ник?",
            "сосиски будешь?",
            "встреча 03.11.2026 12 30",
            "киска моя спит",
        ] {
            assert_eq!(cat(s), None, "{s}");
        }
    }

    #[test]
    fn contact_swap_pushes() {
        for s in [
            "пиши в тг @anna_2005",
            "го в телегу",
            "t.me/anna2005",
            "t . me / anna",
            "+7 (999) 123-45-67",
            "8 999 123 45 67",
            "whatsapp?",
            "есть ватсап?",
            "add me on snap",
            "напиши мне в инсту anna_99",
            "w h a t s a p p",
            "anna.k@gmail.com",
            "@annak пиши",
            "давай в дискорд",
            "тг есть?",
            "кинь вк",
            "add me on snap",
        ] {
            assert_eq!(cat(s), Some(ChatCategory::ContactSwap), "{s}");
        }
    }

    #[test]
    fn explicit_words() {
        for s in [
            "покажи сиськи",
            "покажи мне свою грудь",
            "show me your tits",
            "давай вирт",
            "ты шлюха",
            "send nudes",
            "p0rn",
            "suck my dick",
            "разденься",
            "соси",
            "show me your ass",
            "покажи попу",
        ] {
            assert_eq!(cat(s), Some(ChatCategory::Explicit), "{s}");
        }
    }

    #[test]
    fn grooming_combos() {
        for s in [
            "сколько тебе лет? покажи грудь",
            "тебе 14? хочешь секса",
            "how old are you? send nudes",
            "ты школьница? раздевайся",
            "мне нравятся малолетки голые",
            "13yo sexy?",
            "скока лет? давай вирт",
        ] {
            assert_eq!(cat(s), Some(ChatCategory::Grooming), "{s}");
        }
    }

    #[test]
    fn remembered_age_question_needs_strong_words() {
        assert!(classify("сколько тебе лет?", false).age_context);
        assert!(classify("ты школьница?", false).age_context);
        assert!(!classify("как дела?", false).age_context);
        assert!(!classify("мне 15 минут до дома", false).age_context);
        assert!(classify("мне 15", false).age_context);
        assert_eq!(
            classify("покажи сиськи", true).category,
            Some(ChatCategory::Grooming)
        );
        assert_eq!(
            classify("ты голая?", true).category,
            Some(ChatCategory::Grooming)
        );
        // mild compliment after an age question between adults: not flagged
        assert_eq!(classify("you look sexy", true).category, None);
        assert_eq!(classify("привет", true).category, None);
    }

    #[test]
    fn category_names_for_logs() {
        assert_eq!(ChatCategory::ContactSwap.as_str(), "contact_swap");
        assert_eq!(ChatCategory::Explicit.as_str(), "explicit");
        assert_eq!(ChatCategory::Grooming.as_str(), "grooming");
    }
}
