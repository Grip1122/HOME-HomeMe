from concurrent.futures import ThreadPoolExecutor
import copy
import sqlite3
import threading
import pytest
from fastapi.testclient import TestClient
from server.app.storage import Store
from server.main import create_app

ENTRY={'object_id':'cup_red','room':'living','pos':[0,.75,0]}


def history(store):
    with sqlite3.connect(store.path) as db:
        return db.execute('SELECT layout_id,object_id,previous_json,next_json FROM memory_history ORDER BY id').fetchall()


def test_concurrent_same_object_across_independent_stores_preserves_updates(tmp_path):
    path=tmp_path/'db';store=Store(path);store.observe('A',[ENTRY]);store.update_confidence('A','cup_red',False)
    workers=[Store(path) for _ in range(4)];barrier=threading.Barrier(4)
    def hit(worker):
        barrier.wait();return worker.update_confidence('A','cup_red',True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows=list(pool.map(hit,workers))
    assert sorted(r['confidence'] for r in rows)==[.45,.5,.55,.6]
    assert store.list_memory('A')[0]['confidence']==.6
    assert len(history(store))==6


def test_concurrent_layouts_and_logs_remain_isolated_and_survive_restart(tmp_path,layout):
    path=tmp_path/'db';other=copy.deepcopy(layout);other['layout_id']='B'
    clients=[TestClient(create_app(path,{'A':layout,'B':other})) for _ in range(2)]
    barrier=threading.Barrier(2)
    def write(item):
        client,lid=item;barrier.wait()
        assert client.post('/memory/observe',json={'layout_id':lid,'entries':[ENTRY]}).status_code==200
        for _ in range(3):
            assert client.post('/memory/miss' if lid=='A' else '/memory/hit',json={'layout_id':lid,'object_id':'cup_red'}).status_code==200
        plan=client.post('/plan',json={'layout_id':lid,'query':'我的红色水杯在哪'}).json()
        assert client.post('/log',json={'layout_id':lid,'query':lid,'plan':plan,'steps':[{**plan['steps'][0],'result':'succeeded'}],'duration_ms':1,'memory_enabled':True}).status_code==200
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(write,zip(clients,['A','B'])))
    restarted=TestClient(create_app(path,{'A':layout,'B':other}))
    assert restarted.get('/memory',params={'layout_id':'A'}).json()[0]['confidence']==0
    assert restarted.get('/memory',params={'layout_id':'B'}).json()[0]['confidence']==.95
    for lid in ['A','B']:
        rows=restarted.get('/log',params={'layout_id':lid}).json()
        assert len(rows)==1 and rows[0]['query']==lid and rows[0]['layout_id']==lid


def test_failed_correction_rolls_back_memory_and_both_history_rows(tmp_path):
    store=Store(tmp_path/'db');store.observe('A',[ENTRY]);before=store.list_memory('A');old_history=history(store)
    with sqlite3.connect(store.path) as db:
        db.execute("CREATE TRIGGER fail_correction BEFORE INSERT ON memory_history WHEN json_extract(NEW.next_json, '$.source')='correct' AND json_extract(NEW.next_json, '$.status')='fresh' BEGIN SELECT RAISE(ABORT, 'injected history failure'); END")
    with pytest.raises(sqlite3.IntegrityError,match='injected'):
        store.correct('A',{**ENTRY,'room':'study','pos':[3,.8,2]})
    assert store.list_memory('A')==before
    assert history(store)==old_history


def test_reset_failure_after_delete_and_first_insert_restores_old_data(tmp_path):
    store=Store(tmp_path/'db');store.observe('A',[ENTRY]);store.observe('B',[ENTRY])
    before=store.list_memory('A');before_b=store.list_memory('B');old_history=history(store)
    with sqlite3.connect(store.path) as db:
        db.execute("CREATE TRIGGER fail_second_seed BEFORE INSERT ON spatial_memory WHEN NEW.object_id='book_blue' BEGIN SELECT RAISE(ABORT, 'injected reset failure'); END")
    seed={**ENTRY,'confidence':.3,'status':'fresh'}
    with pytest.raises(sqlite3.IntegrityError,match='injected'):
        store.reset('A',[seed,{**seed,'object_id':'book_blue'}])
    assert store.list_memory('A')==before and store.list_memory('B')==before_b
    assert history(store)==old_history
