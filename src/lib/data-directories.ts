import fs from 'fs';
import fsp from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

export const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  process.env.NEXT_RUNTIME === 'edge'
);

export const DATA_DIR = isServerless
  ? path.join(tmpdir(), 'deepchat-data')
  : path.join(process.cwd(), 'data');
export const CHAT_DIR = path.join(DATA_DIR, 'chat');
export const SHARE_DIR = path.join(CHAT_DIR, 'sharechat');
export const LLM_DIR = path.join(DATA_DIR, 'llm');
export const LLM_API_DIR = path.join(LLM_DIR, 'api');
export const TEMP_DIR = path.join(DATA_DIR, 'temp');
export const TEMP_FILE_DIR = path.join(TEMP_DIR, 'file');
export const USER_DIR = path.join(DATA_DIR, 'user');
export const MEMORY_DIR = path.join(USER_DIR, 'memories');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const DATA_DIRECTORIES = [
  DATA_DIR,
  CHAT_DIR,
  SHARE_DIR,
  LLM_DIR,
  LLM_API_DIR,
  TEMP_DIR,
  TEMP_FILE_DIR,
  USER_DIR,
  MEMORY_DIR,
  BACKUP_DIR
];

export const ensureDataDirectoriesSync = () => {
  for (const directory of DATA_DIRECTORIES) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

export const ensureDataDirectories = async () => {
  await Promise.all(DATA_DIRECTORIES.map(directory => fsp.mkdir(directory, { recursive: true })));
};
