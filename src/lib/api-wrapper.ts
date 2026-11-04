import { NextRequest, NextResponse } from 'next/server';
import { logger, recordSystemLog } from './logger';
import { ZodError } from 'zod';

export type ApiHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse<any>> | NextResponse<any>;

export function withApi(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest, context?: any) => {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const url = req.nextUrl?.pathname || req.url;
    const method = req.method;

    try {
      return await handler(req, context);
    } catch (err: any) {
      logger.error({ err, requestId, method, url }, `API Route Unhandled Error: ${method} ${url}`);

      // Record to SQLite system log for console diagnostics
      await recordSystemLog('error', 'app', `API ${method} ${url} failed: ${err.message || 'Internal Error'}`, {
        requestId,
        stack: err.stack,
        url,
        method
      }).catch(() => {});

      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input payload: ' + err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
              details: err.errors,
              requestId
            }
          },
          { status: 400 }
        );
      }

      const status = typeof err.status === 'number' && err.status >= 400 && err.status <= 599 ? err.status : 500;
      const message = err.message || 'Internal server error';
      const code = err.code || (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

      return NextResponse.json(
        {
          success: false,
          error: {
            code,
            message,
            requestId
          }
        },
        { status }
      );
    }
  };
}
