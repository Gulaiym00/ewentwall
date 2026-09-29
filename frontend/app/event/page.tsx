import { redirect } from 'next/navigation';

// Guest pages live at /e/{slug} (the QR link). This old path opens the demo event, if one is configured.
export default function Page() {
  const demo = process.env.NEXT_PUBLIC_DEMO_EVENT_SLUG;
  redirect(demo ? `/e/${demo}` : '/');
}
