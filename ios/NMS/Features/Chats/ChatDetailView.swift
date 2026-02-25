import SwiftUI
import Combine

@MainActor
final class ChatDetailViewModel: ObservableObject {
    @Published var messages: [Message] = []
    @Published var text = ""
    @Published var isSending = false
    @Published var errorMessage: String? = nil

    private var refreshTask: Task<Void, Never>?

    func load(conversationId: Int, token: String) async {
        do {
            messages = try await APIClient.shared.messages(conversationId: conversationId, token: token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startAutoRefresh(conversationId: Int, token: String) {
        refreshTask?.cancel()
        refreshTask = Task {
            while !Task.isCancelled {
                await load(conversationId: conversationId, token: token)
                try? await Task.sleep(nanoseconds: 2_000_000_000)
            }
        }
    }

    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    func send(conversationId: Int, token: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }
        isSending = true
        defer { isSending = false }

        do {
            _ = try await APIClient.shared.sendMessage(conversationId: conversationId, text: trimmed, token: token)
            text = ""
            await load(conversationId: conversationId, token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ChatDetailView: View {
    let conversation: Conversation
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = ChatDetailViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                List(vm.messages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(message.sender)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if !message.text.isEmpty {
                            Text(message.text)
                        }
                        if let attachment = message.attachment {
                            HStack(spacing: 8) {
                                Image(systemName: attachment.type == "video" ? "video" : "photo")
                                Text(attachment.type == "video" ? "Видео" : "Фото")
                                    .font(.caption)
                            }
                            .foregroundStyle(.secondary)
                        }
                    }
                    .id(message.id)
                }
                .listStyle(.plain)
                .onChange(of: vm.messages.count) { _, _ in
                    if let last = vm.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            Divider()
            HStack(spacing: 8) {
                TextField("Сообщение", text: $vm.text, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                Button(vm.isSending ? "..." : "Отправить") {
                    Task {
                        guard let token = session.token else { return }
                        await vm.send(conversationId: conversation.id, token: token)
                    }
                }
                .disabled(vm.isSending)
                .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .navigationTitle(conversation.title)
        .task {
            guard let token = session.token else { return }
            await vm.load(conversationId: conversation.id, token: token)
            vm.startAutoRefresh(conversationId: conversation.id, token: token)
        }
        .onDisappear { vm.stopAutoRefresh() }
        .refreshable {
            guard let token = session.token else { return }
            await vm.load(conversationId: conversation.id, token: token)
        }
        .alert("Ошибка", isPresented: .constant(vm.errorMessage != nil), actions: {
            Button("OK") { vm.errorMessage = nil }
        }, message: {
            Text(vm.errorMessage ?? "")
        })
    }
}
