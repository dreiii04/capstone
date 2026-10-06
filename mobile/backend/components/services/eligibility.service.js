export const documentEligibilityByRole = {
  student: new Set([
    'f-137 (sh)',
    'f-137 (gs/jh)',
    'general weighted average (gwa)',
    'good moral character/esc (gmc/esc)',
    'card (re-print)',
    'moi (memorandum of inclusion)',
    'student verification',
    'request form (lost)',
    'certified true copy (ctc)',
    'application for graduation',
    'prospectus',
    'certificate of grades',
    'transfer credential',
    'certificate of enrollment',
    'clearance',
  ]),
  former_student: new Set([
    'general weighted average (gwa)',
    'good moral character/esc (gmc/esc)',
    'certified true copy (ctc)',
    'certificate of grades',
    'transfer credential',
    'clearance',
  ]),
  alumni: new Set([
    'transcript of records (tor)',
    'general weighted average (gwa)',
    'good moral character/esc (gmc/esc)',
    'certified true copy (ctc)',
    'diploma (2nd copy)',
    'certificate of grades',
    'transfer credential',
    'clearance',
  ]),
};


const aliases = {
  'tor': 'transcript of records (tor)', 'transcript of records': 'transcript of records (tor)',
  'gwa': 'general weighted average (gwa)', 'gmc/esc': 'good moral character/esc (gmc/esc)',
  'certificate of good moral': 'good moral character/esc (gmc/esc)',
  'ctc': 'certified true copy (ctc)', 'moi': 'moi (memorandum of inclusion)',
  'application for grad': 'application for graduation',
  'certificate of candidacy for graduation': 'application for graduation',
  'cert. of enrollment': 'certificate of enrollment',
  'cert. of grades': 'certificate of grades', 'grade certification': 'certificate of grades',
};
export function eligibilityRole(user) {
  const value = String(user?.studentStatus || user?.role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['former_student','stopped_student','student_stopped','stopped'].includes(value)) return 'former_student';
  if (['student','current_student'].includes(value)) return 'student';
  if (['alumni','masters','doctorate'].includes(value)) return 'alumni';
  return '';
}
export function isDocumentAllowedForRole(docName, role) {
  const allowed = documentEligibilityByRole[role];
  if (!allowed) return false;
  const raw = String(docName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const name = aliases[raw] || raw;
  return allowed.has(name);
}
