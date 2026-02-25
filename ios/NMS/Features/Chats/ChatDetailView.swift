import SwiftUI

@MainActor
final class ChatDetailViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var text = ""

    func load(conversationId: Int, token: String) async {
        do {
            messages = try await APIClient.shared.messages(conversationId: conversationId, token: token)
        } catch {
            messages = []
        }
    }

    func send(conversationId: Int, token: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await APIClient.shared.sendMessage(conversationId: conversationId, text: trimmed, token: token)
            text = ""
            messages = try await APIClient.shared.messages(conversationId: conversationId, token: token)
        } catch {
            // You can surface this in UI if needed
        }
    }
}

struct ChatDetailView: View {
    let conversation: Conversation
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = ChatDetailViewModel()

    var body: some View {
        VStack {
            List(vm.messages) { message in
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.sender).font(.caption).foregroundColor(.secondary)
                    Text(message.text)
                }
            }

            HStack {
                TextField("Сообщение", text: $vm.text)
                    .textFieldStyle(.roundedBorder)
                Button("Отправить") {
                    Task {
                        guard let token = session.token else { return }
                        await vm.send(conversationId: conversation.id, token: token)
                    }
                }
            }
            .padding()
        }
        .navigationTitle(conversation.title)
        .task {
            guard let token = session.token else { return }
            await vm.load(conversationId: conversation.id, token: token)
        }
    }
}
