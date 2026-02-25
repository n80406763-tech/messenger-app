import Foundation

final class APIClient {
    static let shared = APIClient()
    private init() {}

    // IMPORTANT: change to your production API URL
    private let baseURL = URL(string: "https://netrender.ru")!

    func login(username: String, password: String) async throws -> LoginResponse {
        try await request(path: "/api/login", method: "POST", body: ["username": username, "password": password], token: nil)
    }

    func me(token: String) async throws -> MeResponse {
        try await request(path: "/api/me", method: "GET", body: Optional<[String: String]>.none, token: token)
    }

    func conversations(token: String) async throws -> [Conversation] {
        let data: ConversationListResponse = try await request(path: "/api/conversations", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.conversations
    }

    func messages(conversationId: Int, token: String) async throws -> [Message] {
        let data: MessageListResponse = try await request(path: "/api/conversations/\(conversationId)/messages?limit=30", method: "GET", body: Optional<[String: String]>.none, token: token)
        return data.messages
    }

    func sendMessage(conversationId: Int, text: String, token: String) async throws {
        _ = try await request(path: "/api/conversations/\(conversationId)/messages", method: "POST", body: ["text": text], token: token) as MessageSendResponse
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

private struct MessageSendResponse: Codable {
    let message: Message
}
