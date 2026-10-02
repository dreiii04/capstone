class DocumentOption {
  final String name;
  final double price;
  final Set<String> allowedRoles;

  const DocumentOption(
    this.name,
    this.price, {
    required this.allowedRoles,
  });
}

/// Canonical role identifiers that match normalizeRole() output.
/// student, former_student, alumni (masters and doctorate treated as alumni).
const _allRoles = {'student', 'former_student', 'alumni'};

const List<DocumentOption> documentOptions = [
  DocumentOption('F-137 (SH)', 400,
      allowedRoles: {'student'}),
  DocumentOption('F-137 (GS/JH)', 250,
      allowedRoles: {'student'}),
  DocumentOption('Transcript of Records (TOR)', 600,
      allowedRoles: _allRoles),
  DocumentOption('General Weighted Average (GWA)', 250,
      allowedRoles: _allRoles),
  DocumentOption('Good Moral Character/ESC (GMC/ESC)', 200,
      allowedRoles: _allRoles),
  DocumentOption('Card (re-print)', 200,
      allowedRoles: {'student'}),
  DocumentOption('MOI (Memorandum of Inclusion)', 250,
      allowedRoles: {'student'}),
  DocumentOption('Student Verification', 250,
      allowedRoles: {'student'}),
  DocumentOption('Request Form (Lost)', 200,
      allowedRoles: {'student'}),
  DocumentOption('Certified True Copy (CTC)', 200,
      allowedRoles: _allRoles),
  DocumentOption('Diploma (2nd Copy)', 300,
      allowedRoles: {'alumni'}),
  DocumentOption('Application for Graduation', 200,
      allowedRoles: {'student'}),
  DocumentOption('Prospectus', 200,
      allowedRoles: {'student'}),
  DocumentOption('Certificate of Grades', 250,
      allowedRoles: _allRoles),
  DocumentOption('Transfer Credential', 300,
      allowedRoles: _allRoles),
  DocumentOption('Certificate of Enrollment', 250,
      allowedRoles: {'student'}),
  DocumentOption('Clearance', 200,
      allowedRoles: _allRoles),
];

/// Returns documents the given role is allowed to request.
/// [normalizedRole] should be 'student', 'former_student', or 'alumni'.
/// Masters and doctorate roles are mapped to 'alumni' by the caller.
List<DocumentOption> getAvailableDocumentOptions({String normalizedRole = 'student'}) {
  return documentOptions
      .where((doc) => doc.allowedRoles.contains(normalizedRole))
      .toList();
}

/// Returns true if [normalizedRole] is allowed to request [docName].
bool isDocumentAllowedForRole(String docName, String normalizedRole) {
  final normalized = docName.trim().toLowerCase();
  for (final option in documentOptions) {
    if (option.name.toLowerCase() == normalized) {
      return option.allowedRoles.contains(normalizedRole);
    }
  }
  // Unknown/custom documents remain eligible for existing requests.
  return true;
}

double documentPriceForName(String name) {
  final normalized = name.trim().toLowerCase();
  for (final option in documentOptions) {
    if (option.name.toLowerCase() == normalized) return option.price;
  }
  return 0;
}
