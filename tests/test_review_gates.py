import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from scripts import check_contracts as gate


def test_invalid_git_ref_is_a_failure_with_diagnostic():
    result=subprocess.run([sys.executable,str(gate.ROOT/'scripts/check_contracts.py'),'--base','missing-review-ref-987654'],capture_output=True,text=True,encoding='utf-8')
    assert result.returncode!=0
    assert 'missing-review-ref-987654' in result.stdout+result.stderr
    assert '[OK]' not in result.stdout
    assert '检查 0 个' not in result.stdout


def test_layout_example_update_is_legal_without_replacing_runtime_layout(tmp_path,monkeypatch):
    import importlib.util
    spec=importlib.util.spec_from_file_location("contract_checks",gate.ROOT/"tests/test_contracts.py")
    test_contracts=importlib.util.module_from_spec(spec);spec.loader.exec_module(test_contracts)
    # Example is illustrative; B's runtime layout remains independently versioned.
    shutil.copytree(gate.ROOT/'contracts',tmp_path/'contracts')
    shutil.copytree(gate.ROOT/'web/public/layouts',tmp_path/'web/public/layouts')
    p=tmp_path/'contracts/layout.example.json';data=json.loads(p.read_text(encoding='utf-8'))
    data['version']=2;data['rooms'][0]['aliases']=['合法示例别名'];p.write_text(json.dumps(data),encoding='utf-8')
    monkeypatch.setattr(test_contracts,'C',tmp_path/'contracts')
    monkeypatch.setattr(test_contracts,'ROOT',tmp_path)
    test_contracts.test_layout_example_matches_schema()
    test_contracts.test_frontend_layouts_match_schema()
    monkeypatch.setattr(gate,'ROOT',tmp_path);monkeypatch.setattr(gate,'CONTRACTS',tmp_path/'contracts');monkeypatch.setattr(gate,'LOCK',tmp_path/'contracts/contracts.lock.json')
    gate.LOCK.write_text(json.dumps(gate.build_lock()),encoding='utf-8')
    def git(*args):
        subprocess.run(['git',*args],cwd=tmp_path,check=True,capture_output=True)
    git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
    git('add','.');git('-c','core.hooksPath=disabled-hooks','commit','-m','baseline')
    data['rooms'][0]['aliases'].append('另一个示例名');p.write_text(json.dumps(data),encoding='utf-8')
    gate.LOCK.write_text(json.dumps(gate.build_lock()),encoding='utf-8')
    monkeypatch.setattr(sys,'argv',['check_contracts.py'])
    assert gate.main()==0


def test_ci_pr_title_is_passed_as_environment_data():
    text=(gate.ROOT/'.github/workflows/ci.yml').read_text(encoding='utf-8')
    assert 'PR_TITLE: ${{ github.event.pull_request.title }}' in text
    assert "title='${{ github.event.pull_request.title }}'" not in text
    assert 'echo "$PR_TITLE"' in text
    # Shell expansion preserves quotes, substitutions and newlines as data.
    title="[CONTRACT] O'Reilly $(echo injected) `echo unsafe`\nsecond line"
    result=subprocess.run(['bash','-c','printf "%s" "$PR_TITLE"'],env={'PR_TITLE':title},capture_output=True,text=True) if os.name != 'nt' and shutil.which('bash') else None
    if result:
        assert result.stdout==title
