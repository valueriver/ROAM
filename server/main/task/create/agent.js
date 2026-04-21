import { randomUUID } from "crypto";
import { chat } from "../../agent/handler.js";
import { buildSystemPrompt } from "../../prompt/index.js";
import { getSettings } from "../../service/settings/get.js";
import { registerTaskExecution, unregisterTaskExecution } from "../execution.js";
import {
  insertAgentTaskRecord,
  saveTaskMessage,
  updateTaskAborted,
  updateTaskDone,
  updateTaskError
} from "../../repository/task/create.js";
import { broadcast } from "../../system/ws.js";
const runAgentTask = async ({
  app,
  prompt,
  provider,
  apiUrl,
  apiKey,
  model,
  send,
  signal,
  enableToolResultTruncate,
  toolResultMaxChars,
  enableToolLoopLimit,
  toolMaxRounds
}) => {
  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ];
  return await chat(messages, {
    provider,
    apiUrl,
    apiKey,
    model,
    send,
    signal,
    maxRounds: enableToolLoopLimit ? toolMaxRounds : 1e5,
    enableToolResultTruncate,
    toolResultMaxChars
  });
};
const createAgentTask = async ({
  app,
  title = "",
  prompt,
  meta = null
}) => {
  const {
    apiUrl,
    apiKey,
    model,
    provider,
    enableToolResultTruncate,
    toolResultMaxChars,
    enableToolLoopLimit,
    toolMaxRounds
  } = getSettings();
  const conversationId = `task:${randomUUID().slice(0, 8)}`;
  const { taskId } = insertAgentTaskRecord({
    conversationId,
    app,
    title,
    prompt,
    meta
  });
  broadcast({ type: "tasks_changed" });
  const send = (msg) => {
    if (msg.type === "assistant_tool_calls" || msg.type === "tool_result" || msg.type === "done") {
      if (msg.message) saveTaskMessage(conversationId, msg.message, null);
      return;
    }
  };
  const abortController = new AbortController();
  registerTaskExecution(taskId, abortController);
  try {
    const response = await runAgentTask({
      app,
      prompt,
      provider,
      apiUrl,
      apiKey,
      model,
      send,
      signal: abortController.signal,
      enableToolResultTruncate,
      toolResultMaxChars,
      enableToolLoopLimit,
      toolMaxRounds
    });
    updateTaskDone({ taskId, response });
    broadcast({ type: "tasks_changed" });
    return { id: taskId, conversationId, response };
  } catch (error) {
    if (error?.name === "AbortError") {
      updateTaskAborted({ taskId });
    } else {
      updateTaskError({ taskId, message: error?.message || "任务执行失败" });
    }
    broadcast({ type: "tasks_changed" });
    throw error;
  } finally {
    unregisterTaskExecution(taskId);
  }
};
export {
  createAgentTask,
  runAgentTask
};
