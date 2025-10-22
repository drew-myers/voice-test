import { AgentConfigTrigger } from "./AgentConfigTrigger";
import { LiveTranscript } from "./LiveTranscript";
import { AgentDetailsView } from "../hooks/usePromptWorkflow";
import {
  CallPanelActions,
  CallPanelState,
} from "../context/AgentExperienceContext";

type CallPanelProps = {
  state: CallPanelState;
  actions: CallPanelActions;
  agentDetails: AgentDetailsView;
};

export const CallPanel = ({
  state,
  actions,
  agentDetails,
}: CallPanelProps) => {
  const {
    statusLabel,
    conversationStatus,
    conversationId,
    error,
    promptMessage,
    isStarting,
    isEnding,
    isCallActive,
    isPromptLoading,
    messages,
  } = state;
  const { startCall, endCall, enterEditMode } = actions;
  const { hasAgentDetails, agentDisplayLabel, agentTooltip } = agentDetails;
  const agentName =
    hasAgentDetails && agentDisplayLabel ? agentDisplayLabel : "Agent";

  return (
    <>
      <header className="panel__header">
        <div className="panel__header-row">
          <h1>Voice Agent Training Demo</h1>
          <AgentConfigTrigger />
        </div>
        <p>Talk to the voice agent, then iterate on the prompt and try again.</p>
      </header>

      <div className="panel__status">
        <span className="label">Status</span>
        <span className={`status status--${conversationStatus}`}>
          {statusLabel}
        </span>
      </div>

      {hasAgentDetails && (
        <div className="panel__agent">
          <span className="label">Agent</span>
          <span className="panel__agent-name" title={agentTooltip ?? undefined}>
            {agentDisplayLabel}
          </span>
        </div>
      )}

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

      <LiveTranscript
        messages={messages}
        agentName={agentName}
        isCallActive={isCallActive}
      />

      <div className="panel__actions">
        <button
          type="button"
          className="button primary"
          onClick={startCall}
          disabled={isStarting || isCallActive || isPromptLoading}
        >
          {isStarting ? "Starting…" : "Start Call"}
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={endCall}
          disabled={!isCallActive || isEnding}
        >
          {isEnding ? "Ending…" : "End Call"}
        </button>
      </div>

      <button
        type="button"
        className="button tertiary"
        onClick={enterEditMode}
        disabled={isPromptLoading}
      >
        Give the agent feedback
      </button>
    </>
  );
};
