import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeService {
  /**
   * 現在の日時を取得
   */
  getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  }
}
