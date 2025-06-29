import { useLoaderData, useActionData, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { SessionKV, MessageKV, InboxKV } from "~/utils/kv";
import { getUserSession } from "~/utils/session.server";
import { useState } from "react";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    const messageId = params.messageId;
    if (!messageId) {
      throw new Error("メッセージIDが必要です");
    }
    
    // セッションからユーザー情報を取得
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");
    
    if (!sessionId) {
      throw new Error("認証が必要です");
    }
    
    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      throw new Error("セッションが無効です");
    }
    
    // メッセージ取得
    const message = await MessageKV.get(env.MESSAGES_KV, messageId);
    if (!message) {
      throw new Error("メッセージが見つかりません");
    }
    
    // アクセス権限チェック
    const canAccess = message.to.some(email => kvSession.managedEmails.includes(email));
    if (!canAccess) {
      throw new Error("このメッセージにアクセスする権限がありません");
    }
    
    // 受信者メールアドレス特定（複数の場合は最初の管理対象）
    const recipientEmail = message.to.find(email => kvSession.managedEmails.includes(email));
    
    return {
      message,
      recipientEmail,
      user: {
        email: kvSession.email,
        managedEmails: kvSession.managedEmails,
      }
    };
  } catch (error) {
    console.error("Failed to load message:", error);
    throw new Error("メッセージの取得に失敗しました");
  }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { env } = (context as { cloudflare: { env: Env } }).cloudflare;
  
  try {
    const messageId = params.messageId;
    if (!messageId) {
      return { error: "メッセージIDが必要です" };
    }
    
    // セッション確認
    const session = await getUserSession(request.headers.get("Cookie"));
    const sessionId = session.get("sessionId");
    
    if (!sessionId) {
      return { error: "認証が必要です" };
    }
    
    const kvSession = await SessionKV.get(env.USERS_KV, sessionId);
    if (!kvSession || kvSession.expiresAt < Date.now()) {
      return { error: "セッションが無効です" };
    }
    
    const formData = await request.formData();
    const action = formData.get("action") as string;
    
    if (action === "markRead") {
      // メッセージ取得してアクセス権限確認
      const message = await MessageKV.get(env.MESSAGES_KV, messageId);
      if (!message) {
        return { error: "メッセージが見つかりません" };
      }
      
      const canAccess = message.to.some(email => kvSession.managedEmails.includes(email));
      if (!canAccess) {
        return { error: "権限がありません" };
      }
      
      // 各受信者のInboxで既読状態を更新
      const updatePromises = message.to
        .filter(email => kvSession.managedEmails.includes(email))
        .map(email => InboxKV.updateReadStatus(env.MAILBOXES_KV, email, messageId, true));
      
      await Promise.all(updatePromises);
      
      return { success: true, message: "既読にしました" };
    }
    
    return { error: "無効なアクションです" };
  } catch (error) {
    console.error("Failed to perform action:", error);
    return { error: "操作に失敗しました" };
  }
}

