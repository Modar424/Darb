import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { PageResult } from '../dto/pagination';

/** Uniform success envelope: `{ data }` or `{ data, meta }` for paginated collections. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof PageResult) return { data: result.items, meta: result.meta };
        return { data: result ?? null };
      }),
    );
  }
}
