// @flow
import React from "react";
import "./App.css";
import {
  initialState,
  statuses,
  type Selection,
  type State,
  type Ticket as TicketT,
  type Actor as ActorT,
} from "./types";

import { type Action } from "./actions";
import {
  featureBranchActions,
  applyFeatureBranchAction,
} from "./feature-branch-actions";
import { ticketActions, applyTicketAction } from "./ticket-actions";
import { branchActions, applyBranchAction } from "./branch-actions";
import { creationActions, applyCreationAction } from "./creation-actions";
import { ciActions, applyCiAction } from "./ci-actions";
import { prActions, applyPrAction } from "./pr-actions";

const Strut = ({ size }) => <div style={{ flexBasis: size }} />;

const styles = {
  label: {
    fontSize: "80%",
    color: "#ccc",
  },
  flatButton: {
    cursor: "pointer",
    backgroundColor: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "white",
  },
  actionButton: {
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#86ff8b",
  },
};

const Ticket = ({ ticket, onSelect, selection, state }) => {
  const fields = [
    ["Fix version", ticket.fixVersion],
    ["Assignee", ticket.assignee],
    ["Target branch", ticket.targetBranch],
    ["Pull Request", ticket.pullRequest],
    ["Build url", ticket.buildUrl],
  ];
  return (
    <div
      onClick={onSelect}
      style={{
        border: "1px solid #aaa",
        cursor: "pointer",
        padding: "8px",
        fontSize: "80%",
        position: "relative",
        marginBottom: 4,
        boxShadow:
          selection &&
          selection.type === "ticket" &&
          selection.ticket === ticket.id
            ? "0 0 5px #aaa"
            : "",
      }}
    >
      <div style={styles.label}>{"MOB-" + ticket.id}</div>
      <Strut size={4} />
      {ticket.title}
      {fields.map(([title, v]) =>
        v != null ? (
          <React.Fragment key={title}>
            <Strut key={title + "-strut"} size={4} />
            <div style={styles.label} key={title}>
              {title}: {v}
            </div>
          </React.Fragment>
        ) : null,
      )}
      <ActionsBadge
        state={state}
        selection={{ type: "ticket", ticket: ticket.id }}
      />
    </div>
  );
};

