"""Pure path-normalization checks; no Git subprocess, credentials or services."""
import ast,importlib.util,json,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('copy_export',Path(__file__).with_name('clean-copy.py'))
copy=importlib.util.module_from_spec(spec);spec.loader.exec_module(copy)
class PublicationPaths(unittest.TestCase):
 def setUp(self):
  self.home='/'+'home'+'/fictional-user';self.root=Path(self.home+'/backroom')
 def test_python_constructor_stays_executable(self):
  source="from pathlib import Path\np = Path('"+self.home+"/.local/state/switch') / 'session'\n"
  cleaned=copy.normalize(source,self.root);ast.parse(cleaned)
  self.assertIn("Path.home()",cleaned);self.assertNotIn(self.home,cleaned)
 def test_node_login_path_uses_environment(self):
  source="readFileSync('"+self.home+"/.codex/auth.json', 'utf8')"
  cleaned=copy.normalize(source,self.root)
  self.assertIn("process.env.HOME",cleaned);self.assertNotIn(self.home,cleaned)
 def test_historical_json_keeps_result_and_source_is_unchanged(self):
  source=json.dumps({'body':'cd '+str(self.root)+'/sample','status':'PASS','count':3})
  cleaned=copy.normalize(source,self.root);value=json.loads(cleaned)
  self.assertEqual(value['status'],'PASS');self.assertEqual(value['count'],3)
  self.assertIn('${BACKROOM_ROOT}',value['body']);self.assertIn(self.home,source)
if __name__=='__main__':unittest.main(verbosity=2)
