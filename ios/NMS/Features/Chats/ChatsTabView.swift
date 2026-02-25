import SwiftUI

struct ChatsTabView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        TabView {
            ChatsListView()
                .tabItem { Label("Чаты", systemImage: "message") }

            SettingsView()
                .tabItem { Label("Настройки", systemImage: "gear") }
        }
    }
}
