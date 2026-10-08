import type { Session } from './service';

// Temporary switch for team testing. When NBC_ADMIN_OPEN=true every visitor to the committee
// workspace acts as an administrator without signing in. Remove the variable to restore staff sign-in.
export const adminOpen = () => process.env.NBC_ADMIN_OPEN === 'true';
export const openAdminSession: Session = {
  role: 'admin',
  participant_id: null,
  auth_source: 'open-access',
  actor: 'open-access',
};
