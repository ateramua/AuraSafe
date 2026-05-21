export interface FileStat {
  size: number;
  modifiedAt: number;
  isDirectory: boolean;
}

export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  writeFile(path: string, contents: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;
  mkdir(path: string): Promise<void>;
  watch?(path: string, onChange: (event: 'change' | 'delete') => void): () => void;
}

export interface SecureStorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface NotificationProvider {
  show(title: string, body: string): Promise<void>;
}

export interface ClipboardProvider {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface PlatformProviders {
  filesystem: FileSystemProvider;
  secureStorage: SecureStorageProvider;
  notifications: NotificationProvider;
  clipboard: ClipboardProvider;
}
