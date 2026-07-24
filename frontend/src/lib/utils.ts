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

/**
 * Chuẩn hóa các link thông báo từ Backend/Socket thành URL chính xác theo App.tsx
 * Giải quyết triệt để 5 kịch bản Test (bao gồm việc Backend gửi link có hoặc không có prefix role)
 */
export function resolveNotificationLink(
  rawLink: string | undefined | null,
  activeRole: string,
  clientSubtype?: string | null
): string {
  if (!rawLink) return '/';

  let link = rawLink.trim();
  const isExpert = activeRole === 'EXPERT';
  const isCeo = activeRole === 'CLIENT' && clientSubtype === 'CEO';
  const isTechTeam = activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM';

  // SCENARIO 2: Sửa lỗi sai Route dự án của Expert (/expert/projects -> /expert/service/projects)
  if (link.startsWith('/expert/projects') || link.includes('/expert/invitations')) {
    return '/expert/service/projects';
  }

  // Dùng Regex để bắt mọi định dạng: /engagements/:id, /expert/engagements/:id/bid, /ceo/engagements/:id/milestones...
  const engagementMatch = link.match(/\/engagements\/([^/]+)(?:\/(.*))?/);
  
  if (engagementMatch) {
    const engagementId = engagementMatch[1];
    const subPath = engagementMatch[2] || ''; // 'milestones', 'bid', 'review', 'milestones/xxx', v.v.

    if (isExpert) {
      // SCENARIO 3 & 5: Expert click thông báo hợp đồng, milestone, dispute, bid -> Tất cả gom về Inbox
      if (!subPath || subPath.startsWith('milestones') || subPath.startsWith('bid') || subPath.startsWith('nda') || subPath.startsWith('dispute')) {
        return `/expert/inbox/${engagementId}`;
      }
      return `/expert/engagements/${engagementId}/${subPath}`;
    }

    if (isCeo) {
      // SCENARIO 4: CEO click thông báo Bid -> Đưa vào Inbox để thương lượng
      if (subPath.startsWith('bid')) {
        return `/ceo/inbox/${engagementId}`;
      }
      // CEO click thông báo Milestone -> Đưa vào Workspace làm việc
      if (!subPath || subPath.startsWith('milestones')) {
        return `/ceo/engagements/${engagementId}/milestones`; 
      }
      return `/ceo/engagements/${engagementId}/${subPath}`;
    }

    if (isTechTeam) {
      return `/tech-team/engagements/${engagementId}/milestones`;
    }
  }

  // SCENARIO 1: Các link hợp lệ sẵn (vd: /expert/inbox/:id) sẽ lọt qua đây và được giữ nguyên
  return link;
}