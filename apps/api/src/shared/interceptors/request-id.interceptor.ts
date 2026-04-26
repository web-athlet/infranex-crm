import { randomUUID } from 'node:crypto';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

type RequestWithId = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseWithHeader = {
  setHeader: (name: string, value: string) => void;
};

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<ResponseWithHeader>();
    const incoming = request.headers['x-request-id'];
    const requestId = Array.isArray(incoming) ? incoming[0] : incoming;

    request.requestId = requestId || randomUUID();
    response.setHeader('x-request-id', request.requestId);

    return next.handle();
  }
}
