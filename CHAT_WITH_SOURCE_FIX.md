# Chat with Source - Backend Fix Documentation

## Overview
This document describes the fix applied to the "Chat with Source" feature to ensure proper context handling and source-aware responses.

## Problem Identified
The chat with source feature was not properly utilizing the source context when generating responses. The backend was set up correctly but needed improvements in:

1. **Context Size**: Increased from 4000 to 6000 tokens to ensure full source content is available
2. **System Prompt**: Enhanced to explicitly emphasize using ONLY source context
3. **Logging**: Added comprehensive logging for debugging
4. **Context Message**: Improved formatting to ensure the LLM receives clear instructions

## Changes Made

### File: `api/routers/source_chat.py`

#### Function: `stream_source_chat_response()`

**Key Improvements:**

1. **Increased Context Token Limit**
   ```python
   # Before: max_tokens=4000
   # After: max_tokens=6000
   cb = ContextBuilder(
       source_id=source_id,
       include_insights=True,
       include_notes=False,
       max_tokens=6000  # Increased to ensure full context is available
   )
   ```
   - Ensures more of the source document is available for context

2. **Enhanced System Prompt**
   ```python
   system_prompt = (
       "You are an expert investigative analyst. "
       "Answer questions using ONLY the SOURCE CONTEXT provided below. "
       "Never use external knowledge or information outside the source. "
       "Give COMPREHENSIVE, DETAILED answers with ALL relevant facts — "
       "dates, names, locations, amounts, events, relationships, and connections. "
       "Never give short answers. Always provide complete information. "
       "If information is not found in the source, say 'Not found in source.'"
   )
   ```
   - More explicit about using ONLY source context
   - Emphasizes comprehensive answers
   - Clarifies what to do when information is not found

3. **Improved Context Message**
   ```python
   context_message = (
       f"SOURCE CONTEXT:\n\n{formatted_context}\n\n"
       f"---\n"
       f"Using ONLY the above source context, answer this question "
       f"in full detail with all relevant information:\n\n{message}"
   )
   ```
   - Added "with all relevant information" for clarity
   - Clear separation between context and question

4. **Added Comprehensive Logging**
   ```python
   logger.info(f"[SourceChat] Context built: {len(formatted_context)} chars, {len(raw_insights)} insights")
   logger.info(f"[SourceChat] Streaming response for: {message[:100]}")
   logger.info(f"[SourceChat] Response complete: {len(complete_content)} chars")
   ```
   - Helps debug context building and response generation

## How It Works

### Request Flow
1. **User sends message** → Frontend calls `/api/sources/{sourceId}/chat/sessions/{sessionId}/messages`
2. **Backend receives request** → `send_message_to_source_chat()` endpoint
3. **Context is built** → `ContextBuilder` retrieves source content and insights
4. **Context is formatted** → `_format_source_context()` creates readable context
5. **LLM is called** → With system prompt + history + context + question
6. **Response streams** → Tokens are sent back via SSE (Server-Sent Events)
7. **Session is saved** → Messages are persisted to LangGraph state

### Context Building Process
```
Source Document
    ↓
ContextBuilder (max_tokens=6000)
    ↓
Extract full_text + insights
    ↓
Year-based prioritization (if year mentioned in question)
    ↓
_format_source_context()
    ↓
Formatted context with:
  - Source ID & Title
  - Full content (up to 40K chars)
  - Generated insights
```

### LLM Payload Structure
```
[
  SystemMessage(content="You are an expert..."),
  ...previous messages (last 2 turns)...,
  HumanMessage(content="SOURCE CONTEXT:\n\n{formatted_context}\n\n---\nUsing ONLY the above source context, answer this question in full detail with all relevant information:\n\n{message}")
]
```

## Frontend Integration

The frontend (`useSourceChat` hook) handles:
- Session management (create, list, switch, delete)
- Message streaming via SSE
- Real-time token display
- Suggested questions generation
- Context indicators display

**No UI changes were made** - only backend improvements.

## Testing the Fix

### Manual Testing Steps

1. **Upload a source document** (PDF, DOCX, etc.)
2. **Open Chat with Source** panel
3. **Ask a specific question** about the document content
4. **Verify response includes**:
   - Specific facts from the document
   - Names, dates, locations mentioned
   - Detailed information (not short answers)
   - References to actual content

### Example Questions to Test
- "Who is [name from document]?"
- "What happened in [year from document]?"
- "Where is [location from document]?"
- "When did [event from document] occur?"

### Debugging
Check API logs for:
```
[SourceChat] Context built: XXXX chars, X insights
[SourceChat] Streaming response for: ...
[SourceChat] Response complete: XXXX chars
```

## Architecture Preserved

✅ **No changes to**:
- Frontend UI components
- Frontend API client
- Database schema
- Session management
- Message persistence
- Suggested questions generation
- Context indicators

✅ **Only improved**:
- Context token allocation
- System prompt clarity
- Logging for debugging
- Context message formatting

## Performance Considerations

- **Context size**: 6000 tokens (~4500 words) - balanced for quality and speed
- **Max response tokens**: 2048 tokens (~1500 words) - allows comprehensive answers
- **Streaming**: Real-time token delivery for better UX
- **Caching**: Session state cached in LangGraph SQLite

## Backward Compatibility

✅ **Fully backward compatible**
- No API endpoint changes
- No request/response schema changes
- No database migrations needed
- Existing sessions continue to work

## Future Improvements

Potential enhancements:
1. Add source-specific RAG (Retrieval-Augmented Generation)
2. Implement semantic search for better context retrieval
3. Add citation tracking for source references
4. Support for multi-source context
5. Custom system prompts per source type

## Summary

The fix ensures that the "Chat with Source" feature properly utilizes source context by:
1. Allocating more tokens for context (6000 vs 4000)
2. Providing clearer instructions to the LLM
3. Improving logging for debugging
4. Maintaining all existing functionality

The UI remains unchanged - only backend improvements were made to ensure better source-aware responses.
