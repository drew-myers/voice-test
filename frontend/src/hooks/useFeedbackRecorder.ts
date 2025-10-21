import { useCallback, useEffect, useRef, useState } from "react";
import { arrayBufferToBase64 } from "../utils/audio";
import { buildEndpointUrl } from "../utils/api";

type UseFeedbackRecorderOptions = {
  onTranscript: (text: string) => void;
};

export const useFeedbackRecorder = ({
  onTranscript,
}: UseFeedbackRecorderOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showStopIcon, setShowStopIcon] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveformRef = useRef<HTMLSpanElement | null>(null);
  const skipTranscriptionRef = useRef(false);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        skipTranscriptionRef.current = true;
        mediaRecorderRef.current.stop();
      } catch {
        // swallow stop errors
      }
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    waveformRef.current?.style.setProperty("--waveform-scale", "0");
    recordedChunksRef.current = [];
    setIsRecording(false);
    setShowStopIcon(false);
    setRecordingError(null);
  }, []);

  useEffect(
    () => () => {
      reset();
    },
    [reset],
  );

  const renderWaveform = useCallback(() => {
    if (!analyserRef.current || !waveformRef.current) {
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);
    const maxAmplitude = dataArray.reduce((max, value) => {
      const deviation = Math.abs(value - 128) / 128;
      return Math.max(max, deviation);
    }, 0);
    const scale = Math.min(1, maxAmplitude * 3);
    waveformRef.current.style.setProperty("--waveform-scale", `${scale}`);
    animationFrameRef.current = requestAnimationFrame(renderWaveform);
  }, []);

  const handleStop = useCallback(async () => {
    setIsRecording(false);
    setShowStopIcon(false);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    waveformRef.current?.style.setProperty("--waveform-scale", "0");

    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }

    const skip = skipTranscriptionRef.current;
    skipTranscriptionRef.current = false;

    if (!skip) {
      try {
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        const arrayBuffer = await blob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(arrayBuffer);

        const response = await fetch(
          buildEndpointUrl("/api/elevenlabs/transcribe"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: base64Audio,
              format: "webm",
            }),
          },
        );

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Failed to transcribe audio.");
        }

        const payload = (await response.json()) as { text: string };
        const transcript = payload.text.trim();
        if (transcript) {
          onTranscript(transcript);
        }
      } catch (err) {
        setRecordingError(
          err instanceof Error
            ? err.message
            : "Failed to transcribe audio.",
        );
      }
    }

    recordedChunksRef.current = [];
    mediaRecorderRef.current = null;
  }, [onTranscript]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      setShowStopIcon(true);
      mediaRecorderRef.current?.stop();
      return;
    }

    setRecordingError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser does not support microphone access.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 44100 },
      });

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        void handleStop();
      });

      recorder.addEventListener("start", () => {
        setTimeout(() => {
          if (mediaRecorderRef.current) {
            setShowStopIcon(true);
          }
        }, 1200);
        animationFrameRef.current = requestAnimationFrame(renderWaveform);
      });

      recorder.start();
      skipTranscriptionRef.current = false;
      setIsRecording(true);
      setShowStopIcon(false);
    } catch (err) {
      reset();
      setRecordingError(
        err instanceof Error ? err.message : "Unable to access microphone.",
      );
    }
  }, [handleStop, isRecording, renderWaveform, reset]);

  return {
    isRecording,
    showStopIcon,
    recordingError,
    waveformRef,
    toggleRecording,
    reset,
    setRecordingError,
  };
};
