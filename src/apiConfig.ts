/// <reference types="vite/client" />
import { Capacitor } from '@capacitor/core';

const environment = (import.meta as any).env || {};
const browserApiUrl = environment.VITE_API_URL;
const nativeApiUrl = environment.VITE_CAPACITOR_API_URL;
const configuredApiUrl = Capacitor.isNativePlatform()
  ? nativeApiUrl || 'https://shopniro.onrender.com'
  : browserApiUrl || 'https://shopniro.onrender.com';

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}