async function handleApi(req, res, pathname, searchParams = null, ctx) {
  with (ctx) {
      const params = searchParams || new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
    
      // Dedicated namespace for native app clients: /api/app/*
      // We normalize to existing /api/* handlers to keep one source of truth.
      if (pathname === '/api/app') pathname = '/api';
      if (pathname.startsWith('/api/app/')) pathname = `/api/${pathname.slice('/api/app/'.length)}`;
    
      // Compatibility typo alias: "conservations" -> "conversations"
      if (pathname.includes('/conservations')) pathname = pathname.replace('/conservations', '/conversations');
    
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          users: state.users.length,
          conversations: state.conversations.length,
          messages: state.messages.length
        });
      }
    
      if (req.method === 'GET' && pathname === '/api/calls/config') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { iceServers: getIceServersFromEnv() });
      }

      if (req.method === 'POST' && pathname === '/api/calls/signal') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });

        try {
          const body = await parseBody(req);
          const conversationId = Number(body.conversationId || 0);
          const type = normalizeText(body.type || '');
          const conversation = getConversationById(conversationId);
          if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
            return sendJson(res, 404, { error: 'Conversation not found' });
          }

          const allowedTypes = new Set(['offer', 'answer', 'ice', 'bye', 'reject']);
          if (!allowedTypes.has(type)) return sendJson(res, 400, { error: 'Invalid call signal type' });

          const payload = {
            conversationId,
            type,
            fromUserId: auth.user.id,
            from: displayNameForViewer(auth.user, auth.user.id),
            sdp: body.sdp || null,
            candidate: body.candidate || null,
            createdAt: new Date().toISOString()
          };

          broadcast(
            'call_signal',
            payload,
            (meta) => canReceiveConversation(conversation, meta.user) && meta.user.id !== auth.user.id
          );

          return sendJson(res, 200, { ok: true });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }

      if (req.method === 'POST' && pathname === '/api/register') {
        try {
          const body = await parseBody(req);
          const username = normalizeUsername(body.username);
          const password = String(body.password || '');
          const fullName = normalizeText(body.fullName || '');
          const email = normalizeText(body.email || '').toLowerCase();
          const securityQuestion = normalizeText(body.securityQuestion || '');
          const securityAnswer = normalizeText(body.securityAnswer || '');
    
          if (!isValidUsername(username) || password.length < 6) {
            return sendJson(res, 400, { error: 'Username 3-24 chars and password min 6 chars required.' });
          }
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sendJson(res, 400, { error: 'Некорректный email' });
          }
    
          const exists = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
          if (exists) return sendJson(res, 409, { error: 'Username already exists' });
    
          const user = {
            id: state.nextUserId++,
            username,
            passwordHash: hashPassword(password),
            role: 'user',
            avatar: null,
            hideName: false,
            lastSeenAt: null,
            showOnlineStatus: true,
            allowAvatarView: true,
            allowAvatarDownload: false,
            pushSubscriptions: [],
            fullName,
            email,
            securityQuestion,
            securityAnswerHash: securityAnswer ? hashPassword(securityAnswer.toLowerCase()) : null
          };
          state.users.push(user);
          saveState();
          return sendJson(res, 201, { user: toPublicUser(user, user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/login') {
        try {
          const ip = getClientIp(req);
          if (!consumeRateLimit(ipLoginRequests, ip, LOGIN_WINDOW_MS, LOGIN_LIMIT)) {
            return sendJson(res, 429, { error: 'Too many login attempts. Try again later.' });
          }
    
          const body = await parseBody(req);
          const username = normalizeUsername(body.username);
          const password = String(body.password || '');
          const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
          if (!user || !verifyPassword(password, user.passwordHash)) {
            return sendJson(res, 401, { error: 'Invalid credentials' });
          }
    
          user.lastSeenAt = new Date().toISOString();
          saveState();
          const token = createSession(user);
          return sendJson(res, 200, { token, user: toPublicUser(user, user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
    
      if (req.method === 'POST' && pathname === '/api/password/forgot') {
        try {
          const body = await parseBody(req);
          const username = normalizeUsername(body.username);
          const email = normalizeText(body.email || '').toLowerCase();
          const securityAnswer = normalizeText(body.securityAnswer || '').toLowerCase();
          const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.role === 'user');
          if (!user) return sendJson(res, 404, { error: 'Пользователь не найден' });
    
          if (user.email && email && user.email !== email) {
            return sendJson(res, 400, { error: 'Email не совпадает' });
          }
          if (user.securityAnswerHash && !verifyPassword(securityAnswer, user.securityAnswerHash)) {
            return sendJson(res, 400, { error: 'Неверный контрольный ответ' });
          }
    
          const result = applyPasswordReset(user, 'Самостоятельный сброс пароля');
          saveState();
          return sendJson(res, 200, {
            ok: true,
            delivery: result.hasEmail
              ? `Новый пароль отправлен на ${maskEmail(user.email)}`
              : `Email не указан. Временный пароль: ${result.newPassword}`
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/support/guest') {
        try {
          const body = await parseBody(req);
          const topic = normalizeText(body.topic || 'Другое');
          const username = normalizeUsername(body.username);
          const email = normalizeText(body.email || '').toLowerCase();
          const text = normalizeText(body.text || '');
          if (!text) return sendJson(res, 400, { error: 'Введите текст обращения' });
    
          const supportIds = state.users.filter((u) => isSupportRole(u)).map((u) => u.id);
          const conversation = {
            id: state.nextConversationId++,
            type: 'support_guest',
            title: `Гость: ${topic}${username ? ` (@${username})` : ''}`,
            participantIds: supportIds,
            createdAt: new Date().toISOString(),
            guestMeta: { username, email, topic }
          };
          state.conversations.push(conversation);
    
          const guestMessage = {
            id: state.nextMessageId++,
            conversationId: conversation.id,
            senderId: 0,
            senderName: username ? `Guest @${username}` : 'Guest',
            text: `[${topic}] ${text}${email ? `
    Контакт: ${email}` : ''}`,
            attachment: null,
            createdAt: new Date().toISOString()
          };
          state.messages.push(guestMessage);
    
          let responseText = 'Обращение отправлено в поддержку. Ожидайте ответа.';
          if (topic === 'Забыл пароль' && username) {
            const user = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase() && u.role === 'user');
            if (user) {
              const result = applyPasswordReset(user, 'Запрос через гостевую поддержку: Забыл пароль');
              responseText = result.hasEmail
                ? `Пароль сброшен и отправлен на ${maskEmail(user.email)}`
                : `Пароль сброшен. Временный пароль: ${result.newPassword}`;
    
              const systemMessage = {
                id: state.nextMessageId++,
                conversationId: conversation.id,
                senderId: 0,
                senderName: 'Support Bot',
                text: `Автообработка темы "Забыл пароль": пароль обновлён для @${user.username}.`,
                attachment: null,
                createdAt: new Date().toISOString()
              };
              state.messages.push(systemMessage);
            } else {
              responseText = 'Пользователь не найден. Проверьте username.';
            }
          }
    
          saveState();
          return sendJson(res, 201, { ok: true, message: responseText });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/logout') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        sessions.delete(auth.token);
        delete state.persistedSessions[auth.token];
        saveState();
        return sendJson(res, 200, { ok: true });
      }
    
      if (req.method === 'GET' && pathname === '/api/me') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { user: toPublicUser(auth.user, auth.user.id) });
      }
    
      if (req.method === 'GET' && pathname === '/api/profile') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, {
          username: auth.user.username,
          avatar: auth.user.avatar,
          hideName: auth.user.hideName,
          role: auth.user.role,
          showOnlineStatus: auth.user.showOnlineStatus,
          allowAvatarView: auth.user.allowAvatarView,
          allowAvatarDownload: auth.user.allowAvatarDownload,
          fullName: auth.user.fullName || '',
          email: auth.user.email || '',
          securityQuestion: auth.user.securityQuestion || '',
          hasSecurityAnswer: Boolean(auth.user.securityAnswerHash)
        });
      }
    
      if (req.method === 'POST' && pathname === '/api/profile') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const body = await parseBody(req);
          const hideName = typeof body.hideName === 'boolean' ? body.hideName : auth.user.hideName;
          const showOnlineStatus =
            typeof body.showOnlineStatus === 'boolean' ? body.showOnlineStatus : auth.user.showOnlineStatus;
          const allowAvatarView =
            typeof body.allowAvatarView === 'boolean' ? body.allowAvatarView : auth.user.allowAvatarView;
          const allowAvatarDownload =
            typeof body.allowAvatarDownload === 'boolean' ? body.allowAvatarDownload : auth.user.allowAvatarDownload;
          const fullName = typeof body.fullName === 'string' ? normalizeText(body.fullName) : auth.user.fullName || '';
          const email = typeof body.email === 'string' ? normalizeText(body.email).toLowerCase() : auth.user.email || '';
          const securityQuestion =
            typeof body.securityQuestion === 'string' ? normalizeText(body.securityQuestion) : auth.user.securityQuestion || '';
          const securityAnswer = typeof body.securityAnswer === 'string' ? normalizeText(body.securityAnswer).toLowerCase() : '';
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return sendJson(res, 400, { error: 'Некорректный email' });
          }
          let avatar = auth.user.avatar;
    
          if (body.avatarDataUrl === null) avatar = null;
          if (typeof body.avatarDataUrl === 'string') {
            const parsedAvatar = parseImageDataUrl(body.avatarDataUrl, MAX_AVATAR_BYTES);
            if (!parsedAvatar) return sendJson(res, 400, { error: 'Invalid avatar image (max 2MB)' });
            avatar = parsedAvatar;
          }
    
          auth.user.hideName = hideName;
          auth.user.showOnlineStatus = showOnlineStatus;
          auth.user.allowAvatarView = allowAvatarView;
          auth.user.allowAvatarDownload = allowAvatarDownload;
          auth.user.avatar = avatar;
          auth.user.fullName = fullName;
          auth.user.email = email;
          auth.user.securityQuestion = securityQuestion;
          if (securityAnswer) auth.user.securityAnswerHash = hashPassword(securityAnswer);
          saveState();
    
          return sendJson(res, 200, { user: toPublicUser(auth.user, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'GET' && pathname === '/api/support/agents') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        if (auth.user.role !== 'support_admin') return sendJson(res, 403, { error: 'Forbidden' });
    
        const agents = state.users
          .filter((u) => u.role === 'support_admin' || u.role === 'support_agent')
          .map((u) => ({ ...toPublicUser(u, auth.user.id), role: u.role }));
        return sendJson(res, 200, { agents });
      }
    
      if (req.method === 'POST' && pathname === '/api/support/agents') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        if (auth.user.role !== 'support_admin') return sendJson(res, 403, { error: 'Forbidden' });
    
        try {
          const body = await parseBody(req);
          const username = normalizeUsername(body.username);
          const password = String(body.password || '');
    
          if (!isValidUsername(username) || password.length < 6) {
            return sendJson(res, 400, { error: 'Username 3-24 chars and password min 6 chars required.' });
          }
    
          const exists = state.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
          if (exists) return sendJson(res, 409, { error: 'Username already exists' });
    
          const user = {
            id: state.nextUserId++,
            username,
            passwordHash: hashPassword(password),
            role: 'support_agent',
            avatar: null,
            hideName: false,
            lastSeenAt: null,
            showOnlineStatus: true,
            allowAvatarView: true,
            allowAvatarDownload: false,
            pushSubscriptions: []
          };
          state.users.push(user);
          saveState();
          return sendJson(res, 201, { user: toPublicUser(user, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'GET' && pathname === '/api/support/categories') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { categories: SUPPORT_CATEGORIES });
      }
    
    
      if (req.method === 'GET' && pathname === '/api/push/public-key') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        return sendJson(res, 200, { publicKey: VAPID_PUBLIC_KEY });
      }
    
      if (req.method === 'POST' && pathname === '/api/push/subscribe') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const body = await parseBody(req);
          const subscription = body.subscription;
          if (!subscription || typeof subscription.endpoint !== 'string') {
            return sendJson(res, 400, { error: 'Invalid subscription' });
          }
    
          const list = Array.isArray(auth.user.pushSubscriptions) ? auth.user.pushSubscriptions : [];
          const filtered = list.filter((item) => item.endpoint !== subscription.endpoint);
          auth.user.pushSubscriptions = [...filtered, subscription];
          removePushInbox(subscription.endpoint);
          saveState();
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/push/unsubscribe') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const body = await parseBody(req);
          const endpoint = String(body.endpoint || '');
          auth.user.pushSubscriptions = (auth.user.pushSubscriptions || []).filter((item) => item.endpoint !== endpoint);
          removePushInbox(endpoint);
          saveState();
          return sendJson(res, 200, { ok: true });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'GET' && pathname === '/api/push/pull') {
        const endpoint = String(params.get('endpoint') || '');
        if (!endpoint) return sendJson(res, 400, { error: 'Endpoint required' });
        if (!hasSubscriptionEndpoint(endpoint)) return sendJson(res, 404, { error: 'Subscription not found' });
    
        const payloads = pullAllPushPayloads(endpoint, 20);
        saveState();
        return sendJson(res, 200, { notifications: payloads, notification: payloads[0] || null });
      }
    
      if (req.method === 'GET' && pathname === '/api/users/search') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const q = normalizeUsername(params.get('q') || '').toLowerCase();
        const mode = String(params.get('mode') || 'exact').toLowerCase();
    
        const users = state.users
          .filter((u) => u.id !== auth.user.id)
          .filter((u) => (isSupportRole(auth.user) ? true : !isSupportRole(u)))
          .filter((u) => {
            if (mode === 'contains' && q === '*') return true;
            if (!q) return false;
            if (mode === 'contains') return u.username.toLowerCase().includes(q);
            return u.username.toLowerCase() === q;
          })
          .slice(0, 20)
          .map((u) => toPublicUser(u, auth.user.id));
    
        return sendJson(res, 200, { users });
      }
    
      const userStatusMatch = pathname.match(/^\/api\/users\/(\d+)\/status$/);
      if (req.method === 'GET' && userStatusMatch) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const userId = Number(userStatusMatch[1]);
        const user = state.users.find((u) => u.id === userId);
        if (!user) return sendJson(res, 404, { error: 'User not found' });
    
        const canSeeOnline = user.id === auth.user.id || user.showOnlineStatus;
        return sendJson(res, 200, {
          userId: user.id,
          online: canSeeOnline ? isUserOnline(user.id) : false,
          lastSeenAt: canSeeOnline ? user.lastSeenAt || null : null
        });
      }
    
    
    
      const avatarMatch = pathname.match(/^\/api\/users\/(\d+)\/avatar$/);
      if (req.method === 'GET' && avatarMatch) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const userId = Number(avatarMatch[1]);
        const user = state.users.find((u) => u.id === userId);
        if (!user) return sendJson(res, 404, { error: 'User not found' });
    
        const canSeeAvatar = user.id === auth.user.id || user.allowAvatarView;
        const canDownload = user.id === auth.user.id || user.allowAvatarDownload;
        if (!canSeeAvatar || !canDownload || !user.avatar) {
          return sendJson(res, 403, { error: 'Avatar download not allowed' });
        }
    
        return sendJson(res, 200, { avatarDataUrl: user.avatar });
      }
      if (req.method === 'GET' && pathname === '/api/conversations') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const list = state.conversations
          .filter((c) => canReceiveConversation(c, auth.user))
          .map((c) => serializeConversation(c, auth.user.id))
          .sort((a, b) => (b.lastMessage?.id || 0) - (a.lastMessage?.id || 0));
    
        return sendJson(res, 200, { conversations: list });
      }
    
    
      if (req.method === 'GET' && pathname === '/api/contacts') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const ids = [...userContactIds(auth.user.id)];
        const contacts = ids
          .map((id) => state.users.find((u) => u.id === id))
          .filter(Boolean)
          .map((u) => toPublicUser(u, auth.user.id));
    
        return sendJson(res, 200, { contacts });
      }
    
      if (req.method === 'GET' && pathname === '/api/group-invites') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const invites = state.groupInvites
          .filter((inv) => inv.inviteeId === auth.user.id && inv.status === 'pending')
          .map((inv) => serializeInvite(inv, auth.user.id));
    
        return sendJson(res, 200, { invites });
      }
    
      if (req.method === 'POST' && pathname.match(/^\/api\/group-invites\/(\d+)\/respond$/)) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const inviteId = Number(pathname.split('/')[3]);
          const invite = state.groupInvites.find((inv) => inv.id === inviteId && inv.inviteeId === auth.user.id);
          if (!invite || invite.status !== 'pending') {
            return sendJson(res, 404, { error: 'Invite not found' });
          }
    
          const body = await parseBody(req);
          const accept = body.accept === true;
          invite.status = accept ? 'accepted' : 'rejected';
          invite.respondedAt = new Date().toISOString();
    
          const conversation = getConversationById(invite.conversationId);
          if (accept && conversation && conversation.type === 'group') {
            conversation.participantIds = [...new Set([...conversation.participantIds, auth.user.id])];
            broadcastConversationUpdated(conversation.id);
          }
    
          saveState();
          return sendJson(res, 200, { invite: serializeInvite(invite, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/conversations/direct') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const body = await parseBody(req);
          const targetUserId = Number(body.targetUserId || 0);
          const target = state.users.find((u) => u.id === targetUserId);
          if (!target || target.id === auth.user.id) return sendJson(res, 400, { error: 'Invalid target user' });
          if (isSupportRole(auth.user) || isSupportRole(target)) {
            return sendJson(res, 403, { error: 'Написать поддержке можно только через чат поддержки' });
          }
    
          const existing = state.conversations.find(
            (c) =>
              c.type === 'direct' &&
              c.participantIds.length === 2 &&
              c.participantIds.includes(auth.user.id) &&
              c.participantIds.includes(target.id)
          );
          if (existing) return sendJson(res, 200, { conversation: serializeConversation(existing, auth.user.id) });
    
          const conversation = {
            id: state.nextConversationId++,
            type: 'direct',
            title: null,
            participantIds: [auth.user.id, target.id],
            createdAt: new Date().toISOString()
          };
          state.conversations.push(conversation);
          saveState();
          return sendJson(res, 201, { conversation: serializeConversation(conversation, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/conversations/group') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const body = await parseBody(req);
          const title = normalizeText(body.title);
          const rawMembers = Array.isArray(body.memberIds) ? body.memberIds : [];
          const memberIds = [...new Set(rawMembers.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
          const validInvites = memberIds.filter((id) => canInviteFromContacts(auth.user.id, id));
    
          if (title.length < 2) {
            return sendJson(res, 400, { error: 'Group title too short' });
          }
          if (!validInvites.length) {
            return sendJson(res, 400, { error: 'Можно приглашать только людей из ваших контактов' });
          }
    
          const conversation = {
            id: state.nextConversationId++,
            type: 'group',
            title,
            participantIds: [auth.user.id],
            createdAt: new Date().toISOString()
          };
    
          state.conversations.push(conversation);
          validInvites.forEach((inviteeId) => createGroupInvite(conversation.id, auth.user.id, inviteeId));
          saveState();
          return sendJson(res, 201, {
            conversation: serializeConversation(conversation, auth.user.id),
            invites: validInvites.length
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname === '/api/conversations/support') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
        if (isSupportRole(auth.user)) {
          return sendJson(res, 400, { error: 'Сотрудники поддержки отвечают в уже созданных чатах' });
        }
    
        const conversation = getOrCreateSupportConversation(auth.user.id);
        const hasMessages = state.messages.some((m) => m.conversationId === conversation.id);
        if (!hasMessages) {
          const firstReply = buildSupportReply();
          firstReply.conversationId = conversation.id;
          state.messages.push(firstReply);
          saveState();
        }
    
        broadcastConversationUpdated(conversation.id);
    
        return sendJson(res, 200, { conversation: serializeConversation(conversation, auth.user.id) });
      }
    
      if (req.method === 'POST' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/rename')) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const conversationId = Number(pathname.split('/')[3]);
          const conversation = getConversationById(conversationId);
          if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
            return sendJson(res, 404, { error: 'Conversation not found' });
          }
          if (conversation.type !== 'group') return sendJson(res, 400, { error: 'Only group can be renamed' });
    
          const body = await parseBody(req);
          const title = normalizeText(body.title);
          if (title.length < 2) return sendJson(res, 400, { error: 'Group title too short' });
    
          conversation.title = title;
          saveState();
          broadcastConversationUpdated(conversation.id);
          return sendJson(res, 200, { conversation: serializeConversation(conversation, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/members/add')) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const conversationId = Number(pathname.split('/')[3]);
          const conversation = getConversationById(conversationId);
          if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
            return sendJson(res, 404, { error: 'Conversation not found' });
          }
          if (conversation.type !== 'group') {
            return sendJson(res, 400, { error: 'Only group members can be changed' });
          }
    
          const body = await parseBody(req);
          const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
          const validIds = [...new Set(memberIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
            .filter((id) => canInviteFromContacts(auth.user.id, id))
            .filter((id) => !conversation.participantIds.includes(id));
    
          validIds.forEach((inviteeId) => createGroupInvite(conversation.id, auth.user.id, inviteeId));
          saveState();
          broadcastConversationUpdated(conversation.id);
          return sendJson(res, 200, {
            conversation: serializeConversation(conversation, auth.user.id),
            invites: validIds.length
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'POST' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/members/remove')) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        try {
          const conversationId = Number(pathname.split('/')[3]);
          const conversation = getConversationById(conversationId);
          if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
            return sendJson(res, 404, { error: 'Conversation not found' });
          }
          if (conversation.type !== 'group') {
            return sendJson(res, 400, { error: 'Only group members can be changed' });
          }
    
          const body = await parseBody(req);
          const memberId = Number(body.memberId || 0);
          if (!memberId || memberId === auth.user.id) return sendJson(res, 400, { error: 'Cannot remove this member' });
    
          conversation.participantIds = conversation.participantIds.filter((id) => id !== memberId);
          if (conversation.participantIds.length < 2) {
            return sendJson(res, 400, { error: 'Group must keep at least 2 members' });
          }
    
          saveState();
          broadcastConversationUpdated(conversation.id);
          return sendJson(res, 200, { conversation: serializeConversation(conversation, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'GET' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/messages')) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const conversationId = Number(pathname.split('/')[3]);
        const conversation = getConversationById(conversationId);
        if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
          return sendJson(res, 404, { error: 'Conversation not found' });
        }
    
        return sendJson(res, 200, readMessagesPage(conversationId, params, auth.user.id));
      }
    
      if (req.method === 'POST' && pathname.startsWith('/api/conversations/') && pathname.endsWith('/messages')) {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        const conversationId = Number(pathname.split('/')[3]);
        const conversation = getConversationById(conversationId);
        if (!conversation || !canAccessConversation(conversation, auth.user.id)) {
          return sendJson(res, 404, { error: 'Conversation not found' });
        }
    
        if (!consumeRateLimit(userMessageRequests, String(auth.user.id), MESSAGE_WINDOW_MS, MESSAGE_LIMIT)) {
          return sendJson(res, 429, { error: 'Rate limit exceeded (max 90 messages/min)' });
        }
    
        try {
          const body = await parseBody(req);
          const text = normalizeText(body.text);
          const attachment = body.attachment ? parseAttachmentDataUrl(body.attachment.dataUrl) : null;
          const clientMessageId = normalizeClientMessageId(body.clientMessageId);
    
          cleanupRecentClientMessages();
          if (clientMessageId) {
            const key = dedupeKey(auth.user.id, conversation.id, clientMessageId);
            const existingId = state.recentClientMessages[key]?.messageId;
            if (existingId) {
              const existingMessage = state.messages.find((m) => m.id === existingId);
              if (existingMessage) {
                return sendJson(res, 200, { message: serializeMessageForViewer(existingMessage, auth.user.id), deduped: true });
              }
              delete state.recentClientMessages[key];
            }
          }
    
          const complaintType = normalizeText(body.complaintType || '');
          const isSupportComplaint =
            conversation.type === 'support' && SUPPORT_CATEGORIES.some((c) => c === complaintType);
    
          if (!text && !attachment && !isSupportComplaint) {
            return sendJson(res, 400, { error: 'Message text or media required' });
          }
          if (text.length > 1200) return sendJson(res, 400, { error: 'Text too long (max 1200)' });
          if (body.attachment && !attachment) {
            return sendJson(res, 400, { error: 'Invalid media. Allowed: image/* or video/* up to 12MB.' });
          }
    
          const message = {
            id: state.nextMessageId++,
            conversationId,
            senderId: auth.user.id,
            clientMessageId: clientMessageId || null,
            text: text || (isSupportComplaint ? `Жалоба: ${complaintType}` : ''),
            attachment,
            createdAt: new Date().toISOString()
          };
    
          state.messages.push(message);
          if (clientMessageId) {
            state.recentClientMessages[dedupeKey(auth.user.id, conversation.id, clientMessageId)] = {
              messageId: message.id,
              createdAtMs: Date.now()
            };
          }
          if (state.messages.length > 5000) state.messages = state.messages.slice(-5000);
          saveState();
    
          broadcast(
            'message',
            (meta) => serializeMessageForViewer(message, meta.user.id),
            (meta) => canReceiveConversation(conversation, meta.user)
          );
          await notifyPushParticipants(conversation, auth.user.id, message);
    
          if (conversation.type === 'support' && isSupportComplaint && !isSupportRole(auth.user)) {
            const info = buildSupportReply(complaintType);
            info.conversationId = conversation.id;
            state.messages.push(info);
            saveState();
            broadcast('message', (meta) => serializeMessageForViewer(info, meta.user.id), (meta) =>
              canReceiveConversation(conversation, meta.user)
            );
            await notifyPushParticipants(conversation, info.senderId, info);
          }
    
          return sendJson(res, 201, { message: serializeMessageForViewer(message, auth.user.id) });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
      }
    
      if (req.method === 'GET' && pathname === '/api/events') {
        const auth = readAuth(req);
        if (!auth) return sendJson(res, 401, { error: 'Unauthorized' });
    
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
    
        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write('event: ping\ndata: {}\n\n');
        }, 15000);
    
        sseClients.set(res, { user: auth.user });
        auth.user.lastSeenAt = new Date().toISOString();
        saveState();
    
        res.write(`event: ready\ndata: ${JSON.stringify({ user: toPublicUser(auth.user, auth.user.id) })}\n\n`);
    
        const conversations = listConversationsForUser(auth.user);
        conversations.forEach((c) => broadcastConversationPresence(c.id));
    
        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
          auth.user.lastSeenAt = new Date().toISOString();
          saveState();
          conversations.forEach((c) => broadcastConversationPresence(c.id));
        });
        return;
      }
    
      return sendJson(res, 404, { error: 'Not found' });
  }
}

module.exports = { handleApi };
