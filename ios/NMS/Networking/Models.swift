import Foundation

struct LoginResponse: Codable {
    let token: String
}

struct MeResponse: Codable {
    let id: Int
    let username: String
    let role: String?
}

struct ConversationListResponse: Codable {
    let conversations: [Conversation]
}

struct Conversation: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
}

struct MessageListResponse: Codable {
    let messages: [Message]
    let hasMore: Bool
}

struct Message: Codable, Identifiable {
    let id: Int
    let conversationId: Int
    let sender: String
    let senderId: Int?
    let text: String
    let createdAt: String
}

struct ErrorResponse: Codable {
    let error: String
}
