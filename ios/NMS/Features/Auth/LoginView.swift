import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("NMS")
                .font(.largeTitle.bold())
            TextField("Username", text: $username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)

            Button("Войти") {
                Task { await session.login(username: username, password: password) }
            }
            .buttonStyle(.borderedProminent)

            if let err = session.errorMessage {
                Text(err).foregroundColor(.red)
            }
        }
        .padding()
    }
}
