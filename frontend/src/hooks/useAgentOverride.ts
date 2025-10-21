import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "voice-test.agent-override";

export const useAgentOverride = () => {
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const configMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const trimmed = stored?.trim();
      if (trimmed) {
        setAgentOverride(trimmed);
        setAgentIdInput(trimmed);
      }
    } catch {
      // ignore persistence failures
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const value = agentOverride?.trim();
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore persistence failures
    }
  }, [agentOverride]);

  useEffect(() => {
    if (isConfigOpen) {
      setAgentIdInput(agentOverride ?? "");
    }
  }, [agentOverride, isConfigOpen]);

  useEffect(() => {
    if (!isConfigOpen) {
      return;
    }

    const handlePointer = (event: MouseEvent) => {
      if (
        configMenuRef.current &&
        event.target instanceof Node &&
        !configMenuRef.current.contains(event.target)
      ) {
        setIsConfigOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsConfigOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isConfigOpen]);

  return {
    agentOverride,
    setAgentOverride,
    agentIdInput,
    setAgentIdInput,
    isConfigOpen,
    setIsConfigOpen,
    configMenuRef,
  };
};
