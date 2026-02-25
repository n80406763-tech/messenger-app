# NMS — Netrender Messaging Service (клиент + сервер)

Обновлённый мессенджер в стиле привычных приложений: личные диалоги, группы, поиск пользователей, отправка фото/видео, настройки приватности и поддержка.

## Возможности

- Раздельные страницы: вход, регистрация и восстановление (с отдельной формой контрольного вопроса/ответа) + автодозаполнение недостающих данных при первом входе
- Восстановление пароля (кнопка «Забыл пароль» и авто-сброс через поддержку по теме «Забыл пароль»)
- Гостевое обращение в поддержку без входа в аккаунт
- Пользовательские имена контактов (локальные алиасы) + отдельный список ваших контактов с кнопкой «Переименовать»
- Личные чаты (1-на-1)
- Группы с отдельным модальным окном создания (добавление только через приглашение и только для контактов)
- Настройки группы (переименование и изменение участников)
- Поиск людей по username и старт личного диалога (в контактах — только по точному полному совпадению ника)
- Отдельный поиск по существующим чатам
- Отправка текста, фото и видео
- Предпросмотр медиа перед отправкой
- Улучшенная мобильная верстка (телефоны/узкие экраны)
- Улучшенный mobile UX для iPhone: безопасные зоны (safe-area), sticky composer и раздельные экраны списка/диалога
- PWA режим (добавление на экран iPhone/Android)
- Push-уведомления для новых сообщений (в т.ч. в установленном PWA на iPhone)
- Автообновление PWA без переустановки ярлыка (service worker update + auto-reload, доп. проверки обновления при входе/возврате онлайн)
- Настройки профиля (аватар, скрытие имени, приватность онлайн-статуса и аватара)
- Единое окно настроек (профиль + приватность + UI)
- UI-настройки: светлая/тёмная тема и компактный режим
- Онлайн/оффлайн статус и last seen
- Чат поддержки + категории жалоб
- Realtime через SSE (вместо WebSocket в текущей реализации)
- Защита от дублирования отправки сообщений (clientMessageId dedupe)
- Пагинация сообщений

## Поддержка по умолчанию

Сервер автоматически создаёт главный аккаунт поддержки при первом запуске:

- username: `support`
- password: `support123`

Это первый аккаунт поддержки (support_admin), через него можно создавать дополнительные аккаунты поддержки с отдельными логинами и паролями в настройках.

Можно переопределить через env:

- `SUPPORT_ADMIN_USERNAME`
- `SUPPORT_ADMIN_PASSWORD`

Главный аккаунт поддержки может создавать дополнительные аккаунты поддержки из UI настроек.

Важно: писать аккаунтам поддержки напрямую нельзя — только через «Чат поддержки». Для обычного пользователя аккаунты поддержки скрыты в поиске людей и не отображаются как отдельные собеседники.

## Стек

- Node.js (без внешних зависимостей)
- JSON-хранилище `messenger.json`
- Веб-клиент на чистом HTML/CSS/JS

## API (основное)

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/profile`
- `POST /api/profile`
- `POST /api/support/agents` (только support_admin)
- `GET /api/support/categories`
- `GET /api/users/search?q=`
- `GET /api/users/:id/status`
- `GET /api/conversations`
- `POST /api/conversations/direct`
- `POST /api/conversations/group`
- `POST /api/conversations/:id/rename`
- `POST /api/conversations/:id/members/add`
- `POST /api/conversations/:id/members/remove`
- `GET /api/contacts`
- `GET /api/group-invites`
- `POST /api/group-invites/:id/respond`
- `GET /api/conversations/:id/messages?limit=&before_id=`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/support`
- `GET /api/events`

## Быстрый запуск

```bash
node server.js
```

Открой `http://localhost:3000`.

## Деплой на VPS (Sprintbox/Ubuntu) с доменом и HTTPS

Ниже — рабочий вариант для твоего кейса (`netrender.ru`, приложение на `3001`).

### 1) Исправить systemd-сервис (важно)

В `WorkingDirectory` нельзя использовать `~`, только абсолютный путь.

Создай/замени `/etc/systemd/system/messenger.service`:

```ini
[Unit]
Description=NMS Node App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/messenger-app-final/app-messenger
ExecStart=/usr/bin/node /root/messenger-app-final/app-messenger/server.js
Restart=always
RestartSec=3
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Проверка и запуск:

```bash
sudo systemctl daemon-reload
sudo systemctl enable messenger
sudo systemctl restart messenger
sudo systemctl status messenger
```

Если не стартует — смотри лог:

```bash
journalctl -u messenger -n 80 --no-pager
```

### 2) Исправить Caddyfile

Удали дефолтный блок `:80 { ... }` и оставь только домен:

```caddy
netrender.ru, www.netrender.ru {
    reverse_proxy 127.0.0.1:3001
}
```

Проверка конфига и запуск:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy
```

