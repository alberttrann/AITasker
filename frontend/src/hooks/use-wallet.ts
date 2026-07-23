import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client';
import { useAuthStore } from '@store/auth.store';
import type { WalletDto, WalletTransactionDto } from '@t/api.types';

/**
 * Wallet data hooks — used by WalletCard, VietQRPanel, withdrawal screens.
 */

export function useWallet() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['wallet'],
    queryFn:  async () => {
      const { data } = await apiClient.get<WalletDto>('/wallets/me');
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useWalletTransactions(limit = 20) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['wallet', 'transactions', limit],
    queryFn:  async () => {
      const { data } = await apiClient.get<WalletTransactionDto[]>(
        '/wallets/me/transactions',
        { params: { limit } }
      );
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useSubscriptionStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['subscription'],
    queryFn:  async () => {
      const { data } = await apiClient.get<{
        client_tier:    string;
        expert_tier:    string;
        client_expires: string | null;
        expert_expires: string | null;
      }>('/subscriptions/status');
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useTopUpWallet() {
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data } = await apiClient.post<{
        qrCodeUrl: string;
        paymentReference: string;
      }>('/wallets/virtual-accounts/topup', { amount });
      return data;
    },
  });
}

/**
 * Fetches the current user profile for bank-linked status checks.
 */
export function useUserProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn:  async () => {
      const { data } = await apiClient.get<import('@t/api.types').UserDto>('/users/me');
      return data;
    },
    enabled: isAuthenticated,
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { amount: number; bank_account_xid: string }) => {
      const { data } = await apiClient.post<import('@t/api.types').WithdrawalRequestDto>(
        '/withdrawals',
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
  });
}

export function useCancelWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<{ cancelled: boolean; refundedAmount: number }>(`/withdrawals/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] });
    }
  })
}

export function useWithdrawalHistory() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['withdrawals'],
    queryFn: async () => {
      const { data } = await apiClient.get<import('@t/api.types').WithdrawalRequestDto[]>(
        '/withdrawals'
      );
      return data;
    },
    enabled: isAuthenticated,
  });
}

export interface BankLinkPayload {
  bank_account_xid: string;
  holder_name: string;
}

export interface BankLinkStatusDto {
  isLinked: boolean;
  bankAccountXid: string | null;
  holderName: string | null;
  linkedAt: string | null;
}

/**
 * Current bank-link status, backed by GET /bank-hub/link. Lets BankHubLink.tsx
 * render "already linked" vs "not yet linked" without piggybacking on the
 * full user-profile payload.
 */
export function useBankLinkStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['bank-link'],
    queryFn: async () => {
      const { data } = await apiClient.get<BankLinkStatusDto>('/bank-hub/link');
      return data;
    },
    enabled: isAuthenticated,
  });
}

/**
 * First-time bank link. Backend rejects with 409 if a link already exists —
 * use useUpdateBankLink() in that case instead.
 */
export function useInitiateBankLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BankLinkPayload) => {
      const { data } = await apiClient.post('/bank-hub/initiate-link', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['bank-link'] });
    },
  });
}

/**
 * Correct/change an already-linked bank account. Backend rejects
 * with 409 if no link exists yet — use useInitiateBankLink() in that case.
 */
export function useUpdateBankLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BankLinkPayload) => {
      const { data } = await apiClient.put('/bank-hub/link', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['bank-link'] });
    },
  });
}



