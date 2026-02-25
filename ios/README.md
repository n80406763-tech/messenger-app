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

## App Store readiness checklist (minimum)
- Native UI for key flows (auth, chat list, dialog, settings)
- Real moderation/reporting & support response flow
- Stable backend over HTTPS
- Privacy Policy URL + Terms URL
- Correct App Privacy answers in App Store Connect
- APNs-based notifications (recommended over web push for native app)

## Note
Current repository web client remains available; this folder is the native iOS migration path for App Store acceptance.
