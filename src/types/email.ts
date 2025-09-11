export interface EmailThread {
  id: string;
  from: string;
  fromName: string;
  content: string;
  timestamp: Date;
  attachments?: string[];
}

export interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  important: boolean;
  labels: string[];
  attachments: number;
  thread: EmailThread[];
}

export interface EmailFolder {
  id: string;
  label: string;
  icon: any;
  count: number;
}

export interface EmailFilter {
  id: 'all' | 'unread' | 'read';
  label: string;
  icon: any;
}

export interface KeyboardShortcut {
  key: string;
  icon: any;
  description: string;
  color: string;
}

export interface KeyboardShortcutCategory {
  category: string;
  actions: KeyboardShortcut[];
}