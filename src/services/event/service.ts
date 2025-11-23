/**
 * Event 服务实现
 * 
 * **架构说明**：
 * - Event Service 为 Workbench Explorer 场景提供事件查询和订阅功能
 * - 基于 WESClient 类型化 API 实现
 */

import { IClient } from '../../client/client';
import { WESClientImpl } from '../../client/wesclient';
import type { WESClient } from '../../client/wesclient';
import type {
  EventInfo,
  EventFilters,
  EventSubscription,
} from '../../client/wesclient-types';

/**
 * EventService 事件服务接口
 */
export interface EventService {
  // 查询
  getEvents(filters: EventFilters): Promise<EventInfo[]>;
  
  // 订阅
  subscribeEvents(filters: EventFilters): Promise<EventSubscription>;
}

/**
 * EventServiceImpl EventService 实现
 */
export class EventServiceImpl implements EventService {
  private wesClient?: WESClient;

  constructor(private client: IClient) {}

  /**
   * 获取 WESClient（延迟初始化）
   */
  private getWESClient(): WESClient {
    if (!this.wesClient) {
      this.wesClient = new WESClientImpl(this.client);
    }
    return this.wesClient;
  }

  /**
   * 获取事件列表
   */
  async getEvents(filters: EventFilters): Promise<EventInfo[]> {
    const wesClient = this.getWESClient();
    return await wesClient.getEvents(filters);
  }

  /**
   * 订阅事件
   */
  async subscribeEvents(filters: EventFilters): Promise<EventSubscription> {
    const wesClient = this.getWESClient();
    return await wesClient.subscribeEvents(filters);
  }
}

