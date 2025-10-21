import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAgentOverride } from "../hooks/useAgentOverride";
import { useFeedbackRecorder } from "../hooks/useFeedbackRecorder";
import {
  useCallController,
  UseCallControllerReturn,
} from "../hooks/useCallController";
import {
  AgentConfigView,
  useAgentConfigControls,
} from "../hooks/useAgentConfigControls";
import {
  AgentDetailsView,
  Mode,
  PromptViewActions,
  PromptViewState,
  usePromptWorkflow,
} from "../hooks/usePromptWorkflow";

export type CallPanelState = {
  statusLabel: string;
  conversationStatus: UseCallControllerReturn["conversation"]["status"];
  conversationId: string | null;
  error: string | null;
  promptMessage: string | null;
  isStarting: boolean;
  isEnding: boolean;
  isCallActive: boolean;
  isPromptLoading: boolean;
};

export type CallPanelActions = {
  startCall: () => void;
  endCall: () => void;
  enterEditMode: () => void;
};

export type RecorderView = {
  isRecording: boolean;
  showStopIcon: boolean;
  recordingError: string | null;
  waveformRef: RefObject<HTMLSpanElement | null>;
  toggleRecording: () => Promise<void>;
};

type AgentExperienceContextValue = {
  mode: Mode;
  agentDetails: AgentDetailsView;
  call: {
    state: CallPanelState;
    actions: CallPanelActions;
  };
  prompt: {
    state: PromptViewState;
    actions: PromptViewActions;
  };
  recorder: RecorderView;
  agentConfig: AgentConfigView;
};

const AgentExperienceContext = createContext<AgentExperienceContextValue | null>(
  null,
);

export const AgentExperienceProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const transcriptHandlerRef = useRef<(text: string) => void>(() => {});

  const {
    isRecording,
    showStopIcon,
    recordingError,
    waveformRef,
    toggleRecording,
    reset: resetRecorder,
  } = useFeedbackRecorder({
    onTranscript: (transcript) => transcriptHandlerRef.current(transcript),
  });

  const overrideState = useAgentOverride();
  const { agentOverride } = overrideState;

  const effectiveAgentId = useMemo(() => {
    const trimmed = agentOverride?.trim();
    return trimmed ? trimmed : null;
  }, [agentOverride]);

  const {
    mode,
    agentDetailsView,
    promptView,
    promptMessage,
    isPromptLoading,
    appendTranscript,
    enterEditMode: beginPromptEdit,
    resetToCallMode,
    setAgentDetails,
    handleAgentConfigChange,
  } = usePromptWorkflow({
    effectiveAgentId,
    resetRecorder,
  });

  useEffect(() => {
    transcriptHandlerRef.current = appendTranscript;
  }, [appendTranscript]);

  const {
    conversation,
    conversationId,
    statusLabel,
    error,
    isStarting,
    isEnding,
    isCallActive,
    startCall,
    endCall,
    resetCallState,
    clearError,
  } = useCallController({
    effectiveAgentId,
    onAgentResolved: setAgentDetails,
  });

  const conversationStatus = conversation.status;

  const callState = useMemo<CallPanelState>(
    () => ({
      statusLabel,
      conversationStatus,
      conversationId,
      error,
      promptMessage,
      isStarting,
      isEnding,
      isCallActive,
      isPromptLoading,
    }),
    [
      conversationId,
      conversationStatus,
      error,
      isCallActive,
      isEnding,
      isPromptLoading,
      isStarting,
      promptMessage,
      statusLabel,
    ],
  );

  const callActions = useMemo<CallPanelActions>(
    () => ({
      startCall: () => {
        void startCall();
      },
      endCall: () => {
        void endCall();
      },
      enterEditMode: () => {
        clearError();
        beginPromptEdit();
      },
    }),
    [beginPromptEdit, clearError, endCall, startCall],
  );

  const recorderView = useMemo<RecorderView>(
    () => ({
      isRecording,
      showStopIcon,
      recordingError,
      waveformRef,
      toggleRecording,
    }),
    [isRecording, recordingError, showStopIcon, toggleRecording, waveformRef],
  );

  const agentConfigView = useAgentConfigControls({
    overrideState,
    agentOverride,
    isCallActive,
    endCall,
    resetCallState,
    clearError,
    setAgentDetails,
    handleAgentConfigChange,
    resetToCallMode,
  });

  const contextValue = useMemo<AgentExperienceContextValue>(
    () => ({
      mode,
      agentDetails: agentDetailsView,
      call: {
        state: callState,
        actions: callActions,
      },
      prompt: {
        state: promptView.state,
        actions: promptView.actions,
      },
      recorder: recorderView,
      agentConfig: agentConfigView,
    }),
    [
      agentConfigView,
      agentDetailsView,
      callActions,
      callState,
      mode,
      promptView,
      recorderView,
    ],
  );

  return (
    <AgentExperienceContext.Provider value={contextValue}>
      {children}
    </AgentExperienceContext.Provider>
  );
};

export const useAgentExperience = () => {
  const context = useContext(AgentExperienceContext);
  if (!context) {
    throw new Error(
      "useAgentExperience must be used within an AgentExperienceProvider",
    );
  }
  return context;
};
