import { getPrismaClient } from "./index";

export interface FolderData {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export const FolderDB = {
  async getUserFolders(userId: string): Promise<FolderData[]> {
    const prisma = getPrismaClient();
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    return folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color || undefined,
      createdAt: Number(folder.createdAt),
      updatedAt: Number(folder.updatedAt),
    }));
  },

  async createFolder(
    userId: string,
    name: string,
    color?: string
  ): Promise<FolderData> {
    const prisma = getPrismaClient();
    const now = BigInt(Date.now());

    const folder = await prisma.folder.create({
      data: {
        userId,
        name,
        color,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      id: folder.id,
      name: folder.name,
      color: folder.color || undefined,
      createdAt: Number(folder.createdAt),
      updatedAt: Number(folder.updatedAt),
    };
  },

  async updateFolder(
    folderId: string,
    updates: { name?: string; color?: string }
  ): Promise<boolean> {
    const prisma = getPrismaClient();

    try {
      await prisma.folder.update({
        where: { id: folderId },
        data: {
          ...updates,
          updatedAt: BigInt(Date.now()),
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  async deleteFolder(folderId: string): Promise<boolean> {
    const prisma = getPrismaClient();

    try {
      await prisma.$transaction(async (tx) => {
        // フォルダ内のメッセージを受信箱に移動（folderId を null に）
        await tx.emailMetadata.updateMany({
          where: { folderId },
          data: { folderId: null },
        });

        // フォルダを削除
        await tx.folder.delete({
          where: { id: folderId },
        });
      });
      return true;
    } catch {
      return false;
    }
  },

  async getFolderMessages(folderId: string): Promise<number> {
    const prisma = getPrismaClient();

    return await prisma.emailMetadata.count({
      where: { folderId },
    });
  },
};
