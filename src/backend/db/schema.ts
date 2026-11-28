// Turso / libSQL schema for Benthos.
// Covers accounts, OAuth identities, sessions, plan grants, usage windows,
// persistent guest rate limits, chats/messages/versions/attachments,
// personas, settings, encrypted connections, memories, and feedback.

export const TURSO_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    role TEXT NOT NULL DEFAULT 'user',
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT,
    banned_at TEXT,
    banned_by TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS oauth_identities (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(provider, provider_user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    ip_hash TEXT,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS plan_grants (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    plan TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_until TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS usage_windows (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    window_type TEXT NOT NULL,
    limit_tokens INTEGER NOT NULL,
    used_tokens INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL,
    window_end INTEGER NOT NULL,
    UNIQUE(account_id, window_type)
  )`,

  `CREATE TABLE IF NOT EXISTS guest_rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_personas (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT,
    system_prompt TEXT,
    extra_json TEXT,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_settings (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    general_json TEXT,
    appearance_json TEXT,
    tools_json TEXT,
    notifications_json TEXT,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_connections (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    encrypted_api_key TEXT NOT NULL,
    base_url TEXT,
    default_model TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    folder TEXT,
    tags_json TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    is_shared INTEGER NOT NULL DEFAULT 0,
    share_id TEXT UNIQUE,
    pending_attached_files_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    chat_index INTEGER NOT NULL,
    current_version_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS message_versions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    version_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    reasoning TEXT,
    reasoning_duration INTEGER,
    search_sources_json TEXT,
    generation_mode TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    ext TEXT,
    size_bytes INTEGER,
    storage_key TEXT NOT NULL,
    public_url TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS saved_memories (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    source_chat_id TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    importance TEXT,
    vector_json TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS message_feedback (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS email_otps (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    next_resend_at INTEGER NOT NULL DEFAULT 0,
    consumed_at INTEGER,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_daily_tokens (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    requests INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (account_id, day)
  )`,

  `CREATE TABLE IF NOT EXISTS user_model_usage (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    requests INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT NOT NULL,
    PRIMARY KEY (account_id, model_id)
  )`,

  `CREATE TABLE IF NOT EXISTS user_profile_settings (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    is_public INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS library_folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS library_items (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES library_folders(id) ON DELETE SET NULL,
    r2_key TEXT NOT NULL,
    url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/webp',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'upload',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    trashed_at INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_account_id TEXT,
    target_email TEXT,
    reason TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS chat_workspaces (
    chat_id TEXT PRIMARY KEY REFERENCES chats(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Workspace',
    active_file_path TEXT,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS workspace_files (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chat_workspaces(chat_id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    kind TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    content_text TEXT,
    r2_key TEXT,
    public_url TEXT,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(chat_id, path)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_account_updated ON chats(account_id, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_chat_idx ON messages(chat_id, chat_index)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_account ON saved_memories(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON email_otps(email, purpose, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_library_folders_account ON library_folders(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_library_items_account ON library_items(account_id, trashed_at, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_files_chat ON workspace_files(chat_id, updated_at)`
];
