-- Sections become independent. Work no longer drags Learn and Debug with it.
--
-- 0001 introduced "everyone in Work is ALWAYS also in Learn" as a company rule,
-- and 0026 extended it to Debug. Both halves were enforced: an after-insert
-- trigger granted the extra sections, and a deferred constraint trigger refused
-- to let them be removed while Work was held. The rule outlived its usefulness —
-- there are now people who belong on the Work board and nowhere else, and the
-- admin screen had no way to express that. Unchecking Learn raised
-- "Work members must also be in Learn — remove Work first", which is a rule
-- masquerading as an error message.
--
-- Access is now exactly what an admin checked: one row per section, no implied
-- rows, no hidden coupling. The matching client-side rules in
-- src/lib/actions/admin.ts and src/components/admin/user-row.tsx go with it.
--
-- Nothing is revoked here. Everyone who was given Learn/Debug by the trigger
-- keeps those rows — this migration removes the machinery, not the access, so
-- no one loses a section overnight. Admins can now revoke them one at a time.

-- Triggers first: dropping a function while a trigger still references it
-- fails on dependency.
drop trigger if exists memberships_grant_learn_with_work on public.section_memberships;
drop trigger if exists memberships_work_requires_learn on public.section_memberships;

drop function if exists private.grant_learn_with_work();
drop function if exists private.check_work_implies_learn();
