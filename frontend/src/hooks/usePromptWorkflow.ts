import { useCallback, useMemo, useState } from "react";
import { Change } from "diff";
import {
  AgentDetails,
  PromptEditorState,
  usePromptEditor,
} from "./usePromptEditor";

export type Mode = "call" | "edit";

export type AgentDetailsView = Pick<
  AgentDetails,
  "hasAgentDetails" | "agentDisplayLabel" | "agentTooltip"
>;

export type PromptViewState = Pick<
  PromptEditorState,
  | "editStage"
  | "feedback"
  | "isSuggesting"
  | "isPromptLoading"
  | "isPromptSaving"
  | "suggestError"
  | "diffParts"
  | "suggestedPrompt"
  | "manualPrompt"
  | "isManualStage"
  | "firstMessageExpanded"
  | "firstMessageDraft"
  | "hasFirstMessageChanges"
  | "promptError"
>;

export type PromptViewActions = {
  onFeedbackChange: (value: string) => void;
  onSuggest: () => Promise<void>;
  onAcceptSuggestion: () => Promise<void>;
  onRejectSuggestion: () => void;
  onEnterManualEdit: () => void;
  onManualPromptChange: (value: string) => void;
  onCancelManualEdit: () => void;
  onToggleFirstMessage: () => void;
  onFirstMessageChange: (value: string) => void;
  onFirstMessageReset: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
};

type UsePromptWorkflowArgs = {
  effectiveAgentId: string | null;
  resetRecorder: () => void;
};

type PromptView = {
  state: PromptViewState;
  actions: PromptViewActions;
};

export type PromptWorkflow = {
  mode: Mode;
  agentDetailsView: AgentDetailsView;
  promptView: PromptView;
  promptMessage: string | null;
  isPromptLoading: boolean;
  appendTranscript: (transcript: string) => void;
  enterEditMode: () => void;
  resetToCallMode: () => void;
  setAgentDetails: (agentId: string | null, displayName: string | null) => void;
  handleAgentConfigChange: () => void;
};

export const usePromptWorkflow = ({
  effectiveAgentId,
  resetRecorder,
}: UsePromptWorkflowArgs): PromptWorkflow => {
  const [mode, setMode] = useState<Mode>("call");

  const {
    agentDetails,
    state: promptState,
    actions: promptActions,
  } = usePromptEditor({
    effectiveAgentId,
    resetRecorder,
  });

  const {
    setFeedback,
    setManualPrompt,
    setFirstMessageDraft,
    toggleFirstMessageExpanded,
    resetFirstMessageDraft,
    enterEditMode: enterPromptEditMode,
    cancelEditMode: cancelPromptEditMode,
    suggestPrompt,
    acceptSuggestion,
    rejectSuggestion,
    enterManualEdit,
    cancelManualEdit,
    saveCurrentDraft,
    handleAgentConfigChange,
    setAgentDetails,
  } = promptActions;

  const agentDetailsView = useMemo<AgentDetailsView>(
    () => ({
      hasAgentDetails: agentDetails.hasAgentDetails,
      agentDisplayLabel: agentDetails.agentDisplayLabel,
      agentTooltip: agentDetails.agentTooltip,
    }),
    [agentDetails],
  );

  const promptViewState = useMemo<PromptViewState>(
    () => ({
      editStage: promptState.editStage,
      feedback: promptState.feedback,
      isSuggesting: promptState.isSuggesting,
      isPromptLoading: promptState.isPromptLoading,
      isPromptSaving: promptState.isPromptSaving,
      suggestError: promptState.suggestError,
      diffParts: promptState.diffParts as Change[],
      suggestedPrompt: promptState.suggestedPrompt,
      manualPrompt: promptState.manualPrompt,
      isManualStage: promptState.isManualStage,
      firstMessageExpanded: promptState.firstMessageExpanded,
      firstMessageDraft: promptState.firstMessageDraft,
      hasFirstMessageChanges: promptState.hasFirstMessageChanges,
      promptError: promptState.promptError,
    }),
    [promptState],
  );

  const appendTranscript = useCallback(
    (transcript: string) => {
      setFeedback((prev) =>
        prev ? `${prev.trim()} ${transcript}`.trim() : transcript,
      );
    },
    [setFeedback],
  );

  const enterEditMode = useCallback(() => {
    enterPromptEditMode();
    setMode("edit");
  }, [enterPromptEditMode]);

  const resetToCallMode = useCallback(() => {
    setMode("call");
  }, []);

  const handleFeedbackChange = useCallback(
    (value: string) => {
      setFeedback(value);
    },
    [setFeedback],
  );

  const handleSuggest = useCallback(
    () => suggestPrompt(),
    [suggestPrompt],
  );

  const handleAcceptSuggestion = useCallback(async () => {
    const success = await acceptSuggestion();
    if (success) {
      setMode("call");
    }
  }, [acceptSuggestion]);

  const handleRejectSuggestion = useCallback(
    () => rejectSuggestion(),
    [rejectSuggestion],
  );

  const handleEnterManualEdit = useCallback(
    () => enterManualEdit(),
    [enterManualEdit],
  );

  const handleManualPromptChange = useCallback(
    (value: string) => {
      setManualPrompt(value);
    },
    [setManualPrompt],
  );

  const handleCancelManualEdit = useCallback(
    () => cancelManualEdit(),
    [cancelManualEdit],
  );

  const handleToggleFirstMessage = useCallback(
    () => toggleFirstMessageExpanded(),
    [toggleFirstMessageExpanded],
  );

  const handleFirstMessageChange = useCallback(
    (value: string) => {
      setFirstMessageDraft(value);
    },
    [setFirstMessageDraft],
  );

  const handleFirstMessageReset = useCallback(
    () => resetFirstMessageDraft(),
    [resetFirstMessageDraft],
  );

  const handleSave = useCallback(async () => {
    const success = await saveCurrentDraft();
    if (success) {
      setMode("call");
    }
  }, [saveCurrentDraft]);

  const handleCancel = useCallback(() => {
    cancelPromptEditMode();
    setMode("call");
  }, [cancelPromptEditMode]);

  const promptActionsView = useMemo<PromptViewActions>(
    () => ({
      onFeedbackChange: handleFeedbackChange,
      onSuggest: handleSuggest,
      onAcceptSuggestion: handleAcceptSuggestion,
      onRejectSuggestion: handleRejectSuggestion,
      onEnterManualEdit: handleEnterManualEdit,
      onManualPromptChange: handleManualPromptChange,
      onCancelManualEdit: handleCancelManualEdit,
      onToggleFirstMessage: handleToggleFirstMessage,
      onFirstMessageChange: handleFirstMessageChange,
      onFirstMessageReset: handleFirstMessageReset,
      onSave: handleSave,
      onCancel: handleCancel,
    }),
    [
      handleAcceptSuggestion,
      handleCancel,
      handleCancelManualEdit,
      handleFeedbackChange,
      handleFirstMessageChange,
      handleFirstMessageReset,
      handleManualPromptChange,
      handleRejectSuggestion,
      handleSave,
      handleSuggest,
      handleToggleFirstMessage,
      handleEnterManualEdit,
    ],
  );

  const promptView = useMemo<PromptView>(
    () => ({
      state: promptViewState,
      actions: promptActionsView,
    }),
    [promptActionsView, promptViewState],
  );

  return {
    mode,
    agentDetailsView,
    promptView,
    promptMessage: promptState.promptMessage,
    isPromptLoading: promptState.isPromptLoading,
    appendTranscript,
    enterEditMode,
    resetToCallMode,
    setAgentDetails,
    handleAgentConfigChange,
  };
};
