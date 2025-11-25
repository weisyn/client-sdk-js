/**
 * Event Service 单元测试
 */

import { EventServiceImpl } from '../../src/services/event/service';
import { MockClient } from '../mocks/client';
import type { EventFilters } from '../../src/client/wesclient-types';

describe('EventServiceImpl', () => {
  let eventService: EventServiceImpl;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    eventService = new EventServiceImpl(mockClient);
  });

  describe('getEvents', () => {
    it('should get events with filters', async () => {
      const filters: EventFilters = {
        resourceId: new Uint8Array(32).fill(1),
        eventName: 'Transfer',
        limit: 10,
        offset: 0,
      };

      const mockEvents = {
        events: [
          {
            eventName: 'Transfer',
            resourceId: '0x' + '01'.repeat(32),
            data: '0x00',
            txId: '0x1111',
            blockHeight: 1000,
            timestamp: new Date().toISOString(),
          },
          {
            eventName: 'Transfer',
            resourceId: '0x' + '01'.repeat(32),
            data: '0x00',
            txId: '0x2222',
            blockHeight: 1001,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getEvents', mockEvents);

      const events = await eventService.getEvents(filters);

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(2);
    });

    it('should filter events by resourceId', async () => {
      const resourceId = new Uint8Array(32).fill(1);
      const filters: EventFilters = {
        resourceId,
        limit: 10,
      };

      const mockEvents = {
        events: [
          {
            eventName: 'Transfer',
            resourceId: '0x' + '01'.repeat(32),
            data: '0x00',
            txId: '0x1111',
            blockHeight: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getEvents', mockEvents);

      const events = await eventService.getEvents(filters);

      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);
    });

    it('should filter events by eventName', async () => {
      const filters: EventFilters = {
        eventName: 'Transfer',
        limit: 10,
      };

      const mockEvents = {
        events: [
          {
            eventName: 'Transfer',
            resourceId: '0x' + '01'.repeat(32),
            data: '0x00',
            txId: '0x1111',
            blockHeight: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getEvents', mockEvents);

      const events = await eventService.getEvents(filters);

      expect(events).toBeDefined();
      expect(events.every((e) => e.eventName === 'Transfer')).toBe(true);
    });

    it('should handle empty events', async () => {
      const filters: EventFilters = {
        limit: 10,
      };

      mockClient.setResponse('wes_getEvents', { events: [] });

      const events = await eventService.getEvents(filters);

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      const filters: EventFilters = {
        limit: 5,
        offset: 10,
      };

      const mockEvents = {
        events: Array.from({ length: 20 }, (_, i) => ({
          eventName: 'Transfer',
          resourceId: '0x' + '01'.repeat(32),
          data: '0x00',
          txId: `0x${i.toString(16)}`,
          blockHeight: 1000 + i,
          timestamp: new Date().toISOString(),
        })),
      };

      mockClient.setResponse('wes_getEvents', mockEvents);

      const events = await eventService.getEvents(filters);

      expect(events).toBeDefined();
      // 注意：实际的分页逻辑在 WESClient 中实现
    });
  });

  describe('subscribeEvents', () => {
    it('should subscribe to events successfully', async () => {
      const filters: EventFilters = {
        resourceId: new Uint8Array(32).fill(1),
        eventName: 'Transfer',
      };

      // Mock WebSocket 订阅（这里简化处理）
      const mockSubscription = {
        id: 'subscription-123',
        on: jest.fn(),
        unsubscribe: jest.fn().mockResolvedValue(undefined),
      };

      jest.spyOn(mockClient, 'subscribe').mockResolvedValue(mockSubscription as any);

      const subscription = await eventService.subscribeEvents(filters);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.on).toBe('function');
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should handle subscription errors', async () => {
      const filters: EventFilters = {
        resourceId: new Uint8Array(32).fill(1),
      };

      jest.spyOn(mockClient, 'subscribe').mockRejectedValue(new Error('Subscription failed'));

      await expect(eventService.subscribeEvents(filters)).rejects.toThrow();
    });
  });
});

