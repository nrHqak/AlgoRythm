import { useRef, useState } from "react";

const SOUND_MAP = {
  compare: { frequency: 523, duration: 80, type: "sine" },
  swap: { frequency: 330, duration: 120, type: "sine" },
  error: { frequency: 150, duration: 300, type: "sawtooth" },
};

export function useAudio() {
  const contextRef = useRef(null);
  const [muted, setMuted] = useState(false);

  async function unlockAudio() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      contextRef.current = new AudioContextClass();
    }

    if (contextRef.current.state === "suspended") {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }

  async function playSound(eventName) {
    if (muted || !SOUND_MAP[eventName]) {
      return;
    }

    const audioContext = await unlockAudio();
    if (!audioContext) {
      return;
    }

    const { frequency, duration, type } = SOUND_MAP[eventName];
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration / 1000);
  }

  function toggleMute() {
    setMuted((previous) => !previous);
  }

  return {
    muted,
    toggleMute,
    unlockAudio,
    playSound,
  };
}
