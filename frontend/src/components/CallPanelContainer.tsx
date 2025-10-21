import { useCallback } from "react";
import { CallPanel } from "./CallPanel";
import { useAgentExperience } from "../context/AgentExperienceContext";

export const CallPanelContainer = () => {
  const {
    call: { state, actions },
    agentDetails,
  } = useAgentExperience();

  const handleStart = useCallback(() => {
    void actions.startCall();
  }, [actions]);

  const handleEnd = useCallback(() => {
    void actions.endCall();
  }, [actions]);

  return (
    <CallPanel
      state={state}
      agentDetails={agentDetails}
      actions={{
        startCall: handleStart,
        endCall: handleEnd,
        enterEditMode: actions.enterEditMode,
      }}
    />
  );
};
