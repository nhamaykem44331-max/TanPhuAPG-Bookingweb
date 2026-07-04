"use client";

import { useReportWebVitals } from 'next/web-vitals';

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const payload = {
      id: metric.id,
      name: metric.name,
      label: metric.label,
      value: metric.value,
      rating: 'rating' in metric ? metric.rating : undefined,
      startTime: metric.startTime,
      navigationType: 'navigationType' in metric ? metric.navigationType : undefined,
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      timestamp: Date.now(),
    };

    if (process.env.NODE_ENV !== 'production') {
      console.info('[web-vitals]', payload);
    }

    const configuredEndpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;
    const endpoint = configuredEndpoint === 'off'
      ? ''
      : configuredEndpoint || '/api/analytics/web-vitals';
    if (!endpoint || typeof window === 'undefined') return;

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }

    fetch(endpoint, {
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      method: 'POST',
    }).catch(() => {
      // Telemetry must never affect the booking flow.
    });
  });

  return null;
}
