export type Page =
  | 'landing'
  | 'login'
  | 'register'
  | 'guest-event'
  | 'photo-wall'
  | 'dashboard'
  | 'create-event'
  | 'admin';

export interface NavProps {
  navigate: (p: Page) => void;
  dark: boolean;
  toggleDark: () => void;
}

export const routes: Record<Page, string> = {
  landing: '/',
  login: '/login',
  register: '/register',
  'guest-event': '/event',
  'photo-wall': '/wall',
  dashboard: '/dashboard',
  'create-event': '/dashboard/create',
  admin: '/admin',
};
