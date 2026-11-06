import unittest
from publication_review import scan
class PublicationScanTests(unittest.TestCase):
    def kinds(self,text):return {x['kind'] for x in scan('reports/SAMPLE-fixture.txt',text.encode())}
    def test_provider_token_and_arbitrary_token_field(self):
        value='sk-'+('A1'*18)
        self.assertIn('provider-token',self.kinds(value))
        self.assertIn('credential-assignment',self.kinds('{"connectionToken":"'+('A1b2'*10)+'"}'))
    def test_cookie_and_basic_auth(self):
        self.assertIn('credential-assignment',self.kinds('Cookie="session='+('a1b2'*10)+'"'))
        self.assertIn('authorization-value',self.kinds('Authorization: Basic '+('abcdEFGH'*3)))
    def test_paths_email_and_discord_identifiers(self):
        self.assertIn('personal-absolute-path',self.kinds('/home/'+'private-user'+'/data/file'))
        self.assertIn('email',self.kinds('private-person'+'@'+'private-domain.org'))
        self.assertIn('discord-or-platform-snowflake',self.kinds('guild='+('123456789'*2)))
    def test_example_redaction_and_field_expressions_are_not_credentials(self):
        kinds=self.kinds('password="SAMPLE-owner"; token="[REDACTED]"; api_key=secrets.token_hex(24)')
        self.assertNotIn('credential-assignment',kinds)
    def test_value_free_findings(self):
        value='sk-'+('Z9'*18);result=scan('reports/SAMPLE.txt',value.encode())
        self.assertTrue(all(set(x)=={'file','line','kind','view'} for x in result))
        self.assertNotIn(value,str(result))
if __name__=='__main__':unittest.main()
