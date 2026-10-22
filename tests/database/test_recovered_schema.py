"""Integration checks of the recovered metadata/DDL, never an external database.

auth.users/auth.uid below are explicitly minimal LOCAL platform shims, not an
export, reconstruction or test of Supabase-managed Auth behavior.
"""
import json
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
import test_reward_database as reward_database

from scripts.schema_recovery import OUTPUT, SNAPSHOT, render
from test_reward_database import Database, MIGRATION, OTHER, OWNER, ROOT, TASK

cluster = reward_database.cluster
SOURCE = json.loads(SNAPSHOT.read_text())


@pytest.mark.parametrize('change', ['withheld_default', 'unhandled_function', 'orphan_column'])
def test_unreviewed_metadata_cannot_silently_render(change):
    source = deepcopy(SOURCE)
    if change == 'withheld_default':
        source['application']['columns'][0]['default_withheld'] = True
    elif change == 'unhandled_function':
        source['application']['routines'] = [{'name': 'unreviewed'}]
    else:
        source['application']['columns'][0]['table_name'] = 'missing_inventory'
    with pytest.raises(ValueError):
        render(source)


def rows(database, statement):
    return json.loads(database.sql(statement).stdout.strip().splitlines()[-1])


@pytest.fixture(scope='module')
def recovery_cluster(cluster):
    cluster[2].sql('create role postgres bypassrls')
    return cluster


@pytest.fixture
def empty_platform(recovery_cluster):
    command, env, admin = recovery_cluster
    name = 'canonical_' + uuid4().hex
    admin.sql(f'create database {name} owner postgres')
    database = Database(command, env, name)
    try:
        database.sql("create schema auth; create table auth.users(id uuid primary key); "
                     "create function auth.uid() returns uuid language sql stable as "
                     "$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; "
                     "grant usage on schema auth,public to anon,authenticated,service_role,postgres; "
                     "grant references(id) on auth.users to postgres")
        yield database
    finally:
        admin.sql(f'drop database {name}')


@pytest.fixture
def recovered_db(empty_platform):
    empty_platform.sql("set algorythm.schema_recovery='local-review'; " + OUTPUT.read_text())
    return empty_platform


@pytest.fixture
def settled_db(recovered_db):
    recovered_db.sql(MIGRATION.read_text())
    recovered_db.sql(f"insert into auth.users values('{OWNER}'),('{OTHER}'); "
                     f"insert into profiles(id,username) values('{OWNER}','owner'),('{OTHER}','other'); "
                     f"insert into tasks(id,title,description,difficulty,order_index) "
                     f"values('{TASK}','Synthetic task','Synthetic description','beginner',1)")
    return recovered_db


def schema_state(db):
    return rows(db, """select jsonb_build_object(
      'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,
        'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))
        order by c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid
        join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
        where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
      'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',k.conname,
        'definition',pg_get_constraintdef(k.oid,true)) order by c.relname,k.conname)
        from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
      'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by c.relname,ic.relname)
        from pg_index i join pg_class c on c.oid=i.indrelid join pg_class ic on ic.oid=i.indexrelid
        join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
      'policies',(select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname)
        from pg_policies p where p.schemaname='public'),
      'grants',(select jsonb_agg(jsonb_build_object('table',c.relname,'grantee',pg_get_userbyid(a.grantee),
        'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)
        order by c.relname,pg_get_userbyid(a.grantee),a.privilege_type)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
        where n.nspname='public' and c.relkind='r'),
      'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),
        'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.relname)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'))""")


