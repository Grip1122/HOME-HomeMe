import pytest
from server.app.rules import try_correct
from server.app.planner import plan_offline

@pytest.mark.parametrize('query,target',[
 ('不对，应该放茶几','table_coffee'),
 ('不对，不应该放茶几',None),
 ('不对，不应该放到茶几',None),
 ('不对，不应该放在茶几',None),
 ('不对，不该放茶几',None),
 ('不对，不要放茶几或者餐桌',None),
 ('不对，不应该放茶几，应该放书桌','desk'),
 ('不对，应该放书桌，不应该放茶几','desk'),
 ('不对，书应该放书房，不应该放茶几','desk'),
])
def test_negated_destination_is_never_selected(index,query,target):
    result=try_correct(query,index,last_object='cup_red')
    if target is None:
        assert result['steps']==[]
        assert result['corrected'] is False
    else:
        assert result['corrected_to']==target
        assert result['steps'][-1]['to']==target
    if '书应该' in query:
        assert result['corrected_object']=='book_blue'

@pytest.mark.parametrize('wake',['小觅，','小方，',''])
def test_formal_wake_name_and_legacy_alias_match_cache(index,wake):
    result=plan_offline(wake+'帮我找钥匙',index)
    assert result['source']=='cache'
    assert result['steps']==[{'action':'find','target':'keys_yellow'}]
