import { redirect } from 'next/navigation';

// The live wall lives at /e/{slug}/wall. This old path opens the demo event's wall, if one is configured.
export default function Page() {
  const demo = process.env.NEXT_PUBLIC_DEMO_EVENT_SLUG;
  redirect(demo ? `/e/${demo}/wall` : '/');
}
