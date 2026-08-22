"use client";

import { useState } from "react";

export default function useTyping() {
  const [typing, setTyping] = useState(false);

  return {
    typing,
    startTyping: () => setTyping(true),
    stopTyping: () => setTyping(false),
  };
}