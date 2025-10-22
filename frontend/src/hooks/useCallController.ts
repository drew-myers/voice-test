import { useConversation } from "@elevenlabs/react";
import type { Role } from "@elevenlabs/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { buildEndpointUrl, getTokenFromResponse } from "../utils/api";

type UseCallControllerArgs = {
  effectiveAgentId: string | null;
  onAgentResolved: (agentId: string | null, displayName: string | null) => void;
};

export type ConversationMessage = {
  id: string;
  text: string;
  source: Role;
};

export type UseCallControllerReturn = {
  conversation: ReturnType<typeof useConversation>;
  conversationId: string | null;
  statusLabel: string;
  error: string | null;
  isStarting: boolean;
  isEnding: boolean;
  isCallActive: boolean;
  messages: ConversationMessage[];
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  resetCallState: () => void;
  clearError: () => void;
};

export const useCallController = ({
  effectiveAgentId,
  onAgentResolved,
}: UseCallControllerArgs): UseCallControllerReturn => {
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const messageCounterRef = useRef(0);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const handleIncomingMessage = useCallback(
    ({ message, source }: { message: string; source: Role }) => {
      const trimmedMessage = message.trim();
      if (!trimmedMessage) {
        return;
      }

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];

        if (lastMessage && lastMessage.source === source) {
          if (
            trimmedMessage.startsWith(lastMessage.text) ||
            lastMessage.text.startsWith(trimmedMessage)
          ) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, text: trimmedMessage },
            ];
          }
        }

        messageCounterRef.current += 1;

        return [
          ...prev,
          {
            id: `message-${messageCounterRef.current}`,
            source,
            text: trimmedMessage,
          },
        ];
      });
    },
    [],
  );

  const conversation = useConversation({
    onConnect: () => setError(null),
    onDisconnect: () => setConversationId(null),
    onError: (err) =>
      setError(err instanceof Error ? err.message : String(err)),
    onMessage: handleIncomingMessage,
  });

  const statusLabel = useMemo(() => {
    const status = conversation.status;
    if (status === "connecting") return "Connecting…";
    if (status === "connected") return "Connected";
    return "Idle";
  }, [conversation.status]);

  const isCallActive =
    conversation.status === "connected" ||
    conversation.status === "connecting";

  const startCall = useCallback(async () => {
    if (isCallActive) {
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone access.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Microphone permission is required to start the call.",
      );
      setIsStarting(false);
      return;
    }

    try {
      const response = await fetch(
        buildEndpointUrl("/api/elevenlabs/conversation-token"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            effectiveAgentId ? { agent_id: effectiveAgentId } : {},
          ),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to request conversation token.");
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const conversationToken = getTokenFromResponse(
        payload as Record<string, unknown>,
      );

      if (!conversationToken) {
        throw new Error("Conversation token missing from backend response.");
      }

      const resolvedAgentId =
        typeof payload.agent_id === "string"
          ? payload.agent_id.trim()
          : effectiveAgentId || null;

      setMessages([]);
      messageCounterRef.current = 0;

      const id = await conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
      });

      setConversationId(id);
      const rawDisplayName = payload["display_name"];
      let resolvedDisplayName: string | null = null;
      if (typeof rawDisplayName === "string") {
        const trimmedDisplayName = rawDisplayName.trim();
        resolvedDisplayName = trimmedDisplayName || null;
      }
      onAgentResolved(resolvedAgentId, resolvedDisplayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  }, [conversation, effectiveAgentId, isCallActive, onAgentResolved]);

  const endCall = useCallback(async () => {
    if (conversation.status === "disconnected") {
      return;
    }

    setIsEnding(true);
    setError(null);

    try {
      await conversation.endSession();
      setConversationId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsEnding(false);
    }
  }, [conversation]);

  const resetCallState = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    messageCounterRef.current = 0;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    conversation,
    conversationId,
    statusLabel,
    error,
    isStarting,
    isEnding,
    isCallActive,
    messages,
    startCall,
    endCall,
    resetCallState,
    clearError,
  };
};
