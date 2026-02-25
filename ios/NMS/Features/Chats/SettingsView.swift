import SwiftUI

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var fullName = ""
    @Published var email = ""
    @Published var securityQuestion = ""
    @Published var securityAnswer = ""
    @Published var statusMessage: String?

    func load(token: String) async {
        do {
            let profile = try await APIClient.shared.profile(token: token).profile
            fullName = profile.fullName ?? ""
            email = profile.email ?? ""
            securityQuestion = profile.securityQuestion ?? ""
            statusMessage = nil
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func save(token: String) async {
        do {
            _ = try await APIClient.shared.updateProfile(
                payload: ProfileUpdatePayload(
                    fullName: fullName,
                    email: email,
                    securityQuestion: securityQuestion,
                    securityAnswer: securityAnswer
                ),
                token: token
            )
            securityAnswer = ""
            statusMessage = "Сохранено"
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = SettingsViewModel()

    var body: some View {
        NavigationStack {
            Form {
                if let user = session.currentUser {
                    Section("Аккаунт") {
                        Text("@\(user.username)")
                        Text(user.role ?? "user")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Профиль") {
                    TextField("Имя", text: $vm.fullName)
                    TextField("Email", text: $vm.email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Контрольный вопрос", text: $vm.securityQuestion)
                    SecureField("Новый контрольный ответ", text: $vm.securityAnswer)
                    Button("Сохранить") {
                        Task {
                            guard let token = session.token else { return }
                            await vm.save(token: token)
                        }
                    }
                }

                if let status = vm.statusMessage {
                    Section {
                        Text(status)
                            .foregroundStyle(status == "Сохранено" ? .green : .red)
                    }
                }

                Section {
                    Button("Выйти", role: .destructive) {
                        session.logout()
                    }
                }
            }
            .navigationTitle("Настройки")
            .task {
                guard let token = session.token else { return }
                await vm.load(token: token)
            }
        }
    }
}
