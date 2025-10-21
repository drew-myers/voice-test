import { Change, diffLines } from "diff";
import { ChevronDown, ChevronRight, Edit3, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import "./App.css";

const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "";

const buildEndpointUrl = (path: string) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path;

const getTokenFromResponse = (payload: Record<string, unknown>) => {
  const possibleTokenKeys = [
    "token",
    "conversationToken",
    "conversation_token",
  ];

  for (const key of possibleTokenKeys) {
    const value = payload[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return undefined;
};

const stripCodeFence = (input: string | null | undefined) => {
  if (!input) {
    return "";
  }
  const trimmed = input.trim();
  const fenceMatch = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

type EditStage = "input" | "loading" | "result" | "manual";

function App() {
  const [error, setError] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentFirstMessage, setCurrentFirstMessage] = useState("");
  const [firstMessageDraft, setFirstMessageDraft] = useState("");
  const [feedback, setFeedback] = useState("");

  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [manualPrompt, setManualPrompt] = useState<string | null>(null);
  const [diffParts, setDiffParts] = useState<Change[]>([]);
  const [editStage, setEditStage] = useState<EditStage>("input");
  const [mode, setMode] = useState<"call" | "edit">("call");
  const [firstMessageExpanded, setFirstMessageExpanded] = useState(false);

  const [isPromptLoading, setIsPromptLoading] = useState(true);
  const [isPromptSaving, setIsPromptSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showStopIcon, setShowStopIcon] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveformRef = useRef<HTMLSpanElement | null>(null);
  const skipTranscriptionRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => setError(null),
    onDisconnect: () => setConversationId(null),
    onError: (err) =>
      setError(err instanceof Error ? err.message : String(err)),
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsPromptLoading(true);
      setPromptError(null);
      try {
        const response = await fetch(
          buildEndpointUrl("/api/elevenlabs/prompt"),
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to fetch agent prompt.");
        }
        const data = (await response.json()) as {
          prompt?: string | null;
          first_message?: string | null;
        };
        if (!cancelled) {
          const prompt = data.prompt ?? "";
          const firstMessage = data.first_message ?? "";
          setCurrentPrompt(prompt);
          setCurrentFirstMessage(firstMessage);
          setFirstMessageDraft(firstMessage);
        }
      } catch (err) {
        if (!cancelled) {
          setPromptError(
            err instanceof Error ? err.message : "Failed to load prompt.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsPromptLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = useMemo(() => {
    const status = conversation.status;
    if (status === "connecting") return "Connecting…";
    if (status === "connected") return "Connected";
    return "Idle";
  }, [conversation.status]);

  const resetRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        skipTranscriptionRef.current = true;
        mediaRecorderRef.current.stop();
      } catch (err) {
        // ignore
      }
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    waveformRef.current?.style.setProperty("--waveform-scale", "0");
    recordedChunksRef.current = [];
    setIsRecording(false);
    setShowStopIcon(false);
  }, []);

  const resetSuggestionState = useCallback(() => {
    resetRecording();
    setSuggestedPrompt(null);
    setManualPrompt(null);
    setDiffParts([]);
    setSuggestError(null);
    setRecordingError(null);
    setFeedback("");
  }, [resetRecording]);

  const handleEnterEditMode = useCallback(() => {
    resetSuggestionState();
    setPromptError(null);
    setPromptMessage(null);
    setEditStage("input");
    setMode("edit");
    setFirstMessageExpanded(false);
  }, [resetSuggestionState]);

  const handleCancelEdit = useCallback(() => {
    resetSuggestionState();
    setPromptError(null);
    setPromptMessage(null);
    setFirstMessageDraft(currentFirstMessage);
    setMode("call");
  }, [currentFirstMessage, resetSuggestionState]);

  const handleSuggestPrompt = useCallback(async () => {
    setSuggestError(null);
    setEditStage("loading");
    setIsSuggesting(true);
    try {
      const response = await fetch(
        buildEndpointUrl("/api/elevenlabs/prompt/suggest"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to generate suggestion.");
      }

      const data = (await response.json()) as {
        current_prompt: string;
        suggested_prompt: string;
      };

      const basePrompt = stripCodeFence(data.current_prompt);
      const revisedPrompt = stripCodeFence(data.suggested_prompt);

      setCurrentPrompt(basePrompt);
      setSuggestedPrompt(revisedPrompt);
      setDiffParts(diffLines(basePrompt, revisedPrompt));
      setEditStage("result");
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : "Failed to generate suggestion.",
      );
      setSuggestedPrompt(null);
      setDiffParts([]);
      setEditStage("input");
    } finally {
      setIsSuggesting(false);
    }
  }, [feedback]);

  const handleSavePrompt = useCallback(
    async (nextPrompt: string, nextFirstMessage?: string | null) => {
      setPromptError(null);
      setPromptMessage(null);
      setIsPromptSaving(true);
      try {
        const payload: Record<string, unknown> = { prompt: nextPrompt };
        if (nextFirstMessage !== undefined) {
          payload.first_message = nextFirstMessage;
        }

        const response = await fetch(
          buildEndpointUrl("/api/elevenlabs/prompt"),
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to save prompt.");
        }

        const data = (await response.json()) as {
          prompt?: string | null;
          first_message?: string | null;
        };

        const updatedPrompt = data.prompt ?? nextPrompt;
        const updatedFirstMessage = data.first_message ?? currentFirstMessage;

        setCurrentPrompt(updatedPrompt);
        setCurrentFirstMessage(updatedFirstMessage);
        setFirstMessageDraft(updatedFirstMessage);
        setPromptMessage("Agent settings saved to ElevenLabs.");
        resetSuggestionState();
        setEditStage("input");
        setMode("call");
      } catch (err) {
        setPromptError(
          err instanceof Error ? err.message : "Failed to save prompt.",
        );
      } finally {
        setIsPromptSaving(false);
      }
    },
    [currentFirstMessage, resetSuggestionState],
  );

  const handleStartCall = useCallback(async () => {
    if (
      conversation.status === "connected" ||
      conversation.status === "connecting"
    ) {
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
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to request conversation token.");
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const conversationToken = getTokenFromResponse(payload);

      if (!conversationToken) {
        throw new Error("Conversation token missing from backend response.");
      }

      const id = await conversation.startSession({
        conversationToken,
        connectionType: "webrtc",
      });

      setConversationId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsStarting(false);
    }
  }, [conversation]);

  const handleEndCall = useCallback(async () => {
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

  const isCallActive =
    conversation.status === "connected" || conversation.status === "connecting";
  const hasFirstMessageChanges = firstMessageDraft !== currentFirstMessage;
  const isManualStage = editStage === "manual" && manualPrompt !== null;

  const renderDiff = () => (
    <div className="diff">
      {diffParts.map((part, index) => {
        const className = part.added
          ? "diff-line diff-line--added"
          : part.removed
            ? "diff-line diff-line--removed"
            : "diff-line";
        return (
          <pre key={index} className={className}>
            {part.value}
          </pre>
        );
      })}
    </div>
  );

  const renderCallMode = () => (
    <>
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

      {promptMessage && (
        <div className="panel__notice" role="status">
          {promptMessage}
        </div>
      )}

      <div className="panel__actions">
        <button
          type="button"
          className="button primary"
          onClick={handleStartCall}
          disabled={isStarting || isCallActive || isPromptLoading}
        >
          {isStarting ? "Starting…" : "Start Call"}
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={handleEndCall}
          disabled={!isCallActive || isEnding}
        >
          {isEnding ? "Ending…" : "End Call"}
        </button>
      </div>

      <button
        type="button"
        className="button tertiary"
        onClick={handleEnterEditMode}
        disabled={isPromptLoading}
      >
        Give the agent feedback
      </button>
    </>
  );

  const renderEditMode = () => (
    <>
      <header className="panel__header">
        <h1>Edit Agent Prompt</h1>
        <p>Provide feedback and review the suggested update.</p>
      </header>

      {editStage === "input" && (
        <section className="prompt-block">
          <label className="label" htmlFor="feedback-input">
            Your feedback
          </label>
          <div className="prompt-input-wrapper">
            <textarea
              id="feedback-input"
              className="prompt-input"
              placeholder="Describe what you'd like the agent to do differently…"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={6}
              disabled={isSuggesting || isPromptSaving || isRecording}
            />
            <button
              type="button"
              className={`record-button${isRecording ? " record-button--active" : ""
                }`}
              onMouseEnter={() => {
                if (isRecording) {
                  setShowStopIcon(true);
                }
              }}
              onMouseLeave={() => {
                if (isRecording) {
                  setShowStopIcon(false);
                }
              }}
              onClick={async () => {
                if (isRecording) {
                  const recorder = mediaRecorderRef.current;
                  skipTranscriptionRef.current = false;
                  recorder?.stop();
                  setShowStopIcon(false);
                  return;
                }

                setRecordingError(null);
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                  });
                  recordedChunksRef.current = [];
                  const recorder = new MediaRecorder(stream, {
                    mimeType: "audio/webm",
                  });
                  mediaRecorderRef.current = recorder;

                  audioContextRef.current = new AudioContext();
                  const source =
                    audioContextRef.current.createMediaStreamSource(stream);
                  analyserRef.current =
                    audioContextRef.current.createAnalyser();
                  analyserRef.current.fftSize = 256;
                  source.connect(analyserRef.current);
                  const dataArray = new Uint8Array(
                    analyserRef.current.frequencyBinCount,
                  );

                  const renderWaveform = () => {
                    if (analyserRef.current && waveformRef.current) {
                      analyserRef.current.getByteTimeDomainData(dataArray);
                      const normalized = dataArray.reduce((sum, value) => {
                        const deviation = Math.abs(value - 128) / 128;
                        return sum + deviation;
                      }, 0);
                      const average = normalized / dataArray.length;
                      const scale = Math.min(Math.max(average * 20, 0.05), 1);
                      waveformRef.current.style.setProperty(
                        "--waveform-scale",
                        `${scale}`,
                      );
                    }
                    animationFrameRef.current =
                      requestAnimationFrame(renderWaveform);
                  };
                  renderWaveform();

                  recorder.addEventListener("dataavailable", (event) => {
                    if (event.data.size > 0) {
                      recordedChunksRef.current.push(event.data);
                    }
                  });

                  recorder.addEventListener("stop", async () => {
                    setIsRecording(false);
                    setShowStopIcon(false);

                    if (animationFrameRef.current !== null) {
                      cancelAnimationFrame(animationFrameRef.current);
                      animationFrameRef.current = null;
                    }
                    waveformRef.current?.style.setProperty(
                      "--waveform-scale",
                      "0",
                    );

                    analyserRef.current?.disconnect();
                    analyserRef.current = null;
                    if (audioContextRef.current) {
                      await audioContextRef.current
                        .close()
                        .catch(() => undefined);
                      audioContextRef.current = null;
                    }

                    recorder.stream
                      .getTracks()
                      .forEach((track) => track.stop());

                    const skip = skipTranscriptionRef.current;
                    skipTranscriptionRef.current = false;

                    if (!skip) {
                      try {
                        const blob = new Blob(recordedChunksRef.current, {
                          type: "audio/webm",
                        });
                        const arrayBuffer = await blob.arrayBuffer();
                        const base64Audio = arrayBufferToBase64(arrayBuffer);

                        const response = await fetch(
                          buildEndpointUrl("/api/elevenlabs/transcribe"),
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              audio: base64Audio,
                              format: "webm",
                            }),
                          },
                        );

                        if (!response.ok) {
                          const detail = await response.text();
                          throw new Error(
                            detail || "Failed to transcribe audio.",
                          );
                        }

                        const payload = (await response.json()) as {
                          text: string;
                        };

                        const transcript = payload.text.trim();
                        if (transcript) {
                          setFeedback((prev) =>
                            prev
                              ? `${prev.trim()} ${transcript}`.trim()
                              : transcript,
                          );
                        }
                      } catch (err) {
                        setRecordingError(
                          err instanceof Error
                            ? err.message
                            : "Failed to transcribe audio.",
                        );
                      }
                    }

                    recordedChunksRef.current = [];
                    mediaRecorderRef.current = null;
                  });

                  recorder.start();
                  skipTranscriptionRef.current = false;
                  setIsRecording(true);
                  setShowStopIcon(false);
                } catch (err) {
                  setRecordingError(
                    err instanceof Error
                      ? err.message
                      : "Unable to access microphone.",
                  );
                  resetRecording();
                }
              }}
              disabled={isSuggesting || isPromptSaving}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                showStopIcon ? (
                  <Square size={16} />
                ) : (
                  <span
                    className="record-waveform"
                    aria-hidden="true"
                    ref={waveformRef}
                  />
                )
              ) : (
                <Mic size={16} />
              )}
            </button>
          </div>
          {recordingError && (
            <div className="panel__error" role="alert">
              {recordingError}
            </div>
          )}
          <div className="prompt-actions">
            <button
              type="button"
              className="button outline"
              onClick={handleSuggestPrompt}
              disabled={
                isSuggesting ||
                isPromptLoading ||
                isPromptSaving ||
                isRecording ||
                feedback.trim().length === 0
              }
            >
              {isSuggesting ? "Generating…" : "Generate suggestion"}
            </button>
          </div>
          {suggestError && (
            <div className="panel__error" role="alert">
              {suggestError}
            </div>
          )}
        </section>
      )}

      {editStage === "loading" && (
        <section className="prompt-block loading">
          <span className="label">Generating suggestion…</span>
        </section>
      )}

      {editStage === "result" && suggestedPrompt && (
        <section className="prompt-block">
          <div className="prompt-header">
            <span className="label">Suggested changes</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setManualPrompt(suggestedPrompt);
                setEditStage("manual");
              }}
              aria-label="Edit suggested prompt"
            >
              <Edit3 size={16} />
            </button>
          </div>
          {renderDiff()}
          <div className="prompt-actions">
            <button
              type="button"
              className="button primary"
              onClick={() =>
                handleSavePrompt(suggestedPrompt, firstMessageDraft)
              }
              disabled={isPromptSaving}
            >
              {isPromptSaving ? "Saving…" : "Accept & Test"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                resetSuggestionState();
                setEditStage("input");
              }}
              disabled={isPromptSaving}
            >
              Reject
            </button>
          </div>
        </section>
      )}

      {editStage === "manual" && manualPrompt !== null && (
        <section className="prompt-block">
          <div className="prompt-header">
            <span className="label">Edit suggested prompt</span>
          </div>
          <textarea
            className="prompt-input"
            value={manualPrompt}
            onChange={(event) => setManualPrompt(event.target.value)}
            rows={10}
            disabled={isPromptSaving}
          />
          <div className="prompt-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setManualPrompt(null);
                setEditStage("result");
              }}
              disabled={isPromptSaving}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="prompt-block first-message-block">
        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setFirstMessageExpanded((prev) => !prev)}
        >
          <span className="label">First message</span>
          {firstMessageExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        {firstMessageExpanded && (
          <div className="first-message-panel">
            <textarea
              id="first-message-input"
              className="prompt-input"
              placeholder="What should the agent say first?"
              value={firstMessageDraft}
              onChange={(event) => setFirstMessageDraft(event.target.value)}
              rows={4}
              disabled={isPromptSaving || isSuggesting || isRecording}
            />
            <p className="prompt-hint">
              Leave blank to have the agent wait for the user to speak first.
            </p>
            <div className="prompt-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setFirstMessageDraft(currentFirstMessage)}
                disabled={
                  isPromptSaving ||
                  isSuggesting ||
                  isRecording ||
                  !hasFirstMessageChanges
                }
              >
                Reset
              </button>
            </div>
            {hasFirstMessageChanges && (
              <p className="prompt-hint prompt-hint--warning">
                Save changes to update the agent's first message.
              </p>
            )}
          </div>
        )}
      </section>

      {promptError && (
        <div className="panel__error" role="alert">
          {promptError}
        </div>
      )}
      <div className="prompt-footer">
        <button
          type="button"
          className="button primary"
          onClick={() => {
            if (isManualStage && manualPrompt !== null) {
              void handleSavePrompt(manualPrompt, firstMessageDraft);
            } else if (hasFirstMessageChanges) {
              void handleSavePrompt(currentPrompt, firstMessageDraft || "");
            }
          }}
          disabled={
            isPromptSaving ||
            isSuggesting ||
            isRecording ||
            (!isManualStage && !hasFirstMessageChanges)
          }
        >
          {isPromptSaving ? "Saving…" : "Save & Test"}
        </button>
        <button
          type="button"
          className="button tertiary"
          onClick={handleCancelEdit}
          disabled={isPromptSaving || isSuggesting}
        >
          Back to call
        </button>
      </div>
    </>
  );

  return (
    <main className="app">
      <section className="panel">
        {mode === "call" ? renderCallMode() : renderEditMode()}
      </section>
    </main>
  );
}

export default App;
