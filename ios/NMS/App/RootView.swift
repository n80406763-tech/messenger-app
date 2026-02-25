import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if session.isAuthorized {
                ChatsTabView()
            } else {
                LoginView()
            }
        }
        .task { await session.restore() }
    }
}
