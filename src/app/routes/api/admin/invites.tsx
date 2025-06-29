import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { InviteKV } from "~/utils/kv";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // 招待一覧を取得（実装は後で追加）
    // 現在はInviteKV.listがないので、基本的な情報のみ返す
    const inviteCount = await InviteKV.count(env.USERS_KV);
    
    return Response.json({
      invites: [],
      total: inviteCount,
      message: "Invite list implementation pending"
    });
  } catch (error) {
    console.error("Failed to get invites:", error);
    return Response.json({ error: "Failed to get invites" }, { status: 500 });
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const expiresInHours = parseInt(formData.get("expiresInHours") as string) || 24;
      
      // 招待トークン生成
      const token = crypto.randomUUID();
      const now = Date.now();
      const expiresAt = now + (expiresInHours * 60 * 60 * 1000);
      
      const invite = {
        token,
        createdAt: now,
        expiresAt,
        used: false,
      };
      
      await InviteKV.set(env.USERS_KV, token, invite);
      
      // 招待URLを生成
      const inviteUrl = `${new URL(request.url).origin}/signup?invite=${token}`;
      
      return Response.json({
        success: true,
        invite: {
          token,
          url: inviteUrl,
          expiresAt,
          expiresInHours,
        }
      });
    } catch (error) {
      console.error("Failed to create invite:", error);
      return Response.json({ error: "Failed to create invite" }, { status: 500 });
    }
  }
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const token = formData.get("token") as string;
      
      if (!token) {
        return Response.json({ error: "Token is required" }, { status: 400 });
      }
      
      // 招待削除
      await InviteKV.delete(env.USERS_KV, token);
      
      return Response.json({ 
        success: true, 
        message: "Invite has been deleted" 
      });
    } catch (error) {
      console.error("Failed to delete invite:", error);
      return Response.json({ error: "Failed to delete invite" }, { status: 500 });
    }
  }
  
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}