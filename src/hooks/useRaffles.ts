import { useQuery } from '@tanstack/react-query';
import { raffleService, globalSettingsService, fazendinhaService, modalidadesService } from '../services/api';
import type { NumberModeId } from '../types';

function tenantCacheKey() {
  return typeof window === 'undefined' ? 'server' : window.location.host;
}

export function useRaffles() {
  return useQuery({
    queryKey: ['raffles', tenantCacheKey()],
    queryFn: () => raffleService.getRaffles(),
    staleTime: 1000 * 60 * 5, // 5 minutos de cache super rápido!
  });
}

export function useRaffleCatalog() {
  return useQuery({
    queryKey: ['raffle-catalog', tenantCacheKey()],
    queryFn: () => raffleService.getRaffleCatalog(),
    staleTime: 1000 * 60 * 5,
  });
}

export function useRaffle(id: string) {
  return useQuery({
    queryKey: ['raffle', tenantCacheKey(), id],
    queryFn: () => raffleService.getRaffleById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useGlobalSettings() {
  return useQuery({
    queryKey: ['settings', tenantCacheKey()],
    queryFn: () => globalSettingsService.getSettings(),
    staleTime: 1000 * 60 * 5, 
  });
}

export function useFazendinha() {
  return useQuery({
    queryKey: ['fazendinha', tenantCacheKey()],
    queryFn: () => fazendinhaService.getState(),
    staleTime: 1000 * 30,
  });
}

export function useFazendinhaHomeMedia() {
  return useQuery({
    queryKey: ['fazendinha-home-media', tenantCacheKey()],
    queryFn: () => fazendinhaService.getHomeMedia(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useFazendinhaMediaSettings() {
  return useQuery({
    queryKey: ['fazendinha-media-settings', tenantCacheKey()],
    queryFn: () => fazendinhaService.getMediaSettings(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useModalidades() {
  return useQuery({
    queryKey: ['modalidades', tenantCacheKey()],
    queryFn: () => modalidadesService.getLanding(),
    staleTime: 1000 * 30,
  });
}

export function useNumberMode(mode: NumberModeId, customerId?: string) {
  return useQuery({
    queryKey: ['number-mode', tenantCacheKey(), mode, customerId],
    queryFn: () => modalidadesService.getMode(mode, customerId),
    staleTime: 1000 * 20,
  });
}
