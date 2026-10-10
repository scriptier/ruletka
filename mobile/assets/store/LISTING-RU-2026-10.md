# Store listing draft — 2026-10-10

Draft only. Do not upload to Google Play, RuStore, or the site.

Package `me.ruletka.app`. On-device name in this branch: `Ruletka.me` (`mobile/app.json`). Public Play page for this package was not found on 2026-10-10. RuStore catalog is live: https://www.rustore.ru/catalog/app/me.ruletka.app (name shown there: `ruletka.me`, age 18+).

Limits used for both stores (RuStore help, checked 2026-10-10): name ≤30, short ≤80, full ≤4000. RuStore collapses the full text around 2000 characters, so the opening has to stand on its own. Both full texts below are under 2000, so the whole paste is the opening.

Counts are Unicode code points of the paste inside each fence, with no trailing newline (`len()` in Python).

Keywords from `knowledge/research/seo-2026-10-08.md`: «чат рулетка», «видеочат без регистрации», «видео чат рулетка». Copy does not promise a partner’s gender, a date, or uncensored video. It does not say the Android app runs on-device AI (the mobile safety detector in this branch is still a stub). It does not say the call always stays off our servers: a direct path is the normal case, a relay is the fallback, and a report can include one screenshot.

## 1. Google Play — Russian (paste)

### Title — 24/30

```
Ruletka.me — чат рулетка
```

Fallback if the reviewer wants the store name identical to the launcher label (10/30):

```
Ruletka.me
```

### Short description — 74/80

```
Чат рулетка: видеочат без регистрации. Случайный собеседник и друзья. 18+.
```

### Full description — 1863/4000

```
Ruletka.me — чат рулетка для Android. Это видео чат рулетка со случайным собеседником и видеочат без регистрации: без почты, телефона и пароля. Только для людей 18 лет и старше. Приложение бесплатное.

Нажмите «Старт» после подтверждения возраста. Отдельный аккаунт не создаётся. Имя и ключ остаются на устройстве. Зашифрованную резервную копию можно экспортировать.

Два способа говорить:
• Случайный видеочат. Вас соединяют с другим человеком 18+. Выбрать пол собеседника нельзя.
• Звонок другу. Обменяйтесь кодом и позвоните, когда оба свободны. Другу можно написать. Если уведомления включены, приложение может сообщить о звонке.

Картинка и звук идут между устройствами, когда сеть это позволяет. Если прямой путь закрыт, звонок может пройти через сервер-ретранслятор. Разговоры мы не записываем. Жалоба, которую вы отправляете, может включать один снимок экрана для проверки.

В каждом звонке можно заблокировать человека или пожаловаться. Своё видео можно скрыть, чужое — размыть, пока вы не готовы смотреть. Опция «Скрыть IP» пускает звонок через ретранслятор, если сервер его предлагает. Собеседник может снять экран или записать разговор. Не передавайте пароли, коды и платёжные данные.

Несколько независимых жалоб могут ограничить доступ к поиску.

Звёзды — бесплатная отметка репутации за подарки. Это не деньги.

Интерфейс на 14 языках, включая русский, английский и украинский.

Вам должно быть 18 лет или больше. Если нет — не устанавливайте приложение. Нельзя насилие и незаконные материалы.

Конфиденциальность: https://ruletka.me/legal/privacy.html
Условия: https://ruletka.me/legal/terms.html
Безопасность: https://ruletka.me/safety.html
Удаление данных: https://ruletka.me/legal/delete.html
Защита детей: https://ruletka.me/legal/child-safety.html
Поддержка: support@ruletka.me
Вопросы приватности: privacy@ruletka.me
Сайт: https://ruletka.me
```

## 2. RuStore — variant against the live text

Same limits as Play (30 / 80 / 4000). The Russian paste in §1 is the proposed RuStore text. Nothing here has been uploaded.

### Live short (given for this draft) — 65/80

```
Видеочат без аккаунта: случайный собеседник и звонки друзьям. 18+
```

### Proposed short — 74/80

Same fence as §1. What changed:

- Adds the head query «чат рулетка» and the modifier «видеочат без регистрации».
- Keeps the honest product: a random partner, friends, and 18+.
- «Без аккаунта» is the same fact as «без регистрации». It moves into the full text («Отдельный аккаунт не создаётся»), so the 80-character short can carry the higher-interest phrase.

### Live catalog text (public page, 2026-10-10)

The store name on that page is `ruletka.me`. The visible description was:

