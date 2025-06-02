import Messages from "../components/Messages";
import ChatInput from "../components/ChatInput";

export default function ChatPage({ activeId, messages, updateMessages }: any) {
  return (
    <div className="flex flex-col flex-1">
      <Messages messages={messages} />
      <ChatInput
        messages={messages}
        updateMessages={(newMessages: string[]) => updateMessages(activeId, newMessages)}
      />
    </div>
  );
}
