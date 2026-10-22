"""API boundary tests mock RPC transport; transaction/privilege tests use real PG."""
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

import main


@pytest.fixture
def api(monkeypatch):
    calls = []
    receipt = {'session_id': 'saved-session', 'xp_awarded': 5, 'reward_status': 'awarded',
               'achievements_earned': [], 'completion_verified': False, 'replayed': False}
    def rpc(name, parameters):
        calls.append((name, parameters))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=receipt))
    monkeypatch.setattr(main, 'supabase', SimpleNamespace(rpc=rpc))
    main.app.dependency_overrides[main.verify_authenticated_user_id] = lambda: 'verified-owner'
    try:
        yield TestClient(main.app), calls, receipt
    finally:
        main.app.dependency_overrides.pop(main.verify_authenticated_user_id)


def payload(**fields):
    return {'code': 'pass', 'idempotency_key': str(uuid4()), **fields}


@pytest.mark.parametrize('claims', [
    {'xp_earned': 1000000000}, {'xp_earned': -100}, {'xp_earned': 10**100},
    {'solved': True}, {'task_completed': True}, {'task_attempts': 1},
    {'task_attempts': -1}, {'mentor_messages_count': 0}, {'user_id': 'other-user'},
])
def test_deprecated_reward_claims_are_rejected_before_rpc(api, claims):
    client, calls, _ = api
    assert client.post('/session/save', json=payload(**claims)).status_code == 422
    assert calls == []


@pytest.mark.parametrize('fields', [{'total_steps': 10**100}, {'total_steps': -1},
                                    {'trace': [{}]*301}, {'idempotency_key': 'forged'},
                                    {'code': 'x'*200001}, {'task_id': 'not-a-uuid'}])
def test_bounds_and_required_idempotency_are_validated(api, fields):
    client, calls, _ = api
    assert client.post('/session/save', json=payload(**fields)).status_code == 422
    assert calls == []


def test_forged_classification_success_are_annotations_and_rpc_is_the_only_write(api):
    client, calls, receipt = api
    body = payload(algorithm_type='bubble_sort', execution_succeeded=True)
    response = client.post('/session/save', json=body)
    assert response.status_code == 200 and response.json() == receipt
    name, parameters = calls[0]
    assert name == 'settle_activity_session' and parameters['p_user_id'] == 'verified-owner'
    assert parameters['p_operation_id'] == body['idempotency_key']
    assert parameters['p_payload']['algorithm_type'] == 'bubble_sort'
    assert not {'xp_earned', 'solved', 'task_attempts', 'mentor_messages_count'} & parameters['p_payload'].keys()
    assert response.json()['achievements_earned'] == [] and not response.json()['completion_verified']


def test_retry_forwards_identical_operation_not_a_fresh_reward(api):
    client, calls, receipt = api
    body = payload()
    assert client.post('/session/save', json=body).status_code == 200
    receipt['replayed'] = True
    assert client.post('/session/save', json=body).json()['replayed']
    assert calls[0] == calls[1]


@pytest.mark.parametrize('message,status', [('idempotency_conflict',409), ('activity_daily_limit',429), ('database unavailable',503)])
def test_transaction_errors_fail_closed_without_fallback_writes(api, monkeypatch, message, status):
    def fail(*_args):
        raise APIError({'message': message, 'code': 'P0001', 'details': None, 'hint': None})
    monkeypatch.setattr(main, 'supabase', SimpleNamespace(rpc=fail))
    assert api[0].post('/session/save', json=payload()).status_code == status


def test_demo_sign_in_cannot_replace_the_shared_service_principal(monkeypatch):
    shared = SimpleNamespace(auth=object())
    monkeypatch.setattr(main, 'supabase', shared)
    monkeypatch.setattr(main, 'DEMO_EMAIL', 'synthetic@example.invalid')
    monkeypatch.setattr(main, 'DEMO_PASSWORD', 'synthetic-only')
    monkeypatch.setattr(main, 'demo_login_attempts', {})
    calls = []
    class IsolatedAuth:
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            self.closed = True
        def sign_in_with_password(self, credentials):
            assert credentials['email'] == 'synthetic@example.invalid'
            return SimpleNamespace(session=SimpleNamespace(access_token='synthetic-access', refresh_token='synthetic-refresh'))
    auth = IsolatedAuth()
    def create(_url, _key, options):
        calls.append(options)
        return SimpleNamespace(auth=auth)
    monkeypatch.setattr(main, 'create_client', create)
    response = TestClient(main.app).post('/auth/demo-login')
    assert response.status_code == 200
    assert main.supabase is shared and auth.closed
    assert calls[0].persist_session is False and calls[0].auto_refresh_token is False
