import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ROBUX';
}
