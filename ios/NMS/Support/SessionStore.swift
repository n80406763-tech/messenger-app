import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published var token: String? = nil
    @Published var currentUser: MeResponse? = nil
    @Published var errorMessage: String? = nil

    var isAuthorized: Bool { token != nil }

    func restore() async {
        guard let saved = KeychainTokenStore.shared.readToken() else { return }
        token = saved
        do {
            currentUser = try await APIClient.shared.me(token: saved)
        } catch {
            logout()
        }
    }

    func login(username: String, password: String) async {
        do {
            let response = try await APIClient.shared.login(username: username, password: password)
            token = response.token
            KeychainTokenStore.shared.writeToken(response.token)
            currentUser = try await APIClient.shared.me(token: response.token)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func logout() {
        token = nil
        currentUser = nil
        KeychainTokenStore.shared.clearToken()
    }
}
