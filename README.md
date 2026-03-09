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
- WebRTC звонки (аудио/видео) с сигналингом через API и поддержкой STUN/TURN
- Защита от дублирования отправки сообщений (clientMessageId dedupe)
- Сессии сохраняются в `messenger.json`, чтобы не требовать повторный вход после перезапуска/обновления сервера
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
- Веб-клиент на чистом HTML/CSS/JS (без React)

## API (основное)

## API для приложения (iOS/нативный клиент)

Для мобильного клиента доступен отдельный namespace: `/api/app/*`.

Примеры:
- `POST /api/app/login`
- `GET /api/app/conversations`
- `GET /api/app/conversations/:id/messages`

`/api/app/*` и `/api/*` используют одну и ту же серверную логику (совместимость сохранена).

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
node index.js
# или: npm start
```

Открой `http://localhost:3000`.

## Сборка проекта в ZIP (одной командой)

Если тебе нужен весь проект одним архивом (`.zip`), используй:

```bash
bash scripts/build-zip.sh
```

Архив появится в папке `dist/` (например `dist/nms-project-YYYYMMDD-HHMMSS.zip`).

Можно указать свою папку для архива:

```bash
bash scripts/build-zip.sh /path/to/output
```

## Быстрое создание файлов через nano (с авто-папками)

Чтобы не создавать папки вручную, используй helper:

```bash
bash scripts/nano-create.sh /var/api/netrender/server/routes.js
bash scripts/nano-create.sh /var/www/netrender/client/index.html
```

Скрипт автоматически:
- создаст недостающие директории,
- создаст пустой файл (если его нет),
- откроет `nano` для вставки кода.

## Создать ВСЕ файлы проекта с нуля и открыть nano по очереди

Если у тебя вообще пустые папки и нужно, чтобы все нужные файлы создались автоматически в правильных директориях (независимо от текущей папки):

```bash
bash /var/api/netrender/server/scripts/nano-seed-project.sh /var/api/netrender/server /var/www/netrender/client
```

Что делает команда:
- создаёт серверные файлы в `/var/api/netrender/server`,
- создаёт клиентские файлы в `/var/www/netrender/client`,
- открывает `nano` для каждого файла по очереди (`server.js`, `routes.js`, ... `index.html`, `app.js`, и т.д.).

Для режима без открытия `nano` (только создать структуру):

```bash
bash /var/api/netrender/server/scripts/nano-seed-project.sh /var/api/netrender/server /var/www/netrender/client --no-open
```

## Экспорт всех кодов в один файл (без ZIP)

Если нужен полный код сразу по всем файлам в одном тексте:

```bash
bash scripts/export-all-files.sh
```

Или в свой файл:

```bash
bash scripts/export-all-files.sh /tmp/nms-full-code.txt
```

## Подготовка пустой структуры + очистка обрывков

Если хочешь всё начать с чистого листа и создать пустую иерархию сразу в нужных путях:

```bash
bash scripts/prepare-layout.sh   /var/www/netrender/client   /var/api/netrender/server   /var/data/netrender
```

Этот скрипт:
- создаёт каталоги,
- удаляет обрывки/остатки файлов в целевых папках,
- оставляет только пустую структуру.

Иерархия после выполнения:

```text
/var/www/netrender/client/
/var/api/netrender/server/
/var/data/netrender/
├── db/
└── uploads/
```

## Инициализация пустой иерархии (клиент/сервер/данные)

Создать сразу пустые каталоги под твой layout:

```bash
bash scripts/init-hierarchy.sh   /var/www/netrender/client   /var/api/netrender/server   /var/data/netrender
```

После этого просто копируй файлы:
- клиент в `/var/www/netrender/client`
- сервер в `/var/api/netrender/server`

## Хранилище данных (разделено на 3 файла)

Сервер хранит БД в `DATA_DIR` (по умолчанию `/var/data/netrender`) и автоматически использует:
- `db/users.json`
- `db/messages.json`
- `db/conversations.json`
- `db/meta.json` (счётчики/сессии/служебные данные)
- `uploads/` (вложения)

Миграция с legacy `messenger.json` происходит автоматически на старте сервера:
- если в `DATA_DIR` есть `messenger.json`, сервер переносит данные в новые файлы,
- исходный файл переименовывается в `messenger.json.migrated-<timestamp>`.

Фото/медиа:
- вложения сохраняются как файлы в `/var/data/netrender/uploads`,
- для изображений используется сжатие Brotli при сохранении (если даёт выигрыш по размеру),
- клиент получает URL вида `/uploads/<file>`.

## Переустановка сервера с нуля из ZIP

После того как перенёс ZIP на сервер, можно развернуть проект одной командой:

```bash
bash scripts/reinstall-server.sh \
  --zip /root/nms-project-YYYYMMDD-HHMMSS.zip \
  --app-dir /opt/nms \
  --port 3001 \
  --domain netrender.ru \
  --with-nginx
```

Что делает скрипт:
- ставит нужные пакеты (`unzip`, `node`, `pm2`, `nginx` при `--with-nginx`),
- распаковывает ZIP в `APP_DIR/current` (с бэкапом старой версии),
- запускает `npm install`/`npm ci` и `npm run check`,
- перезапускает процесс через PM2 (`index.js`),
- настраивает nginx reverse proxy (если указан `--with-nginx`).


## Структура серверных файлов

- `index.js` — входная точка сервера.
- `routes.js` — серверная логика и API роуты.
- `server.js` — совместимый shim (запускает `index.js`).

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



## Формат проекта

Этот репозиторий теперь полностью web-only: сервер на Node.js и клиент на чистых HTML/CSS/JS (без React и без нативного iOS-кода в репозитории).


## WebRTC звонки (TURN/STUN)

Сервер поддерживает сигналинг звонков:
- `GET /api/calls/config`
- `POST /api/calls/signal`

TURN/STUN задаётся через env:
- `WEBRTC_STUN_URL` (по умолчанию `stun:stun.l.google.com:19302`)
- `WEBRTC_TURN_URL`
- `WEBRTC_TURN_USERNAME`
- `WEBRTC_TURN_CREDENTIAL`

Пример для systemd/pm2:

```bash
export WEBRTC_TURN_URL=turn:your.turn.host:3478
export WEBRTC_TURN_USERNAME=user
export WEBRTC_TURN_CREDENTIAL=pass
```

## Ограничения MVP

- Данные хранятся в `/var/data/netrender/db/*.json`, медиа — в `/var/data/netrender/uploads`.
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
