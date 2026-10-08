import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { emptyResource,resourceFieldErrors } from '../src/domain/credentials';
describe('authorized resource publication',()=>{
  it('requires a recorded licence and explicit distribution authority when publishing',()=>{
    const data={...emptyResource(),title:'家风资料',description:'学习用授权资料',regionId:'zhejiang',fileId:'f1',licenseText:'仅限本人非商业学习使用，请保留来源署名。',attribution:'资料提供方'};
    expect(resourceFieldErrors(data)).toEqual({});
    data.status='published';expect(resourceFieldErrors(data)).toHaveProperty('authorized');
    data.authorized=true;expect(resourceFieldErrors(data)).toEqual({});
    data.licenseText='免费';expect(resourceFieldErrors(data)).toHaveProperty('licenseText');
  });
});
describe('credential mutations',()=>{
  beforeEach(()=>{vi.resetModules();vi.stubEnv('VITE_DATA_MODE','http');vi.stubEnv('VITE_API_BASE_URL','/api/v1');vi.stubGlobal('sessionStorage',{getItem:()=>null});vi.stubGlobal('window',new EventTarget());});
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it('retries the exact revocation version and reason with the same idempotency key',async()=>{
    const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})));vi.stubGlobal('fetch',fetcher);
    const {prepareCredentialWrite}=await import('../src/services/credentials');const input={version:4,reason:'授奖依据人工核验有误'};const retry=prepareCredentialWrite('/admin/certificates/cert-1/revoke',input);
    await retry();input.version=5;input.reason='changed';await retry();
    expect(fetcher.mock.calls[0]![1].headers.get('Idempotency-Key')).toBe(fetcher.mock.calls[1]![1].headers.get('Idempotency-Key'));
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({version:4,reason:'授奖依据人工核验有误'});
  });
});
