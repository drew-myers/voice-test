import { Change, diffLines } from "diff";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildEndpointUrl } from "../utils/api";
import { stripCodeFence } from "../utils/text";

export type EditStage = "input" | "loading" | "result" | "manual";

type UsePromptEditorArgs = {
  effectiveAgentId: string | null;
  resetRecorder: () => void;
};

export type AgentDetails = {
  currentAgentId: string | null;
  currentAgentName: string | null;
  hasAgentDetails: boolean;
  agentDisplayLabel: string;
  agentTooltip?: string;
};

export type PromptEditorState = {
  currentPrompt: string;
  currentFirstMessage: string;
  firstMessageDraft: string;
  feedback: string;
  suggestedPrompt: string | null;
  manualPrompt: string | null;
  diffParts: Change[];
  editStage: EditStage;
  firstMessageExpanded: boolean;
  promptError: string | null;
  promptMessage: string | null;
  suggestError: string | null;
  isPromptLoading: boolean;
  isPromptSaving: boolean;
  isSuggesting: boolean;
  isManualStage: boolean;
  hasFirstMessageChanges: boolean;
};

export type PromptEditorActions = {
  setFeedback: Dispatch<SetStateAction<string>>;
  setManualPrompt: Dispatch<SetStateAction<string | null>>;
  setFirstMessageDraft: Dispatch<SetStateAction<string>>;
  toggleFirstMessageExpanded: () => void;
  resetFirstMessageDraft: () => void;
  enterEditMode: () => void;
  cancelEditMode: () => void;
  suggestPrompt: () => Promise<void>;
  acceptSuggestion: () => Promise<boolean>;
  rejectSuggestion: () => void;
  enterManualEdit: () => void;
  cancelManualEdit: () => void;
  saveCurrentDraft: () => Promise<boolean>;
  handleAgentConfigChange: () => void;
  setAgentDetails: (agentId: string | null, displayName: string | null) => void;
  clearPromptMessage: () => void;
};

export type UsePromptEditorReturn = {
  agentDetails: AgentDetails;
  state: PromptEditorState;
  actions: PromptEditorActions;
};

