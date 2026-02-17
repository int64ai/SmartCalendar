/** Chrome storage wrapper */

export interface StorageData {
  apiKey: string;
  model: string;
  theme: 'dark' | 'light' | 'system';
}

const DEFAULTS: StorageData = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  theme: 'dark',
};

export async function getStorage(): Promise<StorageData> {
  const result = await chrome.storage.local.get(DEFAULTS);
  return result as StorageData;
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.local.set(data);
}
