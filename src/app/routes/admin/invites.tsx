import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { InviteKV } from "~/utils/kv";
import { redirect } from "react-router";

export async function loader({ context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    // 現在はInviteKV.listがないので、基本的な情報のみ
    const inviteCount = await InviteKV.count(env.USERS_KV);
    
    return {
      invites: [], // TODO: InviteKV.listを実装後に更新
      total: inviteCount,
    };
  } catch (error) {
    console.error("Failed to get invites:", error);
    throw new Error("招待一覧の取得に失敗しました");
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
      
      return {
        success: true,
        invite: {
          token,
          url: inviteUrl,
          expiresAt,
          expiresInHours,
        }
      };
    } catch (error) {
      console.error("Failed to create invite:", error);
      return { error: "招待URLの生成に失敗しました" };
    }
  }
  
  if (request.method === "DELETE") {
    try {
      const formData = await request.formData();
      const token = formData.get("token") as string;
      
      if (!token) {
        return { error: "トークンが必要です" };
      }
      
      // 招待削除
      await InviteKV.delete(env.USERS_KV, token);
      
      return redirect("/admin/invites");
    } catch (error) {
      console.error("Failed to delete invite:", error);
      return { error: "招待の削除に失敗しました" };
    }
  }
  
  return { error: "許可されていないメソッドです" };
}

export default function AdminInvites() {
  const { total } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "2rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "1rem"
      }}>
        <div>
          <h1>招待URL管理</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            招待数: {total}
          </p>
        </div>
        <a 
          href="/admin"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#6c757d",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          ダッシュボードに戻る
        </a>
      </header>

      {actionData?.error && (
        <div style={{ 
          color: "red", 
          backgroundColor: "#ffebee", 
          padding: "1rem", 
          borderRadius: "4px",
          marginBottom: "1rem"
        }}>
          {actionData.error}
        </div>
      )}

      {actionData?.success && actionData.invite && (
        <div style={{ 
          color: "#155724", 
          backgroundColor: "#d4edda", 
          border: "1px solid #c3e6cb",
          padding: "1rem", 
          borderRadius: "4px",
          marginBottom: "1rem"
        }}>
          <h4 style={{ margin: "0 0 0.5rem 0" }}>招待URL生成完了</h4>
          <p style={{ margin: "0.5rem 0", wordBreak: "break-all" }}>
            <strong>URL:</strong> {actionData.invite.url}
          </p>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>
            有効期限: {new Date(actionData.invite.expiresAt).toLocaleString('ja-JP')}
          </p>
        </div>
      )}

      <div style={{
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        padding: "1.5rem",
        marginBottom: "2rem"
      }}>
        <h2 style={{ margin: "0 0 1rem 0" }}>新しい招待URL生成</h2>
        <Form method="post">
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="expiresInHours" style={{ display: "block", marginBottom: "0.5rem" }}>
              有効期限（時間）:
            </label>
            <select
              id="expiresInHours"
              name="expiresInHours"
              defaultValue="24"
              style={{ 
                padding: "0.5rem", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                width: "200px"
              }}
              disabled={isSubmitting}
            >
              <option value="1">1時間</option>
              <option value="6">6時間</option>
              <option value="24">24時間</option>
              <option value="72">3日</option>
              <option value="168">1週間</option>
            </select>
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "生成中..." : "招待URL生成"}
          </button>
        </Form>
      </div>

      <div style={{ 
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        padding: "1.5rem"
      }}>
        <h2 style={{ margin: "0 0 1rem 0" }}>招待一覧</h2>
        <p style={{ color: "#666", fontStyle: "italic" }}>
          招待一覧機能は実装中です。現在の招待数: {total}
        </p>
      </div>
    </div>
  );
}