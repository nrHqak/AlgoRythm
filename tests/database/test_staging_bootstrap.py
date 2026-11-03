"""Real PG17 bootstrap tests. Minimal local Auth/event fixtures, never hosted equivalence."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote
from uuid import uuid4

import pytest
import test_reward_database as reward_database

from scripts import staging_bootstrap as bootstrap
from test_recovered_schema import test_catalogue_session_quiz_mentor_and_owner_contracts as storage_contract
from test_reward_database import Database, OTHER, OWNER, TASK

cluster = reward_database.cluster

# Local behavioral fixture only; NOT the uninspected Supabase handler body.
LOCAL_EVENT = """create schema fixture_platform;
create function fixture_platform.auto_rls() returns event_trigger language plpgsql as $$
declare cmd record; begin
 for cmd in select * from pg_event_trigger_ddl_commands() where object_type='table' loop
  if cmd.schema_name='public' then
   execute format('alter table %s enable row level security',cmd.object_identity);
  end if;
 end loop;
end $$;
create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE')
 execute function fixture_platform.auto_rls();"""


@pytest.fixture(scope='module')
def bootstrap_cluster(cluster):
    command, env, admin = cluster
    major = int(admin.sql("select current_setting('server_version_num')::int/10000").stdout.strip())
    if major != 17:
        if os.environ.get('BOOTSTRAP_PG17_REQUIRED') == '1':
            pytest.fail('Bootstrap verification requires real PostgreSQL 17')
        pytest.skip('NOT VERIFIED: bootstrap requires PostgreSQL 17, including MAINTAIN')
    admin.sql('create role postgres login bypassrls; create role authenticator noinherit login')
    admin.sql('create role unexpected_bootstrap_grantee')
    return command, env, admin


@pytest.fixture
def platform(bootstrap_cluster):
    command, env, admin = bootstrap_cluster
    name = 'bootstrap_' + uuid4().hex
    admin.sql(f'create database {name} owner postgres')
    db = Database(command, env, name)
    try:
        db.sql("create schema auth; create table auth.users(id uuid primary key); "
               "create function auth.uid() returns uuid language sql stable as "
               "$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; "
               "grant usage on schema auth,public to anon,authenticated,service_role,postgres,authenticator; "
               "grant references(id) on auth.users to postgres; "
               "alter default privileges for role postgres in schema public "
               "grant all on tables to anon,authenticated,service_role; "
               "alter default privileges for role postgres in schema public "
               "grant execute on functions to anon,authenticated,service_role; "
               "alter default privileges for role postgres in schema public "
               "grant all on sequences to anon,authenticated,service_role;")
        db.sql(LOCAL_EVENT)
        yield db
    finally:
        admin.sql(f'drop database {name}')


def phase(db, name, *, check=True, sql=None, target=bootstrap.TARGET):
    return db.sql(f"set algorythm.bootstrap_project_ref='{target}'; "
                  + (sql if sql is not None else bootstrap.phases()[name]), role='postgres', check=check)


def state(db):
    return db.sql('select phase from algorythm_bootstrap.state').stdout.strip()


def closed(db):
    # Independent new connections check effective access after commits.
    for role in ('anon', 'authenticated', 'service_role', 'authenticator'):
        assert db.sql("select has_schema_privilege(current_user,'public','USAGE')",
                      role=role).stdout.strip().splitlines()[-1] == 'f'
        result = db.sql('select count(*) from public.profiles', role=role, check=False)
        assert result.returncode != 0 and 'permission denied' in result.stderr


def cli(db, *args):
    """Pinned real CLI; URL points ONLY to our owned UNIX socket, with TCP disabled."""
    executable = os.environ.get('BOOTSTRAP_SUPABASE_CLI')
    if not executable:
        if os.environ.get('BOOTSTRAP_CLI_REQUIRED') == '1':
            pytest.fail('Pinned Supabase CLI required')
        pytest.skip('NOT VERIFIED: set BOOTSTRAP_SUPABASE_CLI for actual CLI history verification')
    with tempfile.TemporaryDirectory(prefix='agrw-cli-', dir='/tmp') as folder:
        work = Path(folder)
        env = {k: v for k, v in db.env.items()
               if not k.startswith(('SUPABASE_', 'PG', 'GEMINI_', 'VITE_'))}
        env.update(XDG_CONFIG_HOME=folder, SUPABASE_TELEMETRY_DISABLED='true',
                   PGPASSFILE=folder + '/no-password-file')
        executable = str(Path(executable).resolve())
        assert subprocess.check_output([executable, '--version'], env=env, cwd=work, text=True).strip() == '3.0.0'
        (work / 'supabase/migrations').mkdir(parents=True)
        (work / 'supabase/config.toml').write_text('project_id = "bootstrap-local-review"\n')
        for source in (bootstrap.ROOT / 'supabase/migrations').glob('*.sql'):
            (work / 'supabase/migrations' / source.name).write_bytes(source.read_bytes())
        host = db.command[db.command.index('-h') + 1]
        assert host.startswith('/tmp/agrw-') and Path(host).is_dir()
        url = f'postgresql://postgres@localhost:5432/{db.name}?host={quote(host, safe="")}'
        result = subprocess.run([executable, 'migration', *args, '--remote=' + url, '--yes'],
                                cwd=work, env=env, capture_output=True, text=True, timeout=60)
        assert result.returncode == 0, result.stderr + result.stdout
        return result


def history(db):
    return db.sql('select version from supabase_migrations.schema_migrations order by version').stdout.strip().splitlines()


def baseline(db):
    phase(db, '10-baseline-quarantined.sql')
    assert state(db) == 'baseline'
    closed(db)


def reward(db):
    cli(db, 'repair', *bootstrap.VERSIONS, '--status', 'applied')
    assert history(db) == bootstrap.VERSIONS
    phase(db, '20-reward-quarantined.sql')
    assert state(db) == 'reward'
    closed(db)


def release(db):
    cli(db, 'repair', bootstrap.REWARD, '--status', 'applied')
    assert history(db) == bootstrap.VERSIONS + [bootstrap.REWARD]
    phase(db, '30-release.sql')
    assert state(db) == 'released'


def seed(db):
    # Synthetic records in owned local fixtures only.
    db.sql(f"insert into auth.users values('{OWNER}'),('{OTHER}'); "
           f"insert into profiles(id,username) values('{OWNER}','owner'),('{OTHER}','other'); "
           f"insert into tasks(id,title,description,difficulty,order_index) "
           f"values('{TASK}','Synthetic task','Synthetic description','beginner',1)")


def test_pinned_sources_and_boundaries():
    bootstrap.verify()
    assert bootstrap.body(bootstrap.OUTPUT.read_text()).startswith('\nset local search_path')
    with pytest.raises(ValueError, match='boundaries'):
        bootstrap.body('begin;\nbegin;\ncommit;')


def test_changed_hash_refuses_output(monkeypatch, tmp_path):
    changed = tmp_path / 'changed.sql'
    changed.write_text('begin;\nselect 1;\ncommit;\n')
    monkeypatch.setattr(bootstrap, 'HASHES', {changed: hashlib.sha256(b'unmodified').hexdigest()})
    monkeypatch.setattr(bootstrap, 'ROOT', tmp_path)
    with pytest.raises(ValueError, match='Changed source artifact'):
        bootstrap.phases()


@pytest.mark.parametrize('failure', ['auth_missing', 'wrong_ref', 'existing_objects', 'unexpected_grants',
                                  'function_privileges', 'baseline_error', 'incompatible_feature'])
def test_baseline_failure_is_atomic(platform, failure):
    db = platform
    sql = bootstrap.phases()['10-baseline-quarantined.sql']
    target = bootstrap.TARGET
    if failure == 'auth_missing':
        db.sql('drop schema auth cascade')
    elif failure == 'wrong_ref':
        target = 'incorrect-project-ref'
    elif failure == 'existing_objects':
        db.sql('create table public.unexpected(id int)')
    elif failure == 'unexpected_grants':
        db.sql('alter default privileges for role postgres in schema public grant select on tables to unexpected_bootstrap_grantee')
    elif failure == 'function_privileges':
        db.sql('revoke execute on function auth.uid() from public,authenticated,service_role')
    elif failure == 'baseline_error':
        sql = sql.replace('create table public."sessions" (', 'select 1/0;\ncreate table public."sessions" (')
    else:
        # Simulated server DDL rejection; actual wrong-major rejection is tested separately.
        sql = sql.replace('create table public."sessions" (',
                          "do $$begin raise exception 'unsupported feature' using errcode='0A000'; end$$;\n"
                          'create table public."sessions" (')
    result = phase(db, '10-baseline-quarantined.sql', check=False, sql=sql, target=target)
    assert result.returncode != 0, failure
    assert db.sql("select to_regclass('public.profiles') is null and to_regnamespace('algorythm_bootstrap') is null").stdout.strip() == 't'
    assert db.sql("select has_schema_privilege('authenticated','public','USAGE')").stdout.strip() == 't'


def test_history_and_reward_failure_remain_quarantined(platform):
    db = platform
    baseline(db)
    result = phase(db, '20-reward-quarantined.sql', check=False)
    assert result.returncode != 0 and 'Migration-history mismatch' in result.stderr
    closed(db)
    cli(db, 'repair', *bootstrap.VERSIONS, '--status', 'applied')
    sql = bootstrap.phases()['20-reward-quarantined.sql']
    sql = sql.replace('create function public.settle_activity_session',
                      'select 1/0;\ncreate function public.settle_activity_session')
    assert phase(db, '20-reward-quarantined.sql', sql=sql, check=False).returncode != 0
    assert state(db) == 'baseline'
    assert db.sql("select to_regclass('public.reward_accounts') is null").stdout.strip() == 't'
    assert history(db) == bootstrap.VERSIONS
    closed(db)
    phase(db, '20-reward-quarantined.sql')
    assert state(db) == 'reward'
    closed(db)


def test_cli_repairs_only_represented_versions_and_release_gates(platform):
    db = platform
    baseline(db)
    before = db.sql(bootstrap.CATALOGUE).stdout
    cli(db, 'repair', *bootstrap.VERSIONS, '--status', 'applied')
    assert db.sql(bootstrap.CATALOGUE).stdout == before
    assert history(db) == bootstrap.VERSIONS
    listing = cli(db, 'list')
    assert bootstrap.REWARD in listing.stdout
    phase(db, '20-reward-quarantined.sql')
    assert phase(db, '30-release.sql', check=False).returncode != 0
    closed(db)
    release(db)
    assert history(db) == bootstrap.VERSIONS + [bootstrap.REWARD]
    bootstrap.verify()


def test_final_security_drift_cannot_release(platform):
    db = platform
    baseline(db)
    reward(db)
    cli(db, 'repair', bootstrap.REWARD, '--status', 'applied')
    db.sql('grant update(xp) on profiles to authenticated', role='postgres')
    result = phase(db, '30-release.sql', check=False)
    assert result.returncode != 0 and 'differs from reviewed reference' in result.stderr
    assert state(db) == 'reward'
    closed(db)


def test_pending_reward_cannot_be_marked_before_execution(platform):
    db = platform
    baseline(db)
    # Deliberately incorrect history in an owned fixture; never a runbook step.
    cli(db, 'repair', *bootstrap.VERSIONS, bootstrap.REWARD, '--status', 'applied')
    result = phase(db, '20-reward-quarantined.sql', check=False)
    assert result.returncode != 0 and 'Migration-history mismatch' in result.stderr
    assert state(db) == 'baseline'
    assert db.sql("select to_regclass('public.reward_accounts') is null").stdout.strip() == 't'
    closed(db)


@pytest.mark.parametrize('drift', ['defaults', 'function_privileges', 'journal'])
def test_platform_drift_stops_before_reward(platform, drift):
    db = platform
    baseline(db)
    cli(db, 'repair', *bootstrap.VERSIONS, '--status', 'applied')
    if drift == 'defaults':
        db.sql('alter default privileges for role postgres in schema public grant select on tables to unexpected_bootstrap_grantee')
    elif drift == 'function_privileges':
        db.sql('revoke execute on function auth.uid() from public,authenticated,service_role')
    else:
        db.sql('grant select on algorythm_bootstrap.state to authenticated', role='postgres')
    assert phase(db, '20-reward-quarantined.sql', check=False).returncode != 0
    assert state(db) == 'baseline'
    closed(db)


def test_local_guard_refuses_non_owned_database(cluster):
    command, env, _ = cluster
    db = Database(command, env, 'postgres')
    # Test the hosted-execution guard directly, independent of missing principals.
    guard = bootstrap.IDENTITY.split('\n')[-1]
    result = db.sql(guard, check=False)
    assert result.returncode != 0 and 'hosted execution is disabled' in result.stderr


def test_wrong_postgres_major_is_refused(cluster):
    command, env, admin = cluster
    major = int(admin.sql("select current_setting('server_version_num')::int/10000").stdout.strip())
    if major == 17:
        pytest.skip('Incompatible-major rejection is verified in the separate PostgreSQL16 run')
    admin.sql('create role postgres login')
    db = Database(command, env, 'postgres')
    result = phase(db, '10-baseline-quarantined.sql', check=False)
    assert result.returncode != 0 and 'Requires PostgreSQL 17' in result.stderr
    assert db.sql("select to_regnamespace('algorythm_bootstrap') is null").stdout.strip() == 't'


def test_failure_after_release_grants_rolls_back_access(platform):
    db = platform
    baseline(db)
    reward(db)
    cli(db, 'repair', bootstrap.REWARD, '--status', 'applied')
    sql = bootstrap.phases()['30-release.sql']
    sql = sql.replace("update algorythm_bootstrap.state set phase='released'", "select 1/0;\nupdate algorythm_bootstrap.state set phase='released'")
    result = phase(db, '30-release.sql', check=False, sql=sql)
    assert result.returncode != 0 and 'division by zero' in result.stderr
    assert state(db) == 'reward'
    closed(db)
    phase(db, '30-release.sql')
    assert state(db) == 'released'


def test_released_bootstrap_contracts_and_concurrency(platform):
    db = platform
    baseline(db)
    reward(db)
    release(db)
    assert json.loads(db.sql('set search_path=public,pg_catalog; ' + bootstrap.CATALOGUE).stdout) == json.loads(bootstrap.REFERENCE.read_text())
    seed(db)
    storage_contract(db)
    for assignment in ('xp=999', 'level=5', 'streak=99', 'last_active_date=current_date'):
        assert db.sql(f'update profiles set {assignment}', role='authenticated', check=False).returncode != 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda _: db.settle(), range(16)))
    assert sum(r['xp_awarded'] for r in receipts) == 0  # Already awarded today by the storage contract.
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=8) as pool:
        repeated = list(pool.map(lambda _: db.settle(key), range(12)))
    assert len({r['session_id'] for r in repeated}) == 1
    assert sum(not r['replayed'] for r in repeated) == 1
    assert db.sql(f"select xp,saves_today from reward_accounts where user_id='{OWNER}'").stdout.strip() == '5|18'
    db.sql(f"update reward_accounts set saves_today=100 where user_id='{OWNER}'")
    denied = db.settle(check=False)
    assert denied.returncode != 0 and 'activity_daily_limit' in denied.stderr


def test_secure_profile_creation_on_bootstrap(platform):
    db = platform
    baseline(db)
    reward(db)
    release(db)
    assert db.sql(f"insert into profiles(id,username) values('{OWNER}','owner')", role='authenticated', check=False).returncode != 0
    db.sql(f"insert into auth.users values('{OWNER}')")
    db.sql(f"insert into profiles(id,username) values('{OWNER}','owner')", role='authenticated')
    assert db.sql('select xp,level,streak,last_active_date is null from profiles').stdout.strip() == '0|1|0|t'
    db.sql(f"update profiles set username='renamed' where id='{OWNER}'", role='authenticated')
    assert db.sql('select count(*) from profiles', role='authenticated', owner=OTHER).stdout.strip().splitlines()[-1] == '0'
