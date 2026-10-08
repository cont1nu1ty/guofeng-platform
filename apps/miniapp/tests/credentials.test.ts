import { beforeEach,describe,expect,it,vi } from 'vitest'
const state=vi.hoisted(()=>({epoch:1,user:{value:{id:'owner'} as {id:string}|null},request:vi.fn()}))
vi.mock('../src/services/api',()=>({currentSessionEpoch:()=>state.epoch,remoteUser:state.user,request:state.request}))
import { confirmationRequest,downloadCredential } from '../src/services/credentials'
beforeEach(()=>{state.epoch=1;state.user.value={id:'owner'};state.request.mockReset();state.request.mockResolvedValue({data:{ok:true}})})
describe('owner-bound rights confirmations',()=>{
  it('retains terms/revision/version and a stable idempotency key on retry',async()=>{
    const input={revisionId:'revision-1',version:3,agreementVersion:'terms-1',accepted:true};const retry=confirmationRequest('work-1',input)
    await retry();input.revisionId='revision-2';await retry()
    expect(state.request.mock.calls[0]![3]).toEqual(state.request.mock.calls[1]![3]);expect(state.request.mock.calls[1]![2]).toMatchObject({revisionId:'revision-1',version:3})
  })
  it('does not submit a prepared confirmation under a new account',async()=>{
    const retry=confirmationRequest('work-1',{revisionId:'rev',version:1,agreementVersion:'terms-1',accepted:true})
    state.epoch++;state.user.value={id:'different-owner'}
    await expect(retry()).rejects.toThrow('登录状态');expect(state.request).not.toHaveBeenCalled()
  })
  it('does not open a signed download when the account changes while waiting',async()=>{
    state.request.mockImplementation(async()=>{state.epoch++;return {data:{url:'https://example.invalid/private'}}})
    await expect(downloadCredential('certificate',{id:'cert'})).resolves.toBeUndefined()
  })
})
