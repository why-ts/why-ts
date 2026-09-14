#!/usr/bin/env node
/**
 * why-ts harness gate: Cursor `beforeShellExecution` hook.
 *
 * Denies Never-tier commands (see AGENTS.md Territory Map): force-push,
 * package publish, `nx release`, and git tag mutation. Everything else
 * falls through to Cursor's normal permission flow (fail-open on our own
 * parse errors so a bug here does not brick unrelated commands; the
 * dangerous patterns themselves are always denied when matched).
 *
 * Source for the hook contract: https://cursor.com/docs/agent/hooks
 * (fetched during harness creation).
 */
const DENY_PATTERNS = [
  /git\s+push\s+.*(--force|-f\b)/i,
  /\b(npm|pnpm|yarn)\s+publish\b/i,
  /\bnx\s+release\b/i,
  /git\s+tag\s+.*(-d|--delete|-f\b|--force)/i,
  /git\s+push\s+.*(--delete|:refs\/tags)/i,
];

let data = '';
process.stdin.on('data', (chunk) => (data += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0); // can't parse: fail open, let Cursor's own flow decide
  }

  const command = String(input.command || '');
  const hit = DENY_PATTERNS.find((pattern) => pattern.test(command));

  if (hit) {
    process.stdout.write(
      JSON.stringify({
        permission: 'deny',
        user_message:
          'why-ts harness: blocked a Never-tier command (publish / force-push / tag mutation). See AGENTS.md and docs/playbooks/publish.md. Run it yourself if it is genuinely intended.',
        agent_message:
          'This command matches a Never-tier action in AGENTS.md (publish, force-push, or tag mutation). Ask the human to run it directly instead.',
      })
    );
  }

  process.exit(0);
});
