import SwiftUI
import Combine

@MainActor
final class ChatsListViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var errorMessage: String? = nil
    private var refreshTask: Task<Void, Never>?

    func load(token: String) async {
        do {
            conversations = try await APIClient.shared.conversations(token: token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            conversations = []
        }
    }

    func startAutoRefresh(token: String) {
        refreshTask?.cancel()
        refreshTask = Task {
            while !Task.isCancelled {
                await load(token: token)
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
    }
}

struct ChatsListView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = ChatsListViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.conversations.isEmpty {
                    ContentUnavailableView("Пока нет чатов", systemImage: "message", description: Text("Откройте вкладку Контакты и начните диалог."))
                } else {
                    List(vm.conversations) { conv in
                        NavigationLink {
                            ChatDetailView(conversation: conv)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(conv.title).font(.headline)
                                if let preview = conv.lastMessage?.text, !preview.isEmpty {
                                    Text(preview)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Чаты")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
                        Text("v\(version)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .task {
                guard let token = session.token else { return }
                await vm.load(token: token)
                vm.startAutoRefresh(token: token)
            }
            .onDisappear { vm.stopAutoRefresh() }
            .refreshable {
                guard let token = session.token else { return }
                await vm.load(token: token)
            }
            .overlay(alignment: .bottom) {
                if let error = vm.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(.red.opacity(0.85), in: Capsule())
                        .padding(.bottom, 10)
                }
            }
        }
    }
}
