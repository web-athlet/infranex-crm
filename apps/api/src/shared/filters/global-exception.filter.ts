import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { DomainError } from '../errors/domain.error';

type ErrorResponseBody = {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
};

type HttpResponse = {
  status: (statusCode: number) => {
    json: (body: ErrorResponseBody) => void;
  };
};

type RequestWithId = {
  requestId?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();
    const request = context.getRequest<RequestWithId>();
    const requestId = request.requestId ?? 'unknown';
    const { statusCode, body } = this.toErrorResponse(exception, requestId);

    response.status(statusCode).json(body);
  }

  private toErrorResponse(exception: unknown, requestId: string) {
    if (exception instanceof DomainError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        body: {
          code: exception.code,
          message: exception.message,
          requestId,
          details: exception.details,
        },
      };
    }

    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        body: {
          code: 'HTTP_ERROR',
          message: exception.message,
          requestId,
        },
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        requestId,
      },
    };
  }
}
