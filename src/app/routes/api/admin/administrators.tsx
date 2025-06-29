import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { AdminKV } from "~/utils/kv";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // 管理者一覧を取得
    const admins = await AdminKV.list(env.USERS_KV);
    
    // パスワードハッシュを除去してレスポンス
    const safeAdmins = admins.map(admin => ({
      id: admin.id,
      username: admin.username,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin,
    }));
    
    return Response.json({
      administrators: safeAdmins,
      total: admins.length,
    });
  } catch (error) {
    console.error("Failed to get administrators:", error);
    return Response.json({ error: "Failed to get administrators" }, { status: 500 });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;
      
      // バリデーション
      if (!username || !password) {
        return Response.json({ error: "Username and password are required" }, { status: 400 });
      }
      
      if (username.length < 3 || username.length > 30) {
        return Response.json({ error: "Username must be 3-30 characters" }, { status: 400 });
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return Response.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
      }
      
      if (password.length < 8) {
        return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      
      // ユーザー名重複チェック
      const existingAdmin = await AdminKV.getByUsername(env.USERS_KV, username);
      if (existingAdmin) {
        return Response.json({ error: "Username already exists" }, { status: 400 });
      }
      
      // パスワードハッシュ化
      const passwordHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(password + 'salt')
      );
      const hashHex = Array.from(new Uint8Array(passwordHash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // 管理者作成
      const adminId = crypto.randomUUID();
      const admin = {
        id: adminId,
        username,
        passwordHash: hashHex,
        createdAt: Date.now(),
      };
      
      await AdminKV.set(env.USERS_KV, adminId, admin);
      
      return Response.json({
        success: true,
        administrator: {
          id: admin.id,
          username: admin.username,
          createdAt: admin.createdAt,
        }
      });
    } catch (error) {
      console.error("Failed to create administrator:", error);
      return Response.json({ error: "Failed to create administrator" }, { status: 500 });
    }
  }
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const adminId = formData.get("adminId") as string;
      
      if (!adminId) {
        return Response.json({ error: "Admin ID is required" }, { status: 400 });
      }
      
      // 管理者数チェック（最後の管理者は削除不可）
      const adminCount = await AdminKV.count(env.USERS_KV);
      if (adminCount <= 1) {
        return Response.json({ error: "Cannot delete the last administrator" }, { status: 400 });
      }
      
      // 管理者存在確認
      const admin = await AdminKV.get(env.USERS_KV, adminId);
      if (!admin) {
        return Response.json({ error: "Administrator not found" }, { status: 404 });
      }
      
      // 管理者削除
      await AdminKV.delete(env.USERS_KV, adminId);
      
      return Response.json({ 
        success: true, 
        message: `Administrator ${admin.username} has been deleted` 
      });
    } catch (error) {
      console.error("Failed to delete administrator:", error);
      return Response.json({ error: "Failed to delete administrator" }, { status: 500 });
    }
  }
  
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}