'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Product } from '@/types';

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await api.get('/api/products');
      return data;
    },
  });
}

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: ['products', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/products/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const { data } = await api.post('/api/products', { url });
      return data as Product;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/products/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useAddCompetitor(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (url: string) => {
      const { data } = await api.post(`/api/products/${productId}/competitors`, { url });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', productId] }),
  });
}

export function useDeleteCompetitor(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (competitorId: string) => {
      await api.delete(`/api/competitors/${competitorId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', productId] }),
  });
}

export function usePriceHistory(productId: string, days = 30) {
  return useQuery({
    queryKey: ['priceHistory', productId, days],
    queryFn: async () => {
      const { data } = await api.get(`/api/products/${productId}/price-history?days=${days}`);
      return data;
    },
    enabled: !!productId,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const { data } = await api.get('/api/dashboard/summary');
      return data;
    },
  });
}
