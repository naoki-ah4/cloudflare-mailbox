/**
 * バックアップシステム
 * KVデータの圧縮バックアップとR2保存・復旧機能
 */

import { compressObject, decompressObject } from "./compression";
import { logger } from "./logger";

export interface BackupMetadata {
  timestamp: number;
  version: string;
  kvStores: string[];
  totalSize: number;
  compressedSize: number;
  backupType: 'daily' | 'weekly' | 'monthly' | 'manual';
}

export interface BackupData {
  metadata: BackupMetadata;
  users: Record<string, unknown>;
  messages: Record<string, unknown>;
  mailboxes: Record<string, unknown>;
  system: Record<string, unknown>;
}

/**
 * 全KVストアのデータをバックアップ
 */
export const createFullBackup = async (env: Env, backupType: BackupMetadata['backupType'] = 'manual'): Promise<string> => {
  const startTime = Date.now();
  
  try {
    logger.info("フルバックアップ開始", { backupType });
    
    // 各KVストアからデータを取得
    const [usersData, messagesData, mailboxesData, systemData] = await Promise.all([
      exportKVData(env.USERS_KV, 'users'),
      exportKVData(env.MESSAGES_KV, 'messages'),
      exportKVData(env.MAILBOXES_KV, 'mailboxes'),
      exportKVData(env.SYSTEM_KV, 'system')
    ]);
    
    // バックアップデータを構築
    const backupData: BackupData = {
      metadata: {
        timestamp: Date.now(),
        version: '1.0.0',
        kvStores: ['USERS_KV', 'MESSAGES_KV', 'MAILBOXES_KV', 'SYSTEM_KV'],
        totalSize: 0,
        compressedSize: 0,
        backupType
      },
      users: usersData,
      messages: messagesData,
      mailboxes: mailboxesData,
      system: systemData
    };
    
    // データサイズを計算
    const jsonString = JSON.stringify(backupData);
    backupData.metadata.totalSize = jsonString.length;
    
    // データを圧縮
    const compressedData = await compressObject(backupData);
    backupData.metadata.compressedSize = compressedData.length;
    
    // R2にアップロード
    const backupKey = generateBackupKey(backupType);
    await env.ATTACHMENTS_R2.put(backupKey, compressedData, {
      customMetadata: {
        'backup-type': backupType,
        'timestamp': backupData.metadata.timestamp.toString(),
        'original-size': backupData.metadata.totalSize.toString(),
        'compressed-size': backupData.metadata.compressedSize.toString()
      }
    });
    
    const duration = Date.now() - startTime;
    logger.info("フルバックアップ完了", {
      backupKey,
      backupType,
      duration,
      originalSize: backupData.metadata.totalSize,
      compressedSize: backupData.metadata.compressedSize,
      compressionRatio: `${((backupData.metadata.totalSize - backupData.metadata.compressedSize) / backupData.metadata.totalSize * 100).toFixed(1)}%`
    });
    
    return backupKey;
  } catch (error) {
    logger.error("フルバックアップエラー", { error: error as Error, backupType });
    throw error;
  }
};

/**
 * バックアップから復旧
 */
export const restoreFromBackup = async (env: Env, backupKey: string): Promise<void> => {
  const startTime = Date.now();
  
  try {
    logger.info("バックアップ復旧開始", { backupKey });
    
    // R2からバックアップデータを取得
    const backupObject = await env.ATTACHMENTS_R2.get(backupKey);
    if (!backupObject) {
      throw new Error(`バックアップファイルが見つかりません: ${backupKey}`);
    }
    
    // データを展開
    const compressedData = new Uint8Array(await backupObject.arrayBuffer());
    const backupData = await decompressObject<BackupData>(compressedData);
    
    // 各KVストアにデータを復元
    await Promise.all([
      importKVData(env.USERS_KV, 'users', backupData.users),
      importKVData(env.MESSAGES_KV, 'messages', backupData.messages),
      importKVData(env.MAILBOXES_KV, 'mailboxes', backupData.mailboxes),
      importKVData(env.SYSTEM_KV, 'system', backupData.system)
    ]);
    
    const duration = Date.now() - startTime;
    logger.info("バックアップ復旧完了", {
      backupKey,
      duration,
      restoredStores: backupData.metadata.kvStores,
      originalTimestamp: backupData.metadata.timestamp
    });
  } catch (error) {
    logger.error("バックアップ復旧エラー", { error: error as Error, backupKey });
    throw error;
  }
};

/**
 * KVストアからデータをエクスポート（セッション・レートリミット除外）
 */
