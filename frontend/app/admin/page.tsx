import type { Metadata } from 'next';
import AdminDashboard from '@/components/pages/admin/dashboard';

// title.template from layout.tsx does not apply to the page in the same segment
export const metadata: Metadata = { title: { absolute: 'Dashboard · Admin · EventWall' } };

export default function Page() {
  return <AdminDashboard />;
}
