function normalizedText(value) {
  return String(value || '').trim();
}

function ownerQuery(user, {
  idField = 'userId',
  emailField = 'email',
} = {}) {
  const id = normalizedText(user?.id || user?.sub || user?._id);
  const email = normalizedText(user?.email).toLowerCase();
  const clauses = [];
  if (id) {
    clauses.push({ [idField]: id });
    // Legacy records sometimes stored the same account ID as a MongoDB
    // ObjectId even though current schemas use strings. $toString makes the
    // comparison stable across both representations without using a name.
    clauses.push({
      $expr: {
        $eq: [{ $toString: `$${idField}` }, id],
      },
    });
  }
  // Email is only a migration fallback for records that have never been
  // linked to an account. A record carrying a different user ID must never be
  // claimed merely because an email happens to match.
  if (email) {
    clauses.push(id
      ? {
          $and: [
            {
              $or: [
                { [idField]: { $exists: false } },
                { [idField]: null },
                { [idField]: '' },
              ],
            },
            { [emailField]: email },
          ],
        }
      : { [emailField]: email });
  }
  if (clauses.length === 0) return { _id: null };
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

module.exports = { ownerQuery };
