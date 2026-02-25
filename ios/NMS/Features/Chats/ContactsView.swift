import SwiftUI
import Combine

@MainActor
final class ContactsViewModel: ObservableObject {
    @Published var contacts: [PublicUser] = []
    @Published var search = ""
    @Published var searchingUsers: [PublicUser] = []
    @Published var errorMessage: String? = nil

    func loadContacts(token: String) async {
        do {
            contacts = try await APIClient.shared.contacts(token: token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func searchUsers(token: String) async {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else {
            searchingUsers = []
            return
        }

        do {
            searchingUsers = try await APIClient.shared.usersSearch(query: q, token: token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            searchingUsers = []
        }
    }

    func startDirect(userId: Int, token: String) async -> Conversation? {
        do {
            return try await APIClient.shared.createDirect(targetUserId: userId, token: token).conversation
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}

struct ContactsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = ContactsViewModel()
    @State private var selectedConversation: Conversation?

    var body: some View {
        NavigationStack {
            List {
                Section("Мои контакты") {
                    if vm.contacts.isEmpty {
                        Text("Пока нет контактов")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(vm.contacts) { user in
                        contactRow(user)
                    }
                }

                Section("Поиск по username") {
                    TextField("Введите username полностью", text: $vm.search)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Найти") {
                        Task {
                            guard let token = session.token else { return }
                            await vm.searchUsers(token: token)
                        }
                    }

                    ForEach(vm.searchingUsers) { user in
                        contactRow(user)
                    }
                }
            }
            .navigationTitle("Контакты")
            .navigationDestination(item: $selectedConversation) { conv in
                ChatDetailView(conversation: conv)
            }
            .task {
                guard let token = session.token else { return }
                await vm.loadContacts(token: token)
            }
            .refreshable {
                guard let token = session.token else { return }
                await vm.loadContacts(token: token)
            }
            .overlay(alignment: .bottom) {
                if let err = vm.errorMessage {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(.red.opacity(0.85), in: Capsule())
                        .padding(.bottom, 10)
                }
            }
        }
    }

    @ViewBuilder
    private func contactRow(_ user: PublicUser) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(user.username)
                Text(user.isOnline == true ? "online" : "offline")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Написать") {
                Task {
                    guard let token = session.token else { return }
                    selectedConversation = await vm.startDirect(userId: user.id, token: token)
                }
            }
            .buttonStyle(.bordered)
        }
    }
}
