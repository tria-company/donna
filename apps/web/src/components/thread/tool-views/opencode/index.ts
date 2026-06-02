/**
 * OpenCode ToolView components for DonnaComputer.
 *
 * These are registered in the ToolViewRegistry under the "oc-" prefix
 * to avoid collision with AgentPress tool names.
 */

export { OcBashToolView } from './OcBashToolView';
export { OcEditToolView } from './OcEditToolView';
export { OcWriteToolView } from './OcWriteToolView';
export { OcReadToolView } from './OcReadToolView';
export { OcSearchToolView } from './OcSearchToolView';
export { OcWebFetchToolView } from './OcWebFetchToolView';
export { OcWebSearchToolView } from './OcWebSearchToolView';
export { OcPresentationGenToolView } from './OcPresentationGenToolView';
export { OcImageSearchToolView } from './OcImageSearchToolView';
export { OcImageGenToolView } from './OcImageGenToolView';
export { OcShowUserToolView } from './OcShowUserToolView';
export { OcApplyPatchToolView } from './OcApplyPatchToolView';
export { OcTaskToolView } from './OcTaskToolView';
export { OcDonnaTaskToolView } from './OcDonnaTaskToolView';
export { OcTodoToolView } from './OcTodoToolView';
export { OcGenericToolView } from './OcGenericToolView';
export { OcQuestionToolView } from './OcQuestionToolView';
export { OcSessionContextToolView } from './OcSessionContextToolView';
export { OcSkillToolView } from './OcSkillToolView';
export { OcCodesearchToolView } from './OcCodesearchToolView';
export { OcBatchToolView } from './OcBatchToolView';
export { OcPlanToolView } from './OcPlanToolView';
export { OcPtySpawnToolView, OcPtyReadToolView, OcPtyWriteToolView, OcPtyKillToolView } from './OcPtyToolViews';
export { OcMemSearchToolView } from './OcMemSearchToolView';
export { OcMemSaveToolView } from './OcMemSaveToolView';
export { OcSessionListToolView } from './OcSessionListToolView';
export { OcSessionGetToolView } from './OcSessionGetToolView';
export { OcSessionReadToolView } from './OcSessionReadToolView';
export { OcSessionSearchToolView } from './OcSessionSearchToolView';
export { OcSessionMessageToolView } from './OcSessionMessageToolView';
export { OcSessionLineageToolView } from './OcSessionLineageToolView';
export { OcGetMemToolView } from './OcGetMemToolView';
export { OcProjectListToolView } from './OcProjectListToolView';
export { OcProjectGetToolView } from './OcProjectGetToolView';
export { OcProjectSelectToolView } from './OcProjectSelectToolView';
export { OcProjectCreateToolView } from './OcProjectCreateToolView';
export { OcConnectorListToolView } from './OcConnectorListToolView';
export { OcConnectorGetToolView } from './OcConnectorGetToolView';
export { OcConnectorSetupToolView } from './OcConnectorSetupToolView';
export { OcTriggersToolView } from './OcTriggersToolView';
export { OcSessionStatsToolView } from './OcSessionStatsToolView';

import type { ToolViewComponent } from '../wrapper/ToolViewRegistry';
import { OcBashToolView } from './OcBashToolView';
import { OcEditToolView } from './OcEditToolView';
import { OcWriteToolView } from './OcWriteToolView';
import { OcReadToolView } from './OcReadToolView';
import { OcSearchToolView } from './OcSearchToolView';
import { OcWebFetchToolView } from './OcWebFetchToolView';
import { OcWebSearchToolView } from './OcWebSearchToolView';
import { OcPresentationGenToolView } from './OcPresentationGenToolView';
import { OcImageSearchToolView } from './OcImageSearchToolView';
import { OcImageGenToolView } from './OcImageGenToolView';
import { OcShowUserToolView } from './OcShowUserToolView';
import { OcApplyPatchToolView } from './OcApplyPatchToolView';
import { OcTodoToolView } from './OcTodoToolView';
import { OcGenericToolView } from './OcGenericToolView';
import { OcQuestionToolView } from './OcQuestionToolView';
import { OcSessionContextToolView } from './OcSessionContextToolView';
import { OcSkillToolView } from './OcSkillToolView';
import { OcCodesearchToolView } from './OcCodesearchToolView';
import { OcBatchToolView } from './OcBatchToolView';
import { OcPlanToolView } from './OcPlanToolView';
import { OcPtySpawnToolView, OcPtyReadToolView, OcPtyWriteToolView, OcPtyKillToolView } from './OcPtyToolViews';
import { OcMemSearchToolView } from './OcMemSearchToolView';
import { OcMemSaveToolView } from './OcMemSaveToolView';
import { OcSessionListToolView } from './OcSessionListToolView';
import { OcSessionGetToolView } from './OcSessionGetToolView';
import { OcSessionReadToolView } from './OcSessionReadToolView';
import { OcSessionSearchToolView } from './OcSessionSearchToolView';
import { OcSessionMessageToolView } from './OcSessionMessageToolView';
import { OcSessionLineageToolView } from './OcSessionLineageToolView';
import { OcGetMemToolView } from './OcGetMemToolView';
import { OcProjectListToolView } from './OcProjectListToolView';
import { OcProjectGetToolView } from './OcProjectGetToolView';
import { OcProjectSelectToolView } from './OcProjectSelectToolView';
import { OcProjectCreateToolView } from './OcProjectCreateToolView';
import { OcConnectorListToolView } from './OcConnectorListToolView';
import { OcConnectorGetToolView } from './OcConnectorGetToolView';
import { OcConnectorSetupToolView } from './OcConnectorSetupToolView';
import { OcTriggersToolView } from './OcTriggersToolView';
import { OcSessionStatsToolView } from './OcSessionStatsToolView';
import { OcDonnaTaskToolView } from './OcDonnaTaskToolView';

