import { BRAND_NAME } from '@/config/site';
/**
 * Copy-paste setup for the MCP clients people actually use, filled in with
 * the endpoint and a freshly created key.
 *
 * Every format here was checked against the client's own documentation
 * (October 2026); docs/guides/mcp-server.mdx carries the same snippets with
 * the token read from an environment variable instead. The token is written
 * inline because this is shown once, at creation, to someone who wants it
 * working in one paste.
 */

export const MCP_CLIENTS = [
  'claude-code',
  'claude-desktop',
  'codex',
  'cursor',
  'vscode',
  'windsurf',
  'gemini-cli',
  'hermes',
  'openclaw',
  'zed',
] as const;

export type McpClient = (typeof MCP_CLIENTS)[number];

export const MCP_CLIENT_LABELS: Record<McpClient, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude Desktop',
  codex: 'Codex CLI',
  cursor: 'Cursor',
  vscode: 'VS Code',
  windsurf: 'Windsurf',
  'gemini-cli': 'Gemini CLI',
  hermes: 'Hermes Agent',
  openclaw: 'OpenClaw',
  zed: 'Zed',
};

/** The snippet for one client. Where it goes (a terminal, a file, a settings
 *  screen) is UI copy and lives in messages under `apiKeysConnectWhere`. */
/** The name the MCP server is added under in each client's settings. */
export const MCP_SERVER_NAME = BRAND_NAME.toLowerCase();

export function mcpClientSnippet(client: McpClient, url: string, token: string): string {
  const bearer = `Bearer ${token}`;
  const json = (value: unknown) => JSON.stringify(value, null, 2);

  switch (client) {
    case 'claude-code':
      return `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} \\\n  --header "Authorization: ${bearer}"`;
    case 'claude-desktop':
      return [
        `Name: ${BRAND_NAME}`,
        `URL: ${url}`,
        'Authentication: No sign in',
        `Request header: Authorization = ${bearer}`,
      ].join('\n');
    case 'codex':
      return `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${url}"\nhttp_headers = { "Authorization" = "${bearer}" }`;
    case 'cursor':
      return json({ mcpServers: { [MCP_SERVER_NAME]: { url, headers: { Authorization: bearer } } } });
    case 'vscode':
      return json({
        servers: { [MCP_SERVER_NAME]: { type: 'http', url, headers: { Authorization: bearer } } },
      });
    case 'windsurf':
      return json({
        mcpServers: { [MCP_SERVER_NAME]: { serverUrl: url, headers: { Authorization: bearer } } },
      });
    case 'gemini-cli':
      return `gemini mcp add --transport http \\\n  --header "Authorization: ${bearer}" \\\n  ${MCP_SERVER_NAME} ${url}`;
    case 'hermes':
      return `mcp_servers:\n  ${MCP_SERVER_NAME}:\n    url: "${url}"\n    headers:\n      Authorization: "${bearer}"`;
    case 'openclaw':
      return json({
        mcp: {
          servers: {
            [MCP_SERVER_NAME]: { url, transport: 'streamable-http', headers: { Authorization: bearer } },
          },
        },
      });
    case 'zed':
      return json({ context_servers: { [MCP_SERVER_NAME]: { url, headers: { Authorization: bearer } } } });
  }
}
