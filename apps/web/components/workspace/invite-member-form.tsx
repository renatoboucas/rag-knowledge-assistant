"use client";

import { useState, useTransition } from "react";
import { MailPlus } from "lucide-react";
import { Button, Input } from "@rag/ui";

type InviteState =
  | { status: "idle"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function InviteMemberForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("org:member");
  const [state, setState] = useState<InviteState>({ status: "idle", message: "" });
  const [isPending, startTransition] = useTransition();

  function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const response = await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailAddress: email, role }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.message ?? "Unable to send invitation.",
        });
        return;
      }

      setEmail("");
      setRole("org:member");
      setState({ status: "success", message: "Invitation sent." });
    });
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_160px_auto]" onSubmit={submitInvite}>
      <Input
        aria-label="Member email"
        inputMode="email"
        placeholder="teammate@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <select
        aria-label="Role"
        className="border-input bg-background h-10 rounded-md border px-3 text-sm"
        value={role}
        onChange={(event) => setRole(event.target.value)}
      >
        <option value="org:member">Member</option>
        <option value="org:admin">Admin</option>
      </select>
      <Button disabled={isPending} type="submit">
        <MailPlus />
        {isPending ? "Sending" : "Invite"}
      </Button>
      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm sm:col-span-3"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