def test_recovered_artifact_roundtrips_source_metadata(recovered_db):
    assert OUTPUT.read_text() == render(SOURCE)
    state = schema_state(recovered_db)
    app = SOURCE['application']
    assert state['columns'] == [
        {'table': c['table_name'], 'name': c['name'], 'type': c['type'], 'not_null': c['not_null'],
         'default': c['default_expression']} for c in app['columns']]
    assert state['constraints'] == [
        {'table': c['table_name'], 'name': c['name'], 'definition': c['definition']} for c in app['constraints']]
    assert state['indexes'] == [i['definition'] for i in app['indexes']]
    assert state['policies'] == [{k: v for k, v in p.items() if k != 'expression_withheld'} for p in app['policies']]
    assert state['tables'] == [{k: t[k] for k in ('name', 'owner', 'rls', 'force_rls')} for t in app['tables']]
    major = int(recovered_db.sql("select current_setting('server_version_num')::int/10000").stdout.strip())
    # PG16 checks native privileges only; the separate required local PG17 run
    # compares MAINTAIN as well. Never claim PG16 proves the PG17 privilege.
    expected = [
        {'table': g['table_name'], 'grantee': g['grantee'], 'grantor': g['grantor'], 'privilege': privilege,
         'grantable': g['is_grantable']} for g in app['table_grants'] for privilege in g['privileges']
        if major >= 17 or privilege != 'MAINTAIN']
    assert state['grants'] == expected


def test_candidate_requires_explicit_local_review_opt_in(empty_platform):
    result = empty_platform.sql(OUTPUT.read_text(), check=False)
    assert result.returncode != 0 and 'requires explicit local-review' in result.stderr
    assert empty_platform.sql("select to_regclass('public.profiles') is null").stdout.strip() == 't'


def test_snapshot_already_represents_both_legacy_migrations(recovered_db):
    before = schema_state(recovered_db)
    # Local coverage/equivalence check ONLY, not the future initialization plan.
    for name in ('20260808183440_add_task_pattern.sql', '20260808213028_secure_public_tables_with_rls.sql'):
        recovered_db.sql((ROOT / 'supabase/migrations' / name).read_text())
    assert schema_state(recovered_db) == before
    assert [m['version'] for m in SOURCE['represented_migrations']] == ['20260808183440', '20260808213028']


def test_auth_fk_and_safe_profile_initialization_after_reward(recovered_db):
    recovered_db.sql(MIGRATION.read_text())
    denied = recovered_db.sql(f"insert into profiles(id,username) values('{OWNER}','owner')",
                              role='authenticated', check=False)
    assert denied.returncode != 0 and 'foreign key' in denied.stderr
    recovered_db.sql(f"insert into auth.users values('{OWNER}')")
    recovered_db.sql(f"insert into profiles(id,username) values('{OWNER}','owner')", role='authenticated')
    assert recovered_db.sql('select xp,level,streak,last_active_date is null from profiles').stdout.strip() == '0|1|0|t'
    recovered_db.sql(f"update profiles set username='renamed' where id='{OWNER}'", role='authenticated')
    for assignment in ('xp=999', 'level=5', 'streak=99', "last_active_date=current_date"):
        assert recovered_db.sql(f"update profiles set {assignment} where id='{OWNER}'",
                                 role='authenticated', check=False).returncode != 0
    assert recovered_db.sql('select count(*) from profiles', role='authenticated', owner=OTHER).stdout.strip().splitlines()[-1] == '0'
    assert recovered_db.sql('select count(*) from profiles', role='anon', check=False).returncode != 0


