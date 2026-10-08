'use client';

import { useEffect } from 'react';
import { API_URL } from '@/api/session';

/**
 * Pings the API once when the site opens. Render's free server sleeps after 15 minutes without
 * requests and takes about a minute to wake up; this starts waking it while the visitor reads the page.
 */
export function WakeApi() {
  useEffect(() => {
    fetch(`${API_URL}/health`, { cache: 'no-store' }).catch(() => { /* asleep or offline: the real requests will show it */ });
  }, []);
  return null;
}
