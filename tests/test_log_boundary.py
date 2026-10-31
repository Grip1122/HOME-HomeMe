import copy
import pytest
from fastapi.testclient import TestClient
from server.main import create_app

@pytest.fixture
def client(tmp_path,layout):
    return TestClient(create_app(tmp_path/'db.sqlite',{'A':layout}),raise_server_exceptions=False)


def log_payload(client):
    plan=client.post('/plan',json={'query':'我的红色水杯在哪','layout_id':'A'}).json()
    return {'layout_id':'A','query':'我的红色水杯在哪','plan':plan,'steps':[{**plan['steps'][0],'result':'succeeded'}],'duration_ms':100,'memory_enabled':True}

@pytest.mark.parametrize('robot',[[],[1],'bad',1,0,False,True,None,{'holding':[]},{'holding':'missing'},{'pos':[1,2]},{'unknown':1}])
def test_log_rejects_invalid_robot_types_as_422_without_write(client,robot):
    payload=log_payload(client);payload['robot']=robot
    assert client.post('/log',json=payload).status_code==422
    assert client.get('/log',params={'layout_id':'A'}).json()==[]

@pytest.mark.parametrize('robot',[{}, {'holding':None},{'holding':'cup_red','pos':[0,0,0]}])
def test_log_accepts_valid_robot_objects(client,robot):
    payload=log_payload(client);payload['robot']=robot
    assert client.post('/log',json=payload).status_code==200

@pytest.mark.parametrize('steps',[[{}],[{'action':'fly','target':'cup_red','result':'succeeded'}],
 [{'action':'find','target':'missing','result':'succeeded'}],
 [{'action':'find','target':[],'result':'succeeded'}],
 [{'action':'find','target':'cup_red','result':'running'}],
 [{'action':'find','target':'cup_red'}],
 [{'action':'find','target':'cup_red','result':'succeeded','arbitrary':1}],
 [{'action':'go','target':'cup_red','result':'succeeded'}]])
def test_log_rejects_invalid_execution_event_or_plan_mismatch(client,steps):
    payload=log_payload(client);payload['steps']=steps
    assert client.post('/log',json=payload).status_code==422
    assert client.get('/log',params={'layout_id':'A'}).json()==[]

@pytest.mark.parametrize('result',['succeeded','failed','cancelled'])
def test_log_accepts_terminal_execution_results(client,result):
    payload=log_payload(client);payload['steps'][0]['result']=result
    assert client.post('/log',json=payload).status_code==200


def test_log_failure_must_be_last_and_steps_are_a_plan_prefix(client):
    plan={'say':'test','source':'rule','steps':[{'action':'go','target':'cup_red'},{'action':'grab','target':'cup_red'}]}
    payload=log_payload(client);payload['plan']=plan
    payload['steps']=[{**plan['steps'][0],'result':'failed'},{**plan['steps'][1],'result':'succeeded'}]
    assert client.post('/log',json=payload).status_code==422
    payload['steps']=payload['steps'][:1]
    assert client.post('/log',json=payload).status_code==200
    payload['steps']=[]
    assert client.post('/log',json=payload).status_code==200
    assert [r['step_count'] for r in client.get('/log',params={'layout_id':'A'}).json()]==[0,1]
