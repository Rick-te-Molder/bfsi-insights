ALTER FUNCTION public.validate_state_transition(smallint, smallint, boolean)
SET search_path = pg_catalog, public;

ALTER FUNCTION public.enforce_state_transition()
SET search_path = pg_catalog, public;

ALTER FUNCTION public.get_valid_next_states(smallint, boolean)
SET search_path = pg_catalog, public;
