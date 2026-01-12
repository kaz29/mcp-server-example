import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { NotesService } from '../services/notes.service';

@Injectable()
export class NotesTool {
  constructor(private readonly notesService: NotesService) {}

  @Tool({
    name: 'save_note',
    description: 'キーと値のペアでメモを保存します',
    parameters: z.object({
      key: z.string().describe('メモのキー'),
      value: z.string().describe('保存する内容'),
    }),
  })
  async saveNote({ key, value }: { key: string; value: string }) {
    this.notesService.saveNote(key, value);
    return `メモを保存しました: ${key}`;
  }

  @Tool({
    name: 'get_note',
    description: '保存されたメモを取得します',
    parameters: z.object({
      key: z.string().describe('取得するメモのキー'),
    }),
  })
  async getNote({ key }: { key: string }) {
    const value = this.notesService.getNote(key);
    if (value === undefined) {
      return `メモが見つかりません: ${key}`;
    }
    return `${key}: ${value}`;
  }

  @Tool({
    name: 'list_notes',
    description: '保存されているすべてのメモのキーを一覧表示します',
    parameters: z.object({}),
  })
  async listNotes() {
    const keys = this.notesService.listNoteKeys();
    if (keys.length === 0) {
      return '保存されているメモはありません';
    }
    return `保存されているメモのキー: ${keys.join(', ')}`;
  }
}