const exportKVData = async (kv: KVNamespace, storeName: string): Promise<Record<string, unknown>> => {
  const data: Record<string, unknown> = {};
  let cursor: string | undefined;
  let totalKeys = 0;
  
  try {
    do {
      const listResult = await kv.list({ cursor, limit: 1000 });
      
      for (const key of listResult.keys) {
        // セッションとレートリミットは除外
        if (key.name.startsWith('session:') || key.name.startsWith('rate_limit:')) {
          continue;
        }
        
        const value = await kv.get(key.name);
        if (value !== null) {
          data[key.name] = JSON.parse(value);
          totalKeys++;
        }
      }
      
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);
    
    logger.performanceLog(`${storeName}データエクスポート完了`, {
      storeName,
      totalKeys,
      dataSize: JSON.stringify(data).length
    });
    
    return data;
  } catch (error) {
    logger.error(`${storeName}データエクスポートエラー`, { error: error as Error, storeName });
    throw error;
  }
};

/**
 * KVストアにデータをインポート
 */
const importKVData = async (kv: KVNamespace, storeName: string, data: Record<string, unknown>): Promise<void> => {
  const keys = Object.keys(data);
  let importedKeys = 0;
  
  try {
    // バッチ処理で効率的にインポート
    const batchSize = 100;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (key) => {
          const value = JSON.stringify(data[key]);
          await kv.put(key, value);
          importedKeys++;
        })
      );
    }
    
    logger.performanceLog(`${storeName}データインポート完了`, {
      storeName,
      importedKeys,
      totalKeys: keys.length
    });
  } catch (error) {
    logger.error(`${storeName}データインポートエラー`, { error: error as Error, storeName, importedKeys });
    throw error;
  }
};

/**
 * バックアップファイルキーを生成
 */
const generateBackupKey = (backupType: BackupMetadata['backupType']): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `backups/${backupType}/${year}/${month}/${day}/backup-${year}${month}${day}-${hour}${minute}.deflate`;
};

/**
 * バックアップファイル一覧を取得
 */
export const listBackups = async (env: Env, prefix = 'backups/'): Promise<Array<{ key: string; metadata: BackupMetadata | null }>> => {
  try {
    const listResult = await env.ATTACHMENTS_R2.list({ prefix });
    
    const backups = await Promise.all(
      listResult.objects.map(async (obj) => {
        let metadata: BackupMetadata | null = null;
        
        if (obj.customMetadata) {
          metadata = {
            timestamp: parseInt(obj.customMetadata.timestamp || '0'),
            version: '1.0.0',
            kvStores: ['USERS_KV', 'MESSAGES_KV', 'MAILBOXES_KV', 'SYSTEM_KV'],
            totalSize: parseInt(obj.customMetadata['original-size'] || '0'),
            compressedSize: parseInt(obj.customMetadata['compressed-size'] || '0'),
            backupType: (obj.customMetadata['backup-type'] as BackupMetadata['backupType']) || 'manual'
          };
        }
        
        return {
          key: obj.key,
          metadata
        };
      })
    );
    
    // タイムスタンプでソート（新しい順）
    return backups.sort((a, b) => (b.metadata?.timestamp || 0) - (a.metadata?.timestamp || 0));
  } catch (error) {
    logger.error("バックアップ一覧取得エラー", { error: error as Error });
    throw error;
  }
};

/**
 * 古いバックアップファイルを削除
 */
export const cleanupOldBackups = async (env: Env): Promise<void> => {
  try {
    logger.info("古いバックアップクリーンアップ開始");
    
    const backups = await listBackups(env);
    const now = Date.now();
    const deletions: Promise<void>[] = [];
    
    for (const backup of backups) {
      if (!backup.metadata) continue;
      
      const age = now - backup.metadata.timestamp;
      const dayAge = age / (1000 * 60 * 60 * 24);
      
      let shouldDelete = false;
      
      switch (backup.metadata.backupType) {
        case 'daily':
          shouldDelete = dayAge > 7; // 7日より古い日次バックアップ
          break;
        case 'weekly':
          shouldDelete = dayAge > 28; // 4週間より古い週次バックアップ
          break;
        case 'monthly':
          shouldDelete = dayAge > 365; // 1年より古い月次バックアップ
          break;
        case 'manual':
          shouldDelete = dayAge > 30; // 30日より古い手動バックアップ
          break;
      }
      
      if (shouldDelete) {
        deletions.push(env.ATTACHMENTS_R2.delete(backup.key));
        logger.info("古いバックアップを削除", {
          key: backup.key,
          backupType: backup.metadata.backupType,
          dayAge: Math.floor(dayAge)
        });
      }
    }
    
    await Promise.all(deletions);
    
    logger.info("古いバックアップクリーンアップ完了", {
      deletedCount: deletions.length,
      totalBackups: backups.length
    });
  } catch (error) {
    logger.error("バックアップクリーンアップエラー", { error: error as Error });
    throw error;
  }
};