def test_catalogue_session_quiz_mentor_and_owner_contracts(settled_db):
    db = settled_db
    assert db.sql('select max_xp,pattern from tasks', role='authenticated').stdout.strip().splitlines()[-1] == '100|uncategorized'
    receipt = db.settle()
    saved = receipt['session_id']
    assert receipt['xp_awarded'] == 5 and receipt['completion_verified'] is False
    assert db.sql('select reward_policy,solved,attempts,xp_earned,created_at is not null from sessions').stdout.strip() == 'activity-v1|t|1|5|t'
    assert db.sql('select count(*) from sessions', role='authenticated', owner=OTHER).stdout.strip().splitlines()[-1] == '0'
    db.sql(f"insert into quiz_attempts(user_id,quiz_day,question_key,prompt,correct,response_ms) "
           f"values('{OWNER}',current_date,'synthetic','Synthetic?',true,100)", role='authenticated')
    assert db.sql('select xp_earned,created_at is not null from quiz_attempts').stdout.strip() == '0|t'
    assert db.sql(f"insert into quiz_attempts(user_id,quiz_day,question_key,prompt) "
                  f"values('{OWNER}',current_date,'synthetic','Synthetic?')", role='authenticated', check=False).returncode != 0
    assert db.sql(f"insert into quiz_attempts(user_id,quiz_day,question_key,prompt,xp_earned) "
                  f"values('{OWNER}',current_date,'forged','Synthetic?',999)", role='authenticated', check=False).returncode != 0
    db.sql(f"insert into mentor_messages(user_id,session_id,role,message,trigger_type) "
           f"values('{OWNER}','{saved}','mentor','Synthetic message','error')", role='authenticated')
    db.sql(f"insert into mentor_messages(user_id,role,message) values('{OWNER}','user','Synthetic question')", role='authenticated')
    assert db.sql(f"insert into mentor_messages(user_id,session_id,role,message) "
                  f"values('{OTHER}','{saved}','user','Synthetic question')", role='authenticated', owner=OTHER, check=False).returncode != 0
    db.sql(f"insert into pet_profiles(user_id) values('{OWNER}')", role='authenticated')
    assert db.sql('select pet_name,hunger,mood,energy,evolution_points from pet_profiles').stdout.strip() == 'Byte|42|68|74|0'
    db.sql("insert into achievements(slug,title,description,icon,condition_type) "
           "values('synthetic','Synthetic','Synthetic description','star','synthetic')")
    assert db.sql('select xp_reward from achievements', role='authenticated').stdout.strip().splitlines()[-1] == '50'
    assert receipt['achievements_earned'] == []
    assert db.sql('select count(*) from user_achievements').stdout.strip() == '0'
    assert db.sql('select reported_completed,attempts,best_steps from practice_progress').stdout.strip() == 't|1|0'
    assert db.sql('select xp,level,streak from reward_accounts', role='authenticated').stdout.strip().splitlines()[-1] == '5|1|1'
    assert db.sql('select count(*) from reward_accounts', role='authenticated', owner=OTHER).stdout.strip().splitlines()[-1] == '0'
    assert db.settle(owner=OTHER)['profile']['xp'] == 5
    assert db.sql("select public.settle_activity_session(null,null,'{}')", role='authenticated', check=False).returncode != 0
    assert db.sql('select count(*) from reward_private.session_settlements', role='authenticated', check=False).returncode != 0


def test_reward_atomicity_on_recovered_constraints(settled_db):
    db = settled_db
    db.sql('alter table profiles add constraint synthetic_late_failure check(xp=0)')
    assert db.settle(check=False).returncode != 0
    for table in ('sessions', 'reward_accounts', 'practice_progress', 'reward_private.session_settlements'):
        assert db.sql(f'select count(*) from {table}').stdout.strip() == '0'
    assert db.sql('select sum(xp) from profiles').stdout.strip() == '0'


def test_concurrent_settlement_and_replay_on_recovered_schema(settled_db):
    db = settled_db
    with ThreadPoolExecutor(max_workers=8) as pool:
        distinct = list(pool.map(lambda _: db.settle(), range(16)))
    assert sum(r['xp_awarded'] for r in distinct) == 5
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=8) as pool:
        repeated = list(pool.map(lambda _: db.settle(key), range(12)))
    assert len({r['session_id'] for r in repeated}) == 1
    assert sum(not r['replayed'] for r in repeated) == 1
    assert db.sql('select xp,saves_today from reward_accounts').stdout.strip() == '5|17'
    assert db.sql('select count(*) from sessions').stdout.strip() == '17'
    assert db.sql('select count(*) from reward_private.session_settlements').stdout.strip() == '17'
    assert db.sql('select attempts from practice_progress').stdout.strip() == '17'
