import { useCallback, useMemo, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  '',
) ?? '';

const buildEndpointUrl = (path: string) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path;

const getTokenFromResponse = (payload: Record<string, unknown>) => {
  const possibleTokenKeys = ['token', 'conversationToken', 'conversation_token'];

  for (const key of possibleTokenKeys) {
    const value = payload[key];
    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return undefined;
};

function App() {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
    },
    onDisconnect: () => {
      setConversationId(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err));
    },
  });

  const statusLabel = useMemo(() => {
    const status = conversation.status;
    if (status === 'connecting') return 'Connecting…';
    if (status === 'connected') return 'Connected';
    return 'Idle';
  }, [conversation.status]);

  const handleStartCall = useCallback(async () => {
    if (conversation.status === 'connected' || conversation.status === 'connecting') {
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support microphone access.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Microphone permission is required to start the call.',
      );
      setIsStarting(false);
      return;
    }

    try {
      const response = await fetch(
        buildEndpointUrl('/api/elevenlabs/conversation-token'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || 'Failed to request conversation token.');
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const conversationToken = getTokenFromResponse(payload);

      if (!conversationToken) {
        throw new Error('Conversation token missing from backend response.');
      }

      const id = await conversation.startSession({
        conversationToken,
        connectionType: 'webrtc',
      });

      setConversationId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  }, [conversation]);

  const handleEndCall = useCallback(async () => {
    if (conversation.status === 'disconnected') {
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

  const isCallActive =
    conversation.status === 'connected' || conversation.status === 'connecting';

  return (
    <main className="app">
      <section className="panel">
        <header className="panel__header">
          <h1>Voice Test</h1>
          <p>Start an ElevenLabs WebRTC session from the browser.</p>
        </header>

        <div className="panel__status">
          <span className="label">Status</span>
          <span className={`status status--${conversation.status}`}>
            {statusLabel}
          </span>
        </div>

        {conversationId && (
          <div className="panel__conversation">
            <span className="label">Conversation ID</span>
            <code>{conversationId}</code>
          </div>
        )}

        {error && (
          <div className="panel__error" role="alert">
            {error}
          </div>
        )}

        <div className="panel__actions">
          <button
            type="button"
            className="button primary"
            onClick={handleStartCall}
            disabled={isStarting || isCallActive}
          >
            {isStarting ? 'Starting…' : 'Start Call'}
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={handleEndCall}
            disabled={!isCallActive || isEnding}
          >
            {isEnding ? 'Ending…' : 'End Call'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default App;
