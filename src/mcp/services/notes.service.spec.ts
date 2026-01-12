import { describe, it, expect, beforeEach } from 'vitest';
import { NotesService } from './notes.service';

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(() => {
    service = new NotesService();
  });

  describe('saveNote', () => {
    it('should save a note with key and value', () => {
      service.saveNote('test-key', 'test-value');

      expect(service.getNote('test-key')).toBe('test-value');
    });

    it('should overwrite existing note with same key', () => {
      service.saveNote('key1', 'value1');
      service.saveNote('key1', 'value2');

      expect(service.getNote('key1')).toBe('value2');
    });

    it('should save multiple notes', () => {
      service.saveNote('key1', 'value1');
      service.saveNote('key2', 'value2');
      service.saveNote('key3', 'value3');

      expect(service.getNote('key1')).toBe('value1');
      expect(service.getNote('key2')).toBe('value2');
      expect(service.getNote('key3')).toBe('value3');
    });
  });

  describe('getNote', () => {
    it('should return note value for existing key', () => {
      service.saveNote('existing-key', 'existing-value');

      const result = service.getNote('existing-key');

      expect(result).toBe('existing-value');
    });

    it('should return undefined for non-existing key', () => {
      const result = service.getNote('non-existing-key');

      expect(result).toBeUndefined();
    });
  });

  describe('listNoteKeys', () => {
    it('should return empty array when no notes exist', () => {
      const keys = service.listNoteKeys();

      expect(keys).toEqual([]);
    });

    it('should return all note keys', () => {
      service.saveNote('key1', 'value1');
      service.saveNote('key2', 'value2');
      service.saveNote('key3', 'value3');

      const keys = service.listNoteKeys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should not include duplicate keys', () => {
      service.saveNote('key1', 'value1');
      service.saveNote('key1', 'value2'); // 上書き

      const keys = service.listNoteKeys();

      expect(keys).toHaveLength(1);
      expect(keys).toContain('key1');
    });
  });

  describe('hasNote', () => {
    it('should return true for existing note', () => {
      service.saveNote('existing-key', 'value');

      expect(service.hasNote('existing-key')).toBe(true);
    });

    it('should return false for non-existing note', () => {
      expect(service.hasNote('non-existing-key')).toBe(false);
    });

    it('should return true after saving a note', () => {
      expect(service.hasNote('new-key')).toBe(false);

      service.saveNote('new-key', 'new-value');

      expect(service.hasNote('new-key')).toBe(true);
    });
  });
});
