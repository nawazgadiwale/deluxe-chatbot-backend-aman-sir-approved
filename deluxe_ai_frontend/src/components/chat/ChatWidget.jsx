"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";

import { ChatProvider } from "../../context/ChatContext";

import ChatLauncher from "./ChatLauncher";
import ChatWindow from "./ChatWindow";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <ChatProvider>
      {!open && <ChatLauncher onClick={() => setOpen(true)} />}

      <AnimatePresence>
        {open && (
          <ChatWindow
            onClose={() => setOpen(false)}
            onMinimize={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </ChatProvider>
  );
}
