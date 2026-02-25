import SwiftUI

@MainActor
final class ChatsListViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []

    func load(token: String) async {
        do {
            conversations = try await APIClient.shared.conversations(token: token)
        } catch {
            conversations = []
        }
    }
}

struct ChatsListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = ChatsListViewModel()

    var body: some View {
        NavigationStack {
            List(vm.conversations) { conv in
                NavigationLink(conv.title) {
                    ChatDetailView(conversation: conv)
                }
            }
            .navigationTitle("Чаты")
            .task {
                guard let token = session.token else { return }
                await vm.load(token: token)
            }
            .refreshable {
                guard let token = session.token else { return }
                await vm.load(token: token)
            }
        }
    }
}
