"""Checkpointed, explicit sample import. Credentials never enter the dataset receipt."""
from __future__ import annotations
import copy
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('scenario_catalog',HERE/'seed-catalog.py')
catalog=importlib.util.module_from_spec(spec);spec.loader.exec_module(catalog)
base=catalog.base

class Context:
    def __init__(self):
        self.here=HERE;self.root=HERE.parent;self.env=base.ENV
        base.deploy.demo_scope(self.env)
        digest=hashlib.sha256((HERE/'fixtures/non_ai/dataset.json').read_bytes()).hexdigest()
        self.receipt=base.state_module.Receipt(base.sql,self.env['COMPOSE_PROJECT_NAME'],digest,'demoNonAiState')
        self.state=self.receipt.read()
        original=base.state_module.Receipt(base.sql,self.env['COMPOSE_PROJECT_NAME'],base.state_module.fingerprint(HERE)).read()
        if not original or original.get('phase')!='complete':raise ValueError('Install the branch demo dataset before its non-AI extension')
        cat=base.state_module.Receipt(base.sql,self.env['COMPOSE_PROJECT_NAME'],base.state_module.fingerprint(HERE),base.state_module.CATALOG_ID).read()
        self.refs=copy.deepcopy(original['baseManifest']['refs'])
        for kind,records in cat['manifest']['refs'].items():self.refs.setdefault(kind,{}).update(records)
        if self.state is None:self.state=self.receipt.create('running',steps={},records={},files={},modules={})
        self.records=self.state['records'];self.clients={};self.admin=self.client('devadmin',True)
    def checkpoint(self):
        self.receipt.save(self.state)
        path=HERE/'.local'/f"{self.env['COMPOSE_PROJECT_NAME']}-non-ai-manifest.json"
        path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2)+'\n');path.chmod(0o600)
    def client(self,name,admin=False):
        key=(name,admin)
        if key not in self.clients:self.clients[key]=catalog.Client(name,'admin' if admin else 'member')
        return self.clients[key]
    def get(self,client,path):return client.call('GET',path)[0]
    def ref(self,kind,key):return self.refs[kind][key]['id']
    def entity(self,collection,id):return self.get(self.admin,f'/admin/records/{collection}/{id}')
    def record(self,key,**fields):
        self.records[key]=fields;self.checkpoint();return fields
    def _redact(self,value):
        if isinstance(value,dict):return {k:({'$localSecret':'demoPassword'} if k.lower() in ('password','newpassword') else self._redact(v)) for k,v in value.items()}
        if isinstance(value,list):return [self._redact(x) for x in value]
        return value
    def _restore(self,value):
        if isinstance(value,dict):
            if value.get('$localSecret')=='demoPassword':return self.env['JIAFENG_DEV_PASSWORD']
            return {k:self._restore(v) for k,v in value.items()}
        if isinstance(value,list):return [self._restore(x) for x in value]
        return value
    def request(self,client,key,method,path,data=None,headers=None):
        steps=self.state['steps']
        if key not in steps:
            steps[key]={'request':{'actor':client.name,'method':method,'path':path,'data':self._redact(copy.deepcopy(data)),'headers':dict(headers or {})},'complete':False}
            self.checkpoint()
        step=steps[key]
        if step['complete']:return copy.deepcopy(step['result'])
        request=step['request']
        if client.name!=request['actor']:raise ValueError('Checkpoint account mismatch for '+key)
        hs={**request['headers'],'Idempotency-Key':'nonai-v1-'+str(uuid.uuid5(uuid.NAMESPACE_URL,key))}
        result=client.call(request['method'],request['path'],self._restore(request['data']),hs)[0]
        # Store domain records, never session, password or signed URL responses.
        if any(k in result for k in ('token','url','password')):raise ValueError('Secret-bearing endpoints cannot use sample checkpoints')
        step.update(complete=True,result=result);self.checkpoint();return copy.deepcopy(result)
    def post(self,client,key,path,data):return self.request(client,key,'POST',path,data)
    def cmd(self,client,key,command,entity='',data=None,version=None,admin=True):
        body={'command':command,'entityId':entity,'data':data or {}}
        if version is not None:body['version']=version
        result=self.request(client,key,'POST','/admin/commands' if admin else '/commands',body,{'X-Workspace-Mode':'compact'} if admin else {})
        return result['result']
    def upload(self,client,key,path,purpose='media'):
        path=Path(path);files=self.state['files']
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if key not in files:
            files[key]={'sha256':digest,'startedAtMillis':int(dt.datetime.now(dt.timezone.utc).timestamp()*1000)};self.checkpoint()
        saved=files[key]
        if saved['sha256']!=digest:raise ValueError('Source file changed during sample import: '+key)
        if 'result' not in saved:
            raw=base.sql("SELECT JSON_OBJECT('fileId',id,'name',name,'mimeType',mime_type,'size',size,'duration',duration_ms/1000) FROM jf_file WHERE owner_id="+str(int(client.user['id']))+' AND purpose='+base.lit(purpose)+' AND source_sha256='+base.lit(digest)+' AND original_name='+base.lit(path.name)+' AND UNIX_TIMESTAMP(created_at)*1000>='+str(saved['startedAtMillis'])+' ORDER BY created_at,id LIMIT 1;')
            saved['result']=json.loads(raw) if raw else client.upload(path,purpose)
            self.checkpoint()
        return copy.deepcopy(saved['result'])
