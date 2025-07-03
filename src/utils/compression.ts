/**
 * データ圧縮・展開ユーティリティ
 * deflate圧縮を使用してストレージコストを削減
 */

import { logger } from "./logger";

/**
 * 文字列データをdeflate圧縮
 */
export const compressData = async (data: string): Promise<Uint8Array> => {
  try {
    const encoder = new TextEncoder();
    const inputData = encoder.encode(data);
    
    const compressionStream = new CompressionStream('deflate');
    const writer = compressionStream.writable.getWriter();
    const reader = compressionStream.readable.getReader();
    
    // データを書き込み
    await writer.write(inputData);
    await writer.close();
    
    // 圧縮されたデータを読み取り
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalLength += value.length;
    }
    
    // 全チャンクを結合
    const compressedData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      compressedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    const compressionRatio = ((data.length - compressedData.length) / data.length * 100).toFixed(1);
    logger.performanceLog("データ圧縮完了", {
      originalSize: data.length,
      compressedSize: compressedData.length,
      compressionRatio: `${compressionRatio}%`
    });
    
    return compressedData;
  } catch (error) {
    logger.error("データ圧縮エラー", { error: error as Error });
    throw error;
  }
};

/**
 * deflate圧縮されたデータを展開
 */
export const decompressData = async (compressedData: Uint8Array): Promise<string> => {
  try {
    const decompressionStream = new DecompressionStream('deflate');
    const writer = decompressionStream.writable.getWriter();
    const reader = decompressionStream.readable.getReader();
    
    // 圧縮データを書き込み
    await writer.write(compressedData);
    await writer.close();
    
    // 展開されたデータを読み取り
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      totalLength += value.length;
    }
    
    // 全チャンクを結合
    const decompressedData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      decompressedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    const decoder = new TextDecoder();
    const result = decoder.decode(decompressedData);
    
    logger.performanceLog("データ展開完了", {
      compressedSize: compressedData.length,
      decompressedSize: result.length
    });
    
    return result;
  } catch (error) {
    logger.error("データ展開エラー", { error: error as Error });
    throw error;
  }
};

/**
 * オブジェクトをJSONに変換してから圧縮
 */
export const compressObject = async <T>(obj: T): Promise<Uint8Array> => {
  const jsonString = JSON.stringify(obj);
  return compressData(jsonString);
};

/**
 * 圧縮データを展開してオブジェクトに変換
 */
export const decompressObject = async <T>(compressedData: Uint8Array): Promise<T> => {
  const jsonString = await decompressData(compressedData);
  return JSON.parse(jsonString) as T;
};

/**
 * 大きなデータを分割して圧縮（メモリ制限対策）
 */
export const compressLargeData = async (data: string, chunkSize = 1024 * 1024): Promise<Uint8Array[]> => {
  try {
    const chunks: Uint8Array[] = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const compressedChunk = await compressData(chunk);
      chunks.push(compressedChunk);
    }
    
    logger.performanceLog("大容量データ分割圧縮完了", {
      originalSize: data.length,
      chunkCount: chunks.length,
      chunkSize
    });
    
    return chunks;
  } catch (error) {
    logger.error("大容量データ圧縮エラー", { error: error as Error });
    throw error;
  }
};

/**
 * 分割圧縮されたデータを展開して結合
 */
export const decompressLargeData = async (compressedChunks: Uint8Array[]): Promise<string> => {
  try {
    const decompressedChunks: string[] = [];
    
    for (const chunk of compressedChunks) {
      const decompressedChunk = await decompressData(chunk);
      decompressedChunks.push(decompressedChunk);
    }
    
    const result = decompressedChunks.join('');
    
    logger.performanceLog("大容量データ分割展開完了", {
      chunkCount: compressedChunks.length,
      finalSize: result.length
    });
    
    return result;
  } catch (error) {
    logger.error("大容量データ展開エラー", { error: error as Error });
    throw error;
  }
};