export const usePromptEditor = ({
  effectiveAgentId,
  resetRecorder,
}: UsePromptEditorArgs): UsePromptEditorReturn => {
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentFirstMessage, setCurrentFirstMessage] = useState("");
  const [firstMessageDraft, setFirstMessageDraft] = useState("");
  const [feedback, setFeedback] = useState("");

  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [manualPrompt, setManualPrompt] = useState<string | null>(null);
  const [diffParts, setDiffParts] = useState<Change[]>([]);
  const [editStage, setEditStage] = useState<EditStage>("input");
  const [firstMessageExpanded, setFirstMessageExpanded] = useState(false);

  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [isPromptLoading, setIsPromptLoading] = useState(true);
  const [isPromptSaving, setIsPromptSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null);

  const resetSuggestionState = useCallback(() => {
    resetRecorder();
    setSuggestedPrompt(null);
    setManualPrompt(null);
    setDiffParts([]);
    setSuggestError(null);
    setFeedback("");
  }, [resetRecorder]);

  const clearPromptMessage = useCallback(() => {
    setPromptMessage(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPrompt = async () => {
      setIsPromptLoading(true);
      setPromptError(null);
      setCurrentAgentId(effectiveAgentId ?? null);
      setCurrentAgentName(null);

      try {
        const query = effectiveAgentId
          ? `?agent_id=${encodeURIComponent(effectiveAgentId)}`
          : "";
        const response = await fetch(
          buildEndpointUrl(`/api/elevenlabs/prompt${query}`),
        );
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to fetch agent prompt.");
        }

        const data = (await response.json()) as {
          agent_id?: string | null;
          display_name?: string | null;
          prompt?: string | null;
          first_message?: string | null;
        };

        if (!cancelled) {
          const prompt = data.prompt ?? "";
          const firstMessage = data.first_message ?? "";
          const agentId = data.agent_id?.trim() || effectiveAgentId || null;
          const displayName =
            typeof data.display_name === "string"
              ? data.display_name.trim() || null
              : null;

          setCurrentPrompt(prompt);
          setCurrentFirstMessage(firstMessage);
          setFirstMessageDraft(firstMessage);
          setCurrentAgentId(agentId);
          setCurrentAgentName(displayName);
          resetSuggestionState();
          setEditStage("input");
          setFirstMessageExpanded(false);
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

    void loadPrompt();

    return () => {
      cancelled = true;
    };
  }, [effectiveAgentId, resetSuggestionState]);

  const isManualStage = useMemo(
    () => editStage === "manual" && manualPrompt !== null,
    [editStage, manualPrompt],
  );

  const hasFirstMessageChanges = useMemo(
    () => firstMessageDraft !== currentFirstMessage,
    [currentFirstMessage, firstMessageDraft],
  );

  const agentDisplayLabel = useMemo(() => {
    if (currentAgentName) {
      return currentAgentName;
    }
    if (currentAgentId) {
      return currentAgentId;
    }
    if (effectiveAgentId) {
      return effectiveAgentId;
    }
    return "";
  }, [currentAgentId, currentAgentName, effectiveAgentId]);

  const agentTooltip = useMemo(() => {
    if (currentAgentName && currentAgentId) {
      return currentAgentId;
    }
    if (!currentAgentName && effectiveAgentId && effectiveAgentId !== agentDisplayLabel) {
      return effectiveAgentId;
    }
    if (!currentAgentName && currentAgentId) {
      return currentAgentId;
    }
    return undefined;
  }, [agentDisplayLabel, currentAgentId, currentAgentName, effectiveAgentId]);

  const hasAgentDetails = useMemo(
    () => Boolean(agentDisplayLabel),
    [agentDisplayLabel],
  );

  const enterEditMode = useCallback(() => {
    resetSuggestionState();
    setPromptError(null);
    setPromptMessage(null);
    setEditStage("input");
    setFirstMessageExpanded(false);
  }, [resetSuggestionState]);

  const cancelEditMode = useCallback(() => {
    resetSuggestionState();
    setPromptError(null);
    setPromptMessage(null);
    setFirstMessageDraft(currentFirstMessage);
    setFirstMessageExpanded(false);
  }, [currentFirstMessage, resetSuggestionState]);

  const suggestPrompt = useCallback(async () => {
    setSuggestError(null);
    setEditStage("loading");
    setIsSuggesting(true);
    try {
      const response = await fetch(
        buildEndpointUrl("/api/elevenlabs/prompt/suggest"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feedback,
            agent_id: effectiveAgentId ?? undefined,
          }),
        },
      );

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to generate suggestion.");
      }

      const data = (await response.json()) as {
        agent_id?: string | null;
        display_name?: string | null;
        current_prompt: string;
        suggested_prompt: string;
      };

      const basePrompt = stripCodeFence(data.current_prompt);
      const revisedPrompt = stripCodeFence(data.suggested_prompt);
      const resolvedAgentId = data.agent_id?.trim() || effectiveAgentId || null;
      const resolvedDisplayName =
        typeof data.display_name === "string"
          ? data.display_name.trim() || null
          : resolvedAgentId !== currentAgentId
            ? null
            : currentAgentName;

      setCurrentPrompt(basePrompt);
      setSuggestedPrompt(revisedPrompt);
      setDiffParts(diffLines(basePrompt, revisedPrompt));
      setCurrentAgentId(resolvedAgentId);
      setCurrentAgentName(resolvedDisplayName ?? null);
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
  }, [
    currentAgentId,
    currentAgentName,
    effectiveAgentId,
    feedback,
  ]);

  const savePrompt = useCallback(
    async (nextPrompt: string, nextFirstMessage?: string | null) => {
      setPromptError(null);
      setPromptMessage(null);
      setIsPromptSaving(true);
      try {
        const payload: Record<string, unknown> = { prompt: nextPrompt };
        if (nextFirstMessage !== undefined) {
          payload.first_message = nextFirstMessage;
        }
        if (effectiveAgentId) {
          payload.agent_id = effectiveAgentId;
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
          agent_id?: string | null;
          display_name?: string | null;
          prompt?: string | null;
          first_message?: string | null;
        };

        const updatedPrompt = data.prompt ?? nextPrompt;
        const updatedFirstMessage =
          data.first_message ?? currentFirstMessage;
        const resolvedAgentId =
          data.agent_id?.trim() || effectiveAgentId || null;
        const resolvedDisplayName =
          typeof data.display_name === "string"
            ? data.display_name.trim() || null
            : resolvedAgentId !== currentAgentId
              ? null
              : currentAgentName;

        setCurrentPrompt(updatedPrompt);
        setCurrentFirstMessage(updatedFirstMessage);
        setFirstMessageDraft(updatedFirstMessage);
        setCurrentAgentId(resolvedAgentId);
        setCurrentAgentName(resolvedDisplayName ?? null);
        setPromptMessage("Agent settings saved to ElevenLabs.");
        resetSuggestionState();
        setEditStage("input");
        setFirstMessageExpanded(false);
        return true;
      } catch (err) {
        setPromptError(
          err instanceof Error ? err.message : "Failed to save prompt.",
        );
        return false;
      } finally {
        setIsPromptSaving(false);
      }
    },
    [
      currentAgentId,
      currentAgentName,
      currentFirstMessage,
      effectiveAgentId,
      resetSuggestionState,
    ],
  );

  const acceptSuggestion = useCallback(async () => {
    if (!suggestedPrompt) {
      return false;
    }
    return savePrompt(suggestedPrompt, firstMessageDraft);
  }, [firstMessageDraft, savePrompt, suggestedPrompt]);

  const saveCurrentDraft = useCallback(async () => {
    if (isManualStage && manualPrompt !== null) {
      return savePrompt(manualPrompt, firstMessageDraft);
    }
    if (hasFirstMessageChanges) {
      return savePrompt(currentPrompt, firstMessageDraft || "");
    }
    return false;
  }, [
    currentPrompt,
    firstMessageDraft,
    hasFirstMessageChanges,
    isManualStage,
    manualPrompt,
    savePrompt,
  ]);

  const rejectSuggestion = useCallback(() => {
    resetSuggestionState();
    setEditStage("input");
  }, [resetSuggestionState]);

  const enterManualEdit = useCallback(() => {
    if (!suggestedPrompt) {
      return;
    }
    setManualPrompt(suggestedPrompt);
    setEditStage("manual");
  }, [suggestedPrompt]);

  const cancelManualEdit = useCallback(() => {
    setManualPrompt(null);
    setEditStage("result");
  }, []);

  const toggleFirstMessageExpanded = useCallback(() => {
    setFirstMessageExpanded((prev) => !prev);
  }, []);

  const resetFirstMessageDraft = useCallback(() => {
    setFirstMessageDraft(currentFirstMessage);
  }, [currentFirstMessage]);

  const handleAgentConfigChange = useCallback(() => {
    resetSuggestionState();
    setPromptMessage(null);
    setPromptError(null);
    setFirstMessageExpanded(false);
    setEditStage("input");
  }, [resetSuggestionState]);

  const setAgentDetails = useCallback(
    (agentId: string | null, displayName: string | null) => {
      setCurrentAgentId(agentId);
      setCurrentAgentName(displayName);
    },
    [],
  );

  return {
    agentDetails: {
      currentAgentId,
      currentAgentName,
      hasAgentDetails,
      agentDisplayLabel,
      agentTooltip,
    },
    state: {
      currentPrompt,
      currentFirstMessage,
      firstMessageDraft,
      feedback,
      suggestedPrompt,
      manualPrompt,
      diffParts,
      editStage,
      firstMessageExpanded,
      promptError,
      promptMessage,
      suggestError,
      isPromptLoading,
      isPromptSaving,
      isSuggesting,
      isManualStage,
      hasFirstMessageChanges,
    },
    actions: {
      setFeedback,
      setManualPrompt,
      setFirstMessageDraft,
      toggleFirstMessageExpanded,
      resetFirstMessageDraft,
      enterEditMode,
      cancelEditMode,
      suggestPrompt,
      acceptSuggestion,
      rejectSuggestion,
      enterManualEdit,
      cancelManualEdit,
      saveCurrentDraft,
      handleAgentConfigChange,
      setAgentDetails,
      clearPromptMessage,
    },
  };
};
