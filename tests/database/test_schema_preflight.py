"""Synthetic compatibility counterexamples, exclusively in the private local cluster.

These tests document unsafe baseline assumptions, not defects observed remotely.
No external DSN, Supabase project, application credential or production row is used.
"""
import json
from pathlib import Path
from uuid import uuid4

import pytest
import test_reward_database as reward_database

from test_reward_database import (
    Database,
    MIGRATION,
    OTHER,
    OWNER,
    ROOT,
    TASK,
)

cluster = reward_database.cluster


@pytest.fixture
def baseline_db(cluster):
    command, env, admin = cluster
    name = 'preflight_' + uuid4().hex
    admin.sql(f'create database {name}')
    database = Database(command, env, name)
    try:
        database.sql(Path(__file__).with_name('core_fixture.sql').read_text())
        database.sql((ROOT / 'supabase/migrations/20260808213028_secure_public_tables_with_rls.sql').read_text())
        database.sql(f"insert into profiles(id,username) values('{OWNER}','owner'),('{OTHER}','other'); "
                     f"insert into tasks values('{TASK}','Synthetic practice task')")
        yield database
    finally:
        # Same cleanup as the reward harness: only a DB we created in its private
        # UNIX-socket cluster, never a configured or external database.
        admin.sql(f'drop database {name}')


def test_preflight_duplicate_legacy_achievements_abort_entire_migration(baseline_db):
    baseline_db.sql(f"insert into achievements values('{TASK}','synthetic',5); "
                    f"insert into user_achievements values('{OWNER}','{TASK}'),('{OWNER}','{TASK}')")
    result = baseline_db.sql(MIGRATION.read_text(), check=False)
    assert result.returncode != 0 and 'reward_achievement_owner_unique' in result.stderr
    assert baseline_db.sql("select count(*) from information_schema.columns where table_schema='public' "
                           "and table_name='profiles' and column_name='legacy_reward_snapshot'").stdout.strip() == '0'
    assert baseline_db.sql('select count(*) from user_achievements').stdout.strip() == '2'
    assert baseline_db.sql("select to_regclass('public.reward_accounts') is null").stdout.strip() == 't'


@pytest.mark.parametrize('baseline_change', [
    'alter table sessions alter column id set default null',
    'alter table sessions add column tenant_label text not null',
])
def test_preflight_session_shape_can_migrate_but_fail_on_first_save(baseline_db, baseline_change):
    baseline_db.sql(baseline_change)
    baseline_db.sql(MIGRATION.read_text())
    result = baseline_db.settle(check=False)
    assert result.returncode != 0 and 'not-null constraint' in result.stderr
    for table in ('sessions', 'reward_accounts', 'practice_progress', 'reward_private.session_settlements'):
        assert baseline_db.sql(f'select count(*) from {table}').stdout.strip() == '0'


def test_preflight_extra_required_profile_field_breaks_safe_signup(baseline_db):
    baseline_db.sql("alter table profiles add column tenant_label text not null default 'synthetic'; "
                    "alter table profiles alter column tenant_label set default null")
    baseline_db.sql(MIGRATION.read_text())
    new_owner = str(uuid4())
    result = baseline_db.sql(f"insert into profiles(id,username) values('{new_owner}','new_owner')",
                             role='authenticated', owner=new_owner, check=False)
    assert result.returncode != 0 and 'not-null constraint' in result.stderr


def test_preflight_policy_replacement_removes_custom_restrictions(baseline_db):
    baseline_db.sql('create policy synthetic_frozen_profiles on profiles as restrictive '
                    'for select to authenticated using(false)')
    assert baseline_db.sql('select count(*) from profiles', role='authenticated').stdout.strip().splitlines()[-1] == '0'
    baseline_db.sql(MIGRATION.read_text())
    assert baseline_db.sql('select count(*) from profiles', role='authenticated').stdout.strip().splitlines()[-1] == '1'
    assert baseline_db.sql("select count(*) from pg_policies where policyname='synthetic_frozen_profiles'").stdout.strip() == '0'


def test_preflight_inherited_column_grant_survives_direct_revocations(baseline_db):
    baseline_db.sql('create role synthetic_preflight_writer; grant synthetic_preflight_writer to authenticated; '
                    'grant update(xp) on profiles to synthetic_preflight_writer')
    baseline_db.sql(MIGRATION.read_text())
    baseline_db.sql(f"update profiles set xp=999 where id='{OWNER}'", role='authenticated')
    assert baseline_db.sql(f"select xp from profiles where id='{OWNER}'").stdout.strip() == '999'
    # The mirror is compromised; this path alone cannot initialize trusted XP.
    assert baseline_db.settle()['profile']['xp'] == 5


def test_preflight_existing_definer_rpc_can_bypass_new_reward_boundary(baseline_db):
    baseline_db.sql("create function public.synthetic_legacy_reward() returns void language plpgsql "
                    "security definer set search_path='' as $$ begin "
                    "update public.reward_accounts set xp=999 where user_id=auth.uid(); end $$")
    baseline_db.sql(MIGRATION.read_text())
    baseline_db.settle()
    baseline_db.sql('select public.synthetic_legacy_reward()', role='authenticated')
    assert baseline_db.sql('select xp from reward_accounts').stdout.strip() == '999'


def test_preflight_existing_owner_view_bypasses_new_table_rls(baseline_db):
    baseline_db.sql('create view public.synthetic_profile_view as select id,username,xp from profiles; '
                    'grant select on public.synthetic_profile_view to authenticated')
    baseline_db.sql(MIGRATION.read_text())
    assert baseline_db.sql('select count(*) from profiles', role='authenticated').stdout.strip().splitlines()[-1] == '1'
    assert baseline_db.sql('select count(*) from synthetic_profile_view', role='authenticated').stdout.strip().splitlines()[-1] == '3'


def test_preflight_profile_trigger_can_diverge_account_from_receipt(baseline_db):
    baseline_db.sql("create function public.synthetic_legacy_trigger() returns trigger language plpgsql "
                    "security definer set search_path='' as $$ begin "
                    "update public.reward_accounts set xp=xp+100 where user_id=new.id; return new; end $$; "
                    "create trigger synthetic_legacy_reward after update of xp on profiles "
                    "for each row execute function public.synthetic_legacy_trigger()")
    baseline_db.sql(MIGRATION.read_text())
    receipt = baseline_db.settle()
    assert receipt['profile']['xp'] == 5 and receipt['xp_awarded'] == 5
    assert baseline_db.sql('select xp from reward_accounts').stdout.strip() == '105'
    assert baseline_db.sql('select awarded_xp from reward_private.session_settlements').stdout.strip() == '5'


def test_preflight_utc_reward_day_ignores_session_timezone(baseline_db):
    baseline_db.sql(MIGRATION.read_text())
    payload = json.dumps({'code': 'pass', 'array_var': 'arr', 'trace': [], 'total_steps': 0})
    baseline_db.sql("select set_config('TimeZone', case when "
                    "extract(hour from clock_timestamp() at time zone 'UTC')<10 "
                    "then 'Etc/GMT+12' else 'Pacific/Kiritimati' end, false); "
                    f"select public.settle_activity_session('{OWNER}','{uuid4()}','{payload}'::jsonb)", role='service_role')
    assert baseline_db.sql("select reward_day=(clock_timestamp() at time zone 'UTC')::date "
                           "from reward_private.session_settlements").stdout.strip() == 't'
