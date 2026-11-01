'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deepchatQueryKeys } from '@/lib/query-keys';

type ChatUpdatedDetail = {
  chatId?: string;
};

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false
      }
    }
  }));

  useEffect(() => {
    const handleChatUpdated = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as ChatUpdatedDetail | undefined : undefined;
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.recentFiles });
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.archivedChats });
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.sharedLinks });
      if (detail?.chatId) {
        void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chat(detail.chatId) });
      }
    };
    const handleProfileUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile });
    };
    window.addEventListener('chatUpdated', handleChatUpdated);
    window.addEventListener('profileUpdated', handleProfileUpdated);
    return () => {
      window.removeEventListener('chatUpdated', handleChatUpdated);
      window.removeEventListener('profileUpdated', handleProfileUpdated);
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
