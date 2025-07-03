/**
 * バックアップ世代管理システム
 * 効率的な世代管理とコスト最適化
 */

import { logger } from "./logger";

export interface BackupGenerationRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  retentionDays: number;
  description: string;
}

export interface BackupFileInfo {
  key: string;
  timestamp: number;
  backupType: 'daily' | 'weekly' | 'monthly' | 'manual';
  size: number;
  isPromoted?: boolean;
}

/**
 * バックアップ世代管理のルール定義
 */
export const BACKUP_GENERATION_RULES: BackupGenerationRule[] = [
  {
    type: 'daily',
    retentionDays: 7,
    description: '日次バックアップ: 7日間保持'
  },
  {
    type: 'weekly', 
    retentionDays: 28,
    description: '週次バックアップ: 4週間保持'
  },
  {
    type: 'monthly',
    retentionDays: 365,
    description: '月次バックアップ: 1年間保持'
  },
  {
    type: 'yearly',
    retentionDays: 1095, // 3年
    description: '年次バックアップ: 3年間保持'
  }
];

/**
 * 世代管理に基づく削除対象ファイルの特定
 */
export const identifyFilesForDeletion = (
  backups: BackupFileInfo[],
  currentTime = Date.now()
): BackupFileInfo[] => {
  const toDelete: BackupFileInfo[] = [];
  const toPromote: Array<{ from: BackupFileInfo; toType: 'weekly' | 'monthly' | 'yearly' }> = [];
  
  // タイムスタンプでソート（古い順）
  const sortedBackups = [...backups].sort((a, b) => a.timestamp - b.timestamp);
  
  for (const backup of sortedBackups) {
    const ageInDays = (currentTime - backup.timestamp) / (1000 * 60 * 60 * 24);
    const backupDate = new Date(backup.timestamp);
    
    let shouldDelete = false;
    let shouldPromote: 'weekly' | 'monthly' | 'yearly' | null = null;
    
    switch (backup.backupType) {
      case 'daily':
        if (ageInDays > 7) {
          // 7日を超えた日次バックアップの処理
          if (isFirstOfWeek(backupDate) && ageInDays <= 28) {
            // 週の最初の日なら週次に昇格
            shouldPromote = 'weekly';
          } else {
            shouldDelete = true;
          }
        }
        break;
        
      case 'weekly':
        if (ageInDays > 28) {
          // 4週間を超えた週次バックアップの処理
          if (isFirstOfMonth(backupDate) && ageInDays <= 365) {
            // 月の最初の週なら月次に昇格
            shouldPromote = 'monthly';
          } else {
            shouldDelete = true;
          }
        }
        break;
        
      case 'monthly':
        if (ageInDays > 365) {
          // 1年を超えた月次バックアップの処理
          if (isFirstOfYear(backupDate) && ageInDays <= 1095) {
            // 年の最初の月なら年次に昇格
            shouldPromote = 'yearly';
          } else {
            shouldDelete = true;
          }
        }
        break;
        
      case 'manual':
        // 手動バックアップは30日で削除
        if (ageInDays > 30) {
          shouldDelete = true;
        }
        break;
    }
    
    if (shouldDelete) {
      toDelete.push(backup);
    } else if (shouldPromote) {
      toPromote.push({ from: backup, toType: shouldPromote });
    }
  }
  
  // 昇格ログ
  for (const promotion of toPromote) {
    logger.info("バックアップを昇格", {
      key: promotion.from.key,
      fromType: promotion.from.backupType,
      toType: promotion.toType,
      timestamp: new Date(promotion.from.timestamp).toISOString()
    });
  }
  
  return toDelete;
};

/**
 * 世代管理統計の取得
 */
export const getGenerationStatistics = (backups: BackupFileInfo[]): {
  counts: Record<string, number>;
  totalSize: number;
  oldestTimestamp: number;
  newestTimestamp: number;
} => {
  const counts = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    manual: 0
  };
  
  let totalSize = 0;
  let oldestTimestamp = Date.now();
  let newestTimestamp = 0;
  
  for (const backup of backups) {
    counts[backup.backupType]++;
    totalSize += backup.size;
    
    if (backup.timestamp < oldestTimestamp) {
      oldestTimestamp = backup.timestamp;
    }
    if (backup.timestamp > newestTimestamp) {
      newestTimestamp = backup.timestamp;
    }
  }
  
  return {
    counts,
    totalSize,
    oldestTimestamp,
    newestTimestamp
  };
};

/**
 * コスト効率レポートの生成
 */
export const generateCostEfficiencyReport = (
  beforeBackups: BackupFileInfo[],
  afterBackups: BackupFileInfo[]
): {
  deletedCount: number;
  sizeReduction: number;
  costReduction: number; // R2ストレージコスト削減額（USD/month）
  retentionSummary: Record<string, number>;
} => {
  const beforeStats = getGenerationStatistics(beforeBackups);
  const afterStats = getGenerationStatistics(afterBackups);
  
  const deletedCount = beforeBackups.length - afterBackups.length;
  const sizeReduction = beforeStats.totalSize - afterStats.totalSize;
  
  // R2ストレージコスト: $0.015 per GB per month
  const costReduction = (sizeReduction / (1024 * 1024 * 1024)) * 0.015;
  
  return {
    deletedCount,
    sizeReduction,
    costReduction,
    retentionSummary: afterStats.counts
  };
};

/**
 * 日付ヘルパー関数
 */
const isFirstOfWeek = (date: Date): boolean => {
  return date.getDay() === 0; // 日曜日
};

const isFirstOfMonth = (date: Date): boolean => {
  return date.getDate() <= 7 && isFirstOfWeek(date);
};

const isFirstOfYear = (date: Date): boolean => {
  return date.getMonth() === 0 && isFirstOfMonth(date);
};

/**
 * バックアップ昇格処理（実際のファイル操作）
 */
export const promoteBackupFiles = async (
  env: Env,
  promotions: Array<{ 
    oldKey: string; 
    newKey: string; 
    newType: 'weekly' | 'monthly' | 'yearly' 
  }>
): Promise<void> => {
  try {
    logger.info("バックアップファイル昇格開始", { 
      promotionCount: promotions.length 
    });
    
    for (const promotion of promotions) {
      // 元ファイルを取得
      const sourceObject = await env.ATTACHMENTS_R2.get(promotion.oldKey);
      if (!sourceObject) {
        logger.warn("昇格対象ファイルが見つかりません", { 
          oldKey: promotion.oldKey 
        });
        continue;
      }
      
      // 新しいキーでコピー
      await env.ATTACHMENTS_R2.put(promotion.newKey, sourceObject.body, {
        customMetadata: {
          ...sourceObject.customMetadata,
          'backup-type': promotion.newType,
          'promoted-from': promotion.oldKey,
          'promoted-at': Date.now().toString()
        }
      });
      
      // 元ファイルを削除
      await env.ATTACHMENTS_R2.delete(promotion.oldKey);
      
      logger.info("バックアップファイル昇格完了", {
        oldKey: promotion.oldKey,
        newKey: promotion.newKey,
        newType: promotion.newType
      });
    }
    
    logger.info("全バックアップファイル昇格完了", { 
      promotionCount: promotions.length 
    });
  } catch (error) {
    logger.error("バックアップファイル昇格エラー", { 
      error: error as Error,
      promotionCount: promotions.length
    });
    throw error;
  }
};