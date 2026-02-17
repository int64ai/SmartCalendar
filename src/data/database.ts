/** Dexie (IndexedDB) database definition */

import Dexie, { type Table } from 'dexie';
import type { Event, UndoLog } from '../shared/types';

export class CalendarDB extends Dexie {
  events!: Table<Event, string>;
  undoLogs!: Table<UndoLog, string>;

  constructor() {
    super('SmartCalendarDB');
    this.version(1).stores({
      events: 'id, start, end, category, *tags',
      undoLogs: 'undoId, changeSetId, createdAt',
    });
  }
}

export const db = new CalendarDB();
