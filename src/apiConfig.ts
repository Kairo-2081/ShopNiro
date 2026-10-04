/// <reference types="vite/client" />

const envUrl = (import.meta as any).env?.VITE_API_URL;
export const API_BASE_URL = (envUrl || 'https://shopniro.onrender.com').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}