"""Optional networked advisory check, no live Switch API or provisioning.
Requires PyYAML and Pydantic 2. Hash-pinned upstream pure lint/parameter code only.
The no-account suite does NOT require this script/dependencies/network.
"""
import ast,hashlib,json,re,sys,types,urllib.request
from pathlib import Path
from typing import Any,Literal
import yaml
from pydantic import BaseModel,model_validator
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'switch/validation-sources.json').read_text())
source={}
for name,item in manifest['sources'].items():
 data=urllib.request.urlopen(item['url'],timeout=30).read()
 if hashlib.sha256(data).hexdigest()!=item['sha256']:raise SystemExit('Upstream source hash mismatch: '+name)
 source[name]=data.decode()
package=types.ModuleType('switch_core');package.__path__=[];sys.modules['switch_core']=package
rooms=types.ModuleType('switch_core.rooms_yaml');sys.modules[rooms.__name__]=rooms
rooms.__dict__.update(dict(re=re,Any=Any,Literal=Literal,BaseModel=BaseModel,model_validator=model_validator))
names={'PLACEHOLDER_RE','CHAIN_PARAM_TYPES','NEW','OPTIONAL_WITHOUT_DEFAULT_TYPES','ParamType','ParamInput','ParamSpec','ENTITY_PARAM_TYPES','CONSOLE_PARAM_TYPES','coerce_param','interpolate'}
selected=[]
for node in ast.parse(source['rooms_yaml.py']).body:
 if isinstance(node,(ast.ClassDef,ast.FunctionDef)) and node.name in names:selected.append(node)
 elif isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in node.targets):selected.append(node)
# Extract actual ParamSpec, not operational room services or database imports.
module=ast.Module(body=[ast.ImportFrom(module='__future__',names=[ast.alias(name='annotations')],level=0)]+selected,type_ignores=[])
exec(compile(ast.fix_missing_locations(module),'pinned-upstream-parameter-model','exec'),rooms.__dict__)
for name in ['template_v2.py','template_lint.py']:
 mod=types.ModuleType('switch_core.'+name[:-3]);sys.modules[mod.__name__]=mod
 exec(compile(source[name],name,'exec'),mod.__dict__)
text=(root/'switch/backroom.template.yaml').read_text()
result=sys.modules['switch_core.template_lint'].lint_template(text)
print('Pinned upstream Switch 0.31.0 advisory lint: errors='+str(len(result.errors))+' warnings='+str(len(result.warnings)))
for issue in result.errors+result.warnings:print(issue.code+': '+issue.message)
if result.errors or result.warnings:raise SystemExit(1)
print('Source hashes verified; actual upstream ParamSpec/v1 lint used without operational server imports.')
print('Not tested: template import, identity lookup, bridge resolution, provisioning, Console UI or runtime model/owner configuration.')
