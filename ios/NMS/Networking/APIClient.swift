import Foundation

final class APIClient {
    static let shared = APIClient()
    private init() {}

    // IMPORTANT: change to your production API URL
    private let baseURL = URL(string: "https://netrender.ru")!

    func login(username: String, password: String) async throws -> LoginResponse {
        try await request(path: "/api/login", method: "POST", body: ["username": username, "password": password], token: nil)
    }

    func register(payload: RegisterPayload) async throws -> PublicUserEnvelope {
        try await request(path: "/api/register", method: "POST", body: payload, token: nil)
    }

    func forgotPassword(payload: ForgotPasswordPayload) async throws -> ForgotPasswordResponse {
        try await request(path: "/api/password/forgot", method: "POST", body: payload, token: nil)
    }

    func me(token: String) async throws -> MeResponse {
        try await request(path: "/api/me", method: "GET", body: Optional<[String: String]>.none, token: token)
    }

    func profile(token: String) async throws -> ProfileResponse {
        try await request(path: "/api/profile", method: "GET", body: Optional<[String: String]>.none, token: token)
    }

    func updateProfile(payload: ProfileUpdatePayload, token: String) async throws -> ProfileEnvelope {
        try await request(path: "/api/profile", method: "POST", body: payload, token: token)
    }

    func conversations(token: String) async throws -> [Conversation] {
        let data: ConversationListResponse = try await request(path: "/api/conversations", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.conversations
    }

    func contacts(token: String) async throws -> [PublicUser] {
        let data: ContactsResponse = try await request(path: "/api/contacts", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.contacts
    }

    func usersSearch(query: String, token: String) async throws -> [PublicUser] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let data: UsersSearchResponse = try await request(path: "/api/users/search?q=\(encoded)", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.users
    }

    func createDirect(targetUserId: Int, token: String) async throws -> ConversationEnvelope {
        try await request(path: "/api/conversations/direct", method: "POST", body: ["targetUserId": targetUserId], token: token)
    }

    func messages(conversationId: Int, token: String) async throws -> [Message] {
        let data: MessageListResponse = try await request(path: "/api/conversations/\(conversationId)/messages?limit=60", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.messages
    }

    func sendMessage(conversationId: Int, text: String, token: String) async throws -> MessageSendResponse {
        try await request(path: "/api/conversations/\(conversationId)/messages", method: "POST", body: ["text": text], token: token)
    }

    private func request<T: Decodable, Body: Encodable>(path: String, method: String, body: Body?, token: String?) async throws -> T {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if (200..<300).contains(http.statusCode) {
            return try JSONDecoder().decode(T.self, from: data)
        }

        if let apiError = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
            throw NSError(domain: "NMS.API", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: apiError.error])
        }
        throw NSError(domain: "NMS.API", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "Request failed: \(http.statusCode)"])
    }
}
