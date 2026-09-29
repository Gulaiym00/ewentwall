import { OrganizerProvider } from '@/hooks/useOrganizer';
import OrganizerShell from '@/layout/OrganizerShell';

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizerProvider>
      <OrganizerShell>{children}</OrganizerShell>
    </OrganizerProvider>
  );
}
