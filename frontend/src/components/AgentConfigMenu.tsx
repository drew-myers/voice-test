import { Settings } from "lucide-react";
import { RefObject } from "react";

type AgentConfigMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  menuRef: RefObject<HTMLDivElement>;
  agentIdInput: string;
  onAgentIdInputChange: (value: string) => void;
  hasAgentDetails: boolean;
  agentDisplayLabel: string;
  agentTooltip?: string;
  onUseBackendDefault: () => void;
  onApplyOverride: () => void;
  disableUseBackendDefault: boolean;
  disableApplyOverride: boolean;
};

export const AgentConfigMenu = ({
  isOpen,
  onToggle,
  menuRef,
  agentIdInput,
  onAgentIdInputChange,
  hasAgentDetails,
  agentDisplayLabel,
  agentTooltip,
  onUseBackendDefault,
  onApplyOverride,
  disableUseBackendDefault,
  disableApplyOverride,
}: AgentConfigMenuProps) => (
  <div className="panel__config" ref={menuRef}>
    <button
      type="button"
      className="icon-button"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="agent-config-menu"
      onClick={onToggle}
      title="Configure agent"
      aria-label="Configure agent"
    >
      <Settings size={16} />
    </button>
    {isOpen && (
      <div
        id="agent-config-menu"
        role="dialog"
        aria-modal="false"
        className="config-menu"
      >
        <div className="config-menu__header">
          <span className="label">Agent override</span>
          <p className="config-menu__description">
            Provide a custom ElevenLabs agent ID. Leave blank to use the backend
            default.
          </p>
        </div>
        <input
          type="text"
          className="config-menu__input"
          value={agentIdInput}
          onChange={(event) => onAgentIdInputChange(event.target.value)}
          placeholder="agent_123..."
          autoFocus
        />
        <p className="config-menu__status">
          {hasAgentDetails ? (
            <>
              Currently using{" "}
              <span className="config-menu__name" title={agentTooltip ?? undefined}>
                {agentDisplayLabel}
              </span>
            </>
          ) : (
            "Using backend default configuration."
          )}
        </p>
        <div className="config-menu__actions">
          <button
            type="button"
            className="button outline small"
            onClick={onUseBackendDefault}
            disabled={disableUseBackendDefault}
          >
            Use backend default
          </button>
          <button
            type="button"
            className="button primary small"
            onClick={onApplyOverride}
            disabled={disableApplyOverride}
          >
            Apply override
          </button>
        </div>
      </div>
    )}
  </div>
);
