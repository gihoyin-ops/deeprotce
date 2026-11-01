export const deepchatQueryKeys = {
  chats: ['chats'] as const,
  archivedChats: ['archivedChats'] as const,
  sharedLinks: ['sharedLinks'] as const,
  profile: ['profile'] as const,
  recentFiles: ['recentFiles'] as const,
  chat: (id: string) => ['chat', id] as const
};
