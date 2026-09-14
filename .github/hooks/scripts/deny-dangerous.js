#!/usr/bin/env node
/**
 * why-ts harness gate: GitHub Copilot CLI / cloud agent `preToolUse` hook.
 *
 * Denies Never-tier commands (see AGENTS.md Territory Map): force-push,
 * package publish, `nx release`, and git tag mutation, for the `bash` /
 * `powershell` tools. `toolArgs` shape is not fully specified upstream, so
 * this stringifies the whole payload and matches against that blob rather
 * than assuming an exact key name.
 *
 * Exit 0 with no output = allow (default). Exit 0 with a deny decision on
 * stdout = deny. A crash here fails CLOSED per Copilot's own docs (exit
 * code other than 0/2 on preToolUse denies the call), so keep this script
 * defensive and side-effect-free.
 *
 * Source for the hook contract:
 * https://docs.github.com/en/copilot/reference/hooks-reference
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
    process.exit(0); // can't parse: allow, let normal permission flow decide
  }

  const toolName = input.toolName || input.tool_name || '';
  if (!/^(bash|powershell)$/i.test(String(toolName))) {
    process.exit(0);
  }

  const argsBlob = JSON.stringify(input.toolArgs ?? input.tool_input ?? '');
  const hit = DENY_PATTERNS.find((pattern) => pattern.test(argsBlob));

  if (hit) {
    process.stdout.write(
      JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason:
          'why-ts harness: Never-tier action (publish / force-push / tag mutation). See AGENTS.md and docs/playbooks/publish.md. Ask the human to run it directly.',
      })
    );
  }

  process.exit(0);
});