export default function MessageDetail() {
  const { message, recipientEmail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [displayMode, setDisplayMode] = useState<'html' | 'text'>('html');

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1rem" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "1rem",
        borderBottom: "1px solid #eee",
        paddingBottom: "1rem"
      }}>
        <div>
          <a 
            href="/messages"
            style={{
              color: "#007bff",
              textDecoration: "none",
              fontSize: "0.875rem"
            }}
          >
            ← メール一覧に戻る
          </a>
        </div>
        
        <form method="post" action="/api/logout">
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ログアウト
          </button>
        </form>
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

      {actionData?.success && (
        <div style={{ 
          color: "#155724", 
          backgroundColor: "#d4edda", 
          border: "1px solid #c3e6cb",
          padding: "1rem", 
          borderRadius: "4px",
          marginBottom: "1rem"
        }}>
          {actionData.message}
        </div>
      )}
      
      <div style={{ 
        backgroundColor: "white",
        borderRadius: "8px",
        border: "1px solid #dee2e6",
        overflow: "hidden"
      }}>
        {/* メッセージヘッダー */}
        <div style={{ 
          padding: "1.5rem",
          borderBottom: "1px solid #f8f9fa",
          backgroundColor: "#f8f9fa"
        }}>
          <h1 style={{ margin: "0 0 1rem 0", fontSize: "1.5rem" }}>
            {message.subject || "(件名なし)"}
          </h1>
          
          <div style={{ 
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.5rem 1rem",
            fontSize: "0.875rem",
            color: "#666"
          }}>
            <strong>送信者:</strong>
            <span>{message.from}</span>
            
            <strong>受信者:</strong>
            <span>{message.to.join(", ")}</span>
            
            <strong>受信先:</strong>
            <span>{recipientEmail}</span>
            
            <strong>日時:</strong>
            <span>{new Date(message.date).toLocaleString('ja-JP')}</span>
            
            {message.attachments.length > 0 && (
              <>
                <strong>添付ファイル:</strong>
                <span>{message.attachments.length}個</span>
              </>
            )}
          </div>
          
          <div style={{ marginTop: "1rem" }}>
            <Form method="post" style={{ display: "inline" }}>
              <input type="hidden" name="action" value="markRead" />
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.875rem"
                }}
              >
                既読にする
              </button>
            </Form>
          </div>
        </div>
        
        {/* 添付ファイル */}
        {message.attachments.length > 0 && (
          <div style={{ 
            padding: "1rem",
            borderBottom: "1px solid #f8f9fa",
            backgroundColor: "#fafafa"
          }}>
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem" }}>添付ファイル</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {message.attachments.map((attachment, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "white",
                    border: "1px solid #dee2e6",
                    borderRadius: "4px",
                    fontSize: "0.875rem"
                  }}
                >
                  <span style={{ marginRight: "0.5rem" }}>📎</span>
                  <a 
                    href={`/api/attachments/${message.id}/${encodeURIComponent(attachment.filename)}`}
                    download={attachment.filename}
                    style={{
                      color: "#007bff",
                      textDecoration: "none",
                      marginRight: "0.5rem"
                    }}
                  >
                    {attachment.filename}
                  </a>
                  <span style={{ color: "#666", fontSize: "0.75rem" }}>
                    ({Math.round(attachment.size / 1024)}KB)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* メッセージ本文 */}
        <div style={{ padding: "1.5rem" }}>
          {message.html ? (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ 
                display: "flex", 
                gap: "0.5rem", 
                marginBottom: "1rem",
                fontSize: "0.875rem"
              }}>
                <button
                  onClick={() => setDisplayMode('html')}
                  style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: displayMode === 'html' ? "#007bff" : "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  HTML表示
                </button>
                <button
                  onClick={() => setDisplayMode('text')}
                  style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: displayMode === 'text' ? "#007bff" : "#6c757d",
                    color: "white", 
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  テキスト表示
                </button>
              </div>
              
              {/* HTML/テキスト表示 */}
              {displayMode === 'html' ? (
                <div 
                  style={{ 
                    border: "1px solid #e9ecef",
                    borderRadius: "4px",
                    padding: "1rem",
                    backgroundColor: "#fafafa",
                    maxHeight: "400px",
                    overflow: "auto"
                  }}
                  dangerouslySetInnerHTML={{ __html: message.html }}
                />
              ) : (
                <pre style={{ 
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  margin: "0",
                  padding: "1rem",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #e9ecef",
                  borderRadius: "4px",
                  maxHeight: "400px",
                  overflow: "auto"
                }}>
                  {message.text || "テキスト版がありません"}
                </pre>
              )}
            </div>
          ) : message.text ? (
            <div>
              <h4 style={{ margin: "0 0 0.5rem 0" }}>テキスト</h4>
              <pre style={{ 
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                margin: "0",
                padding: "1rem",
                backgroundColor: "#f8f9fa",
                border: "1px solid #e9ecef",
                borderRadius: "4px",
                maxHeight: "400px",
                overflow: "auto"
              }}>
                {message.text}
              </pre>
            </div>
          ) : null}
          
          {!message.html && !message.text && (
            <div style={{ 
              textAlign: "center", 
              padding: "2rem", 
              color: "#666",
              fontStyle: "italic"
            }}>
              メッセージ本文がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}