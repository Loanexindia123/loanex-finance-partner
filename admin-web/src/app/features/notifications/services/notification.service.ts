import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../core/config/api.config';
import { ApiEnvelope } from '../../../core/models/api.models';
import { unwrapApi } from '../../../core/rxjs/unwrap-api';
import { AppNotification, NotificationListResponse } from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

  list(): Observable<NotificationListResponse> {
    return this.http
      .get<ApiEnvelope<NotificationListResponse>>(apiUrl('/notifications'))
      .pipe(unwrapApi());
  }

  markRead(id: string): Observable<AppNotification> {
    return this.http
      .patch<ApiEnvelope<AppNotification>>(apiUrl(`/notifications/${id}/read`), {})
      .pipe(unwrapApi());
  }

  markAllRead(): Observable<{ updated: number }> {
    return this.http
      .patch<ApiEnvelope<{ updated: number }>>(apiUrl('/notifications/read-all'), {})
      .pipe(unwrapApi());
  }
}