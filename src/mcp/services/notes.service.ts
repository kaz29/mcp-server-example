import { Injectable } from '@nestjs/common';

@Injectable()
export class NotesService {
  // メモストレージ（インメモリ）
  private readonly notes = new Map<string, string>();

  /**
   * メモを保存
   */
  saveNote(key: string, value: string): void {
    this.notes.set(key, value);
  }

  /**
   * メモを取得
   */
  getNote(key: string): string | undefined {
    return this.notes.get(key);
  }

  /**
   * 全てのメモのキーを取得
   */
  listNoteKeys(): string[] {
    return Array.from(this.notes.keys());
  }

  /**
   * メモの存在確認
   */
  hasNote(key: string): boolean {
    return this.notes.has(key);
  }
}
