export type PermissionCheck = (permission: string) => boolean;
export function canOpenSettings(can: PermissionCheck) {
  return ['settings:read', 'notifications:read', 'audit:read', 'regions:read'].some(can);
}
export function accessibleSettingsTabs(can: PermissionCheck, remote: boolean) {
  return [
    ...(can('settings:read') ? ['platform'] : []),
    ...(can('notifications:read') ? ['notifications'] : []),
    ...(can('audit:read') ? ['logs'] : []),
    ...(remote && can('settings:read') ? ['search'] : []),
    ...(remote && can('regions:read') ? ['regions'] : []),
  ];
}
