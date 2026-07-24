import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' VND';
}

export function formatConfidencePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function formatSeamCode(code: string): string {
  if (!code) return code;
  return code.replace('<->', '↔');
}

export function ensureExternalUrl(url: string | null | undefined): { href: string; isLink: boolean } {
  if (!url || !url.trim()) return { href: '#', isLink: false };
  const trimmed = url.trim();

  // If already starts with http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    return { href: trimmed, isLink: true };
  }

  // If looks like a domain name (e.g. github.com/..., drive.google.com/...)
  if (/^([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
    return { href: `https://${trimmed}`, isLink: true };
  }

  // Plain text description — not a valid URL
  return { href: '#', isLink: false };
}
