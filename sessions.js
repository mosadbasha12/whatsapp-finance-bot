const SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map();

function createEmptySession() {
  return {
    state: 'MAIN_MENU',
    data: {},
    updatedAt: Date.now()
  };
}

function getSession(phone) {
  const current = sessions.get(phone);

  if (!current || Date.now() - current.updatedAt > SESSION_TTL_MS) {
    const fresh = createEmptySession();
    sessions.set(phone, fresh);
    return fresh;
  }

  current.updatedAt = Date.now();
  return current;
}

function updateSession(phone, patch) {
  const session = getSession(phone);
  const next = {
    ...session,
    ...patch,
    data: {
      ...session.data,
      ...(patch.data || {})
    },
    updatedAt: Date.now()
  };

  sessions.set(phone, next);
  return next;
}

function resetSession(phone) {
  const fresh = createEmptySession();
  sessions.set(phone, fresh);
  return fresh;
}

function cleanupExpiredSessions() {
  const now = Date.now();

  for (const [phone, session] of sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(phone);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 1000).unref();

module.exports = {
  SESSION_TTL_MS,
  getSession,
  updateSession,
  resetSession
};
