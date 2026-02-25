# NMS iOS (SwiftUI) starter for App Store path

This folder contains a native SwiftUI client skeleton that uses the current NMS backend API.

## What is included
- App entry + root navigation (`App/`)
- Secure token storage in Keychain (`Support/KeychainTokenStore.swift`)
- Session/auth state (`Support/SessionStore.swift`)
- API client + models (`Networking/`)
- Basic native UI screens (`Features/`): login, chats list, chat detail, settings
- iOS metadata files for Xcode setup (`Resources/`):
  - `Info.plist`
  - `NMS.entitlements`
  - `PrivacyInfo.xcprivacy`

## How to use in Xcode
1. Create a new **iOS App** project (`SwiftUI`, `Swift`).
2. Copy files from `ios/NMS/` into your Xcode target groups.
3. In target settings:
   - Bundle Identifier: your own (e.g. `com.netrender.nms`)
   - Signing: select your Team
   - iOS Deployment Target: 16+
4. Set API base URL in `Networking/APIClient.swift`.
5. Add Push capability if you plan native push (APNs):
   - Signing & Capabilities → Push Notifications
   - Background Modes → Remote notifications
6. Build and run on device, then archive for TestFlight/App Store.


## Что уже работает в iOS-клиенте
- Раздельные экраны входа / регистрации / восстановления пароля
- Вкладки: Чаты / Контакты / Настройки
- Открытие direct-чата из контактов
- Просмотр сообщений и отправка с автообновлением
- Редактирование базового профиля (имя, email, контрольный вопрос/ответ)

## App Store readiness checklist (minimum)
- Native UI for key flows (auth, chat list, dialog, settings)
- Real moderation/reporting & support response flow
- Stable backend over HTTPS
- Privacy Policy URL + Terms URL
- Correct App Privacy answers in App Store Connect
- APNs-based notifications (recommended over web push for native app)

## Note
Current repository web client remains available; this folder is the native iOS migration path for App Store acceptance.


## Troubleshooting (Xcode errors from screenshot)

### 1) `Type 'SessionStore' does not conform to protocol 'ObservableObject'`
Make sure `SessionStore.swift` imports **Combine** (needed for `ObservableObject` and `@Published`).

### 2) `Multiple commands produce ...`
This usually means duplicate build artifacts in the target (most often `Info.plist`):

- In **Target → Build Settings**:
  - keep only one strategy:
    - either set `Generate Info.plist File = Yes` and **do not** add custom plist file to resources,
    - or set `Generate Info.plist File = No` and point `Info.plist File` to `ios/NMS/Resources/Info.plist`.
- In **Target → Build Phases → Copy Bundle Resources**:
  - remove duplicated `Info.plist` / privacy files if they are listed more than once.
- Then: **Product → Clean Build Folder** and build again.

Recommended for this repo: use `ios/NMS/Resources/Info.plist` as the single plist source (`Generate Info.plist File = No`).


### 3) `Cannot code sign because the target does not have an Info.plist file ...`
Это означает, что у target не задан `INFOPLIST_FILE` и одновременно выключена автогенерация plist.

Исправление (выбери один вариант):

- **Вариант A (рекомендуется Apple):**
  - `Build Settings` → `Generate Info.plist File` = `Yes`
  - `Info.plist File` можно оставить пустым

- **Вариант B (для этого репозитория):**
  - `Build Settings` → `Generate Info.plist File` = `No`
  - `Info.plist File` (`INFOPLIST_FILE`) = `ios/NMS/Resources/Info.plist`

После изменения:
1. `Product` → `Clean Build Folder`
2. Закрой/открой Xcode проект
3. Запусти билд снова

Если ошибка не ушла, проверь что `Info.plist` не удалён из диска и что путь в `INFOPLIST_FILE` написан без опечаток.
