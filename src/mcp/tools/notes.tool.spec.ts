import { describe, it, expect, beforeEach } from 'vitest';
import { NotesTool } from './notes.tool';
import { NotesService } from '../services/notes.service';

describe('NotesTool', () => {
  let tool: NotesTool;
  let notesService: NotesService;

  beforeEach(() => {
    notesService = new NotesService();
    tool = new NotesTool(notesService);
  });

  describe('saveNote', () => {
    it('should save note and return success message', async () => {
      const key = 'test-key';
      const value = 'test-value';

      const result = await tool.saveNote({ key, value });

      expect(result).toBe(`メモを保存しました: ${key}`);
      expect(notesService.getNote(key)).toBe(value);
    });

    it('should handle different key-value pairs', async () => {
      const key = 'another-key';
      const value = 'another-value';

      const result = await tool.saveNote({ key, value });

      expect(result).toBe(`メモを保存しました: ${key}`);
    });
  });

  describe('getNote', () => {
    it('should return note value when note exists', async () => {
      const key = 'existing-key';
      const value = 'existing-value';

      await tool.saveNote({ key, value });
      const result = await tool.getNote({ key });

      expect(result).toBe(`${key}: ${value}`);
    });

    it('should return not found message when note does not exist', async () => {
      const result = await tool.getNote({ key: 'non-existing-key' });

      expect(result).toBe('メモが見つかりません: non-existing-key');
    });

    it('should handle empty string value', async () => {
      const key = 'empty-key';
      const value = '';

      await tool.saveNote({ key, value });
      const result = await tool.getNote({ key });

      expect(result).toBe(`${key}: ${value}`);
    });
  });

  describe('listNotes', () => {
    it('should return list of note keys when notes exist', async () => {
      await tool.saveNote({ key: 'key1', value: 'value1' });
      await tool.saveNote({ key: 'key2', value: 'value2' });
      await tool.saveNote({ key: 'key3', value: 'value3' });

      const result = await tool.listNotes();

      expect(result).toBe('保存されているメモのキー: key1, key2, key3');
    });

    it('should return empty message when no notes exist', async () => {
      const result = await tool.listNotes();

      expect(result).toBe('保存されているメモはありません');
    });

    it('should handle single note', async () => {
      await tool.saveNote({ key: 'single-key', value: 'single-value' });

      const result = await tool.listNotes();

      expect(result).toBe('保存されているメモのキー: single-key');
    });
  });
});
