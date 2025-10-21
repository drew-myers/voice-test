import { EditPanel } from "./EditPanel";
import { useAgentExperience } from "../context/AgentExperienceContext";

export const EditPanelContainer = () => {
  const { agentDetails, prompt, recorder } = useAgentExperience();

  return (
    <EditPanel
      agentDetails={agentDetails}
      prompt={prompt}
      recorderControls={{
        isRecording: recorder.isRecording,
        showStopIcon: recorder.showStopIcon,
        recordingError: recorder.recordingError,
        waveformRef: recorder.waveformRef,
        onToggleRecording: () => {
          void recorder.toggleRecording();
        },
      }}
    />
  );
};
