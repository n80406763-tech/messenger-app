import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        NavigationStack {
            Form {
                if let user = session.currentUser {
                    Section("Профиль") {
                        Text("@\(user.username)")
                    }
                }
                Section {
                    Button("Выйти", role: .destructive) {
                        session.logout()
                    }
                }
            }
            .navigationTitle("Настройки")
        }
    }
}
