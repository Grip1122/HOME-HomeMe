import pytest

from server.app.commands import plan_command
from server.app.planner import plan_offline
from server.app.validate import validate_steps


def test_rule_transport_finds_grabs_and_drops_using_layout_ids(index):
    value = plan_command('帮我把红色水杯放到书房', index)
    assert value['source'] == 'rule'
    assert value['steps'] == [
        {'action': 'find', 'target': 'cup_red'},
        {'action': 'grab', 'target': 'cup_red'},
        {'action': 'go', 'target': 'desk'},
        {'action': 'drop', 'target': 'cup_red', 'to': 'desk'},
    ]
    assert validate_steps(index, value['steps']) == []


def test_rule_transport_does_not_grab_an_already_held_object(index):
    value = plan_command('把水杯放到书房', index, holding='cup_red')
    assert [s['action'] for s in value['steps']] == ['go', 'drop']
    assert validate_steps(index, value['steps'], 'cup_red') == []


@pytest.mark.parametrize('query', ['把水杯放到沙发', '把不存在的物体放到书房', '今天天气不错'])
def test_unresolvable_commands_are_clarified_without_guessing(index, query):
    assert plan_command(query, index) is None


@pytest.mark.parametrize('bad', [[], 'not-json', {}, {'steps': []},
    {'say': 'x', 'steps': [{'action': 'fly'}]},
    {'say': 'x', 'steps': [{'action': 'find', 'target': []}]}])
def test_malformed_online_output_cannot_escape_structure_validation(index, bad):
    result = plan_offline('定位一个杯子', index, cache={}, online=lambda *args: bad)
    assert result['steps'] == [] and result['source'] == 'rule'
