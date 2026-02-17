/** Message protocol between Side Panel and Service Worker */

// Side Panel -> Service Worker
export type PanelToSWMessage =
  | { type: 'CHAT_REQUEST'; payload: { message: string; calendarContext?: { viewing_date: string; view_type: string } } }
  | { type: 'CHAT_CANCEL' }
  | { type: 'CHAT_CLEAR' }
  | { type: 'SETTINGS_UPDATE'; payload: { apiKey?: string; model?: string; theme?: string } }
  | { type: 'GET_SETTINGS' };

// Service Worker -> Side Panel
export type SWToPanelMessage =
  | { type: 'STREAM_START' }
  | { type: 'STREAM_CHUNK'; payload: { content: string } }
  | { type: 'STREAM_TOOL'; payload: { name: string } }
  | { type: 'STREAM_DONE'; payload: { fullText: string } }
  | { type: 'STREAM_ERROR'; payload: { error: string } }
  | { type: 'SETTINGS_DATA'; payload: { apiKey: string; model: string; theme: string } };
