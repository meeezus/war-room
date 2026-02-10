-- Event Triggers Migration
-- 1. Expand events.type CHECK to include task_created, task_updated
-- 2. Auto-emit events on tasks, proposals, and agent_status changes
-- 3. Auto-progress linked tasks when mission status changes

-- ============================================================
-- 1. Expand events.type CHECK constraint
-- ============================================================

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN (
    'proposal_created','proposal_approved','proposal_rejected',
    'mission_started','mission_completed','mission_failed',
    'step_started','step_completed','step_failed','step_stale',
    'heartbeat','agent_action','user_request',
    'task_created','task_updated'
  ));

-- ============================================================
-- 2. Event trigger functions + triggers
-- ============================================================

-- ----- Tasks -----

CREATE OR REPLACE FUNCTION emit_task_event() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO events (type, message, metadata)
    VALUES (
      'task_created',
      'New task: ' || NEW.title,
      jsonb_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'status', NEW.status
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO events (type, message, metadata)
    VALUES (
      'task_updated',
      NEW.title || ' -> ' || NEW.status,
      jsonb_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'owner', NEW.owner
      )
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires on INSERT or when status column changes. No recursion guard needed
-- because we only INSERT into events, and events has no trigger that updates tasks.
CREATE TRIGGER task_event_trigger
  AFTER INSERT OR UPDATE OF status ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION emit_task_event();

-- ----- Proposals -----

CREATE OR REPLACE FUNCTION emit_proposal_event() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO events (type, source_id, message, metadata)
    VALUES (
      'proposal_created',
      NEW.id,
      'New proposal: ' || NEW.title,
      jsonb_build_object(
        'proposal_id', NEW.id,
        'domain', NEW.domain,
        'requested_by', NEW.requested_by
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO events (type, source_id, message, metadata)
      VALUES (
        'proposal_approved',
        NEW.id,
        'Approved: ' || NEW.title,
        jsonb_build_object(
          'proposal_id', NEW.id,
          'approved_by', NEW.approved_by
        )
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO events (type, source_id, message, metadata)
      VALUES (
        'proposal_rejected',
        NEW.id,
        'Rejected: ' || NEW.title,
        jsonb_build_object('proposal_id', NEW.id)
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER proposal_event_trigger
  AFTER INSERT OR UPDATE OF status ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION emit_proposal_event();

-- ----- Agent Status -----

CREATE OR REPLACE FUNCTION emit_agent_status_event() RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO events (type, agent, message, metadata)
    VALUES (
      'agent_action',
      NEW.display_name,
      NEW.display_name || ' is now ' || NEW.status,
      jsonb_build_object(
        'agent_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- agent_status.id is TEXT (not UUID), so we use the agent column for display_name
-- and put the id in metadata instead of source_id.
CREATE TRIGGER agent_status_event_trigger
  AFTER UPDATE ON agent_status
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION emit_agent_status_event();

-- ============================================================
-- 3. Mission auto-progression trigger
-- ============================================================
-- When a mission changes status, advance the linked task
-- (linked via proposal_id: missions.proposal_id -> tasks.proposal_id).
--
-- Mapping:
--   mission running   -> task in_progress  (if task not already done)
--   mission completed -> task review       (if task not already done)
--   mission failed    -> task blocked      (if task not already done)
--
-- The cascade: mission completes -> this trigger updates task.status
--   -> task_event_trigger fires -> emits task_updated event -> feed shows it.

CREATE OR REPLACE FUNCTION progress_task_on_mission() RETURNS trigger AS $$
DECLARE
  _new_task_status text;
BEGIN
  -- Only fire on actual status transitions
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Determine target task status
  CASE NEW.status
    WHEN 'running'   THEN _new_task_status := 'in_progress';
    WHEN 'completed' THEN _new_task_status := 'review';
    WHEN 'failed'    THEN _new_task_status := 'blocked';
    ELSE RETURN NEW;  -- No action for other statuses
  END CASE;

  -- Update linked tasks (via proposal_id), skip tasks already done
  UPDATE tasks
    SET status     = _new_task_status,
        updated_at = now()
    WHERE proposal_id = NEW.proposal_id
      AND NEW.proposal_id IS NOT NULL
      AND status <> 'done';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mission_progression_trigger
  AFTER UPDATE OF status ON missions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION progress_task_on_mission();
