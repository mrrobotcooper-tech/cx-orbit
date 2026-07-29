import { create } from 'zustand';
import type { AnalyzeResult } from '../api/types';

interface UiState {
  conversationChannel: string;
  conversationStatus: string;
  analysisByConversation: Record<string, AnalyzeResult>;
  setConversationFilters: (channel: string, status: string) => void;
  setAnalysis: (conversationId: string, result: AnalyzeResult) => void;
}

export const useUiStore = create<UiState>((set) => ({
  conversationChannel: '',
  conversationStatus: '',
  analysisByConversation: {},
  setConversationFilters: (conversationChannel, conversationStatus) =>
    set({ conversationChannel, conversationStatus }),
  setAnalysis: (conversationId, result) =>
    set((state) => ({
      analysisByConversation: {
        ...state.analysisByConversation,
        [conversationId]: result,
      },
    })),
}));