Если Caddy пишет `listening on :80`, значит порт 80 уже занят (обычно nginx/apache). Проверка:

```bash
sudo ss -ltnp | rg ':80|:443'
```

Если занят nginx, останови его:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl restart caddy
```

### 3) Проверка HTTPS

```bash
curl -I https://netrender.ru
```

Должен вернуться ответ `HTTP/2 200` или `HTTP/2 3xx`.

### 4) iPhone PWA + Push

1. Открой `https://netrender.ru` в Safari.
2. Поделиться → На экран Домой.
3. Запусти приложение с иконки.
4. Внутри: Настройки → Включить push-уведомления.

Без HTTPS push на iPhone не работает.

### 5) Две команды: «запустить всё» и «остановить всё»

Добавлен helper-скрипт `scripts/services.sh` (и короткий алиас `scripts/serv.sh`).

Запустить всё:

```bash
bash scripts/serv.sh start-all
```

Остановить всё:

```bash
bash scripts/serv.sh stop-all
```

Дополнительно:

```bash
bash scripts/serv.sh status-all
bash scripts/serv.sh restart-all
bash scripts/serv.sh update-all
```

`update-all` делает всё сам: `git pull` + `npm install/ci` + restart `messenger` и `caddy`, при этом данные в `messenger.json` не сбрасываются.

Если нужно обновлять **без GitHub** одним локальным файлом (как ты и просил):

```bash
bash scripts/serv.sh local-update /path/to/update-bundle.json
```

Формат `update-bundle.json`:

```json
{
  "files": [
    { "path": "server.js", "encoding": "utf-8", "content": "..." },
    { "path": "public/index.html", "encoding": "utf-8", "content": "..." },
    { "path": "public/app.js", "encoding": "base64", "content": "..." }
  ]
}
```

- `path`: `server.js` или файлы клиента (`public/...`),
- `encoding`: `utf-8` или `base64`.

После применения скрипт автоматически запускает `npm run check`, перезапускает `messenger` + `caddy` и удаляет файл `update-bundle.json`/`*.bundle.json` (одноразовый пакет обновления).

Совместимость сохранена: можно передать и `.zip` архив старого формата.

Если путь не передать, скрипт ищет `update-bundle.json` в корне проекта.

Сбросить всех пользователей/чаты/сообщения (остановит сервисы и удалит БД `messenger.json`):

```bash
bash scripts/serv.sh reset-data
```

Потом запусти обратно:

```bash
bash scripts/serv.sh start-all
```

### PWA на iPhone

1. Открой сайт в Safari.
2. Нажми «Поделиться» → «На экран Домой».
3. Запускай как отдельное приложение.
4. Открой «Настройки» в приложении и нажми «Включить push-уведомления».

Важно: на iPhone push работает только при условиях: iOS 16.4+, запуск из ярлыка «На экран Домой», HTTPS (или localhost для разработки) и разрешенные уведомления для приложения.



## Нативный iOS путь (SwiftUI + API)

Если цель — публикация в App Store как полноценного нативного приложения, используйте заготовку в `ios/NMS/`.

- Инструкция: `ios/README.md`
- Включены стартовые SwiftUI-экраны, API клиент, Keychain-сессии и файлы конфигурации (`Info.plist`, `NMS.entitlements`, `PrivacyInfo.xcprivacy`).
- Текущий web/PWA клиент можно оставить параллельно, а iOS-клиент перевести на тот же backend API.

## Ограничения MVP

- Медиа хранится внутри `messenger.json` в base64 (для большого масштаба лучше файловое/object storage).
- Максимум вложения: 12MB (на клиенте изображения с телефона автоматически ужимаются в JPEG).
- Максимум аватара: 2MB.
- Для продакшена добавь reverse proxy, HTTPS, backup и мониторинг.


## UI заметки

- Внизу экрана есть подпись: `created by Netrender Studios`.
- В правом верхнем углу отображается версия клиента.
- Pinch-zoom отключён для более "app-like" поведения на телефоне.


## Обновления PWA на iPhone

- После деплоя обновлений переустанавливать ярлык не нужно.
- Клиент сам проверяет новую версию service worker и перезагружает приложение при обновлении.
- Критичные файлы (`index.html`, `sw.js`, `manifest.webmanifest`) отдаются с `Cache-Control: no-store`, чтобы обновления применялись без переустановки ярлыка.
- Если сеть была недоступна во время обновления, новая версия подтянется автоматически при следующем открытии/возврате онлайн.
