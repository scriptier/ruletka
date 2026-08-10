/**
 * Localize hub geo country/city for the active UI language.
 * Hub geo is English (MaxMind etc.); product default language is Russian.
 *
 * Usage: window.RuletGeo.localizeCountry("Canada") → "Канада" when lang=ru
 */
(function (global) {
  "use strict";

  /** ISO alpha-2 → English (fallback when Intl missing) */
  const COUNTRY_EN = {
    CA: "Canada",
    US: "United States",
    RU: "Russia",
    UA: "Ukraine",
    KZ: "Kazakhstan",
    BY: "Belarus",
    DE: "Germany",
    FR: "France",
    GB: "United Kingdom",
    UK: "United Kingdom",
    PL: "Poland",
    TR: "Turkey",
    IN: "India",
    BR: "Brazil",
    MX: "Mexico",
    JP: "Japan",
    CN: "China",
    KR: "South Korea",
    IT: "Italy",
    ES: "Spain",
    NL: "Netherlands",
    SE: "Sweden",
    NO: "Norway",
    FI: "Finland",
    AU: "Australia",
    NZ: "New Zealand",
    IL: "Israel",
    AE: "United Arab Emirates",
    SA: "Saudi Arabia",
    EG: "Egypt",
    ZA: "South Africa",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    PH: "Philippines",
    TH: "Thailand",
    VN: "Vietnam",
    ID: "Indonesia",
    MY: "Malaysia",
    SG: "Singapore",
    PT: "Portugal",
    RO: "Romania",
    CZ: "Czechia",
    HU: "Hungary",
    AT: "Austria",
    CH: "Switzerland",
    BE: "Belgium",
    IE: "Ireland",
    GR: "Greece",
    GE: "Georgia",
    AM: "Armenia",
    AZ: "Azerbaijan",
    UZ: "Uzbekistan",
    MD: "Moldova",
    LT: "Lithuania",
    LV: "Latvia",
    EE: "Estonia",
    RS: "Serbia",
    BG: "Bulgaria",
    HR: "Croatia",
    SK: "Slovakia",
    SI: "Slovenia",
    PK: "Pakistan",
    BD: "Bangladesh",
    NG: "Nigeria",
  };

  /**
   * Common city English → Russian (hub cities are English).
   * Unknown cities pass through unchanged.
   */
  const CITY_RU = {
    calgary: "Калгари",
    edmonton: "Эдмонтон",
    vancouver: "Ванкувер",
    toronto: "Торонто",
    montreal: "Монреаль",
    montréal: "Монреаль",
    ottawa: "Оттава",
    winnipeg: "Виннипег",
    quebec: "Квебек",
    "quebec city": "Квебек",
    halifax: "Галифакс",
    victoria: "Виктория",
    "new york": "Нью-Йорк",
    "los angeles": "Лос-Анджелес",
    "san francisco": "Сан-Франциско",
    chicago: "Чикаго",
    miami: "Майами",
    seattle: "Сиэтл",
    boston: "Бостон",
    "las vegas": "Лас-Вегас",
    houston: "Хьюстон",
    dallas: "Даллас",
    atlanta: "Атланта",
    denver: "Денвер",
    phoenix: "Финикс",
    philadelphia: "Филадельфия",
    "washington": "Вашингтон",
    "washington, d.c.": "Вашингтон",
    london: "Лондон",
    paris: "Париж",
    berlin: "Берлин",
    moscow: "Москва",
    "saint petersburg": "Санкт-Петербург",
    "st petersburg": "Санкт-Петербург",
    "st. petersburg": "Санкт-Петербург",
    kyiv: "Киев",
    kiev: "Киев",
    minsk: "Минск",
    almaty: "Алматы",
    astana: "Астана",
    tashkent: "Ташкент",
    tbilisi: "Тбилиси",
    yerevan: "Ереван",
    baku: "Баку",
    istanbul: "Стамбул",
    ankara: "Анкара",
    dubai: "Дубай",
    "abu dhabi": "Абу-Даби",
    tokyo: "Токио",
    seoul: "Сеул",
    beijing: "Пекин",
    shanghai: "Шанхай",
    mumbai: "Мумбаи",
    delhi: "Дели",
    "new delhi": "Нью-Дели",
    bangalore: "Бангалор",
    bengaluru: "Бангалор",
    sao: "Сан-Паулу",
    "são paulo": "Сан-Паулу",
    "sao paulo": "Сан-Паулу",
    "rio de janeiro": "Рио-де-Жанейро",
    "mexico city": "Мехико",
    warsaw: "Варшава",
    prague: "Прага",
    vienna: "Вена",
    amsterdam: "Амстердам",
    stockholm: "Стокгольм",
    oslo: "Осло",
    helsinki: "Хельсинки",
    copenhagen: "Копенгаген",
    rome: "Рим",
    madrid: "Мадрид",
    barcelona: "Барселона",
    lisbon: "Лиссабон",
    athens: "Афины",
    bucharest: "Бухарест",
    budapest: "Будапешт",
    sofia: "София",
    belgrade: "Белград",
    zagreb: "Загреб",
    bratislava: "Братислава",
    ljubljana: "Любляна",
    tallinn: "Таллин",
    riga: "Рига",
    vilnius: "Вильнюс",
    chisinau: "Кишинёв",
    chișinău: "Кишинёв",
    sydney: "Сидней",
    melbourne: "Мельбурн",
    auckland: "Окленд",
    "tel aviv": "Тель-Авив",
    jerusalem: "Иерусалим",
    cairo: "Каир",
    "cape town": "Кейптаун",
    johannesburg: "Йоханнесбург",
    lagos: "Лагос",
    bangkok: "Бангкок",
    "ho chi minh city": "Хошимин",
    hanoi: "Ханой",
    jakarta: "Джакарта",
    manila: "Манила",
    "kuala lumpur": "Куала-Лумпур",
    singapore: "Сингапур",
    "hong kong": "Гонконг",
    taipei: "Тайбэй",
    frankfurt: "Франкфурт",
    munich: "Мюнхен",
    hamburg: "Гамбург",
    "cologne": "Кёльн",
    "zurich": "Цюрих",
    geneva: "Женева",
    brussels: "Брюссель",
    dublin: "Дублин",
    edinburgh: "Эдинбург",
    manchester: "Манчестер",
    birmingham: "Бирмингем",
    glasgow: "Глазго",
    "novosibirsk": "Новосибирск",
    yekaterinburg: "Екатеринбург",
    kazan: "Казань",
    "nizhny novgorod": "Нижний Новгород",
    samara: "Самара",
    rostov: "Ростов-на-Дону",
    "rostov-on-don": "Ростов-на-Дону",
    krasnodar: "Краснодар",
    sochi: "Сочи",
    vladivostok: "Владивосток",
    kharkiv: "Харьков",
    odesa: "Одесса",
    odessa: "Одесса",
    lviv: "Львов",
    dnipro: "Днепр",
    // RU + CIS (high-traffic / MaxMind English)
    chelyabinsk: "Челябинск",
    omsk: "Омск",
    ufa: "Уфа",
    perm: "Пермь",
    voronezh: "Воронеж",
    volgograd: "Волгоград",
    tyumen: "Тюмень",
    irkutsk: "Иркутск",
    krasnoyarsk: "Красноярск",
    saratov: "Саратов",
    tolyatti: "Тольятти",
    "togliatti": "Тольятти",
    barnaul: "Барнаул",
    izhevsk: "Ижевск",
    "ulan-ude": "Улан-Удэ",
    "ulan ude": "Улан-Удэ",
    khabarovsk: "Хабаровск",
    murmansk: "Мурманск",
    kaliningrad: "Калининград",
    tula: "Тула",
    ryazan: "Рязань",
    yaroslavl: "Ярославль",
    tver: "Тверь",
    pskov: "Псков",
    "veliky novgorod": "Великий Новгород",
    novgorod: "Новгород",
    arkhangelsk: "Архангельск",
    magnitogorsk: "Магнитогорск",
    cheboksary: "Чебоксары",
    "naberezhnye chelny": "Набережные Челны",
    lipetsk: "Липецк",
    penza: "Пенза",
    kirov: "Киров",
    tomsk: "Томск",
    kemerovo: "Кемерово",
    "novocherkassk": "Новочеркасск",
    sevastopol: "Севастополь",
    simferopol: "Симферополь",
    bishkek: "Бишкек",
    dushanbe: "Душанбе",
    ashgabat: "Ашхабад",
    ashkhabad: "Ашхабад",
    shymkent: "Шымкент",
    aktau: "Актау",
    aktobe: "Актобе",
    karaganda: "Караганда",
    "nursultan": "Астана",
    // Europe / Americas / Asia common hubs
    milan: "Милан",
    naples: "Неаполь",
    florence: "Флоренция",
    turin: "Турин",
    krakow: "Краков",
    cracow: "Краков",
    wroclaw: "Вроцлав",
    "wrocław": "Вроцлав",
    gdansk: "Гданьск",
    "gdańsk": "Гданьск",
    poznań: "Познань",
    poznan: "Познань",
    lodz: "Лодзь",
    "łódź": "Лодзь",
    porto: "Порту",
    valencia: "Валенсия",
    seville: "Севилья",
    sevilla: "Севилья",
    lyon: "Лион",
    marseille: "Марсель",
    nice: "Ницца",
    antwerp: "Антверпен",
    rotterdam: "Роттердам",
    gothenburg: "Гётеборг",
    "göteborg": "Гётеборг",
    malmo: "Мальмё",
    "malmö": "Мальмё",
    "san diego": "Сан-Диего",
    austin: "Остин",
    portland: "Портленд",
    detroit: "Детройт",
    minneapolis: "Миннеаполис",
    charlotte: "Шарлотт",
    "san jose": "Сан-Хосе",
    haifa: "Хайфа",
    hyderabad: "Хайдарабад",
    chennai: "Ченнаи",
    pune: "Пуна",
    kolkata: "Калькутта",
    calcutta: "Калькутта",
    izmir: "Измир",
    antalya: "Анталья",
    guangzhou: "Гуанчжоу",
    shenzhen: "Шэньчжэнь",
    chengdu: "Чэнду",
    hangzhou: "Ханчжоу",
    "wuhan": "Ухань",
    "osaka": "Осака",
    "kyoto": "Киото",
    "busan": "Пусан",
    "doha": "Доха",
    "riyadh": "Эр-Рияд",
    "jeddah": "Джидда",
    "beirut": "Бейрут",
    "amman": "Амман",
    "casablanca": "Касабланка",
    "nairobi": "Найроби",
    "accra": "Аккра",
    "lima": "Лима",
    "bogota": "Богота",
    "bogotá": "Богота",
    "santiago": "Сантьяго",
    "buenos aires": "Буэнос-Айрес",
    "montevideo": "Монтевидео",
  };

  /** English country name (any case) → ISO for DisplayNames */
  const EN_NAME_TO_ISO = (() => {
    const m = Object.create(null);
    for (const [iso, en] of Object.entries(COUNTRY_EN)) {
      m[en.toLowerCase()] = iso === "UK" ? "GB" : iso;
    }
    // Aliases hub may send
    m["united states of america"] = "US";
    m["usa"] = "US";
    m["u.s."] = "US";
    m["u.s.a."] = "US";
    m["russian federation"] = "RU";
    m["uk"] = "GB";
    m["great britain"] = "GB";
    m["south korea"] = "KR";
    m["korea, republic of"] = "KR";
    m["czechia"] = "CZ";
    m["czech republic"] = "CZ";
    m["türkiye"] = "TR";
    m["turkey"] = "TR";
    return m;
  })();

  function getLang() {
    try {
      if (global.NextfaceI18n?.getLang) return global.NextfaceI18n.getLang();
      if (global.RuletI18n?.getLang) return global.RuletI18n.getLang();
    } catch (_) {}
    try {
      return localStorage.getItem("ruletka-lang") || "ru";
    } catch (_) {
      return "ru";
    }
  }

  function normalizeIso(code) {
    const s = String(code || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
    if (s === "UK") return "GB";
    return s.length === 2 ? s : "";
  }

  function displayNamesRegion(lang, iso) {
    if (!iso) return "";
    try {
      if (typeof Intl !== "undefined" && Intl.DisplayNames) {
        const dn = new Intl.DisplayNames([lang], { type: "region" });
        const n = dn.of(iso);
        if (n && n !== iso) return n;
      }
    } catch (_) {}
    return "";
  }

  /**
   * @param {string} countryOrCode English name or ISO code from hub
   * @param {string} [flagCode] ISO flag (preferred for localization)
   * @returns {string}
   */
  function localizeCountry(countryOrCode, flagCode) {
    const raw = String(countryOrCode || "").trim();
    const lang = getLang();
    if (!raw && !flagCode) return "";
    if (lang === "en") {
      const iso = normalizeIso(flagCode) || normalizeIso(raw);
      if (iso && COUNTRY_EN[iso]) return COUNTRY_EN[iso];
      return raw || iso;
    }
    const iso =
      normalizeIso(flagCode) ||
      normalizeIso(raw) ||
      EN_NAME_TO_ISO[raw.toLowerCase()] ||
      "";
    if (iso) {
      const localized = displayNamesRegion(lang, iso);
      if (localized) return localized;
      // RU fallback via English map + DisplayNames fail
      if (lang === "ru" || lang.startsWith("ru")) {
        // Intl should work for ru; if not, hardcode common
        const RU_FALLBACK = {
          CA: "Канада",
          US: "США",
          RU: "Россия",
          UA: "Украина",
          KZ: "Казахстан",
          BY: "Беларусь",
          DE: "Германия",
          FR: "Франция",
          GB: "Великобритания",
          PL: "Польша",
          TR: "Турция",
          IN: "Индия",
          BR: "Бразилия",
          MX: "Мексика",
          JP: "Япония",
          CN: "Китай",
          KR: "Южная Корея",
          IT: "Италия",
          ES: "Испания",
          NL: "Нидерланды",
          SE: "Швеция",
          NO: "Норвегия",
          FI: "Финляндия",
          AU: "Австралия",
          IL: "Израиль",
          AE: "ОАЭ",
          GE: "Грузия",
          AM: "Армения",
          AZ: "Азербайджан",
          UZ: "Узбекистан",
        };
        if (RU_FALLBACK[iso]) return RU_FALLBACK[iso];
      }
    }
    return raw;
  }

  /**
   * @param {string} city English city from hub
   * @returns {string}
   */
  function localizeCity(city) {
    const raw = String(city || "").trim();
    if (!raw) return "";
    const lang = getLang();
    if (lang === "en") return raw;
    if (lang === "ru" || lang.startsWith("ru")) {
      const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
      if (CITY_RU[key]) return CITY_RU[key];
      // "Calgary, AB" style
      const base = key.split(",")[0].trim();
      if (CITY_RU[base]) return CITY_RU[base];
    }
    return raw;
  }

  const api = {
    localizeCountry,
    localizeCity,
    getLang,
    normalizeIso,
  };
  global.RuletGeo = api;
})(
  typeof window !== "undefined"
    ? window
    : typeof globalThis !== "undefined"
      ? globalThis
      : this
);
