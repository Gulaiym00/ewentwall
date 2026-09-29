import type { Metadata } from 'next';
import AdminReviews from '@/components/pages/admin/reviews';

export const metadata: Metadata = { title: 'Reviews' };

export default function Page() {
  return <AdminReviews />;
}
