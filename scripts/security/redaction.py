"""Pure log redaction: never opens a credential store or discovers secret values."""
import hashlib
import json
import re
SENSITIVE=re.compile(r'token|secret|password|passwd|credential|cookie|authorization|api.?key|private.?key|^key$',re.I)
EMAIL=re.compile(r'[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
UUID=re.compile(r'\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b',re.I)
ASSIGN=re.compile(r'''(?ix)(["']?\b[A-Za-z_]*(?:token|secret|password|passwd|credential|cookie|authorization|api[_-]?key|private[_-]?key)[A-Za-z_]*["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)''')
def scrub(obj):
    if isinstance(obj,dict):return {k:'<REDACTED>' if SENSITIVE.search(k) else scrub(v) for k,v in obj.items()}
    if isinstance(obj,list):return [scrub(v) for v in obj]
    if isinstance(obj,str):return text_scrub(obj)
    return obj

def text_scrub(text):
    text=ASSIGN.sub(lambda m:m[1]+'"<REDACTED>"',text)
    text=re.sub(r'(?i)\b(?:Bearer|Basic)\s+[^\s"\'<>]+','<REDACTED-AUTH>',text)
    text=re.sub(r'\b(?:swlr_|swac_|swk_|sk-|gh[pousr]_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{8,}','<REDACTED-TOKEN>',text)
    text=re.sub(r'\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?|mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{25,})\b','<REDACTED-TOKEN>',text)
    text=re.sub(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)','<REDACTED-PRIVATE-KEY>',text)
    text=re.sub(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b','<REDACTED-KEY>',text)
    text=re.sub(r'(?:/home|/Users)/[A-Za-z0-9_.-]+','<USER_HOME>',text)
    text=re.sub(r'~/agency(?:/[^\s`<>]*)?','<PRIVATE_AGENCY_REFERENCE>',text)
    text=UUID.sub(lambda m:'SAMPLE-id-'+hashlib.sha256(m[0].encode()).hexdigest()[:12],text)
    text=re.sub(r'\bsw_[a-f0-9]{32}\b',lambda m:'SAMPLE-event-'+hashlib.sha256(m[0].encode()).hexdigest()[:12],text)
    text=re.sub(r'(?<![A-Za-z0-9])\d{17,20}(?![A-Za-z0-9])','<REDACTED-PLATFORM-ID>',text)
    def email(m):
        domain=m[0].split('@')[1].lower()
        return m[0] if domain.endswith(('.test','.example','.invalid')) or domain in ['example.com','example.org','example.net','anthropic.com'] else '<REDACTED-EMAIL>'
    return EMAIL.sub(email,text)

def redact(text):
    try:return json.dumps(scrub(json.loads(text)),ensure_ascii=False)
    except (ValueError,TypeError):return text_scrub(text)
