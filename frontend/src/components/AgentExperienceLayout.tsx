import { CallPanelContainer } from "./CallPanelContainer";
import { EditPanelContainer } from "./EditPanelContainer";
import { useAgentExperience } from "../context/AgentExperienceContext";

export const AgentExperienceLayout = () => {
  const { mode } = useAgentExperience();

  return mode === "call" ? <CallPanelContainer /> : <EditPanelContainer />;
};
