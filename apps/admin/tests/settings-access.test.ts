import { describe,expect,it } from 'vitest';
import { accessibleSettingsTabs,canOpenSettings } from '../src/domain/settingsAccess';
describe('job-specific settings navigation',()=>{
  it('allows a content operator into notification drafts without exposing platform configuration',()=>{
    const can=(key:string)=>['content:read','notifications:read','notifications:write'].includes(key);
    expect(canOpenSettings(can)).toBe(true);expect(accessibleSettingsTabs(can,true)).toEqual(['notifications']);
  });
  it('allows data operators to read audit and refuses a visitor with no grant',()=>{
    expect(accessibleSettingsTabs(key=>key==='audit:read',true)).toEqual(['logs']);
    expect(canOpenSettings(()=>false)).toBe(false);expect(accessibleSettingsTabs(()=>false,true)).toEqual([]);
  });
  it('shows region catalog for read access while mutations remain separate',()=>{
    expect(accessibleSettingsTabs(key=>key==='regions:read',true)).toEqual(['regions']);
  });
});
