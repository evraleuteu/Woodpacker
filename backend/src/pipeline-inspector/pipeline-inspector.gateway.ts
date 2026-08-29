import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  roles?: string[];
}

@WebSocketGateway({
  namespace: '/pipeline-inspector',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class PipelineInspectorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger('PipelineInspectorGateway');
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Use the same fallback as JwtModule and guard — supports both docker ('dev-secret')
      // and local backend/.env ('dev-secret-change-in-production') during transition.
      const primarySecret = this.config.get('JWT_SECRET') || 'dev-secret';
      const fallbacks = [primarySecret, 'dev-secret', 'dev-secret-change-in-production'].filter(
        (v, i, a) => a.indexOf(v) === i,
      );
      let payload: any = null;
      let lastErr: unknown = null;
      for (const secret of fallbacks) {
        try {
          payload = this.jwtService.verify(token, { secret });
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!payload) throw lastErr ?? new Error('Invalid token');
      if (!payload || !['admin', 'developer', 'superadmin'].includes(payload.role)) {
        this.logger.warn(`Client ${client.id} has insufficient role: ${payload?.role}`);
        client.disconnect();
        return;
      }

      client.userId = payload.sub;
      client.roles = [payload.role];
      this.connectedClients.set(client.id, client);
      this.logger.log(`Client ${client.id} (${payload.sub}) connected to pipeline inspector`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Client ${client.id} failed authentication: ${msg}`);
      // Let the client know it was an auth failure so it can refresh the token.
      try {
        client.emit('connect_error', { message: msg });
      } catch {}
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected from pipeline inspector`);
  }

  @SubscribeMessage('subscribe:exercise')
  handleSubscribeExercise(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() exerciseId: string) {
    client.join(`exercise:${exerciseId}`);
    this.logger.log(`Client ${client.id} subscribed to exercise ${exerciseId}`);
    return { success: true, exerciseId };
  }

  @SubscribeMessage('unsubscribe:exercise')
  handleUnsubscribeExercise(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() exerciseId: string) {
    client.leave(`exercise:${exerciseId}`);
    this.logger.log(`Client ${client.id} unsubscribed from exercise ${exerciseId}`);
    return { success: true, exerciseId };
  }

  @SubscribeMessage('subscribe:pipeline-events')
  handleSubscribePipelineEvents(@ConnectedSocket() client: AuthenticatedSocket) {
    client.join('pipeline-events');
    this.logger.log(`Client ${client.id} subscribed to pipeline events`);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  // Methods to emit events from other services
  emitExerciseEvent(exerciseId: string, event: any) {
    this.server.to(`exercise:${exerciseId}`).emit('pipeline:event', {
      exerciseId,
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  emitPipelineEvent(event: any) {
    this.server.to('pipeline-events').emit('pipeline:event', {
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  emitStageUpdate(exerciseId: string, stage: string, status: string, data?: any) {
    this.server.to(`exercise:${exerciseId}`).emit('stage:update', {
      exerciseId,
      stage,
      status,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  emitError(exerciseId: string, error: any) {
    this.server.to(`exercise:${exerciseId}`).emit('pipeline:error', {
      exerciseId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}