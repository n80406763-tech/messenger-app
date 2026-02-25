import Foundation
import Combine

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
            errorMessage = nil
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

    func register(username: String, password: String, fullName: String, email: String, securityQuestion: String, securityAnswer: String) async {
        do {
            _ = try await APIClient.shared.register(
                payload: RegisterPayload(
                    username: username,
                    password: password,
                    fullName: fullName,
                    email: email,
                    securityQuestion: securityQuestion,
                    securityAnswer: securityAnswer
                )
            )
            await login(username: username, password: password)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func forgotPassword(username: String, email: String, securityAnswer: String) async -> String {
        do {
            let response = try await APIClient.shared.forgotPassword(
                payload: ForgotPasswordPayload(username: username, email: email, securityAnswer: securityAnswer)
            )
            errorMessage = nil
            return response.delivery
        } catch {
            errorMessage = error.localizedDescription
            return error.localizedDescription
        }
    }

    func logout() {
        token = nil
        currentUser = nil
        errorMessage = nil
        KeychainTokenStore.shared.clearToken()
    }
}
