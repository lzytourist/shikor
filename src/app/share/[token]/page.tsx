import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { PasscodeGate } from "@/components/workspace/passcode-gate";
import { TreeWorkspaceShell } from "@/components/workspace/tree-workspace-shell";
import { getCurrentSession } from "@/server/dal/auth";
import { getSharedTreeWorkspaceByToken } from "@/server/dal/trees";

interface SharedTreePageProps {
  params: Promise<{ token: string }>;
}

async function SharedTreeLoader({ params }: SharedTreePageProps) {
  const { token } = await params;
  const [result, session] = await Promise.all([
    getSharedTreeWorkspaceByToken(token),
    getCurrentSession(),
  ]);

  if (result.status === "locked") {
    return (
      <PasscodeGate
        token={result.token}
        treeName={result.treeName}
        label={result.label}
      />
    );
  }

  return (
    <TreeWorkspaceShell
      workspace={result.workspace}
      currentUser={session?.user ?? null}
    />
  );
}

export default function SharedTreePage(props: SharedTreePageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Opening shared family tree...
          </div>
        </div>
      }
    >
      <SharedTreeLoader {...props} />
    </Suspense>
  );
}
