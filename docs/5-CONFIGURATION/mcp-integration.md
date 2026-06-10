# Model Context Protocol (MCP) Integration

Open i_Notes can be seamlessly integrated into your AI workflows using the **Model Context Protocol (MCP)**, enabling direct access to your i_Notes, sources, and chat functionality from AI assistants like Claude Desktop and VS Code extensions.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard that allows AI applications to securely connect to external data sources and tools. With the Open i_Notes MCP server, you can:

- 📚 **Access your i_Notes** directly from Claude Desktop or VS Code
- 🔍 **Search your research content** without leaving your AI assistant
- 💬 **Create and manage chat sessions** with your research as context
- 📝 **Generate notes** and insights on-the-fly
- 🤖 **Automate workflows** using the full Open i_Notes API

## Quick Setup

### For Claude Desktop

1. **Install the MCP server** (automatically from PyPI):

   ```bash
   # No manual installation needed! Claude Desktop will use uvx to run it automatically
   ```

2. **Configure Claude Desktop**:

   **macOS/Linux**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "open-i_Notes": {
         "command": "uvx",
         "args": ["open-i_Notes-mcp"],
         "env": {
           "OPEN_i_Notes_URL": "http://localhost:5055",
           "OPEN_i_Notes_PASSWORD": "your_password_here"
         }
       }
     }
   }
   ```

   **Windows**: Edit `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "open-i_Notes": {
         "command": "uvx",
         "args": ["open-i_Notes-mcp"],
         "env": {
           "OPEN_i_Notes_URL": "http://localhost:5055",
           "OPEN_i_Notes_PASSWORD": "your_password_here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop** and start using your i_Notes in conversations!

### For VS Code (Cline and other MCP-compatible extensions)

Add to your VS Code settings or `.vscode/mcp.json`:

```json
{
  "servers": {
    "open-i_Notes": {
      "command": "uvx",
      "args": ["open-i_Notes-mcp"],
      "env": {
        "OPEN_i_Notes_URL": "http://localhost:5055",
        "OPEN_i_Notes_PASSWORD": "your_password_here"
      }
    }
  }
}
```

## Configuration

- **OPEN_i_Notes_URL**: URL to your Open i_Notes API (default: `http://localhost:5055`)
- **OPEN_i_Notes_PASSWORD**: Optional - only needed if you've enabled password protection

### For Remote Servers

If your Open i_Notes instance is running on a remote server, update the URL accordingly:

```json
"OPEN_i_Notes_URL": "http://192.168.1.100:5055"
```

Or with a domain:

```json
"OPEN_i_Notes_URL": "https://i_Notes.yourdomain.com/api"
```

## What You Can Do

Once connected, you can ask Claude or your AI assistant to:

- _"Search my research i_Notes for information about [topic]"_
- _"Create a new note summarizing the key points from our conversation"_
- _"List all my i_Notes"_
- _"Start a chat session about [specific source or topic]"_
- _"What sources do I have in my [i_Notes name] i_Notes?"_
- _"Add this PDF to my research i_Notes"_
- _"Show me all notes in [i_Notes name]"_

The MCP server provides full access to Open i_Notes's capabilities, allowing you to manage your research seamlessly from within your AI assistant.

## Available Tools

The Open i_Notes MCP server exposes these capabilities:

### i_Notes

- List i_Notes
- Get i_Notes details
- Create new i_Notes
- Update i_Notes information
- Delete i_Notes

### Sources

- List sources in a i_Notes
- Get source details
- Add new sources (links, files, text)
- Update source metadata
- Delete sources

### Notes

- List notes in a i_Notes
- Get note details
- Create new notes
- Update notes
- Delete notes

### Chat

- Create chat sessions
- Send messages to chat sessions
- Get chat history
- List chat sessions

### Search

- Vector search across content
- Text search across content
- Filter by i_Notes

### Models

- List configured AI models
- Get model details
- Create model configurations
- Update model settings

### Settings

- Get application settings
- Update settings

## MCP Server Repository

The Open i_Notes MCP server is developed and maintained by the Epochal team:

**🔗 GitHub**: [Epochal-dev/open-i_Notes-mcp](https://github.com/Epochal-dev/open-i_Notes-mcp)

Contributions, issues, and feature requests are welcome!

## Finding the Server

The Open i_Notes MCP server is published to the official MCP Registry:

- **Registry**: Search for "open-i_Notes" at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io)
- **PyPI**: [pypi.org/project/open-i_Notes-mcp](https://pypi.org/project/open-i_Notes-mcp)
- **GitHub**: [Epochal-dev/open-i_Notes-mcp](https://github.com/Epochal-dev/open-i_Notes-mcp)

## Troubleshooting

### Connection Errors

1. Verify the `OPEN_i_Notes_URL` is correct and accessible
2. If using password protection, ensure `OPEN_i_Notes_PASSWORD` is set correctly
3. For remote servers, make sure port 5055 is accessible from your machine
4. Check firewall settings if connecting to a remote server

## Using with Other MCP Clients

The Open i_Notes MCP server follows the standard MCP protocol and can be used with any MCP-compatible client. Check your client's documentation for configuration details.

## Learn More

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
