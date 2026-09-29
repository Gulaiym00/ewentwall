import type { Metadata } from 'next';
import AdminEvents from '@/components/pages/admin/events';

export const metadata: Metadata = { title: 'Events' };

export default function Page() {
  return <AdminEvents />;
}
