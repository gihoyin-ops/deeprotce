'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { OPEN_AUTH_MODAL_EVENT } from '@/lib/auth/auth-url';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/auth/guest';
import { CentralAuthModal } from '@/components/ui/CentralAuthModal';

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

  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenAuthModal = () => setAuthModalOpen(true);
    window.addEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenAuthModal);
    return () => window.removeEventListener(OPEN_AUTH_MODAL_EVENT, handleOpenAuthModal);
  }, []);

  const handleAuthSuccess = () => {
    try {
      localStorage.setItem('deepchat-auth-hint', '1');
      window.dispatchEvent(new Event('deepchat:auth-hint'));
    } catch {}
    void queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile });
    void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.chats });
    void queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.recentFiles });
    window.dispatchEvent(new Event('profileUpdated'));
    window.dispatchEvent(new Event('chatUpdated'));
  };

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <CentralAuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </QueryClientProvider>
  );
}
