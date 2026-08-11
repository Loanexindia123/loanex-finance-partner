import { map, OperatorFunction } from 'rxjs';
import { ApiEnvelope } from '../models/api.models';

/** Unwraps the `{ success, data }` envelope every LoanEx endpoint returns. */
export function unwrapApi<T>(): OperatorFunction<ApiEnvelope<T>, T> {
  return map((res) => {
    if (!res.success) {
      throw res;
    }
    return res.data;
  });
}
