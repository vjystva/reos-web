/** @jest-environment jsdom */
import {
  channelLabel,
  eventLabel,
  channelIcon,
  isChannelSupported,
  groupPreferencesByCategory,
} from '../../utils/notificationSettings';

describe('channelLabel', () => {
  it('returns labels for all channels', () => {
    expect(channelLabel('email')).toBe('Email');
    expect(channelLabel('sms')).toBe('SMS');
    expect(channelLabel('push')).toBe('Push Notification');
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
  });

  it('returns raw string for unknown', () => {
    expect(channelLabel('telegram')).toBe('telegram');
    expect(channelLabel('')).toBe('');
  });
});

describe('eventLabel', () => {
  it('returns labels for all events', () => {
    expect(eventLabel('booking_update')).toBe('Booking Updates');
    expect(eventLabel('payment_due')).toBe('Payment Due Reminders');
    expect(eventLabel('site_visit_reminder')).toBe('Site Visit Reminders');
    expect(eventLabel('lead_assigned')).toBe('Lead Assignments');
    expect(eventLabel('document_ready')).toBe('Document Ready');
    expect(eventLabel('price_change')).toBe('Price Change Alerts');
  });

  it('returns raw string for unknown event', () => {
    expect(eventLabel('unknown_event')).toBe('unknown_event');
  });
});

describe('channelIcon', () => {
  it('returns icon strings for known channels', () => {
    expect(typeof channelIcon('email')).toBe('string');
    expect(channelIcon('email').length).toBeGreaterThan(0);
    expect(channelIcon('push')).toBe('bell');
    expect(channelIcon('sms')).toBe('message-circle');
  });

  it('returns "bell" as fallback for unknown', () => {
    expect(channelIcon('unknown')).toBe('bell');
  });
});

describe('isChannelSupported', () => {
  it('whatsapp requires premium or enterprise', () => {
    expect(isChannelSupported('whatsapp', 'basic')).toBe(false);
    expect(isChannelSupported('whatsapp', 'premium')).toBe(true);
    expect(isChannelSupported('whatsapp', 'enterprise')).toBe(true);
  });

  it('standard channels are supported on all plans', () => {
    for (const channel of ['email', 'sms', 'push']) {
      expect(isChannelSupported(channel, 'basic')).toBe(true);
      expect(isChannelSupported(channel, 'premium')).toBe(true);
    }
  });

  it('unknown channels are supported', () => {
    expect(isChannelSupported('custom_channel', 'basic')).toBe(true);
  });
});

describe('groupPreferencesByCategory', () => {
  const prefs = [
    { event: 'booking_update', enabled: true },
    { event: 'payment_due', enabled: true },
    { event: 'site_visit_reminder', enabled: false },
    { event: 'lead_assigned', enabled: true },
    { event: 'document_ready', enabled: true },
    { event: 'price_change', enabled: false },
  ];

  it('groups transaction events together', () => {
    const groups = groupPreferencesByCategory(prefs);
    expect(groups['Transactions']).toHaveLength(2);
  });

  it('groups scheduling events', () => {
    const groups = groupPreferencesByCategory(prefs);
    expect(groups['Scheduling']).toHaveLength(1);
  });

  it('returns "Other" for unknown events', () => {
    const groups = groupPreferencesByCategory([{ event: 'custom_event', enabled: true }]);
    expect(groups['Other']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(groupPreferencesByCategory([])).toEqual({});
  });
});
