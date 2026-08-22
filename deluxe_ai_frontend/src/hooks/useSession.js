"use client";

import { useMemo } from "react";
import sessionService from "../services/sessionService";

export default function useSession() {
  const sessionId = useMemo(
    () => sessionService.getSessionId(),
    []
  );

  return {
    sessionId,

    newSession: () => sessionService.newSession(),

    clearSession: () => sessionService.clear(),
  };
}