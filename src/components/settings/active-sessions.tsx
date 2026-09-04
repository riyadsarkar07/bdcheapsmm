"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import {
  revokeUserSessionAction,
  revokeOtherSessionsAction,
} from "@/lib/actions/security";
import { signOutAction } from "@/lib/actions/auth";

export type ActiveSession = {
  id: string;
  device: string;
  location: string;
  deviceType: "mobile" | "tablet" | "desktop";
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

function SessionIcon({ deviceType }: { deviceType: ActiveSession["deviceType"] }) {
  if (deviceType === "mobile") return <Smartphone className="h-4 w-4" />;
  if (deviceType === "tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

export function ActiveSessions({ sessions }: { sessions: ActiveSession[] }) {
  const router = useRouter();
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [revokingAll, setRevokingAll] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const hasOthers = sessions.some((s) => !s.isCurrent);

  async function revokeSession(id: string) {
    setRevokingId(id);
    try {
      const result = await revokeUserSessionAction(id);
      if (result.success) {
        toast.success(result.message ?? "Session signed out");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to sign out session");
      }
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAll() {
    if (!hasOthers) return;
    if (!confirm("Sign out every other device? You will stay signed in on this one.")) return;
    setRevokingAll(true);
    try {
      const result = await revokeOtherSessionsAction();
      if (result.success) {
        toast.success(result.message ?? "Other sessions signed out");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to sign out other sessions");
      }
    } finally {
      setRevokingAll(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOutAction();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Active Sessions
          </CardTitle>
          <CardDescription>
            Devices and browsers signed in to your account. Sign out anything you do not recognize.
          </CardDescription>
        </div>
        {hasOthers ? (
          <Button
            variant="outline"
            size="sm"
            onClick={revokeAll}
            disabled={revokingAll || revokingId !== null}
          >
            {revokingAll ? <Loader2 className="animate-spin" /> : <ShieldOff />}
            Sign out all others
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {sessions.length === 0 ? (
          <p className="rounded-lg bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No active sessions found.
          </p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <SessionIcon deviceType={session.deviceType} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{session.device}</p>
                    {session.isCurrent ? (
                      <Badge variant="success">This device</Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {session.location}
                    </span>
                    <span>Last active {timeAgo(session.lastSeenAt)}</span>
                    <span>Signed in {timeAgo(session.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {session.isCurrent ? (
                  <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
                    {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                    Sign out
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={revokingId === session.id || revokingAll}
                  >
                    {revokingId === session.id ? <Loader2 className="animate-spin" /> : <LogOut />}
                    Sign out
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
