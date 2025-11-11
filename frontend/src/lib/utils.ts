import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

export function isExamActive(startTime: string, endTime: string): boolean {
  const now = new Date();
  const start = parseISO(startTime);
  const end = parseISO(endTime);
  return isAfter(now, start) && isBefore(now, end);
}

export function isExamUpcoming(startTime: string): boolean {
  return isAfter(parseISO(startTime), new Date());
}

export function isExamPast(endTime: string): boolean {
  return isBefore(parseISO(endTime), new Date());
}

export function getGradeColor(grade?: string): string {
  if (!grade) return 'text-dark-500';

  const gradeColors: Record<string, string> = {
    'A+': 'text-success-600',
    'A': 'text-success-500',
    'B+': 'text-primary-600',
    'B': 'text-primary-500',
    'C': 'text-warning-500',
    'D': 'text-danger-500',
    'F': 'text-danger-600',
  };

  return gradeColors[grade] || 'text-dark-500';
}

export function getScoreColor(percentage: number): string {
  if (percentage >= 90) return 'text-success-600';
  if (percentage >= 75) return 'text-success-500';
  if (percentage >= 60) return 'text-primary-500';
  if (percentage >= 50) return 'text-warning-500';
  return 'text-danger-500';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'bg-success-100 text-success-700',
    medium: 'bg-warning-100 text-warning-700',
    high: 'bg-danger-100 text-danger-700',
    critical: 'bg-danger-600 text-white',
  };
  return colors[severity.toLowerCase()] || 'bg-dark-100 text-dark-700';
}

export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    'bg-primary-500',
    'bg-secondary-500',
    'bg-accent-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-danger-500',
  ];

  return colors[Math.abs(hash) % colors.length];
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
