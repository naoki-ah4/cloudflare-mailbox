/**
 * クライアント側でのdeflate圧縮/解凍ユーティリティ
 * ブラウザのCompressionStream/DecompressionStream APIを使用
 */

/**
 * deflate圧縮されたデータを解凍する
 * @param compressedData deflate圧縮されたバイナリデータ
 * @returns 解凍されたテキストデータ
 */
export const decompressDeflate = async (
  compressedData: Uint8Array
): Promise<string> => {
  try {
    // DecompressionStreamでdeflate解凍
    const decompressionStream = new DecompressionStream("deflate");
    const writer = decompressionStream.writable.getWriter();
    const reader = decompressionStream.readable.getReader();

    // 圧縮データを書き込み
    await writer.write(compressedData);
    await writer.close();

    // 解凍されたデータを読み取り
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    // Uint8Arrayを結合してテキストに変換
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // UTF-8デコード
    return new TextDecoder("utf-8").decode(result);
  } catch (error) {
    throw new Error(`deflate解凍に失敗しました: ${(error as Error).message}`);
  }
};

/**
 * Base64エンコードされたdeflateデータを解凍する
 * @param base64Data Base64エンコードされたdeflateデータ
 * @returns 解凍されたテキストデータ
 */
export const decompressBase64Deflate = async (
  base64Data: string
): Promise<string> => {
  try {
    // Base64デコード
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return await decompressDeflate(bytes);
  } catch (error) {
    throw new Error(
      `Base64 deflate解凍に失敗しました: ${(error as Error).message}`
    );
  }
};

/**
 * ファイルからdeflateデータを読み取って解凍する
 * @param file deflate圧縮されたファイル
 * @returns 解凍されたテキストデータ
 */
export const decompressFileDeflate = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return await decompressDeflate(uint8Array);
  } catch (error) {
    throw new Error(
      `ファイルdeflate解凍に失敗しました: ${(error as Error).message}`
    );
  }
};

/**
 * 解凍されたJSONデータをオブジェクトにパースする
 * @param decompressedText 解凍されたJSONテキスト
 * @returns パースされたオブジェクト
 */
export const parseDecompressedJSON = <T = unknown>(
  decompressedText: string
): T => {
  try {
    return JSON.parse(decompressedText) as T;
  } catch (error) {
    throw new Error(`JSON解析に失敗しました: ${(error as Error).message}`);
  }
};

/**
 * deflate圧縮されたバックアップファイルを解凍してJSONオブジェクトとして取得
 * @param compressedData deflate圧縮されたバイナリデータ
 * @returns バックアップデータオブジェクト
 */
export const decompressBackupData = async <T = unknown>(
  compressedData: Uint8Array
): Promise<T> => {
  const decompressedText = await decompressDeflate(compressedData);
  return parseDecompressedJSON<T>(decompressedText);
};
