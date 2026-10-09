import concurrent.futures
import datetime
import json
from html.parser import HTMLParser
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.canon=[];self.noindex=False;self.schemas=[];self.record=False;self.buff='';self.h1=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='link' and a.get('rel')=='canonical':self.canon.append(a.get('href'))
  if tag=='meta' and a.get('name')=='robots' and 'noindex' in a.get('content',''):self.noindex=True
  if tag=='h1':self.h1+=1
  if tag=='script' and a.get('type')=='application/ld+json':self.record=True;self.buff=''
 def handle_data(self,data):
  if self.record:self.buff+=data
 def handle_endtag(self,tag):
  if tag=='script' and self.record:self.schemas.append(json.loads(self.buff));self.record=False
opener=urllib.request.build_opener()
opener.addheaders=[('User-Agent','Mozilla/5.0')]
urllib.request.install_opener(opener)
base='https://fxnholdings.com'
sitemap=urllib.request.urlopen(base+'/sitemap.xml').read()
root=ET.fromstring(sitemap);urls=[x.text for x in root.findall('{*}url/{*}loc')]
def check(url):
 with urllib.request.urlopen(url) as response:
  html=response.read().decode();page=Page();page.feed(html)
  assert response.status==200 and page.canon==[url] and not page.noindex and page.h1==1,url
  if url.endswith(('uk-vat-for-online-sellers-when-to-register/','starting-a-us-business-from-overseas/')):
   assert 'Updated <time datetime="2026-10-09">' in html
   article=next(s for s in page.schemas if s.get('@type')=='BlogPosting')
   assert article['dateModified']=='2026-10-09'
  return {'url':url,'status':response.status,'canonical':page.canon[0],'h1':page.h1,'jsonld_blocks':len(page.schemas)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(check,urls))
health=json.load(urllib.request.urlopen(base+'/api/health'));assert health=={'ok':True}
assert b'20261010g' in urllib.request.urlopen(base).read()
out={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'asset_version':'20261010g','health':health,'lastmod_count':len(root.findall('{*}url/{*}lastmod')),'pages':results}
Path('seo-reports/2026-10-09-post-deploy/evidence/remediation/live-crawl.json').write_text(json.dumps(out,indent=2))
print(f'{len(results)} live sitemap pages pass status, canonical, indexability, H1 and JSON-LD checks; API healthy; version confirmed.')
