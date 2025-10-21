import { useCallback, useMemo } from "react";
import type { useAgentOverride } from "./useAgentOverride";

export type AgentConfigView = {
  isOpen: boolean;
  toggle: () => void;
  menuRef: ReturnType<typeof useAgentOverride>["configMenuRef"];
  agentIdInput: string;
  setAgentIdInput: (value: string) => void;
  disableUseBackendDefault: boolean;
  disableApplyOverride: boolean;
  useBackendDefault: () => void;
  applyOverride: () => void;
};

type UseAgentConfigControlsArgs = {
  overrideState: ReturnType<typeof useAgentOverride>;
  agentOverride: string | null;
  isCallActive: boolean;
  endCall: () => Promise<void>;
  resetCallState: () => void;
  clearError: () => void;
  setAgentDetails: (agentId: string | null, displayName: string | null) => void;
  handleAgentConfigChange: () => void;
  resetToCallMode: () => void;
};

export const useAgentConfigControls = ({
  overrideState,
  agentOverride,
  isCallActive,
  endCall,
  resetCallState,
  clearError,
  setAgentDetails,
  handleAgentConfigChange,
  resetToCallMode,
}: UseAgentConfigControlsArgs): AgentConfigView => {
  const {
    setAgentOverride,
    agentIdInput,
    setAgentIdInput,
    isConfigOpen,
    setIsConfigOpen,
    configMenuRef,
  } = overrideState;

  const agentInputTrimmed = useMemo(
    () => agentIdInput.trim(),
    [agentIdInput],
  );

  const isAgentOverrideDirty = useMemo(
    () => agentInputTrimmed !== (agentOverride ?? ""),
    [agentInputTrimmed, agentOverride],
  );

  const updateAgentIdInput = useCallback(
    (value: string) => {
      setAgentIdInput(value);
    },
    [setAgentIdInput],
  );

  const toggle = useCallback(() => {
    setIsConfigOpen((prev) => !prev);
  }, [setIsConfigOpen]);

  const close = useCallback(() => {
    setIsConfigOpen(false);
  }, [setIsConfigOpen]);

  const stopActiveCall = useCallback(() => {
    if (isCallActive) {
      void endCall();
    } else {
      resetCallState();
    }
  }, [endCall, isCallActive, resetCallState]);

  const useBackendDefault = useCallback(() => {
    if (!agentOverride) {
      updateAgentIdInput("");
      close();
      resetToCallMode();
      return;
    }

    stopActiveCall();
    clearError();
    setAgentOverride(null);
    updateAgentIdInput("");
    close();
    setAgentDetails(null, null);
    handleAgentConfigChange();
    resetToCallMode();
  }, [
    agentOverride,
    clearError,
    close,
    handleAgentConfigChange,
    resetToCallMode,
    setAgentDetails,
    setAgentOverride,
    stopActiveCall,
    updateAgentIdInput,
  ]);

  const applyOverride = useCallback(() => {
    const nextOverride = agentInputTrimmed || null;
    if (!isAgentOverrideDirty) {
      close();
      return;
    }

    stopActiveCall();
    clearError();
    setAgentOverride(nextOverride);
    updateAgentIdInput(nextOverride ?? "");
    close();
    setAgentDetails(nextOverride, null);
    handleAgentConfigChange();
    resetToCallMode();
  }, [
    agentInputTrimmed,
    clearError,
    close,
    handleAgentConfigChange,
    isAgentOverrideDirty,
    resetToCallMode,
    setAgentDetails,
    setAgentOverride,
    stopActiveCall,
    updateAgentIdInput,
  ]);

  return useMemo<AgentConfigView>(
    () => ({
      isOpen: isConfigOpen,
      toggle,
      menuRef: configMenuRef,
      agentIdInput,
      setAgentIdInput: updateAgentIdInput,
      disableUseBackendDefault:
        !agentOverride && agentInputTrimmed.length === 0,
      disableApplyOverride: !isAgentOverrideDirty,
      useBackendDefault,
      applyOverride,
    }),
    [
      agentIdInput,
      agentInputTrimmed,
      agentOverride,
      applyOverride,
      configMenuRef,
      isAgentOverrideDirty,
      isConfigOpen,
      toggle,
      updateAgentIdInput,
      useBackendDefault,
    ],
  );
};
