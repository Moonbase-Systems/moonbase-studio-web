/** Elapsed recording time. Pause freezes the clock. */
export const createElapsedClock = (now: () => number) => {
  let accumulated = 0;
  let runningSince: number | null = null;

  return {
    start() {
      accumulated = 0;
      runningSince = now();
    },
    pause() {
      if (runningSince === null) {
        return;
      }
      accumulated += now() - runningSince;
      runningSince = null;
    },
    resume() {
      if (runningSince !== null) {
        return;
      }
      runningSince = now();
    },
    elapsed() {
      return accumulated + (runningSince === null ? 0 : now() - runningSince);
    },
  };
};

export const formatRecordingClock = (elapsedMs: number): string => {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};
