// @flow
export type PrAction = {
  type: "pr",
  title: string,
  number: number,
  action: string,
  owner: string,
};

import type {
  State,
  Ticket,
  PullRequest,
  Actor,
  DevEnv,
  LocalBranch,
} from "./types";

import type { Action } from "./actions";

export const prActions = (pr: PullRequest, state: State): Array<Action> => {
  const actions = [];
  if (!pr.merged && !pr.head.startsWith("feature/")) {
    if (pr.reviewStatus !== "accepted") {
      actions.push({ title: "Accept", action: "accept" });
    }
    if (pr.reviewStatus !== "rejected") {
      actions.push({ title: "Reject", action: "reject" });
    }
  }
  if (pr.reviewStatus === "accepted" && !pr.merged) {
    actions.push({ title: "Land", action: "land" });
  }
  return actions.map(action => ({
    ...action,
    type: "pr",
    owner: pr.owner,
    number: pr.number,
  }));
};

const replacePr = (state, pr) => ({
  ...state,
  pullRequests: state.pullRequests.map(p => (p.number === pr.number ? pr : p)),
});

export const applyPrAction = (
  who: Actor,
  number: number,
  action: string,
  state: State,
): State => {
  if (who.type !== "dev") {
    return state;
  }
  const pr = state.pullRequests.find(pr => pr.number === number);
  if (!pr) {
    return state;
  }
  switch (action) {
    case "reject":
      return replacePr(state, { ...pr, reviewStatus: "rejected" });
    case "accept":
      return replacePr(state, { ...pr, reviewStatus: "accepted" });
    case "land":
      if (pr.head.startsWith("feature/")) {
        const remoteBranch = state.remoteBranches.find(b => b.name === pr.head);
        if (!remoteBranch) {
          throw new Error(
            `rtying to land nonexistent feature branch ${pr.head}`,
          );
        }
        return {
          ...replacePr(state, { ...pr, merged: true }),
          tickets: pr.ticket
            ? state.tickets.map(t =>
                t.id === pr.ticket
                  ? { ...t, status: "ready to release", targetBranch: pr.base }
                  : t.targetBranch === pr.head
                  ? { ...t, status: "ready to release", targetBranch: pr.base }
                  : t,
              )
            : state.tickets,
          remoteBranches: state.remoteBranches
            .filter(b => b.name !== pr.head)
            .map(b =>
              b.name === pr.base
                ? { ...b, commits: b.commits.concat(remoteBranch.commits) }
                : b,
            ),
        };
      }
      const tmp = {
        ...state,
        remoteBranches: state.remoteBranches.map(branch =>
          branch.name === pr.base
            ? {
                ...branch,
                commits: branch.commits.concat([
                  { pr: pr.number, ticket: pr.ticket },
                ]),
              }
            : branch,
        ),
        tickets: pr.ticket
          ? state.tickets.map(t =>
              t.id === pr.ticket
                ? {
                    ...t,
                    status: t.qeVerifiable ? "landed" : "ready to release",
                    targetBranch: pr.base,
                  }
                : t,
            )
          : state.tickets,
        actors: state.actors.map(actor =>
          actor.name === who.name && who.type === "dev"
            ? {
                ...who,
                env: {
                  ...who.env,
                  localBranches: who.env.localBranches.filter(
                    b => b.name !== pr.head,
                  ),
                },
              }
            : actor,
        ),
      };
      return replacePr(tmp, { ...pr, merged: true });
  }
  return state;
};
