# MCP Protocol Testing

This file contains context on tools, which can be shared with Claude Desktop or other MCP clients to do integration testing.

# Tools

reclaim_add_time
From server: reclaim-mcp-server

reclaim_clear_exceptions
From server: reclaim-mcp-server

reclaim_create_task
From server: reclaim-mcp-server

reclaim_delete_task
From server: reclaim-mcp-server

reclaim_get_task
From server: reclaim-mcp-server

reclaim_list_tasks
From server: reclaim-mcp-server

reclaim_log_work
From server: reclaim-mcp-server

reclaim_mark_complete
From server: reclaim-mcp-server

reclaim_mark_incomplete
From server: reclaim-mcp-server

reclaim_prioritize
From server: reclaim-mcp-server

reclaim_start_timer
From server: reclaim-mcp-server

reclaim_stop_timer
From server: reclaim-mcp-server

reclaim_update_task
From server: reclaim-mcp-server

—-

# Tests

# Detailed Reclaim.ai Tool Testing Reference

Below is a comprehensive reference for testing all Reclaim.ai tools, with specific input/output examples and expected field changes.

## Input and Output Examples for Each Tool

| Tool | Input Example | Output Example | Notes on Response |
|------|---------------|----------------|-------------------|
| reclaim_list_tasks | `{ "filter": "active" }` | ```[{"id": 9349049, "title": "Brief Drafting", "notes": "Task Breakdown...", "status": "IN_PROGRESS", "timeChunksRequired": 126, "timeChunksSpent": 105, "timeChunksRemaining": 21, "priority": "P1", "eventCategory": "WORK"}, {"id": 9388515, "title": "Review Document", "status": "SCHEDULED", "priority": "P2", ...}]``` | Returns array of task objects; truncated example above |
| reclaim_create_task | `{ "title": "Test Task", "notes": "Test notes", "priority": "P3", "eventCategory": "WORK", "eventSubType": "FOCUS", "timeChunksRequired": 2 }` | ```{"id": 9414231, "title": "Test Task", "notes": "Test notes", "eventCategory": "WORK", "eventSubType": "FOCUS", "status": "NEW", "timeChunksRequired": 2, "timeChunksSpent": 0, "timeChunksRemaining": 2, "priority": "P3", ...}``` | Returns the created task with assigned ID |
| reclaim_get_task | `{ "taskId": 9414231 }` | ```{"id": 9414231, "title": "Test Task", "notes": "Test notes", "eventCategory": "WORK", "eventSubType": "FOCUS", "status": "NEW", "timeChunksRequired": 2, "timeChunksSpent": 0, "timeChunksRemaining": 2, "priority": "P3", ...}``` | Returns complete task object |
| reclaim_update_task | `{ "taskId": 9414231, "title": "Updated Test Task", "notes": "Updated notes", "priority": "P2" }` | ```{"id": 9414231, "title": "Updated Test Task", "notes": "Updated notes", "eventCategory": "WORK", "eventSubType": "FOCUS", "status": "NEW", "timeChunksRequired": 2, "timeChunksSpent": 0, "timeChunksRemaining": 2, "priority": "P2", ...}``` | Returns task with updated fields |
| reclaim_add_time | `{ "taskId": 9414231, "minutes": 60 }` | ```{"events": [], "taskOrHabit": {"id": 9414231, "title": "Updated Test Task", "timeChunksRequired": 6, "timeChunksSpent": 0, "timeChunksRemaining": 6, ...}}``` | timeChunksRequired and timeChunksRemaining increase by 2 (60 min = 2 chunks) |
| reclaim_prioritize | `{ "taskId": 9414231 }` | ```{"events": [], "taskOrHabit": {"id": 9414231, "title": "Updated Test Task", "status": "SCHEDULED", ...}}``` | status changes to "SCHEDULED" |
| reclaim_start_timer | `{ "taskId": 9414231 }` | ```{"events": [...], "taskOrHabit": {"id": 9414231, "title": "Updated Test Task", "status": "IN_PROGRESS", ...}}``` | status changes to "IN_PROGRESS", events array contains calendar events |
| reclaim_stop_timer | `{ "taskId": 9414231 }` | ```{"events": [...], "taskOrHabit": {"id": 9414231, "title": "Updated Test Task", "status": "SCHEDULED", ...}}``` | status typically changes to "SCHEDULED" |
| reclaim_log_work | `{ "taskId": 9414231, "minutes": 30 }` | ```{"events": [...], "taskOrHabit": {"id": 9414231, "timeChunksSpent": 2, "timeChunksRemaining": 4, ...}}``` | timeChunksSpent increases, timeChunksRemaining decreases |
| reclaim_mark_complete | `{ "taskId": 9414231 }` | ```{"events": [...], "taskOrHabit": {"id": 9414231, "status": "ARCHIVED", "finished": "2025-04-26T16:25:17.721370022-04:00", ...}}``` | status changes to "ARCHIVED", finished timestamp added |
| reclaim_mark_incomplete | `{ "taskId": 9414231 }` | ```{"events": [], "taskOrHabit": {"id": 9414231, "status": "IN_PROGRESS", ...}}``` | status changes to "IN_PROGRESS", finished field removed |
| reclaim_clear_exceptions | `{ "taskId": 9414231 }` | ```{"events": [], "taskOrHabit": {"id": 9414231, ...}}``` | Resets scheduling exceptions |
| reclaim_delete_task | `{ "taskId": 9414231 }` | ```{"success": true}``` | Returns success message |

## Logical Testing Order

The coding agent should follow this logical order when developing tests:

1. **reclaim_list_tasks** - First check existing tasks
2. **reclaim_create_task** - Create a test task, store the returned task ID for subsequent operations
3. **reclaim_get_task** - Verify the task was created correctly
4. **reclaim_update_task** - Test updating various fields
5. **reclaim_add_time** - Test adding time to the task
6. **reclaim_prioritize** - Test prioritizing the task
7. **reclaim_start_timer** - Test starting a timer
8. **reclaim_stop_timer** - Test stopping a timer
9. **reclaim_log_work** - Test logging work
10. **reclaim_mark_complete** - Test marking as complete
11. **reclaim_mark_incomplete** - Test marking as incomplete
12. **reclaim_clear_exceptions** - Test clearing exceptions
13. **reclaim_delete_task** - Finally, clean up by deleting the test task

## Important Implementation Notes

1. **Task ID handling**: Use the task ID returned from `reclaim_create_task` for all subsequent operations

2. **Status transitions**:
   - NEW → SCHEDULED (after prioritize)
   - SCHEDULED → IN_PROGRESS (after start_timer)
   - IN_PROGRESS → SCHEDULED (after stop_timer)
   - Any status → ARCHIVED (after mark_complete)
   - ARCHIVED → IN_PROGRESS (after mark_incomplete)

3. **Time measurements**:
   - 30 minutes = 1 chunk
   - Always use multiples of 30 for the minutes parameter
   - Verify timeChunksRequired, timeChunksSpent, and timeChunksRemaining change appropriately

4. **Task status interpretation**:
   - Tasks with status "COMPLETE" are NOT finished by the user - they need attention
   - Only tasks with status "ARCHIVED" are actually completed

5. **Error handling**:
   - Test with invalid task IDs to ensure errors are handled properly
   - Test with invalid time values (non-multiples of 30)
