import json
from pathlib import Path
import unittest
from unittest.mock import patch
from redaction import redact
class RedactionTests(unittest.TestCase):
    def test_unknown_tokens_masked_without_credential_discovery(self):
        values=['opaque-'+('A1'*18),'opaque-'+('B2'*18)]
        source=json.dumps({'status':200,'accessToken':values[0],'response':{'refresh_token':values[1]}})
        with patch.object(Path,'read_text',side_effect=AssertionError('Credential-store read forbidden')):
            result=redact(source)
        self.assertTrue(all(value not in result for value in values));self.assertEqual(json.loads(result)['status'],200)
    def test_multiline_and_unquoted_assignments(self):
        values=['a1'*20,'b2'*20]
        result=redact('access_token = "'+values[0]+'"\npassword='+values[1])
        self.assertTrue(all(value not in result for value in values))
    def test_headers_and_legacy_prefixes(self):
        values=['Basic '+('YWJj'*8),'swlr_'+('A1'*20),'swac_'+('B2'*20)]
        for value in values:self.assertNotIn(value,redact(value))
    def test_private_paths_and_identity_values(self):
        value='11111111'+'-2222-3333-4444-'+'555555555555'
        result=redact('/home/'+'private-user'+'/project '+value)
        self.assertNotIn(value,result);self.assertNotIn('private-user',result)
if __name__=='__main__':unittest.main()
