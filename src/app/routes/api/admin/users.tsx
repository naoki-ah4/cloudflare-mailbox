import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { UserKV } from "~/utils/kv";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // ユーザー一覧を取得
    const users = await UserKV.list(env.USERS_KV);
    
    // パスワードハッシュを除去してレスポンス
    const safeUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      managedEmails: user.managedEmails,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));
    
    return Response.json({
      users: safeUsers,
      total: users.length,
    });
  } catch (error) {
    console.error("Failed to get users:", error);
    return Response.json({ error: "Failed to get users" }, { status: 500 });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const userId = formData.get("userId") as string;
      
      if (!userId) {
        return Response.json({ error: "User ID is required" }, { status: 400 });
      }
      
      // ユーザー存在確認
      const user = await UserKV.get(env.USERS_KV, userId);
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      
      // ユーザー削除
      await UserKV.delete(env.USERS_KV, userId);
      
      return Response.json({ 
        success: true, 
        message: `User ${user.username} has been deleted` 
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      return Response.json({ error: "Failed to delete user" }, { status: 500 });
    }
  }
  
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}