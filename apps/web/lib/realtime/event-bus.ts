import { EventEmitter } from "node:events";

import { createClient, type RedisClientType } from "redis";
import type { RealtimeChannel, RealtimeEvent } from "@rag/types";

import { env } from "@/lib/env";

type RealtimeHandler = (event: RealtimeEvent) => void | Promise<void>;

export interface RealtimeEventBus {
  publish<TPayload>(event: RealtimeEvent<TPayload>): Promise<void>;
  subscribe(channel: RealtimeChannel, handler: RealtimeHandler): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(500);

export class InMemoryRealtimeEventBus implements RealtimeEventBus {
  async publish<TPayload>(event: RealtimeEvent<TPayload>) {
    emitter.emit(event.channel, event);
  }

  async subscribe(channel: RealtimeChannel, handler: RealtimeHandler) {
    emitter.on(channel, handler);

    return async () => {
      emitter.off(channel, handler);
    };
  }

  async close() {
    emitter.removeAllListeners();
  }
}

export class RedisRealtimeEventBus implements RealtimeEventBus {
  private publisher?: RedisClientType;
  private subscriber?: RedisClientType;

  constructor(private readonly redisUrl: string) {}

  private async getPublisher() {
    this.publisher ??= createClient({ url: this.redisUrl });

    if (!this.publisher.isOpen) {
      await this.publisher.connect();
    }

    return this.publisher;
  }

  private async getSubscriber() {
    this.subscriber ??= createClient({ url: this.redisUrl });

    if (!this.subscriber.isOpen) {
      await this.subscriber.connect();
    }

    return this.subscriber;
  }

  async publish<TPayload>(event: RealtimeEvent<TPayload>) {
    const publisher = await this.getPublisher();
    await publisher.publish(event.channel, JSON.stringify(event));
  }

  async subscribe(channel: RealtimeChannel, handler: RealtimeHandler) {
    const subscriber = await this.getSubscriber();
    const listener = (message: string) => {
      void handler(JSON.parse(message) as RealtimeEvent);
    };

    await subscriber.subscribe(channel, listener);

    return async () => {
      await subscriber.unsubscribe(channel, listener);
    };
  }

  async close() {
    await Promise.all([this.publisher?.quit(), this.subscriber?.quit()]);
    this.publisher = undefined;
    this.subscriber = undefined;
  }
}

let eventBus: RealtimeEventBus | undefined;

export function getRealtimeEventBus() {
  eventBus ??= env.REDIS_URL
    ? new RedisRealtimeEventBus(env.REDIS_URL)
    : new InMemoryRealtimeEventBus();

  return eventBus;
}

export function createRealtimeEvent<TPayload>(
  input: Omit<RealtimeEvent<TPayload>, "id" | "createdAt">,
): RealtimeEvent<TPayload> {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}
