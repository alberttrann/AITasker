import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(redisUrl: string): Promise<void> {
    const isTls = redisUrl.startsWith('rediss://');
    const socketOptions = isTls ? { tls: true, rejectUnauthorized: false } : {};

    const pubClient = createClient({
      url: redisUrl,
      socket: socketOptions,
    });
    const subClient = pubClient.duplicate();

    // Attach error listeners to catch connection drops and prevent unhandled exceptions from crashing the process
    pubClient.on('error', (err) => {
      this.logger.error('Redis Publisher Client Error:', err);
    });

    subClient.on('error', (err) => {
      this.logger.error('Redis Subscriber Client Error:', err);
    });

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log(
      `Successfully connected to Redis at ${redisUrl.replace(/:[^:]*@/, '@')} for WebSocket scaling`,
    );
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
