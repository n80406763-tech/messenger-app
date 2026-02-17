# Windows USB Access Control (Master/User) + предлогон-блокировка

> Ключевой момент: «полностью необходимо» на Windows достигается только комбинацией **кастомного Credential Provider + политики hardening + Secure Boot/BitLocker/TPM + физической защиты BIOS/UEFI**. Одним PowerShell-скриптом этого добиться нельзя.

Этот документ даёт production-план под ваш сценарий (10 ПК в сети):

- только админ выпускает токены;
- два типа USB (Master и User);
- User-токен привязан к конкретному ПК;
- до входа в Windows доступ идёт через ваш провайдер авторизации;
- «директорские» SMB-ресурсы доступны только с Master-токеном.

## Архитектура (рекомендуемая)

1. **Usb Credential Provider (CP)**
   - COM DLL (C++), регистрируется как Credential Provider.
   - Работает прямо на экране входа Windows (до desktop).
   - Читает токен с USB, проверяет подпись/срок/привязку к ПК.
   - Для User-токена разрешает вход только в назначенную учётку на назначенном ПК.
   - Для Master-токена разрешает админ-учётку/расширенный профиль.

2. **Token Policy Service (LocalSystem)**
   - Фоновая служба, дублирует валидацию после входа.
   - Применяет доступ к сетевым ресурсам (map/unmap шар, группы, firewall rules).
   - Пишет аудит в Event Log.

3. **Issuer Station (только у администратора)**
   - Отдельный админский ПК/VM, где хранится `secret.key`.
   - Выпуск токенов только через `New-UsbToken.ps1`.
   - Отзыв токенов через `revoked-token-ids.txt`.

4. **Network Segmentation + SMB ACL**
   - Директорские шары только для группы `Directors`.
   - Обычным пользователям доступ запрещён всегда.
   - Master-токен временно даёт членство/доступ через Policy Service.

## Что реально сделать «необходимым» (чеклист)

- [x] Secure Boot включён.
- [x] BitLocker + TPM на всех ПК.
- [x] Запрет загрузки с USB в BIOS/UEFI + пароль BIOS.
- [x] Отключить Safe Mode/Recovery обходы через GPO/UEFI policy.
- [x] Отключить локальные «запасные» админ-аккаунты и оставить break-glass в сейфе.
- [x] WDAC/AppLocker: запуск только подписанных бинарей.
- [x] Вход только через ваш CP (Password provider отключить политикой).
- [x] Аудит входов и отказов на центральный collector.

## Быстрый режим (как вы просили: почти всё автоматически)

### Шаг 0 (опционально): одним скриптом собрать набор на Desktop

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Build-Desktop-UsbKit.ps1
```

После этого на рабочем столе появится папка `UsbAccessKit` со всеми нужными скриптами.

### Скрипт 1: создать флешку

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Create-UsbFlash.ps1 \
  -SecretFile C:\UsbTokenAdmin\secret.key \
  -InitSecretIfMissing \
  -UsbRoot E:\ \
  -Role User \
  -AllowedComputerName PC-01 \
  -UserName user01 \
  -ExpiresInDays 30
```

Master-флешка:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Create-UsbFlash.ps1 \
  -SecretFile C:\UsbTokenAdmin\secret.key \
  -UsbRoot F:\ \
  -Role Master \
  -UserName director \
  -ExpiresInDays 7
```

### Скрипт 2: установить «программу» на ПК

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Install-UsbAccessControl.ps1
```

Скрипт установки сам спросит:

- путь к `secret.key`;
- кто вы: `User` или `Admin`;
- на какого Windows-пользователя ставить (работать будет только для него);
- для режима `Admin` — список узлов/хостов в сети, которым запретить SMB-доступ (если никого не запретили, значит разрешено всем).

Что сделает скрипт установки:

- скопирует нужные скрипты в `C:\ProgramData\UsbPolicy`;
- положит `secret.key`;
- сохранит конфиг `agent-config.json` (режим, пользователь, deny-list);
- применит hardening;
- создаст Scheduled Task `UsbAccessAgent-<user>` (SYSTEM), который регулярно и при логоне применяет политику;
- будет автоматически добавлять/удалять целевого пользователя из группы `UsbMasterAccess` по Master-токену;
- в режиме `Admin` создаст firewall-блокировки SMB только для указанных хостов (неуказанные хосты остаются разрешены).

## Формат токена

На USB хранится `usb-token.json`:

- `TokenId`
- `Role` (`User`/`Master`)
- `UserName`
- `AllowedComputerName` (`*` для master)
- `IssuedAtUtc`
- `ExpiresAtUtc`
- `Version`
- `Signature` (HMAC-SHA256 по полям выше)

## Выпуск токена (только админ)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\New-UsbToken.ps1 \
  -SecretFile C:\UsbTokenAdmin\secret.key \
  -UsbRoot E:\ \
  -Role User \
  -AllowedComputerName PC-01 \
  -UserName user01 \
  -ExpiresInDays 30
```

Master:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\New-UsbToken.ps1 \
  -SecretFile C:\UsbTokenAdmin\secret.key \
  -UsbRoot F:\ \
  -Role Master \
  -UserName director \
  -ExpiresInDays 7
```

## Проверка токена

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\Test-UsbToken.ps1 \
  -SecretFile C:\ProgramData\UsbPolicy\secret.key \
  -UsbRoot E:\ \
  -RevokedTokenIdsFile C:\ProgramData\UsbPolicy\revoked-token-ids.txt
```

Если токен невалиден/просрочен/отозван/не для этого ПК — скрипт вернёт `exit 1`.

## Предлогон-приложение (как реализовать)

Вам нужен отдельный Windows-проект (C++):

- `ICredentialProvider`, `ICredentialProviderCredential`;
- в `GetCredentialCount` показывать плитку только при наличии валидного USB;
- при ошибке показывать: «Доступ запрещён. Требуется подходящий USB-ключ.»;
- при успехе передавать учётные данные в LSA (Kerberos/NTLM) по вашей политике.

> Если хотите, следующим шагом можно добавить в репозиторий шаблон C++ Credential Provider (каркас) с инструкцией сборки через Visual Studio.

## Runtime-реакция в сети (ваш сценарий)

- Пользователь на ПК №1 с обычным токеном:
  - вход разрешён только если токен привязан к ПК №1;
  - попытка открыть `\\director-pc\confidential` => отказ.
- Пользователь с Master-токеном:
  - доступ к директорскому ресурсу разрешается политикой.

Пример сообщения:

- **«Доступ к ресурсу директора запрещён. Нужен мастер-USB.»**

## Hardening-скрипт

Для базовой локальной настройки используйте:

- `scripts/windows/Apply-UsbPolicyHardening.ps1`

Он включает аудит и политику, уменьшающую обходы (не заменяет GPO/Intune).
