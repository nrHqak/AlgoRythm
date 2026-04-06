import { useEffect, useState } from "react";

export function usePlayer(totalSteps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, [totalSteps]);

  useEffect(() => {
    if (!isPlaying || totalSteps <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentStep((previous) => {
        if (previous >= totalSteps - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 600);

    return () => window.clearInterval(timer);
  }, [isPlaying, totalSteps]);

  function play() {
    if (totalSteps <= 0 || currentStep >= totalSteps - 1) {
      return;
    }
    setIsPlaying(true);
  }

  function pause() {
    setIsPlaying(false);
  }

  function next() {
    setCurrentStep((previous) => (previous >= totalSteps - 1 ? previous : previous + 1));
  }

  function prev() {
    setCurrentStep((previous) => (previous <= 0 ? previous : previous - 1));
  }

  const progress = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;

  return {
    currentStep,
    setCurrentStep,
    isPlaying,
    play,
    pause,
    next,
    prev,
    progress,
  };
}
