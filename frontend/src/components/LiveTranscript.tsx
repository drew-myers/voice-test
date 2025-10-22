import { useEffect, useRef } from "react";
import type { ConversationMessage } from "../hooks/useCallController";

type LiveTranscriptProps = {
  messages: ConversationMessage[];
  agentName: string;
  isCallActive: boolean;
};

export const LiveTranscript = ({
  messages,
  agentName,
  isCallActive,
}: LiveTranscriptProps) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const placeholderText = isCallActive
    ? "Transcript will appear here once anyone speaks."
    : "Start a call to see the live transcript of your conversation.";

  return (
    <section className="panel__transcript" aria-live="polite">
      <div className="panel__transcript-header">
        <span className="label">Live Transcript</span>
      </div>
      <div className="panel__transcript-body" ref={scrollContainerRef}>
        {messages.length === 0 ? (
          <p className="panel__transcript-placeholder">{placeholderText}</p>
        ) : (
          messages.map((entry) => (
            <div
              key={entry.id}
              className={`panel__message panel__message--${entry.source}`}
            >
              <span className="panel__message-speaker">
                {entry.source === "user" ? "You" : agentName}
              </span>
              <span className="panel__message-text">{entry.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
