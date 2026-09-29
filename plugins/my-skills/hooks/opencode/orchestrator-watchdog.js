/**
 * The opencode half of the orchestrator watchdog. opencode's `event` hook returns
 * Promise<void> and cannot veto a stop, so this plugin waits for the conductor's
 * session to go idle and re-prompts it, under the rules of the Claude Code Stop hook
 * (../orchestrator-stop.cjs), which it requires rather than restates. Three differ:
 *
 * - Only a top-level session is re-prompted. Subagent (`task`) sessions go idle too.
 * - Ownership is proved from the session's own latest 200 messages, by a tool call
 *   that ran `run-state.cjs start <run>` or `next <run>` — the Stop hook's own test,
 *   so a session that only read the run's state is never made its conductor.
 * - There is no `stop_hook_active`. The three-block guard is the loop guard.
 *
 * A turn the operator aborted is left alone, as Claude Code runs no Stop hook on an
 * interrupt. The re-prompt carries the agent and model of the session's last user
 * message, as the operator's own next prompt would; without them opencode falls back
 * to its default agent. On compaction, the owning session's summary gets the resume
 * pointer. Every handler swallows its own errors: a watchdog bug must never throw
 * into opencode or re-prompt a session by mistake.
 *
 * scripts/install-opencode.sh links this file to
 * ~/.config/opencode/plugins/my-skills-orchestrator-watchdog.js. opencode calls every
 * export of a plugin module as a plugin, so this module exports exactly one.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const MESSAGE_WINDOW = 200;

// opencode imports this file through the installer's symlink, so resolve the link
// before requiring the rules that live beside the real file.
let rules = null;
try {
  rules = createRequire(fs.realpathSync(fileURLToPath(import.meta.url)))('../orchestrator-stop.cjs');
} catch {
  // Copied away from its sibling: register no hooks rather than fail opencode's load.
}

/** Condition 6: a tool call of this session that the Stop hook would take as proof. */
function ownsRun(messages, found, sessionId) {
  const accepts = rules.provesOwnership(found, rules.nextStep(found.dir), sessionId);
  return messages.some((message) => (message?.parts ?? []).some((part) =>
    part?.type === 'tool' && rules.runStateCalls(part.state?.input?.command, found.run).some(accepts)));
}

function aborted(messages) {
  const last = messages.at(-1)?.info;
  return last?.role === 'assistant' && last.error?.name === 'MessageAbortedError';
}

function repromptBody(messages, text) {
  const body = { parts: [{ type: 'text', text }] };
  const prompt = messages.findLast((message) => message?.info?.role === 'user')?.info;
  if (typeof prompt?.agent === 'string') body.agent = prompt.agent;
  if (prompt?.model?.providerID && prompt.model.modelID) body.model = { providerID: prompt.model.providerID, modelID: prompt.model.modelID };
  return body;
}

export const OrchestratorWatchdog = async ({ client, directory, worktree }) => {
  if (!rules) return {};
  // Worktrees are listed afresh on every event: Step 0a adds one mid-session.
  const roots = () => [...new Set([worktree, directory, ...rules.linkedWorktrees(worktree || directory)].filter(Boolean))];
  const checking = new Set();

  // The latest messages of a top-level session; null for a subagent or a failed call.
  async function conductorMessages(id) {
    const session = await client.session.get({ path: { id } });
    if (!session?.data || session.data.parentID) return null;
    const listed = await client.session.messages({ path: { id }, query: { limit: MESSAGE_WINDOW } });
    return Array.isArray(listed?.data) ? listed.data.slice(-MESSAGE_WINDOW) : null;
  }

  async function reprompt(id) {
    const candidates = rules.activeRuns(roots()).filter((found) => rules.blockable(found));
    if (!candidates.length) return;
    const messages = await conductorMessages(id);
    if (!messages || aborted(messages)) return;
    const found = candidates.find((candidate) => ownsRun(messages, candidate, id));
    // recordBlock re-reads the lease: a `wait` or `done` that landed during the awaits above wins.
    if (!found || !rules.recordBlock(found, id)) return;
    await client.session.promptAsync({ path: { id }, body: repromptBody(messages, rules.blockReason(found.run)) });
  }

  return {
    event: async (input) => {
      try {
        const event = input?.event;
        const id = event?.type === 'session.idle' ? event.properties?.sessionID : undefined;
        // One check per session at a time: a doubled idle event must not re-prompt twice.
        if (!id || checking.has(id)) return;
        checking.add(id);
        try {
          await reprompt(id);
        } finally {
          checking.delete(id);
        }
      } catch {
        // Fail open: a watchdog error never reaches opencode.
      }
    },
    'experimental.session.compacting': async (input, output) => {
      try {
        const live = input?.sessionID
          ? rules.activeRuns(roots()).filter((found) => ['active', 'waiting'].includes(found.lease.state))
          : [];
        if (!live.length) return;
        const messages = await conductorMessages(input.sessionID);
        const found = messages && live.find((candidate) => ownsRun(messages, candidate, input.sessionID));
        if (!found) return;
        output.context.push(`An orchestrator run is active: resume from .orchestrator/runs/${found.run}/NEXT (run-state.cjs status).`);
      } catch {
        // Fail open: a compaction never fails on the watchdog's account.
      }
    },
  };
};
