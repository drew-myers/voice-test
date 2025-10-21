import { AgentConfigMenu } from "./AgentConfigMenu";
import { useAgentExperience } from "../context/AgentExperienceContext";

export const AgentConfigTrigger = () => {
  const { agentConfig, agentDetails } = useAgentExperience();
  const {
    isOpen,
    toggle,
    menuRef,
    agentIdInput,
    setAgentIdInput,
    disableUseBackendDefault,
    disableApplyOverride,
    useBackendDefault,
    applyOverride,
  } = agentConfig;

  return (
    <AgentConfigMenu
      isOpen={isOpen}
      onToggle={toggle}
      menuRef={menuRef}
      agentIdInput={agentIdInput}
      onAgentIdInputChange={setAgentIdInput}
      hasAgentDetails={agentDetails.hasAgentDetails}
      agentDisplayLabel={agentDetails.agentDisplayLabel}
      agentTooltip={agentDetails.agentTooltip}
      onUseBackendDefault={useBackendDefault}
      onApplyOverride={applyOverride}
      disableUseBackendDefault={disableUseBackendDefault}
      disableApplyOverride={disableApplyOverride}
    />
  );
};
