"""Prepare LOCAL-ONLY bootstrap SQL offline. No connection, credentials or remote mode.

The SQL itself refuses TCP/listening servers and non-owned test databases. Hosted
activation requires a separately reviewed change after platform review/approval.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.schema_recovery import OUTPUT, ROOT, SNAPSHOT, render

TARGET = 'aexhskdofnpqqraapigk'
VERSIONS = ['20260808183440', '20260808213028']
REWARD = '20261022113757'
MIGRATION = ROOT / 'supabase/migrations/20261022113757_reward_integrity.sql'
REFERENCE = ROOT / 'supabase/bootstrap/final-schema.expected.json'
HASHES = {
    OUTPUT: 'e1c73eac2942be1d25d56f19afa4f1a1cb82c13b9304e55269dc5156e3abc668',
    SNAPSHOT: '90b78c5e233db3136853d4dd2fb72d9741432c3be03bc88241a3547812307d3f',
    ROOT / 'supabase/migrations/20260808183440_add_task_pattern.sql':
        '8e63c0f2cebcd8193fb08fbed04de42d7b3d7e2fd24920deb7088d2a6302ba42',
    ROOT / 'supabase/migrations/20260808213028_secure_public_tables_with_rls.sql':
        '0110251c69bd53c9f73a747c59180dcfb020acb506db379b5e45ecad813f439f',
    MIGRATION: 'f0705538d81ea953ba34270d9b4bb0b8c551fcd914814970412c4b475c84a27d',
    REFERENCE: '934b29a236b72c2f0caa71fa78f55b676560f5a6806bec5b61d66d567780295d',
}


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def body(sql):
    """Only the reviewed, hash-pinned outer lines are omitted, never arbitrary SQL.

    Do NOT split on semicolons: PL/pgSQL bodies contain BEGIN/END and semicolons.
    Source files remain immutable. Unexpected top-level boundaries fail closed.
    """
    lines = sql.splitlines()
    starts = [i for i, line in enumerate(lines) if line == 'begin;']
    ends = [i for i, line in enumerate(lines) if line == 'commit;']
    if len(starts) != 1 or len(ends) != 1 or starts[0] >= ends[0]:
        raise ValueError('Unreviewed transaction boundaries')
    if any(line.strip() and not line.startswith('--') for line in lines[ends[0] + 1:]):
        raise ValueError('SQL after source COMMIT')
    return '\n'.join(lines[starts[0] + 1:ends[0]])


def verify():
    for path, expected in HASHES.items():
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Changed source artifact: {path.relative_to(ROOT)}')
    source = json.loads(SNAPSHOT.read_text())
    if OUTPUT.read_text() != render(source):
        raise ValueError('Candidate does not match source renderer')
    for path in (OUTPUT, MIGRATION):
        body(path.read_text())
    return source


# Schema-only comparison; never application rows, Auth sessions or routine bodies.
# Normalized schema-qualified keys distinguish public tables from the ledger.
CATALOGUE = """select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',a.attname,
   'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))
   order by n.nspname,c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid
   join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
   where n.nspname in ('public','reward_private') and c.relkind='r' and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',k.conname,
   'definition',pg_get_constraintdef(k.oid,true),'validated',k.convalidated,'deferrable',k.condeferrable)
   order by n.nspname,c.relname,k.conname) from pg_constraint k join pg_class c on c.oid=k.conrelid
   join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','reward_private')),
 'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by n.nspname,c.relname,ic.relname)
   from pg_index i join pg_class c on c.oid=i.indrelid join pg_class ic on ic.oid=i.indexrelid
   join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','reward_private')),
 'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)
   from pg_policies p where p.schemaname in ('public','reward_private')),
 'grants',(select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,
   'grantee',pg_get_userbyid(a.grantee),'grantor',pg_get_userbyid(a.grantor),
   'privilege',a.privilege_type,'grantable',a.is_grantable)
   order by n.nspname,c.relname,pg_get_userbyid(a.grantee),a.privilege_type)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
   where n.nspname in ('public','reward_private') and c.relkind='r'),
 'column_grants',(select jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'column',p.attname,
   'grantee',pg_get_userbyid(a.grantee),'grantor',pg_get_userbyid(a.grantor),
   'privilege',a.privilege_type,'grantable',a.is_grantable)
   order by n.nspname,c.relname,p.attnum,pg_get_userbyid(a.grantee),a.privilege_type)
   from pg_attribute p join pg_class c on c.oid=p.attrelid join pg_namespace n on n.oid=c.relnamespace
   cross join lateral aclexplode(p.attacl) a
   where n.nspname in ('public','reward_private') and p.attnum>0 and not p.attisdropped),
 'tables',(select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,
   'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity)
   order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','reward_private') and c.relkind='r'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,
   'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),
   'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
   'definition_md5',md5(pg_get_functiondef(p.oid)),
   'acl',(select jsonb_agg(jsonb_build_object('grantee',pg_get_userbyid(a.grantee),
     'privilege',a.privilege_type,'grantable',a.is_grantable) order by pg_get_userbyid(a.grantee))
     from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) order by p.proname)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','reward_private') and not
     (n.nspname='public' and p.proname='rls_auto_enable' and p.pronargs=0 and p.prorettype='event_trigger'::regtype)),
 'other_relations',(select jsonb_agg(c.relname order by c.relname) from pg_class c
   join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','reward_private')
   and c.relkind not in ('r','i')),
 'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t
   join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','reward_private') and not t.tgisinternal),
 'types',(select jsonb_agg(t.typname order by t.typname) from pg_type t
   join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','reward_private')
   and t.typtype in ('e','d','r')),
 'rules',(select jsonb_agg(pg_get_ruledef(r.oid) order by r.rulename) from pg_rewrite r
   join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','reward_private')))"""

PLATFORM = """select jsonb_build_object(
 'events',(select jsonb_agg(jsonb_build_object('name',e.evtname,'enabled',e.evtenabled,
   'event',e.evtevent,'tags',e.evttags,'function',e.evtfoid::regproc::text) order by e.evtname)
   from pg_event_trigger e),
 'defaults',(select jsonb_agg(to_jsonb(d) order by d.oid) from pg_default_acl d),
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,
   'super',rolsuper,'bypass',rolbypassrls,'login',rolcanlogin,'createrole',rolcreaterole,
   'createdb',rolcreatedb) order by rolname) from pg_roles),
 'membership',(select jsonb_agg(to_jsonb(m) order by m.oid) from pg_auth_members m),
 'handlers',(select jsonb_agg(jsonb_build_object('name',p.oid::regproc::text,
   'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
   'definition_md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text) order by p.oid::regproc::text)
   from pg_proc p where p.oid in (select evtfoid from pg_event_trigger)))"""


def assertion(condition, message):
    return f'do $guard$ begin if {condition} then raise exception {literal(message)}; end if; end $guard$;'


def compare(expected):
    return assertion(f'({CATALOGUE}) is distinct from {literal(json.dumps(expected))}::jsonb',
                     'Application schema/security differs from reviewed reference')


def baseline_reference(source):
    app = source['application']
    return {
        'columns': [{'table': 'public.' + c['table_name'], 'name': c['name'], 'type': c['type'],
                     'not_null': c['not_null'], 'default': c['default_expression']} for c in app['columns']],
        'constraints': [{'table': 'public.' + c['table_name'], 'name': c['name'], 'definition': c['definition'],
                         'validated': c['validated'], 'deferrable': c['is_deferrable']} for c in app['constraints']],
        'indexes': [i['definition'] for i in app['indexes']],
        'policies': [{k: v for k, v in p.items() if k != 'expression_withheld'} for p in app['policies']],
        'grants': [{'table': 'public.' + g['table_name'], 'grantee': g['grantee'], 'grantor': g['grantor'],
                    'privilege': p, 'grantable': g['is_grantable']}
                   for g in app['table_grants'] for p in g['privileges']],
        'column_grants': None,
        'tables': [{'name': 'public.' + t['name'], 'owner': t['owner'], 'rls': t['rls'],
                    'force_rls': t['force_rls']} for t in app['tables']],
        'functions': None,
        'other_relations': None, 'triggers': None, 'types': None, 'rules': None,
    }


def history(versions):
    # SELECT versions only. The CLI alone owns history creation/insertion.
    return """do $guard$ declare versions text[]; begin
 if to_regclass('supabase_migrations.schema_migrations') is null then
   versions := array[]::text[];
 else
   select coalesce(array_agg(version::text order by version),array[]::text[]) into versions
     from supabase_migrations.schema_migrations;
 end if;
 if versions is distinct from array[""" + ','.join(literal(v) for v in versions) + """ ]::text[] then
   raise exception 'Migration-history mismatch; no automatic repair/revert/reset';
 end if; end $guard$;"""


IDENTITY = assertion("current_user<>'postgres' or current_setting('server_version_num')::int/10000<>17",
                     'Requires PostgreSQL 17 and SQL identity postgres') + '\n' + assertion(
    f"current_setting('algorythm.bootstrap_project_ref',true) is distinct from '{TARGET}'",
    'Incorrect project ref') + '\n' + assertion(
    "session_user<>'audit_admin' or inet_server_addr() is not null or current_setting('listen_addresses')<>'' "
    "or current_database() !~ '^bootstrap_[a-f0-9]{32}$'",
    'LOCAL VERIFICATION ONLY: hosted execution is disabled')

PRINCIPALS = """do $guard$ begin
 if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
   raise exception 'Missing managed Auth prerequisites';
 end if;
 if not exists(select 1 from pg_attribute where attrelid='auth.users'::regclass
   and attname='id' and atttypid='uuid'::regtype and attnotnull)
   or (select prorettype from pg_proc where oid='auth.uid()'::regprocedure)<>'uuid'::regtype
   or not has_schema_privilege('postgres','public','CREATE')
   or not has_schema_privilege('postgres','auth','USAGE')
   or not has_column_privilege('postgres','auth.users','id','REFERENCES') then
   raise exception 'Incompatible Auth/schema privileges or types';
 end if;
 if (select count(*) from pg_roles where rolname in ('anon','authenticated','service_role','authenticator'))<>4
   or exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','authenticator')
     and (rolsuper or rolcreaterole or rolcreatedb))
   or exists(select 1 from pg_roles where rolname in ('anon','authenticated') and (rolbypassrls or rolcanlogin))
   or exists(select 1 from pg_roles where rolname='authenticator' and (rolbypassrls or rolinherit))
   or not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls and not rolcanlogin)
   or exists(select 1 from pg_auth_members m join pg_roles r on r.oid=m.member
     where r.rolname in ('anon','authenticated','service_role')) then
   raise exception 'Unexpected API role capabilities/inheritance';
 end if;
 if not has_function_privilege('authenticated','auth.uid()','EXECUTE')
   or not has_function_privilege('service_role','auth.uid()','EXECUTE')
   or not has_schema_privilege('authenticated','auth','USAGE') then
   raise exception 'Missing function privileges';
 end if;
end $guard$;"""

PREREQUISITES = PRINCIPALS + """\ndo $guard$ begin
 if exists(select 1 from pg_namespace where nspname in ('reward_private','algorythm_bootstrap'))
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public')
   or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
     where n.nspname='public' and not exists(select 1 from pg_depend d
       where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e'))
   or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and (p.proname<>'rls_auto_enable' or p.pronargs<>0
       or p.prorettype<>'event_trigger'::regtype)) then
   raise exception 'Existing application objects; never reset or overwrite';
 end if;
 if exists(select 1 from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
   where d.defaclrole='postgres'::regrole and (d.defaclnamespace=0 or d.defaclnamespace='public'::regnamespace)
   and a.grantee<>0 and pg_get_userbyid(a.grantee) not in ('postgres','anon','authenticated','service_role'))
   or exists(select 1 from pg_namespace n cross join lateral aclexplode(n.nspacl) a
     where n.nspname='public' and ((a.privilege_type='CREATE' and a.grantee<>n.nspowner
       and pg_get_userbyid(a.grantee)<>'postgres') or (a.grantee<>0 and pg_get_userbyid(a.grantee) not in
       ('pg_database_owner','postgres','anon','authenticated','service_role','authenticator')))) then
   raise exception 'Unexpected pre-existing grants';
 end if;
end $guard$;"""

CLOSE_SCHEMA = 'revoke all on schema public from public,anon,authenticated,service_role,authenticator;'
CLOSED = assertion("exists(select 1 from pg_roles where rolname in "
                   "('anon','authenticated','service_role','authenticator') and "
                   "(has_schema_privilege(oid,'public','USAGE') or has_schema_privilege(oid,'public','CREATE')))",
                   'Containment lost: API schema access')

# Broad platform defaults may add service privileges beyond migration GRANTs.
# Normalize only the three newly-created reward relations, inside its transaction.
FINAL_SERVICE_GRANTS = """revoke all on public.reward_accounts,public.practice_progress,
 reward_private.session_settlements from service_role;
grant select,insert,update on public.reward_accounts,public.practice_progress to service_role;
grant select,insert on reward_private.session_settlements to service_role;"""


def state_guard(phase):
    return assertion(f"(select phase from algorythm_bootstrap.state) is distinct from '{phase}' "
                     f"or (select target from algorythm_bootstrap.state) is distinct from '{TARGET}' "
                     f"or (select artifacts from algorythm_bootstrap.state) is distinct from {literal(artifact_id())}",
                     'Bootstrap state/artifact mismatch') + '\n' + assertion(
        f'({PLATFORM}) is distinct from (select platform from algorythm_bootstrap.state)',
        'Platform defaults/event/role inventory drift; review required') + '\n' + assertion(
        "exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','authenticator') "
        "and (has_schema_privilege(oid,'algorythm_bootstrap','USAGE') "
        "or has_schema_privilege(oid,'algorythm_bootstrap','CREATE') "
        "or has_table_privilege(oid,'algorythm_bootstrap.state','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN'))) "
        "or not exists(select 1 from pg_class where oid='algorythm_bootstrap.state'::regclass "
        "and relowner='postgres'::regrole and relrowsecurity)",
        'Bootstrap journal must remain private and owned by postgres')


def artifact_id():
    return hashlib.sha256(''.join(HASHES.values()).encode()).hexdigest()


def phases():
    source = verify()
    baseline = baseline_reference(source)
    final = json.loads(REFERENCE.read_text())
    grants = '\n'.join(line for line in OUTPUT.read_text().splitlines() if line.startswith('grant '))
    start = ('-- GENERATED LOCAL REVIEW SQL. NOT AUTHORIZED FOR HOSTED EXECUTION.\n'
             'begin;\nset local search_path=public,pg_catalog;\nset local lock_timeout=\'2s\';\n'
             'set local statement_timeout=\'30s\';\n'
             'select pg_advisory_xact_lock(713031113);\n' + IDENTITY + '\n')
    baseline_sql = start + PREREQUISITES + '\n' + history([])
    baseline_sql += f"\ndo $guard$ begin perform set_config('algorythm.bootstrap_platform_initial',({PLATFORM})::text,true); end $guard$;\n"
    baseline_sql += CLOSE_SCHEMA + """
create schema algorythm_bootstrap authorization postgres;
revoke all on schema algorythm_bootstrap from public,anon,authenticated,service_role,authenticator;
create table algorythm_bootstrap.state (
 singleton boolean primary key default true check(singleton), phase text not null,
 target text not null, artifacts text not null, platform jsonb not null);
alter table algorythm_bootstrap.state enable row level security;
revoke all on algorythm_bootstrap.state from public,anon,authenticated,service_role,authenticator;
set local algorythm.schema_recovery='local-review';
""" + body(OUTPUT.read_text()) + '\n' + compare(baseline) + """
revoke all on all tables in schema public from public,anon,authenticated,service_role,authenticator;
""" + CLOSED + f"\ninsert into algorythm_bootstrap.state values(true,'baseline','{TARGET}'," + literal(artifact_id())
    baseline_sql += ",current_setting('algorythm.bootstrap_platform_initial')::jsonb);\n"
    baseline_sql += state_guard('baseline') + '\ncommit;\n'
    reward_sql = start + CLOSED + '\n' + PRINCIPALS + '\n' + state_guard('baseline') + '\n' + history(VERSIONS) + '\n' + grants
    # Exact source restoration is asserted INSIDE the closed reward transaction.
    reward_sql += '\n' + compare(baseline) + '\n' + body(MIGRATION.read_text()) + '\n' + FINAL_SERVICE_GRANTS
    reward_sql += '\n' + compare(final)
    reward_sql += "\nrevoke all on schema reward_private from public,anon,authenticated,service_role,authenticator;\n"
    reward_sql += CLOSED + "\nupdate algorythm_bootstrap.state set phase='reward';\ncommit;\n"
    release_sql = start + CLOSED + '\n' + PRINCIPALS + '\n' + state_guard('reward') + '\n' + history(VERSIONS + [REWARD])
    release_sql += '\n' + compare(final) + """
grant usage on schema public to anon,authenticated,service_role,authenticator;
grant usage on schema reward_private to service_role;
""" + assertion("has_schema_privilege('anon','reward_private','USAGE') or "
                 "has_schema_privilege('authenticated','reward_private','USAGE') or "
                 "has_function_privilege('anon','public.settle_activity_session(uuid,uuid,jsonb)','EXECUTE') or "
                 "has_function_privilege('authenticated','public.settle_activity_session(uuid,uuid,jsonb)','EXECUTE') or "
                 "not has_function_privilege('service_role','public.settle_activity_session(uuid,uuid,jsonb)','EXECUTE')",
                 'Final service-only RPC/schema assertion failed')
    release_sql += "\nupdate algorythm_bootstrap.state set phase='released';\ncommit;\n"
    return {'10-baseline-quarantined.sql': baseline_sql,
            '20-reward-quarantined.sql': reward_sql, '30-release.sql': release_sql}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify pinned sources and build local SQL offline')
    parser.add_argument('--emit-local', type=Path, help='Create a NEW local SQL review directory; never connects')
    args = parser.parse_args()
    if not args.check and args.emit_local is None:
        parser.error('Remote execution is disabled. Choose --check or --emit-local NEW_DIRECTORY.')
    rendered = phases()
    if args.emit_local:
        args.emit_local.mkdir(parents=False, exist_ok=False)
        for name, sql in rendered.items():
            (args.emit_local / name).write_text(sql)
    print('Pinned artifacts verified; local-only SQL prepared offline. No database contacted.')


if __name__ == '__main__':
    # Direct script execution and module execution share the same offline code.
    main()
