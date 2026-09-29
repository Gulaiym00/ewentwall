'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { routes, type NavProps } from '@/utils/routes';

export function useNav(): NavProps {
  const router = useRouter();
  const { dark, toggleDark } = useTheme();
  return {
    navigate: (p) => {
      router.push(routes[p]);
      window.scrollTo(0, 0);
    },
    dark,
    toggleDark,
  };
}
