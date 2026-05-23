const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push Notification',
  whatsapp: 'WhatsApp',
};

const EVENT_LABELS: Record<string, string> = {
  booking_update: 'Booking Updates',
  payment_due: 'Payment Due Reminders',
  site_visit_reminder: 'Site Visit Reminders',
  lead_assigned: 'Lead Assignments',
  document_ready: 'Document Ready',
  price_change: 'Price Change Alerts',
};

const CHANNEL_ICONS: Record<string, string> = {
  email: 'mail',
  sms: 'message-circle',
  push: 'bell',
  whatsapp: 'phone',
};

const EVENT_CATEGORIES: Record<string, string> = {
  booking_update: 'Transactions',
  payment_due: 'Transactions',
  site_visit_reminder: 'Scheduling',
  lead_assigned: 'Sales',
  document_ready: 'Documents',
  price_change: 'Market',
};

const PREMIUM_CHANNELS = new Set(['whatsapp']);

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event;
}

export function channelIcon(channel: string): string {
  return CHANNEL_ICONS[channel] ?? 'bell';
}

export function isChannelSupported(channel: string, userPlan: string): boolean {
  if (PREMIUM_CHANNELS.has(channel)) {
    return userPlan === 'premium' || userPlan === 'enterprise';
  }
  return true;
}

export function groupPreferencesByCategory<T extends { event: string }>(
  prefs: T[],
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const pref of prefs) {
    const category = EVENT_CATEGORIES[pref.event] ?? 'Other';
    if (!groups[category]) groups[category] = [];
    groups[category].push(pref);
  }
  return groups;
}
