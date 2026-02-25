import SwiftUI

struct ChatsTabView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        TabView {
            ChatsListView()
                .tabItem { Label("Чаты", systemImage: "message") }

            ContactsView()
                .tabItem { Label("Контакты", systemImage: "person.2") }

            SettingsView()
                .tabItem { Label("Настройки", systemImage: "gear") }
        }
        .tint(.blue)
    }
}