```
ruletka — живой видеочат без аккаунта. Нажмите Старт и вас соединит со случайным собеседником. Видео и звук идут напрямую между устройствами (peer-to-peer), эфир на наши серверы не записывается. Кому подойдёт • случайные разговоры лицом к лицу • звонки друзьям по коду • общение с телефона или с браузера ruletka.me Что умеет • Старт / Стоп / Далее — новый собеседник • камера и микрофон, скрыть себя, переворот камеры • друзья: код, чат, звонок • блок и жалоба, чтобы больше не встретиться • звёзды — социальный счёт за подарки, это не деньги • 14 языков, в том числе русский Правила Только 18+. Нельзя несовершеннолетним, насилию и запрещённому контенту. Нарушения можно пожаловаться. Несколько независимых жалоб ограничивают доступ к поиску. Контакты: support@ruletka.me Сайт: https://ruletka.me Конфиденциальность: https://ruletka.me/privacy.html
```

Why the proposed full text differs:

- The live privacy URL `https://ruletka.me/privacy.html` returned 404 on 2026-10-10. The draft uses `https://ruletka.me/legal/privacy.html`, which returned 200, and adds terms, safety, data deletion, and child-safety links.
- «Напрямую» and «эфир на наши серверы не записывается» overclaim. A blocked direct path can use a relay, and a report can include one screenshot. The draft says we do not record calls, and it says when a relay or a screenshot is involved.
- The three target queries are absent from the live text. They are in the proposed title, short, and first sentence.
- «Нельзя несовершеннолетним, насилию…» is broken grammar. The draft says who the app is for, and that violence and illegal material are not allowed, without the clickbait word «запрещённый».
- The live page is tagged «Знакомства». The draft does not promise dating. Matching is random, and gender cannot be chosen.

## 3. Google Play — English (paste)

### Title — 23/30

```
Ruletka.me — video chat
```

### Short description — 72/80

```
Random video chat with strangers. No sign-up. Call friends by code. 18+.
```

### Full description — 1721/4000

```
Ruletka.me is a random video chat for Android. No sign-up, no email, no phone number, and no password. The app is free and only for people 18 or older.

Confirm your age and tap Start. There is no separate account. Your name and key stay on the device. You can export an encrypted backup.

Two ways to talk:
• Random video chat. You are connected with another adult. You cannot filter by gender.
• A call to a friend. Share a code and call when you are both free. You can also send a message. If notifications are on, the app can tell you about a friend's call.

Picture and sound go between the devices when the network allows it. If a direct path is blocked, the call may pass through a relay server. We do not record calls. A report you send can include one screenshot for review.

On every call you can block or report the other person. You can hide your own video and blur theirs until you are ready to watch. Hide IP sends the call through the relay when the server offers it. The other person can take a screenshot or record. Do not share passwords, codes, or payment details.

Several independent reports can limit access to search.

Stars are a free reputation mark for gifts. They are not money.

The interface is in 14 languages, including English, Russian, and Ukrainian.

You must be 18 or older. If you are not, do not install the app. Violence and illegal material are not allowed.

Privacy: https://ruletka.me/legal/privacy.html
Terms: https://ruletka.me/legal/terms.html
Safety: https://ruletka.me/safety.html
Data deletion: https://ruletka.me/legal/delete.html
Child safety: https://ruletka.me/legal/child-safety.html
Support: support@ruletka.me
Privacy mail: privacy@ruletka.me
Site: https://ruletka.me
```

English queries covered in the short and the first lines: random video chat, no sign-up, strangers, friends by code, 18+. The name Omegle is left out of the paste. A comparison page can carry that word. A store title should not.

## Where the Russian queries sit

| Phrase | Where |
|---|---|
| чат рулетка | Title; short; first sentence of the full text |
| видеочат без регистрации | Short; first sentence of the full text |
| видео чат рулетка | First sentence of the full text |

«Видео чат рулетка» also contains «чат рулетка». That is one sentence, not a repeated slogan.

## Not in the paste (on purpose)

- Sexual-intent queries («видеочат с девушками», «без цензуры», and the English equivalents).
- Voice-only roulette. The SEO note says to target that only if the product has it.
- “Works in Russia without a VPN.”
- On-device AI on Android.
- An iPhone app. The site already points iPhone users to Safari.
- Debate mode, gifts as a feature list, and 3–4 person layout. They exist in the app. This draft stays on chat roulette, no registration, and friend calls. Say if they should be added before upload.
- Clickbait words RuStore lists: «лучший», «единственный», «запрещённый», «секретный», «самый».

## Anton decides before any upload

- Store name: `Ruletka.me — чат рулетка` (24) or the exact launcher string `Ruletka.me` (10). RuStore also asks for a Russian name unless the Latin name is a registered trademark (ФЗ-168). `Ruletka.me` is what makes the listing unique next to the other app named «Чат Рулетка». This draft does not claim a trademark registration.
- RuStore tags currently include «Знакомства». The paste does not promise dates. Changing tags is a console action.
- Live RuStore build shown on 2026-10-10 was 0.1.479 (“final”). This draft does not change version or release notes.
- Upload still needs an explicit go. This file is the paste source only.
