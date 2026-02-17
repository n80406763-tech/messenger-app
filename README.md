# Messenger (клиент + сервер)

Обновлённый мессенджер в стиле привычных приложений: личные диалоги, группы, поиск пользователей, отправка фото/видео, настройки приватности и поддержка.

## Возможности

- Регистрация/логин
- Личные чаты (1-на-1)
- Группы с отдельным модальным окном создания
- Настройки группы (переименование и изменение участников)
- Поиск людей по username и старт личного диалога
- Отдельный поиск по существующим чатам
- Отправка текста, фото и видео
- Предпросмотр медиа перед отправкой
- Улучшенная мобильная верстка (телефоны/узкие экраны)
- PWA режим (добавление на экран iPhone/Android)
- Push-уведомления для новых сообщений (в т.ч. в установленном PWA на iPhone)
- Настройки профиля (аватар, скрытие имени, приватность онлайн-статуса и аватара)
- Онлайн/оффлайн статус и last seen
- Чат поддержки + категории жалоб
- Realtime через SSE
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
Description=Messenger Node App
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
```

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


## Ограничения MVP

- Медиа хранится внутри `messenger.json` в base64 (для большого масштаба лучше файловое/object storage).
- Максимум вложения: 12MB (на клиенте изображения с телефона автоматически ужимаются в JPEG).
- Максимум аватара: 2MB.
- Для продакшена добавь reverse proxy, HTTPS, backup и мониторинг.
