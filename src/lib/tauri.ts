import { invoke } from "@tauri-apps/api/core";

export interface ZshrcFile {
  path: string;
  content: string;
  exists: boolean;
}

export interface BackupInfo {
  name: string;
  path: string;
  epoch_secs: number;
  size: number;
}

export interface WriteOutcome {
  path: string;
  backup: BackupInfo | null;
  bytes: number;
}

export interface ZshValidation {
  ok: boolean;
  message: string;
}

export const api = {
  readZshrc: () => invoke<ZshrcFile>("read_zshrc"),
  writeZshrc: (content: string) => invoke<WriteOutcome>("write_zshrc", { content }),
  listBackups: () => invoke<BackupInfo[]>("list_backups"),
  readBackup: (name: string) => invoke<string>("read_backup", { name }),
  restoreBackup: (name: string) => invoke<WriteOutcome>("restore_backup", { name }),
  deleteBackup: (name: string) => invoke<void>("delete_backup", { name }),
  revealBackups: () => invoke<string>("reveal_backups"),
  validateZsh: (content: string) => invoke<ZshValidation>("validate_zsh", { content }),
  openInZed: (path: string) => invoke<void>("open_in_zed", { path }),
  revealInFinder: (path: string) => invoke<void>("reveal_in_finder", { path }),
};