/**
 * Registry entries for OpenCode tools.
 * Call `toolViewRegistry.registerMany(ocToolViewRegistrations)` to activate.
 */
export const ocToolViewRegistrations: Record<string, ToolViewComponent> = {
  // Shell / command execution
  'oc-bash': OcBashToolView,

  // PTY (pseudo-terminal) tools
  'oc-pty_spawn': OcPtySpawnToolView,
  'oc-pty-spawn': OcPtySpawnToolView,
  'oc-pty_read': OcPtyReadToolView,
  'oc-pty-read': OcPtyReadToolView,
  'oc-pty_write': OcPtyWriteToolView,
  'oc-pty-write': OcPtyWriteToolView,
  'oc-pty_input': OcPtyWriteToolView,
  'oc-pty-input': OcPtyWriteToolView,
  'oc-pty_kill': OcPtyKillToolView,
  'oc-pty-kill': OcPtyKillToolView,

  // File editing
  'oc-edit': OcEditToolView,
  'oc-morph_edit': OcEditToolView,
  'oc-morph-edit': OcEditToolView,

  // File writing / creation
  'oc-write': OcWriteToolView,

  // File reading
  'oc-read': OcReadToolView,

  // Search tools (glob, grep, list)
  'oc-glob': OcSearchToolView,
  'oc-grep': OcSearchToolView,
  'oc-list': OcSearchToolView,

  // Web fetching (generic URL fetch)
  'oc-webfetch': OcWebFetchToolView,
  'oc-scrape-webpage': OcWebFetchToolView,

  // Web search (structured search results)
  'oc-websearch': OcWebSearchToolView,
  'oc-web-search': OcWebSearchToolView,
  'oc-web_search': OcWebSearchToolView,

  // Image search
  'oc-image-search': OcImageSearchToolView,

  // Image generation
  'oc-image-gen': OcImageGenToolView,

  // Video generation (uses generic — prompt + output display)
  'oc-video-gen': OcGenericToolView,

  // Presentation generation (create slide, preview, export, etc.)
  'oc-presentation-gen': OcPresentationGenToolView,

  // Show (output to user — files, images, URLs, text, errors)
  'oc-show': OcShowUserToolView,
  'oc-show-user': OcShowUserToolView, // backward compat

  // Apply patch (multi-file diffs)
  'oc-apply-patch': OcApplyPatchToolView,
  'oc-apply_patch': OcApplyPatchToolView,

  // Agent task tools (unified system)
  'oc-agent_task': OcDonnaTaskToolView,
  'oc-agent-task': OcDonnaTaskToolView,
  'agent_task': OcDonnaTaskToolView,
  'agent-task': OcDonnaTaskToolView,
  'oc-agent_task_update': OcDonnaTaskToolView,
  'oc-agent-task-update': OcDonnaTaskToolView,
  'agent_task_update': OcDonnaTaskToolView,
  'agent-task-update': OcDonnaTaskToolView,
  'oc-agent_task_list': OcDonnaTaskToolView,
  'oc-agent-task-list': OcDonnaTaskToolView,
  'agent_task_list': OcDonnaTaskToolView,
  'agent-task-list': OcDonnaTaskToolView,
  'oc-agent_task_get': OcDonnaTaskToolView,
  'oc-agent-task-get': OcDonnaTaskToolView,
  'agent_task_get': OcDonnaTaskToolView,
  'agent-task-get': OcDonnaTaskToolView,
  'oc-task_create': OcDonnaTaskToolView,
  'oc-task-create': OcDonnaTaskToolView,
  'task_create': OcDonnaTaskToolView,
  'task-create': OcDonnaTaskToolView,
  'oc-task_update': OcDonnaTaskToolView,
  'oc-task-update': OcDonnaTaskToolView,
  'task_update': OcDonnaTaskToolView,
  'task-update': OcDonnaTaskToolView,
  'oc-task_list': OcDonnaTaskToolView,
  'oc-task-list': OcDonnaTaskToolView,
  'task_list': OcDonnaTaskToolView,
  'task-list': OcDonnaTaskToolView,
  'oc-task_get': OcDonnaTaskToolView,
  'oc-task-get': OcDonnaTaskToolView,
  'task_get': OcDonnaTaskToolView,
  'task-get': OcDonnaTaskToolView,

  // Legacy agent tools (backwards compat for old sessions)
  'oc-task': OcDonnaTaskToolView,
  'task': OcDonnaTaskToolView,
  'oc-agent_spawn': OcDonnaTaskToolView,
  'agent_spawn': OcDonnaTaskToolView,
  'agent-spawn': OcDonnaTaskToolView,
  'oc-agent_message': OcDonnaTaskToolView,
  'agent_message': OcDonnaTaskToolView,
  'agent-message': OcDonnaTaskToolView,
  'oc-agent_stop': OcDonnaTaskToolView,
  'agent_stop': OcDonnaTaskToolView,
  'agent-stop': OcDonnaTaskToolView,
  'oc-agent_status': OcDonnaTaskToolView,
  'agent_status': OcDonnaTaskToolView,
  'agent-status': OcDonnaTaskToolView,

  // Session spawning (legacy — routed to unified renderer)
  'oc-session_spawn': OcDonnaTaskToolView,
  'oc-session-spawn': OcDonnaTaskToolView,
  'session_spawn': OcDonnaTaskToolView,
  'session-spawn': OcDonnaTaskToolView,
  'oc-session_start_background': OcDonnaTaskToolView,
  'oc-session-start-background': OcDonnaTaskToolView,
  'session_start_background': OcDonnaTaskToolView,
  'session-start-background': OcDonnaTaskToolView,

  // Todo / task management
  'oc-todowrite': OcTodoToolView,
  'oc-todoread': OcTodoToolView,

  // Question tool — formatted Q&A display
  'oc-question': OcQuestionToolView,

  // Session context (cross-session references)
  'oc-session-context': OcSessionContextToolView,
  'oc-session_context': OcSessionContextToolView,

  // Skill loading (SKILL.md knowledge modules)
  'oc-skill': OcSkillToolView,

  // Code search (external API search)
  'oc-codesearch': OcCodesearchToolView,

  // Batch execution (parallel tool calls)
  'oc-batch': OcBatchToolView,

  // Plan tools (agent switching)
  'oc-plan_exit': OcPlanToolView,
  'oc-plan-exit': OcPlanToolView,
  'oc-plan_enter': OcPlanToolView,
  'oc-plan-enter': OcPlanToolView,

  // Memory tools (kortix-memory)
  'oc-mem_search': OcMemSearchToolView,
  'oc-mem-search': OcMemSearchToolView,
  'mem_search': OcMemSearchToolView,
  'mem-search': OcMemSearchToolView,
  'memory_search': OcMemSearchToolView,
  'memory-search': OcMemSearchToolView,
  'ltm_search': OcMemSearchToolView,
  'ltm-search': OcMemSearchToolView,
  'oc-mem_save': OcMemSaveToolView,
  'oc-mem-save': OcMemSaveToolView,

  // Session tools (Donna session surfaces)
  'oc-session_list': OcSessionListToolView,
  'oc-session-list': OcSessionListToolView,
  'session_list': OcSessionListToolView,
  'oc-session_get': OcSessionGetToolView,
  'oc-session-get': OcSessionGetToolView,
  'session_get': OcSessionGetToolView,
  'oc-session_read': OcSessionReadToolView,
  'oc-session-read': OcSessionReadToolView,
  'session_read': OcSessionReadToolView,
  'oc-session_search': OcSessionSearchToolView,
  'oc-session-search': OcSessionSearchToolView,
  'session_search': OcSessionSearchToolView,
  'oc-session_message': OcSessionMessageToolView,
  'oc-session-message': OcSessionMessageToolView,
  'session_message': OcSessionMessageToolView,
  'oc-session_lineage': OcSessionLineageToolView,
  'oc-session-lineage': OcSessionLineageToolView,
  'session_lineage': OcSessionLineageToolView,
  'oc-session_stats': OcSessionStatsToolView,
  'oc-session-stats': OcSessionStatsToolView,
  'session_stats': OcSessionStatsToolView,
  'oc-session_list_background': OcSessionListToolView,
  'oc-session-list-background': OcSessionListToolView,
  'session_list_background': OcSessionListToolView,
  'oc-session_list_spawned': OcSessionListToolView,
  'oc-session-list-spawned': OcSessionListToolView,
  'session_list_spawned': OcSessionListToolView,

  // Project tools (Donna project surfaces)
  'oc-project_list': OcProjectListToolView,
  'oc-project-list': OcProjectListToolView,
  'project_list': OcProjectListToolView,
  'oc-project_get': OcProjectGetToolView,
  'oc-project-get': OcProjectGetToolView,
  'project_get': OcProjectGetToolView,
  'oc-project_select': OcProjectSelectToolView,
  'oc-project-select': OcProjectSelectToolView,
  'project_select': OcProjectSelectToolView,
  'oc-project_create': OcProjectCreateToolView,
  'oc-project-create': OcProjectCreateToolView,
  'project_create': OcProjectCreateToolView,
  'oc-project_update': OcProjectGetToolView,
  'oc-project-update': OcProjectGetToolView,
  'project_update': OcProjectGetToolView,
  'oc-project_delete': OcProjectGetToolView,
  'oc-project-delete': OcProjectGetToolView,
  'project_delete': OcProjectGetToolView,

  // Connector tools (kortix-connectors plugin)
  'oc-connector_list': OcConnectorListToolView,
  'oc-connector-list': OcConnectorListToolView,
  'connector_list': OcConnectorListToolView,
  'oc-connector_get': OcConnectorGetToolView,
  'oc-connector-get': OcConnectorGetToolView,
  'connector_get': OcConnectorGetToolView,
  'oc-connector_setup': OcConnectorSetupToolView,
  'oc-connector-setup': OcConnectorSetupToolView,
  'connector_setup': OcConnectorSetupToolView,

  // Legacy / compatibility memory retrieval tool
  'oc-get_mem': OcGetMemToolView,
  'oc-get-mem': OcGetMemToolView,
  'get_mem': OcGetMemToolView,
  'get-mem': OcGetMemToolView,

  // Trigger tools (Donna trigger management)
  'oc-triggers': OcTriggersToolView,
  'triggers': OcTriggersToolView,
  'oc-trigger_create': OcTriggersToolView,
  'oc-trigger-create': OcTriggersToolView,
  'trigger_create': OcTriggersToolView,
  'trigger-create': OcTriggersToolView,
  'oc-trigger_list': OcTriggersToolView,
  'oc-trigger-list': OcTriggersToolView,
  'trigger_list': OcTriggersToolView,
  'trigger-list': OcTriggersToolView,
  'oc-trigger_get': OcTriggersToolView,
  'oc-trigger-get': OcTriggersToolView,
  'trigger_get': OcTriggersToolView,
  'trigger-get': OcTriggersToolView,
  'oc-trigger_delete': OcTriggersToolView,
  'oc-trigger-delete': OcTriggersToolView,
  'trigger_delete': OcTriggersToolView,
  'trigger-delete': OcTriggersToolView,
  'oc-trigger_update': OcTriggersToolView,
  'oc-trigger-update': OcTriggersToolView,
  'trigger_update': OcTriggersToolView,
  'trigger-update': OcTriggersToolView,
  'oc-trigger_test': OcTriggersToolView,
  'oc-trigger-test': OcTriggersToolView,
  'trigger_test': OcTriggersToolView,
  'trigger-test': OcTriggersToolView,
  'oc-trigger_pause': OcTriggersToolView,
  'oc-trigger-pause': OcTriggersToolView,
  'trigger_pause': OcTriggersToolView,
  'trigger-pause': OcTriggersToolView,
  'oc-trigger_resume': OcTriggersToolView,
  'oc-trigger-resume': OcTriggersToolView,
  'trigger_resume': OcTriggersToolView,
  'trigger-resume': OcTriggersToolView,

  // MCP tools and other unknown tools will fall through to the
  // registry's default (GenericToolView). The OcGenericToolView
  // is available for explicit oc-* fallback if needed.
};
