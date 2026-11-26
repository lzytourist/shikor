"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2, Share2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TreeRole } from "@/db/schema";
import {
  addCollaboratorByEmailAction,
  createShareLinkAction,
  removeCollaboratorAction,
  toggleShareLinkAction,
} from "@/server/actions/collaboration";
import type { TreeWorkspaceData } from "@/server/dal/trees";

interface ShareCollaborateDialogProps {
  treeId: string;
  canManage: boolean;
  collaborators: TreeWorkspaceData["collaborators"];
  shareLinks: TreeWorkspaceData["shareLinks"];
}

export function ShareCollaborateDialog({
  treeId,
  canManage,
  collaborators,
  shareLinks,
}: ShareCollaborateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");

  const [linkLabel, setLinkLabel] = useState("Family WhatsApp Group");
  const [passcode, setPasscode] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    startTransition(async () => {
      const res = await addCollaboratorByEmailAction({
        treeId,
        email: inviteEmail,
        role: inviteRole,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Collaborator added!");
      setInviteEmail("");
    });
  };

  const handleCreateLink = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createShareLinkAction({
        treeId,
        label: linkLabel,
        passcode,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Passcode-protected share link created!");
      setPasscode("");
    });
  };

  const copyShareUrl = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Share link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
          <Share2 className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Family Tree</DialogTitle>
          <DialogDescription>
            Create a passcode-protected link for your family chat, or invite
            relatives to help update the tree.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={canManage ? "links" : "members"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="links" className="gap-1.5 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              Passcode Links ({shareLinks.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Members ({collaborators.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links" className="space-y-4 pt-3">
            {canManage ? (
              <>
                <form
                  onSubmit={handleCreateLink}
                  className="rounded-xl border bg-muted/25 p-3.5 space-y-3"
                >
                  <p className="text-xs font-semibold">
                    Create Passcode-Protected Read-Only Link
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    <Input
                      placeholder="Label (e.g. Eid Reunion)"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                    />
                    <Input
                      placeholder="Set Passcode (min 4 chars)"
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending}
                    className="w-full cursor-pointer"
                  >
                    {isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    )}
                    Generate Share Link
                  </Button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {shareLinks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No share links created yet.
                    </p>
                  ) : (
                    shareLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {link.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            /share/{link.token}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={link.isActive}
                            onCheckedChange={(checked) =>
                              startTransition(async () => {
                                await toggleShareLinkAction({
                                  treeId,
                                  linkId: link.id,
                                  isActive: checked,
                                });
                              })
                            }
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 cursor-pointer"
                            onClick={() => copyShareUrl(link.token)}
                          >
                            {copiedToken === link.token ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Only the Tree Owner can create or revoke passcode share links.
              </p>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4 pt-3">
            {canManage && (
              <form
                onSubmit={handleInvite}
                className="rounded-xl border bg-muted/25 p-3.5 space-y-2.5"
              >
                <p className="text-xs font-semibold">
                  Invite a Family Member by Email
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="cousin@gmail.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(v) =>
                      setInviteRole(v as Exclude<TreeRole, "owner">)
                    }
                  >
                    <SelectTrigger className="w-28 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Can Edit</SelectItem>
                      <SelectItem value="viewer">View Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" disabled={isPending}>
                    Add
                  </Button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {collaborators.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="capitalize">
                      {m.role}
                    </Badge>
                    {canManage && m.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() =>
                          startTransition(async () => {
                            await removeCollaboratorAction({
                              treeId,
                              memberId: m.memberId,
                            });
                          })
                        }
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
