import Foundation

struct LoginResponse: Codable {
    let token: String
}

struct MeResponse: Codable {
    let id: Int
    let username: String
    let role: String?
}

struct PublicUser: Codable, Identifiable {
    let id: Int
    let username: String
    let avatar: String?
    let hideName: Bool?
    let isOnline: Bool?
    let lastSeenAt: String?
}

struct PublicUserEnvelope: Codable {
    let user: PublicUser
}

struct RegisterPayload: Codable {
    let username: String
    let password: String
    let fullName: String
    let email: String
    let securityQuestion: String
    let securityAnswer: String
}

struct ForgotPasswordPayload: Codable {
    let username: String
    let email: String
    let securityAnswer: String
}

struct ForgotPasswordResponse: Codable {
    let ok: Bool
    let delivery: String
}

struct ConversationListResponse: Codable {
    let conversations: [Conversation]
}

struct ConversationEnvelope: Codable {
    let conversation: Conversation
}

struct Conversation: Codable, Identifiable {
    let id: Int
    let type: String
    let title: String
    let lastMessage: Message?
}

struct ContactsResponse: Codable {
    let contacts: [PublicUser]
}

struct UsersSearchResponse: Codable {
    let users: [PublicUser]
}

struct Attachment: Codable {
    let type: String
    let mime: String?
    let name: String?
    let size: Int?
    let dataUrl: String?
}

struct MessageListResponse: Codable {
    let messages: [Message]
    let hasMore: Bool
}

struct MessageSendResponse: Codable {
    let message: Message
}

struct Message: Codable, Identifiable {
    let id: Int
    let conversationId: Int
    let sender: String
    let senderId: Int?
    let text: String
    let attachment: Attachment?
    let createdAt: String
}

struct ProfileResponse: Codable {
    let profile: Profile
}

struct ProfileEnvelope: Codable {
    let user: PublicUser
}

struct Profile: Codable {
    let id: Int
    let username: String
    let fullName: String?
    let email: String?
    let securityQuestion: String?
}

struct ProfileUpdatePayload: Codable {
    let fullName: String
    let email: String
    let securityQuestion: String
    let securityAnswer: String
}

struct ErrorResponse: Codable {
    let error: String
}
