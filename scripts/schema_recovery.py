"""Render the screened, source-verified schema candidate offline. No DB/network access."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'supabase/recovery/application-schema.snapshot.json'
OUTPUT = ROOT / 'supabase/recovery/application-schema.candidate.sql'
TYPES = {'uuid', 'text', 'integer', 'boolean', 'jsonb', 'date', 'timestamp with time zone'}
DEFAULTS = {'gen_random_uuid()', 'now()', '0', '1', '42', '50', '68', '74', '100',
            "'Byte'::text", "'arr'::text", "'locked'::text", "'uncategorized'::text", 'false'}
ALL_TABLE = {'DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'}


def identifier(value):
    if not re.fullmatch(r'[a-z_][a-z0-9_]*', value):
        raise ValueError(f'Unreviewed identifier: {value!r}')
    return f'"{value}"'


def expression(value):
    if any(marker in value for marker in (';', '--', '/*', '$', "'")):
        raise ValueError('Unreviewed expression: requires separate screening')
    return value


def render(snapshot):
    if snapshot['format_version'] != 1:
        raise ValueError('Unsupported snapshot format')
    app = snapshot['application']
    for kind in ('routines', 'triggers', 'views', 'sequences', 'rules', 'enum_domains', 'column_grants'):
        if app[kind]:
            raise ValueError(f'{kind} requires an explicit renderer/review; never silently omit objects')
    tables = sorted(app['tables'], key=lambda t: t['name'])
    names = {t['name'] for t in tables}
    if len(names) != len(tables):
        raise ValueError('Duplicate table metadata')
    for kind, key in (('columns', 'table_name'), ('constraints', 'table_name'), ('indexes', 'table_name'),
                      ('policies', 'tablename'), ('table_grants', 'table_name')):
        if any(obj[key] not in names for obj in app[kind]):
            raise ValueError(f'Orphan {kind} metadata; never omit an unrepresented table')
    sql = [
        '-- SOURCE-VERIFIED RECOVERY CANDIDATE. Not release-approved; not a CLI migration.',
        '-- Generated offline by scripts/schema_recovery.py from the screened metadata snapshot.',
        '-- Represents the task-pattern and old RLS migrations already present in the source.',
        '-- Preserves LEGACY browser INSERT/UPDATE grants; never activate this snapshot alone.',
        '-- No managed schemas, Auth users, platform roles, defaults, event triggers or history are restored.',
        '-- Local review must explicitly SET algorythm.schema_recovery = \'local-review\' first.',
        'begin;', 'set local search_path = public, pg_catalog;',
        "do $$ begin\n  if current_setting('algorythm.schema_recovery',true) is distinct from 'local-review' then\n"
        "    raise exception 'Recovery candidate requires explicit local-review opt-in; no remote initialization approval implied';\n"
        "  end if;\n  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then\n"
        "    raise exception 'Managed Auth dependencies must already exist';\n  end if;\nend $$;",
        'set local role postgres;',
    ]
    for table in tables:
        if (table['schema_name'] != 'public' or table['kind'] != 'r' or table['owner'] != 'postgres'
                or table['partition'] or table['has_options'] or table['persistence'] != 'p'
                or table['access_method'] != 'heap' or table['replica_identity'] != 'd'):
            raise ValueError('Unsupported table properties; review before rendering')
        columns = []
        for col in sorted((c for c in app['columns'] if c['table_name'] == table['name']), key=lambda c: c['position']):
            if (col['schema_name'] != 'public' or col['type'] not in TYPES or col['identity'] or col['generated']
                    or col['dimensions'] or col['column_collation'] not in (None, '"default"') or col['default_withheld']):
                raise ValueError('Unsupported or withheld column definition')
            definition = identifier(col['name']) + ' ' + col['type']
            if col['has_default']:
                if col['default_expression'] not in DEFAULTS:
                    raise ValueError('Missing or unreviewed default')
                definition += ' default ' + col['default_expression']
            if col['not_null']:
                definition += ' not null'
            columns.append('  ' + definition)
        if not columns:
            raise ValueError('Missing table column inventory')
        sql.append(f'create table public.{identifier(table["name"])} (\n' + ',\n'.join(columns) + '\n);')
    # Every referenced key must exist before any foreign key is attached.
    for constraint in sorted(app['constraints'], key=lambda c: (c['type'] == 'f', c['table_name'], c['name'])):
        if (constraint['type'] not in ('p', 'u', 'f') or not constraint['validated']
                or constraint['is_deferrable'] or constraint['initially_deferred']):
            raise ValueError('Unsupported constraint properties')
        definition = expression(constraint['definition'])
        definition = re.sub(r'REFERENCES ([a-z_][a-z0-9_]*)\(', r'REFERENCES public.\1(', definition)
        sql.append(f'alter table public.{identifier(constraint["table_name"])} add constraint '
                   f'{identifier(constraint["name"])} {definition};')
    for index in sorted(app['indexes'], key=lambda i: (i['table_name'], i['name'])):
        if not index['valid']:
            raise ValueError('Invalid index')
        if not index['constraint_backed']:
            sql.append(expression(index['definition']) + ';')
    for table in tables:
        target = 'public.' + identifier(table['name'])
        sql.append(f'alter table {target} {"enable" if table["rls"] else "disable"} row level security;')
        if table['force_rls']:
            sql.append(f'alter table {target} force row level security;')
        sql.append(f'revoke all privileges on table {target} from public, anon, authenticated, service_role;')
    for grant in sorted(app['table_grants'], key=lambda g: (g['table_name'], g['grantee'])):
        if grant['schema_name'] != 'public' or grant['table_name'] not in names or grant['grantor'] != 'postgres':
            raise ValueError('Unreviewed grant origin')
        privileges = set(grant['privileges'])
        if not privileges <= ALL_TABLE:
            raise ValueError('Unreviewed privilege')
        clause = 'all privileges' if privileges == ALL_TABLE else ', '.join(sorted(privileges))
        grantee = 'public' if grant['grantee'] == 'PUBLIC' else identifier(grant['grantee'])
        sql.append(f'grant {clause} on table public.{identifier(grant["table_name"])} to {grantee}'
                   + (' with grant option' if grant['is_grantable'] else '') + ';')
    for policy in sorted(app['policies'], key=lambda p: (p['tablename'], p['policyname'])):
        if (policy['expression_withheld'] or policy['schemaname'] != 'public'
                or policy['cmd'] not in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
                or policy['permissive'] not in ('PERMISSIVE', 'RESTRICTIVE')):
            raise ValueError('Unreviewed policy')
        roles = ', '.join('public' if r == 'public' else identifier(r) for r in policy['roles'])
        statement = (f'create policy {identifier(policy["policyname"])} on public.{identifier(policy["tablename"])} '
                     f'as {policy["permissive"]} for {policy["cmd"]} to {roles}')
        if policy['qual'] is not None:
            statement += ' using (' + expression(policy['qual']) + ')'
        if policy['with_check'] is not None:
            statement += ' with check (' + expression(policy['with_check']) + ')'
        sql.append(statement + ';')
    sql.append('commit;')
    return '\n\n'.join(sql) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true', help='Write the local candidate artifact')
    mode.add_argument('--check', action='store_true', help='Check deterministic local output')
    args = parser.parse_args()
    expected = render(json.loads(SNAPSHOT.read_text()))
    if args.write:
        OUTPUT.write_text(expected)
    elif args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != expected:
            raise SystemExit('Schema candidate is stale; review then run --write locally')
        print('Schema candidate is current; no database was contacted.')
    else:
        print(expected, end='')


if __name__ == '__main__':
    main()