function Columns({ state, setSelection, selection }) {
  return (
    <div
      style={{
        padding: "8px",
        flexDirection: "row",
        height: 500,
      }}
    >
      {statuses.map((status, i) => (
        <div
          key={status}
          style={{
            border: "1px solid #aaa",
            borderWidth: i === 0 ? "1px" : "1px 1px 1px 0",
            margin: 0,
            width: 130,
            // overflow: "auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "8px", padding: 4 }}>
            {status}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "4px" }}>
            {state.tickets
              .filter(ticket => ticket.status === status)
              .map(ticket => (
                <Ticket
                  state={state}
                  selection={selection}
                  key={ticket.id}
                  ticket={ticket}
                  onSelect={() =>
                    setSelection({ type: "ticket", ticket: ticket.id })
                  }
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const generalActions = (state: State): Array<Action> =>
  ciActions(state)
    .concat(creationActions(state))
    .concat(featureBranchActions(state));

const actionsForSelection = (
  state: State,
  selection: ?Selection,
): Array<Action> => {
  if (!selection) {
    return [];
  }
  switch (selection.type) {
    case "ticket":
      const ticket = state.tickets.find(
        ticket => ticket.id === selection.ticket,
      );
      if (!ticket) {
        return [];
      }
      return ticketActions(ticket, state);
    case "pr":
      const pr = state.pullRequests.find(pr => pr.number === selection.pr);
      if (!pr) {
        throw new Error("Unknown pr sleection " + selection.pr);
      }
      return prActions(pr, state);
    case "branch":
      const owner = state.actors.find(
        actor => actor.name === selection.owner && actor.type === "dev",
      );
      if (!owner || owner.type !== "dev") {
        return [];
      }
      const branch = owner.env.localBranches.find(
        branch => branch.name === selection.branch,
      );
      if (!branch) {
        return [];
      }
      return branchActions(owner.name, branch, state);
    default:
      return [];
  }
};

const isActionApplicable = (action, actor) => {
  switch (action.type) {
    case "feature-branch":
      return actor.type === "dev";
    case "branch":
      return action.owner === actor.name;
    case "ticket":
      return action.role === actor.type || action.role === actor.name;
    case "pr":
      return (
        (action.owner === actor.name) === (action.action === "land") &&
        actor.type === "dev"
      );
  }
};

const Actor = ({
  state,
  actor,
  actions,
  takeAction,
  selection,
  setSelection,
}: {
  state: State,
  actor: ActorT,
  actions: Array<Action>,
  selection: ?Selection,
  setSelection: Selection => void,
  takeAction: (
    action: { type: "actor", who: ActorT, action: Action } | MultiAction,
  ) => void,
}) => {
  const applicable = actions.filter(action =>
    isActionApplicable(action, actor),
  );
  return (
    <div style={{ alignItems: "stretch", padding: 4 }}>
      <div
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignSelf: "stretch",
        }}
      >
        <div style={{ marginRight: 8 }}>
          {actor.type}: {actor.name}
        </div>
        <div style={{ flexDirection: "row" }}>
          {applicable.map(action => (
            <button
              key={action.action}
              style={{ marginLeft: 8, ...styles.actionButton }}
              onClick={() => takeAction({ type: "actor", action, who: actor })}
            >
              {action.title}
            </button>
          ))}
        </div>
      </div>
      {actor.type === "dev" && actor.env.localBranches.length > 0 ? (
        <div style={{ margin: 8, border: "1px solid #555", padding: 12 }}>
          <div style={{ marginBottom: 8, ...styles.label }}>Branches:</div>
          {actor.env.localBranches.map(branch => (
            <div
              key={branch.name}
              style={{
                padding: 4,
                cursor: "pointer",
                position: "relative",
                backgroundColor:
                  selection &&
                  selection.type === "branch" &&
                  selection.branch === branch.name
                    ? "#666"
                    : "",
              }}
              onClick={() => {
                setSelection({
                  type: "branch",
                  branch: branch.name,
                  owner: actor.name,
                });
              }}
            >
              {branch.name + " -> " + branch.parent}
              <ActionsBadge
                state={state}
                selection={{
                  type: "branch",
                  branch: branch.name,
                  owner: actor.name,
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const Actors = ({ state, actions, selection, setSelection, takeAction }) => {
  return (
    <div style={{ height: 400, minWidth: 300, overflow: "auto" }}>
      <div style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {actions
          .filter(a => a.type === "creation")
          .map((action, i) => (
            <button
              key={i}
              style={{ ...styles.actionButton, marginLeft: 8 }}
              onClick={() =>
                takeAction({
                  type: "actor",
                  who: { name: "ci", type: "ci" },
                  action: action,
                })
              }
            >
              {action.title}
            </button>
          ))}
      </div>
      {state.actors.map(actor => (
        <Actor
          setSelection={setSelection}
          selection={selection}
          key={actor.name}
          state={state}
          actions={actions}
          actor={actor}
          takeAction={takeAction}
        />
      ))}
    </div>
  );
};

const reducer = (state: State, { action, who }) => {
  switch (action.type) {
    case "feature-branch":
      return applyFeatureBranchAction(who, action.branch, action.action, state);
    case "ticket":
      return applyTicketAction(action.id, who, action.action, state);
    case "creation":
      return applyCreationAction(action.action, state);
    case "branch":
      return applyBranchAction(who, action.branch, action.action, state);
    case "pr":
      return applyPrAction(who, action.number, action.action, state);
    case "ci":
      return applyCiAction(action.branch, action.action, state);
  }
  return state;
};

type MultiAction =
  | {
      type: "state-history",
      position: number,
    }
  | { type: "reset" };

const multiReducer = inner => (state, action) => {
  if (action.type === "state-history") {
    return { ...state, position: action.position };
  }
  if (action.type === "reset") {
    return { states: [makeMultiState(initialState)], position: 0 };
  }
  const newState = inner(state.states[state.position].contents, action);
  return {
    ...state,
    states: [makeMultiState(newState)].concat(
      state.states.slice(state.position),
    ),
    position: 0,
  };
};

const KEY = "gitflow-state";

const logger = inner => (state, action) => {
  const newState = inner(state, action);
  console.log(action);
  console.log(newState);
  return newState;
};

const makeMultiState = contents => ({ contents, date: Date.now(), name: null });

const loadStates = () => {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return { states: [makeMultiState(initialState)], position: 0 };
  }
  return JSON.parse(raw);
};

const clearState = () => {
  localStorage.removeItem(KEY);
};

const saveStates = states => {
  localStorage.setItem(KEY, JSON.stringify(states));
};

const prAction = pr => action =>
  action.type === "pr" && action.pr === pr.number;

const branchActionFilter = branch => action =>
  action.type === "branch" && action.branch === branch.name;

const ActionsBadge = ({ state, selection }) => {
  const applicable = actionsForSelection(state, selection).length;
  if (!applicable) {
    return null;
  }
  return (
    <div
      style={{
        padding: "2px 4px",
        fontSize: "50%",
        backgroundColor: "green",
        borderRadius: 4,
        position: "absolute",
        top: -4,
        left: -8,
      }}
    >
      {applicable}
    </div>
  );
};

const PullRequests = ({
  actions,
  setSelection,
  selection,
  state,
  takeAction,
}) => {
  const [showMerged, setShowMerged] = React.useState(false);
  const mergedCount = state.pullRequests.filter(p => p.merged).length;
  return (
    <div style={{ width: 300, alignItems: "stretch" }}>
      <div
        style={{
          flexDirection: "row",
          // justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={styles.label}>Pull Requests:</div>
        {mergedCount > 0 ? (
          <button
            style={{ marginLeft: 8, ...styles.flatButton }}
            onClick={() => setShowMerged(!showMerged)}
          >
            {showMerged ? "Hide merged" : `Show ${mergedCount} merged`}
          </button>
        ) : null}
      </div>
      <div>
        {state.pullRequests.map(pr =>
          !pr.merged || showMerged ? (
            <div
              key={pr.number}
              onClick={() => setSelection({ type: "pr", pr: pr.number })}
              style={{
                position: "relative",
                padding: 4,
                flexDirection: "row",
                paddingLeft: 8,
                alignItems: "center",
                cursor: "pointer",
                backgroundColor:
                  selection &&
                  selection.type === "pr" &&
                  selection.pr === pr.number
                    ? "#555"
                    : "",
              }}
            >
              {pr.summary}
              <div
                style={{
                  padding: 4,
                  marginLeft: 8,
                  backgroundColor: {
                    waiting: "#666",
                    accepted: "#151",
                    rejected: "#833",
                  }[pr.reviewStatus],
                }}
              >
                {pr.merged ? "merged" : pr.reviewStatus}
              </div>
              <div
                style={{ ...styles.label, marginLeft: 8 }}
              >{`pulls/${pr.number}`}</div>
              {pr.merged ? null : (
                <ActionsBadge
                  state={state}
                  selection={{ type: "pr", pr: pr.number }}
                />
              )}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
};

const tabOff = (node, offset, selector = null) => {
  const tabbable = [].slice.call(
    document.querySelectorAll(selector || "[tabindex], button, input, a[href]"),
  );
  const idx = tabbable.indexOf(node);
  const next = tabbable[idx + offset];
  if (next) {
    next.focus();
  }
};

const RemoteBranches = ({ state, actions, takeAction }) => {
  return (
    <div style={{ width: 300, padding: 0, marginLeft: 16 }}>
      <div style={{ ...styles.label, marginBottom: 8, flexDirection: "row" }}>
        Remote branches
        {actions
          .filter(action => action.type === "ci" && action.action !== "build")
          .map((action, i) => (
            <button
              key={i}
              style={{ ...styles.actionButton, marginLeft: 8 }}
              onClick={() =>
                takeAction({
                  type: "actor",
                  who: { name: "ci", type: "ci" },
                  action: action,
                })
              }
            >
              {action.title}
            </button>
          ))}
      </div>
      {state.remoteBranches.map(rb => (
        <div
          key={rb.name}
          style={{
            flexDirection: "row",
            alignItems: "center",
            whiteSpace: "nowrap",
          }}
        >
          {rb.name}
          <span style={{ ...styles.label, marginLeft: 4 }}>
            {rb.commits.length} commits
          </span>
          <Strut size={8} />
          {actions
            .filter(
              action =>
                action.type === "ci" &&
                action.branch === rb.name &&
                action.action === "build",
            )
            .map((action, i) => (
              <button
                key={i}
                style={styles.actionButton}
                onClick={() =>
                  takeAction({
                    type: "actor",
                    who: { name: "ci", type: "ci" },
                    action,
                  })
                }
              >
                {action.title}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
};

function App() {
  const [outerState, dispatch] = React.useReducer(
    multiReducer(logger(reducer)),
    loadStates(),
  );
  const [selection, setSelection] = React.useState(null);
  const state = outerState.states[outerState.position].contents;
  const actions = actionsForSelection(state, selection).concat(
    generalActions(state),
  ); // todo include release & ci actions
  return (
    <div className="App">
      <div style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <div style={{ width: 150, padding: 8 }}>
          <div
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <button
              style={styles.flatButton}
              onClick={() => {
                clearState();
                dispatch({ type: "reset" });
              }}
            >
              Clear
            </button>
            <Strut size={8} />
            <button
              style={styles.flatButton}
              onClick={() => saveStates(outerState)}
            >
              Save
            </button>
          </div>
          <div style={{ height: 400, overflow: "auto" }}>
            {outerState.states.map((inner, i) => (
              <div
                className="state-item"
                key={i}
                tabIndex={0}
                onKeyDown={evt => {
                  if (evt.key === "ArrowDown") {
                    tabOff(evt.target, 1, ".state-item");
                    evt.preventDefault();
                  } else if (evt.key === "ArrowUp") {
                    tabOff(evt.target, -1, ".state-item");
                    evt.preventDefault();
                  }
                }}
                style={{
                  padding: "4px 8px",
                  cursor: "pointer",
                  backgroundColor: i === outerState.position ? "#555" : "",
                }}
                onFocus={() => dispatch({ type: "state-history", position: i })}
              >
                {new Date(inner.date).toLocaleTimeString()}
              </div>
            ))}
          </div>
        </div>
        <div>
          <Columns
            state={state}
            setSelection={setSelection}
            selection={selection}
          />
          <div style={{ flexDirection: "row" }}>
            <Actors
              setSelection={setSelection}
              state={state}
              actions={actions}
              selection={selection}
              takeAction={dispatch}
            />
            <Strut size={32} />
            <PullRequests
              setSelection={setSelection}
              state={state}
              actions={actions}
              selection={selection}
              takeAction={dispatch}
            />
            <RemoteBranches
              state={state}
              actions={actions}
              takeAction={dispatch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
