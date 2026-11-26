"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { ShikorLogo } from "@/components/brand/shikor-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { unlockShareLinkAction } from "@/server/actions/collaboration";

interface PasscodeGateProps {
  token: string;
  treeName: string;
  label: string;
}

export function PasscodeGate({ token, treeName, label }: PasscodeGateProps) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await unlockShareLinkAction({ token, passcode });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Unlocked ${treeName}!`);
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 dark:bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto">
            <ShikorLogo />
          </div>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">{treeName}</CardTitle>
            <CardDescription className="mt-1">
              Shared via <strong>{label}</strong>. Enter the family passcode to
              explore the tree.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter family passcode..."
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full cursor-pointer"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Unlock Family Tree
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
