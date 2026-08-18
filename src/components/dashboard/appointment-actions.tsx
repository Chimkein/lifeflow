"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface AppointmentActionsProps {
  appointmentId: string;
  status: string;
  onStatusChange?: (id: string, status: string) => void;
}

export function AppointmentActions({
  appointmentId,
  status: initialStatus,
}: AppointmentActionsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [updating, setUpdating] = useState(false);

  if (status === "confirmed") {
    return (
      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        Confirmed
      </span>
    );
  }

  const handleAction = async (newStatus: "confirmed" | "dismissed") => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/gmail/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } finally {
      setUpdating(false);
    }
  };

  if (status === "dismissed") return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
        onClick={() => handleAction("confirmed")}
        disabled={updating}
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => handleAction("dismissed")}
        disabled={updating}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
