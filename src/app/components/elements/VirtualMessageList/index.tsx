import VirtualList from "../VirtualList";
import { sanitizeEmailText } from "~/utils/sanitize";
import type { EmailMetadata } from "~/utils/schema";

interface VirtualMessageListProps {
  messages: (EmailMetadata & { mailbox: string })[];
  selectedMailbox: string | null;
  containerHeight?: number;
  onMessageClick?: (messageId: string) => void;
}

const MESSAGE_ITEM_HEIGHT = 96; // メッセージアイテムの高さ

const VirtualMessageList = ({
  messages,
  selectedMailbox,
  containerHeight = 600,
  onMessageClick,
}: VirtualMessageListProps) => {
  const renderMessage = (message: EmailMetadata & { mailbox: string }) => (
    <a
      href={`/messages/${message.messageId}`}
      onClick={(e) => {
        if (onMessageClick) {
          e.preventDefault();
          onMessageClick(message.messageId);
        }
      }}
      className={`flex p-4 border-b border-gray-100 last:border-b-0 no-underline text-inherit transition-colors hover:bg-gray-50 h-full items-center ${
        !message.isRead ? "bg-blue-50" : ""
      }`}
      role="listitem"
      aria-label={`メール: ${message.subject || "(件名なし)"} 送信者: ${message.from}`}
    >
      <div className="flex justify-between items-start w-full max-sm:flex-col max-sm:gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <span
              className={`text-sm truncate ${!message.isRead ? "font-bold" : ""}`}
            >
              {sanitizeEmailText(message.from)}
            </span>
            {!selectedMailbox && (
              <span className="ml-2 px-2 py-0.5 bg-gray-200 rounded-xl text-xs text-gray-600 flex-shrink-0">
                {message.mailbox}
              </span>
            )}
            {message.hasAttachments && (
              <span className="ml-2 text-xs flex-shrink-0" aria-hidden="true">📎</span>
            )}
          </div>
          <div
            className={`mb-1 truncate ${!message.isRead ? "font-bold" : ""}`}
            title={message.subject || "(件名なし)"}
          >
            {sanitizeEmailText(message.subject) || "(件名なし)"}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {message.preview || ""}
          </div>
        </div>
        <div className="text-xs text-gray-600 text-right min-w-[100px] max-sm:text-left max-sm:min-w-auto flex-shrink-0">
          <time dateTime={message.date}>
            {new Date(message.date).toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      </div>
    </a>
  );

  const keyExtractor = (message: EmailMetadata & { mailbox: string }) => 
    message.messageId;

  return (
    <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
      {messages.length === 0 ? (
        <div className="text-center p-12 bg-gray-50 text-gray-600">
          メールがありません
        </div>
      ) : (
        <VirtualList
          items={messages}
          itemHeight={MESSAGE_ITEM_HEIGHT}
          containerHeight={containerHeight}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          overscan={3}
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        />
      )}
    </div>
  );
};

export default VirtualMessageList;