"""Real disposable local PostgreSQL. Never accepts an external database URL."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[2]
OWNER = '00000000-0000-4000-8000-000000000001'
OTHER = '00000000-0000-4000-8000-000000000002'
TASK = '00000000-0000-4000-8000-000000000003'
MIGRATION = ROOT / 'supabase/migrations/20261022113757_reward_integrity.sql'


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class Database:
    def __init__(self, command, env, name):
        self.command, self.env, self.name = command, env, name

    def sql(self, sql, *, role=None, owner=OWNER, check=True):
        if role:
            sql = f"set role {role}; select set_config('request.jwt.claim.sub',{literal(owner)},false); " + sql
        result = subprocess.run(self.command + ['-d', self.name, '-c', sql], env=self.env,
                                capture_output=True, text=True, timeout=30)
        if check:
            assert result.returncode == 0, result.stderr
        return result

    def settle(self, key=None, payload=None, *, owner=OWNER, check=True):
        payload = payload or {'code': 'pass', 'array_var': 'arr', 'trace': [], 'error': None,
                              'total_steps': 0, 'algorithm_type': 'bubble_sort',
                              'execution_succeeded': True, 'task_id': TASK}
        statement = f"select public.settle_activity_session('{owner}','{key or uuid4()}',{literal(json.dumps(payload))}::jsonb)"
        result = self.sql(statement, role='service_role', owner=owner, check=check)
        return json.loads(result.stdout.strip().splitlines()[-1]) if result.returncode == 0 else result


@pytest.fixture(scope='module')
def cluster():
    config = shutil.which('pg_config')
    required = os.environ.get('REWARD_DATABASE_REQUIRED') == '1'
    if not config and not os.environ.get('REWARD_POSTGRES_BIN'):
        if required:
            pytest.fail('Required local PostgreSQL binaries unavailable')
        pytest.skip('NOT VERIFIED: local PostgreSQL binaries unavailable')
    bindir = Path(os.environ.get('REWARD_POSTGRES_BIN') or subprocess.check_output([config, '--bindir'], text=True).strip())
    if not (bindir / 'initdb').exists() or (hasattr(os, 'geteuid') and os.geteuid() == 0):
        if required:
            pytest.fail('Required initdb unavailable or running as root')
        pytest.skip('NOT VERIFIED: initdb unavailable or running as root')
    # Explicit, private UNIX socket only; never inherit developer connection options.
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
    with tempfile.TemporaryDirectory(prefix='agrw-', dir='/tmp') as folder:
        env['PGPASSFILE'] = folder + '/no-password-file'
        data = str(Path(folder) / 'data')
        subprocess.run([str(bindir / 'initdb'), '-D', data, '-U', 'audit_admin', '-A', 'trust', '--no-locale', '--encoding=UTF8'],
                       env=env, check=True, capture_output=True)
        subprocess.run([str(bindir / 'pg_ctl'), '-D', data, '-l', folder + '/postgres.log', '-o',
                        f"-k {folder} -c listen_addresses='' -p 5432", '-w', 'start'], env=env, check=True, capture_output=True)
        command = [str(bindir / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', folder,
                   '-p', '5432', '-U', 'audit_admin']
        admin = Database(command, env, 'postgres')
        try:
            admin.sql('create role anon; create role authenticated; create role service_role bypassrls;')
            admin.sql('create database reward_template')
            template = Database(command, env, 'reward_template')
            template.sql((Path(__file__).with_name('core_fixture.sql')).read_text())
            template.sql((ROOT / 'supabase/migrations/20260808213028_secure_public_tables_with_rls.sql').read_text())
            template.sql(MIGRATION.read_text())
            yield command, env, admin
        finally:
            subprocess.run([str(bindir / 'pg_ctl'), '-D', data, '-m', 'immediate', '-w', 'stop'],
                           env=env, check=True, capture_output=True)


@pytest.fixture
def db(cluster):
    command, env, admin = cluster
    name = 'reward_' + uuid4().hex
    admin.sql(f'create database {name} template reward_template')
    db = Database(command, env, name)
    db.sql(f"insert into profiles(id,username,xp) values('{OWNER}','owner',1000000000),('{OTHER}','other',0); "
           f"insert into tasks values('{TASK}','Practice task')")
    try:
        yield db
    finally:
        admin.sql(f'drop database {name}')


def test_legacy_xp_is_not_authority_and_activity_award_is_bounded(db):
    first = db.settle()
    assert first['xp_awarded'] == 5 and first['profile']['xp'] == 5
    assert first['achievements_earned'] == [] and first['completion_verified'] is False
    second = db.settle()
    assert second['xp_awarded'] == 0 and second['reward_status'] == 'daily_limit'
    assert db.sql('select xp from profiles where username=\'owner\'').stdout.strip() == '5'


def test_concurrent_unique_operations_have_no_lost_updates_and_daily_cap(db):
    db.sql(f"insert into reward_accounts(user_id,xp,last_active_date) values('{OWNER}',195,(clock_timestamp() at time zone 'UTC')::date-1)")
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda _: db.settle(), range(16)))
    assert sum(row['xp_awarded'] for row in receipts) == 5
    assert db.sql('select xp,level,saves_today from reward_accounts').stdout.strip() == '200|2|16'
    assert db.sql('select count(*) from sessions').stdout.strip() == '16'


def test_concurrent_duplicate_requests_two_tabs_settle_once(db):
    key = str(uuid4())
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda _: db.settle(key), range(12)))
    assert len({row['session_id'] for row in receipts}) == 1
    assert sum(not row['replayed'] for row in receipts) == 1
    assert db.sql('select count(*) from sessions').stdout.strip() == '1'
    assert db.sql('select xp,saves_today from reward_accounts').stdout.strip() == '5|1'
    assert db.sql('select attempts from practice_progress').stdout.strip() == '1'


def test_lost_response_retry_out_of_order_and_key_conflict(db):
    key = str(uuid4())
    committed = db.settle(key)  # Simulate dropping the HTTP response after commit.
    db.settle()  # Another tab arrives before retry.
    replay = db.settle(key)
    assert replay['session_id'] == committed['session_id'] and replay['replayed']
    error = db.settle(key, {'code': 'different', 'trace': [], 'total_steps': 0}, check=False)
    assert error.returncode != 0 and 'idempotency_conflict' in error.stderr
    assert db.sql('select count(*) from sessions').stdout.strip() == '2'


def test_partial_failure_rolls_back_session_progress_balance_and_ledger(db):
    db.sql("create function fail_profile() returns trigger language plpgsql as $$begin raise exception 'injected failure'; end$$; "
           'create trigger fail_update before update on profiles for each row execute function fail_profile()')
    key = str(uuid4())
    error = db.settle(key, check=False)
    assert error.returncode != 0 and 'injected failure' in error.stderr
    for table in ['sessions', 'practice_progress', 'reward_accounts', 'reward_private.session_settlements']:
        assert db.sql(f'select count(*) from {table}').stdout.strip() == '0'
    db.sql('drop trigger fail_update on profiles')
    assert db.settle(key)['xp_awarded'] == 5


@pytest.mark.parametrize('column,value', [('xp','1000000000'), ('level','5'), ('streak','999'), ('last_active_date',"current_date")])
def test_browser_cannot_update_reward_columns_even_with_old_public_column_grants(db, column, value):
    error = db.sql(f"update profiles set {column}={value} where id='{OWNER}'", role='authenticated', check=False)
    assert error.returncode != 0 and 'permission denied' in error.stderr


def test_profile_safe_creation_edit_and_cross_owner_isolation(db):
    third = str(uuid4())
    db.sql(f"insert into profiles(id,username) values('{third}','newuser')", role='authenticated', owner=third)
    assert db.sql(f"select xp,level,streak from profiles where id='{third}'").stdout.strip() == '0|1|0'
    db.sql(f"update profiles set username='edited' where id='{OWNER}'", role='authenticated')
    db.sql(f"update profiles set username='stolen' where id='{OTHER}'", role='authenticated')
    assert db.sql(f"select username from profiles where id='{OTHER}'").stdout.strip() == 'other'
    assert db.sql(f"select count(*) from profiles where id='{OTHER}'", role='authenticated').stdout.strip().endswith('0')
    assert db.sql(f"insert into profiles(id,username,xp) values('{uuid4()}','forged',100)", role='authenticated', check=False).returncode != 0
    db.settle()
    assert db.sql('select count(*) from reward_accounts', role='authenticated', owner=OTHER).stdout.strip().endswith('0')


@pytest.mark.parametrize('table', ['reward_accounts','task_progress','practice_progress','sessions','user_achievements'])
def test_browser_cannot_write_privileged_tables(db, table):
    error = db.sql(f"insert into {table}(user_id) values('{OWNER}')", role='authenticated', check=False)
    assert error.returncode != 0 and 'permission denied' in error.stderr
    assert db.sql(f'delete from {table}', role='authenticated', check=False).returncode != 0
    assert db.sql(f'update {table} set user_id=user_id', role='authenticated', check=False).returncode != 0


def test_browser_cannot_call_settlement_or_read_private_ledger(db):
    assert db.sql(f"select settle_activity_session('{OTHER}','{uuid4()}','{{}}')", role='authenticated', check=False).returncode != 0
    assert db.sql('select * from reward_private.session_settlements', role='authenticated', check=False).returncode != 0
    assert db.sql(f"select settle_activity_session('{OWNER}','{uuid4()}','{{}}')", role='anon', check=False).returncode != 0


def test_numeric_saturation_streak_and_no_completion_achievements(db):
    db.sql(f"insert into reward_accounts(user_id,xp,streak,last_active_date) values('{OWNER}',2147483647,2147483647,(clock_timestamp() at time zone 'UTC')::date-1)")
    receipt = db.settle()
    assert receipt['xp_awarded'] == 0 and receipt['reward_status'] == 'balance_limit'
    assert db.sql('select count(*) from user_achievements').stdout.strip() == '0'
    assert receipt['practice_progress']['reported_completed']
    assert receipt['completion_verified'] is False
    db.sql('update reward_accounts set xp=0,save_day=null,saves_today=0')
    receipt = db.settle()
    assert receipt['profile']['streak'] == 2147483647 and receipt['xp_awarded'] == 5


def test_persistent_daily_save_limit_and_replay_still_work(db):
    first_key = str(uuid4())
    db.settle(first_key)
    for _ in range(99):
        db.settle()
    error = db.settle(check=False)
    assert 'activity_daily_limit' in error.stderr
    assert db.settle(first_key)['replayed']
    assert db.sql('select count(*) from sessions').stdout.strip() == '100'


def test_quiz_is_practice_and_achievement_uniqueness(db):
    db.sql(f"insert into quiz_attempts(user_id,quiz_day,question_key,prompt,correct) values('{OWNER}',current_date,'q','practice',true)", role='authenticated')
    assert db.sql('select xp_earned from quiz_attempts').stdout.strip() == '0'
    assert db.sql('update quiz_attempts set xp_earned=100', role='authenticated', check=False).returncode != 0
    award = str(uuid4())
    db.sql(f"insert into achievements values('{award}','legacy',10); insert into user_achievements values('{OWNER}','{award}',false)")
    assert db.sql(f"insert into user_achievements values('{OWNER}','{award}',true)",check=False).returncode != 0


def test_operation_keys_are_scoped_to_owner_and_cannot_transfer_rewards(db):
    key = str(uuid4())
    first = db.settle(key)
    second = db.settle(key, owner=OTHER)
    assert first['session_id'] != second['session_id']
    assert first['profile']['xp'] == second['profile']['xp'] == 5
    assert db.sql('select count(*) from sessions', role='authenticated').stdout.strip().endswith('1')
    assert db.sql('select count(*) from sessions', role='authenticated', owner=OTHER).stdout.strip().endswith('1')


def test_sql_rejects_deprecated_reward_claims_without_any_mutation(db):
    result = db.settle(payload={'code': 'pass', 'trace': [], 'total_steps': 0, 'xp_earned': 1000000000}, check=False)
    assert result.returncode != 0
    assert db.sql('select count(*) from sessions').stdout.strip() == '0'
    assert db.sql('select count(*) from reward_accounts').stdout.strip() == '0'


def test_migration_archives_unverified_balances_without_importing_them(db):
    assert db.sql("select legacy_reward_snapshot->>'xp' from profiles where username='legacy_snapshot'").stdout.strip() == '777'
    assert db.sql("select count(*) from reward_accounts where user_id='00000000-0000-4000-8000-000000000099'").stdout.strip() == '0'


@pytest.mark.parametrize('xp,level', [(195,2), (495,3), (995,4), (1995,5)])
def test_level_thresholds_are_recalculated_in_the_transaction(db, xp, level):
    db.sql(f"insert into reward_accounts(user_id,xp) values('{OWNER}',{xp})")
    receipt = db.settle()
    assert receipt['profile']['xp'] == xp + 5
    assert receipt['profile']['level'] == level


@pytest.mark.parametrize('days,expected,award', [(0,4,0), (1,5,5), (3,1,5)])
def test_streak_uses_server_utc_activity_dates(db, days, expected, award):
    db.sql(f"insert into reward_accounts(user_id,streak,last_active_date) values('{OWNER}',4,(clock_timestamp() at time zone 'UTC')::date-{days})")
    receipt = db.settle()
    assert receipt['profile']['streak'] == expected and receipt['xp_awarded'] == award
