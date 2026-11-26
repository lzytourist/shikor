import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { TreeWorkspaceShell } from "@/components/workspace/tree-workspace-shell";
import { requireUser } from "@/server/dal/auth";
import { getTreeWorkspaceBySlug } from "@/server/dal/trees";

interface TreeWorkspacePageProps {
  params: Promise<{ slug: string }>;
}

async function TreeWorkspaceLoader({ params }: TreeWorkspacePageProps) {
  const { slug } = await params;
  const [{ user }, workspace] = await Promise.all([
    requireUser(),
    getTreeWorkspaceBySlug(slug),
  ]);

  return <TreeWorkspaceShell workspace={workspace} currentUser={user} />;
}

export default function TreeWorkspacePage(props: TreeWorkspacePageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading family graph workspace...
          </div>
        </div>
      }
    >
      <TreeWorkspaceLoader {...props} />
    </Suspense>
  );
}
