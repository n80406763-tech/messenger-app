import SwiftUI

struct LoginView: View {
    enum AuthMode: String, CaseIterable, Identifiable {
        case login = "Вход"
        case register = "Регистрация"
        case recovery = "Восстановление"
        var id: String { rawValue }
    }

    @EnvironmentObject private var session: SessionStore
    @State private var mode: AuthMode = .login

    @State private var username = ""
    @State private var password = ""

    @State private var registerFullName = ""
    @State private var registerEmail = ""
    @State private var registerQuestion = ""
    @State private var registerAnswer = ""

    @State private var recoveryUsername = ""
    @State private var recoveryEmail = ""
    @State private var recoveryAnswer = ""
    @State private var statusMessage: String?

    var body: some View {
        VStack(spacing: 16) {
            Text("NMS")
                .font(.largeTitle.bold())
            Text("Netrender Messaging Service")
                .foregroundStyle(.secondary)
                .font(.footnote)

            Picker("Режим", selection: $mode) {
                ForEach(AuthMode.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)

            Group {
                switch mode {
                case .login: loginForm
                case .register: registerForm
                case .recovery: recoveryForm
                }
            }

            if let statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let err = session.errorMessage {
                Text(err)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
    }

    private var loginForm: some View {
        VStack(spacing: 12) {
            TextField("Логин", text: $username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            SecureField("Пароль", text: $password)
                .textFieldStyle(.roundedBorder)

            Button("Войти") {
                Task { await session.login(username: username, password: password) }
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var registerForm: some View {
        VStack(spacing: 12) {
            TextField("Логин", text: $username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            SecureField("Пароль (мин. 6)", text: $password)
                .textFieldStyle(.roundedBorder)
            TextField("Имя", text: $registerFullName)
                .textFieldStyle(.roundedBorder)
            TextField("Email", text: $registerEmail)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            TextField("Контрольный вопрос", text: $registerQuestion)
                .textFieldStyle(.roundedBorder)
            SecureField("Контрольный ответ", text: $registerAnswer)
                .textFieldStyle(.roundedBorder)

            Button("Создать аккаунт") {
                Task {
                    await session.register(
                        username: username,
                        password: password,
                        fullName: registerFullName,
                        email: registerEmail,
                        securityQuestion: registerQuestion,
                        securityAnswer: registerAnswer
                    )
                    if session.isAuthorized {
                        statusMessage = "Аккаунт создан. Вы вошли автоматически."
                    }
                }
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var recoveryForm: some View {
        VStack(spacing: 12) {
            TextField("Логин", text: $recoveryUsername)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            TextField("Email", text: $recoveryEmail)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            SecureField("Контрольный ответ", text: $recoveryAnswer)
                .textFieldStyle(.roundedBorder)

            Button("Сбросить пароль") {
                Task {
                    statusMessage = await session.forgotPassword(
                        username: recoveryUsername,
                        email: recoveryEmail,
                        securityAnswer: recoveryAnswer
                    )
                }
            }
            .buttonStyle(.bordered)
        }
    }
}
