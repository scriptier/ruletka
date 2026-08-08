/**
 * Localize hub geo (English country/city) for the active app language.
 * Matches web ui/geoLocalize.js — default product language is Russian.
 */

const COUNTRY_RU: Record<string, string> = {
  CA: "Канада",
  US: "США",
  RU: "Россия",
  UA: "Украина",
  KZ: "Казахстан",
  BY: "Беларусь",
  DE: "Германия",
  FR: "Франция",
  GB: "Великобритания",
  UK: "Великобритания",
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
  NZ: "Новая Зеландия",
  IL: "Израиль",
  AE: "ОАЭ",
  GE: "Грузия",
  AM: "Армения",
  AZ: "Азербайджан",
  UZ: "Узбекистан",
  MD: "Молдова",
  LT: "Литва",
  LV: "Латвия",
  EE: "Эстония",
  RS: "Сербия",
  BG: "Болгария",
  HR: "Хорватия",
  SK: "Словакия",
  SI: "Словения",
  CZ: "Чехия",
  HU: "Венгрия",
  AT: "Австрия",
  CH: "Швейцария",
  BE: "Бельгия",
  IE: "Ирландия",
  GR: "Греция",
  PT: "Португалия",
  RO: "Румыния",
  SA: "Саудовская Аравия",
  EG: "Египет",
  ZA: "ЮАР",
  AR: "Аргентина",
  CL: "Чили",
  CO: "Колумбия",
  PH: "Филиппины",
  TH: "Таиланд",
  VN: "Вьетнам",
  ID: "Индонезия",
  MY: "Малайзия",
  SG: "Сингапур",
  PK: "Пакистан",
  BD: "Бангладеш",
  NG: "Нигерия",
};

const EN_NAME_TO_ISO: Record<string, string> = {
  canada: "CA",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  russia: "RU",
  "russian federation": "RU",
  ukraine: "UA",
  kazakhstan: "KZ",
  belarus: "BY",
  germany: "DE",
  france: "FR",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  poland: "PL",
  turkey: "TR",
  india: "IN",
  brazil: "BR",
  mexico: "MX",
  japan: "JP",
  china: "CN",
  "south korea": "KR",
  italy: "IT",
  spain: "ES",
  netherlands: "NL",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  australia: "AU",
  "new zealand": "NZ",
  israel: "IL",
  "united arab emirates": "AE",
  georgia: "GE",
  armenia: "AM",
  azerbaijan: "AZ",
  uzbekistan: "UZ",
};

const CITY_RU: Record<string, string> = {
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
  washington: "Вашингтон",
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
  "sao paulo": "Сан-Паулу",
  "são paulo": "Сан-Паулу",
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
  sydney: "Сидней",
  melbourne: "Мельбурн",
  "tel aviv": "Тель-Авив",
  jerusalem: "Иерусалим",
  novosibirsk: "Новосибирск",
  yekaterinburg: "Екатеринбург",
  kazan: "Казань",
  sochi: "Сочи",
  krasnodar: "Краснодар",
  kharkiv: "Харьков",
  odesa: "Одесса",
  odessa: "Одесса",
  lviv: "Львов",
  dnipro: "Днепр",
  // Keep parity with ui/geoLocalize.js CITY_RU (RU/CIS + high-traffic)
  "nizhny novgorod": "Нижний Новгород",
  samara: "Самара",
  rostov: "Ростов-на-Дону",
  "rostov-on-don": "Ростов-на-Дону",
  vladivostok: "Владивосток",
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
  togliatti: "Тольятти",
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
  nursultan: "Астана",
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
  poznan: "Познань",
  "poznań": "Познань",
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
  wuhan: "Ухань",
  osaka: "Осака",
  kyoto: "Киото",
  busan: "Пусан",
  doha: "Доха",
  riyadh: "Эр-Рияд",
  jeddah: "Джидда",
  beirut: "Бейрут",
  amman: "Амман",
  casablanca: "Касабланка",
  nairobi: "Найроби",
  accra: "Аккра",
  lima: "Лима",
  bogota: "Богота",
  "bogotá": "Богота",
  santiago: "Сантьяго",
  "buenos aires": "Буэнос-Айрес",
  montevideo: "Монтевидео",
  // EU capitals already on web map — keep mobile parity
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
  "chișinău": "Кишинёв",
  auckland: "Окленд",
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
  cologne: "Кёльн",
  zurich: "Цюрих",
  geneva: "Женева",
  brussels: "Брюссель",
  dublin: "Дублин",
  edinburgh: "Эдинбург",
  manchester: "Манчестер",
  birmingham: "Бирмингем",
  glasgow: "Глазго",
  bucharest: "Бухарест",
};

export function normalizeIso(code: unknown): string {
  const s = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  if (s === "UK") return "GB";
  return s.length === 2 ? s : "";
}

function displayNamesRegion(lang: string, iso: string): string {
  try {
    // RN / Hermes: Intl.DisplayNames available on modern Android
    const DN = (Intl as unknown as { DisplayNames?: typeof Intl.DisplayNames })
      .DisplayNames;
    if (DN) {
      const dn = new DN([lang], { type: "region" });
      const n = dn.of(iso);
      if (n && n !== iso) return n;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * @param countryOrCode English country name or ISO from hub
 * @param flagCode ISO flag code (preferred)
 * @param lang App language code (e.g. "ru", "en")
 */
export function localizeCountry(
  countryOrCode: string | undefined | null,
  flagCode?: string | null,
  lang = "ru"
): string {
  const raw = String(countryOrCode || "").trim();
  const l = String(lang || "ru").toLowerCase().slice(0, 2);
  if (!raw && !flagCode) return "";
  if (l === "en") {
    const iso = normalizeIso(flagCode) || normalizeIso(raw);
    return raw || iso;
  }
  const iso =
    normalizeIso(flagCode) ||
    normalizeIso(raw) ||
    EN_NAME_TO_ISO[raw.toLowerCase()] ||
    "";
  if (iso) {
    const viaIntl = displayNamesRegion(l, iso);
    if (viaIntl) return viaIntl;
    if (l === "ru" && COUNTRY_RU[iso]) return COUNTRY_RU[iso];
  }
  return raw;
}

export function localizeCity(
  city: string | undefined | null,
  lang = "ru"
): string {
  const raw = String(city || "").trim();
  if (!raw) return "";
  const l = String(lang || "ru").toLowerCase().slice(0, 2);
  if (l === "en") return raw;
  if (l === "ru") {
    const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (CITY_RU[key]) return CITY_RU[key];
    const base = key.split(",")[0].trim();
    if (CITY_RU[base]) return CITY_RU[base];
  }
  return raw;
}
