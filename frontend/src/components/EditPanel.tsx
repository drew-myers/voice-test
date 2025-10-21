import { RefObject } from "react";
import { ChevronDown, ChevronRight, Edit3, Mic, Square } from "lucide-react";
import { DiffView } from "./DiffView";
import { AgentConfigTrigger } from "./AgentConfigTrigger";
import {
  AgentDetailsView,
  PromptViewActions,
  PromptViewState,
} from "../hooks/usePromptWorkflow";

type RecorderControls = {
  isRecording: boolean;
  showStopIcon: boolean;
  recordingError: string | null;
  waveformRef: RefObject<HTMLSpanElement | null>;
  onToggleRecording: () => void;
};

type EditPanelProps = {
  agentDetails: AgentDetailsView;
  prompt: {
    state: PromptViewState;
    actions: PromptViewActions;
  };
  recorderControls: RecorderControls;
};

export const EditPanel = ({
  agentDetails,
  prompt,
  recorderControls,
}: EditPanelProps) => {
  const { isRecording, showStopIcon, recordingError, waveformRef, onToggleRecording } =
    recorderControls;
  const { state, actions } = prompt;
  const {
    editStage,
    feedback,
    isSuggesting,
    isPromptLoading,
    isPromptSaving,
    suggestError,
    diffParts,
    suggestedPrompt,
    manualPrompt,
    isManualStage,
    firstMessageExpanded,
    firstMessageDraft,
    hasFirstMessageChanges,
    promptError,
  } = state;
  const {
    onFeedbackChange,
    onSuggest,
    onAcceptSuggestion,
    onRejectSuggestion,
    onEnterManualEdit,
    onManualPromptChange,
    onCancelManualEdit,
    onToggleFirstMessage,
    onFirstMessageChange,
    onFirstMessageReset,
    onSave,
    onCancel,
  } = actions;
  const { hasAgentDetails, agentDisplayLabel, agentTooltip } = agentDetails;

  const isGenerateDisabled =
    isSuggesting ||
    isPromptLoading ||
    isPromptSaving ||
    isRecording ||
    feedback.trim().length === 0;

  return (
    <>
      <header className="panel__header">
        <div className="panel__header-row">
          <h1>Edit Agent Prompt</h1>
          <AgentConfigTrigger />
        </div>
        <p>Provide feedback and review the suggested update.</p>
      </header>

      {hasAgentDetails && (
        <div className="panel__agent">
          <span className="label">Agent</span>
          <span className="panel__agent-name" title={agentTooltip ?? undefined}>
            {agentDisplayLabel}
          </span>
        </div>
      )}

      {editStage === "input" && (
        <section className="prompt-block">
          <label className="label" htmlFor="feedback-input">
            Your feedback
          </label>
          <div className="prompt-input-with-actions">
            <textarea
              id="feedback-input"
              className="prompt-input"
              placeholder="Summarize what needs to change about the agent..."
              value={feedback}
              onChange={(event) => onFeedbackChange(event.target.value)}
              rows={6}
              disabled={isSuggesting || isPromptSaving || isRecording}
            />
            <div className="prompt-input__actions">
              <button
                type="button"
                className="icon-button"
                onClick={onToggleRecording}
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
              onClick={() => {
                void onSuggest();
              }}
              disabled={isGenerateDisabled}
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
              onClick={onEnterManualEdit}
              aria-label="Edit suggested prompt"
            >
              <Edit3 size={16} />
            </button>
          </div>
          <DiffView parts={diffParts} />
          <div className="prompt-actions">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                void onAcceptSuggestion();
              }}
              disabled={isPromptSaving}
            >
              {isPromptSaving ? "Saving…" : "Accept & Test"}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={onRejectSuggestion}
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
            onChange={(event) => onManualPromptChange(event.target.value)}
            rows={10}
            disabled={isPromptSaving}
          />
          <div className="prompt-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onCancelManualEdit}
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
          onClick={onToggleFirstMessage}
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
              onChange={(event) => onFirstMessageChange(event.target.value)}
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
                onClick={onFirstMessageReset}
                disabled={
                  isPromptSaving || isSuggesting || isRecording || !hasFirstMessageChanges
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
            void onSave();
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
          onClick={onCancel}
          disabled={isPromptSaving || isSuggesting}
        >
          Back to call
        </button>
      </div>
    </>
  );
};
