import { randomUUID } from "crypto";
import { callLlmRegular } from "../../llm/regular.js";
import { buildSystemPrompt } from "../../prompt/index.js";
import { getSettings } from "../../service/settings/get.js";
import { registerTaskExecution, unregisterTaskExecution } from "../execution.js";
import {
  insertInstantTaskRecord,
  saveTaskMessage,
  updateTaskAborted,
  updateTaskDone,
  updateTaskError
} from "../../repository/task/create.js";
import { broadcast } from "../../system/ws.js";
import { parseJsonObject, validateBySchema } from "../../../shared/ai/json.js";
const runInstantTask = async ({
  prompt,
  schema,
  provider,
  apiUrl,
  apiKey,
  model,
  messages,
  tools,
  tool_choice,
  parallel_tool_calls,
  signal
}) => {
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  const systemPrompt = buildSystemPrompt();
  const payload = {
    model,
    messages: hasMessages ? messages : [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: schema ? `${prompt}

输出必须是 JSON，对应 schema：${JSON.stringify(schema)}` : prompt
      }
    ]
  };
  if (Array.isArray(tools) && tools.length) payload.tools = tools;
  if (tool_choice !== void 0) payload.tool_choice = tool_choice;
  if (parallel_tool_calls !== void 0) payload.parallel_tool_calls = parallel_tool_calls;
  const assistant = await callLlmRegular(provider, apiUrl, apiKey, payload, signal);
  const assistantMessage = {
    role: "assistant",
    content: assistant?.content ?? ""
  };
  if (Array.isArray(assistant?.tool_calls) && assistant.tool_calls.length > 0) {
    assistantMessage.tool_calls = assistant.tool_calls;
  }
  if (assistant?.reasoning_content !== undefined) {
    assistantMessage.reasoning_content = assistant.reasoning_content;
  }
  const content = String(assistantMessage.content || "").trim();
  if (Array.isArray(assistantMessage.tool_calls) && assistantMessage.tool_calls.length > 0) {
    return {
      assistantMessage,
      response: JSON.stringify({
        content,
        tool_calls: assistantMessage.tool_calls
      })
    };
  }
  if (schema) {
    const parsed = parseJsonObject(content);
    validateBySchema(parsed, schema);
    return {
      assistantMessage,
      response: JSON.stringify(parsed)
    };
  }
  return {
    assistantMessage,
    response: content
  };
};
const createInstantTask = async ({
  app,
  title = "",
  prompt,
  schema = null,
  meta = null,
  messages = null,
  tools = null,
  tool_choice = void 0,
  parallel_tool_calls = void 0
}) => {
  const { apiUrl, apiKey, model, provider } = getSettings();
  const conversationId = `task:${randomUUID().slice(0, 8)}`;
  const { taskId } = insertInstantTaskRecord({
    conversationId,
    app,
    title,
    prompt,
    schema,
    meta
  });
  broadcast({ type: "tasks_changed" });
  const abortController = new AbortController();
  registerTaskExecution(taskId, abortController);
  try {
    const { assistantMessage, response } = await runInstantTask({
      prompt,
      schema,
      provider,
      apiUrl,
      apiKey,
      model,
      messages,
      tools,
      tool_choice,
      parallel_tool_calls,
      signal: abortController.signal
    });
    saveTaskMessage(conversationId, assistantMessage, null);
    updateTaskDone({ taskId, response });
    broadcast({ type: "tasks_changed" });
    return { id: taskId, conversationId, response };
  } catch (error) {
    if (error?.name === "AbortError") {
      updateTaskAborted({ taskId });
    } else {
      updateTaskError({ taskId, message: error?.message || "Task execution failed" });
    }
    broadcast({ type: "tasks_changed" });
    throw error;
  } finally {
    unregisterTaskExecution(taskId);
  }
};
export {
  createInstantTask,
  runInstantTask
};
