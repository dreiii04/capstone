const juniorHighGradeLevels = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const seniorHighGradeLevels = ['Grade 11', 'Grade 12'];
const collegeYearLevels = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
];

const collegeProgramOptions = [
  'BSIT',
  'BSCS',
  'BSIS',
  'BSECE',
  'BSCE',
  'BSA',
  'BSBA',
  'BSHM',
  'BSTM',
  'BEED',
  'BSED',
];

const seniorHighStrandOptions = [
  'Accounting, Business and Management (ABM)',
  'Science, Technology, Engineering, and Mathematics (STEM)',
  'Humanities and Social Sciences (HUMSS)',
  'General Academic Strand (GAS)',
  'Information-Communication Technology (ICT)',
  'Technological And Livelihood Education (TLE)',
];

List<String> gradeOptionsFor(String currentGrade) {
  if (juniorHighGradeLevels.contains(currentGrade)) return juniorHighGradeLevels;
  if (seniorHighGradeLevels.contains(currentGrade)) return seniorHighGradeLevels;
  if (collegeYearLevels.contains(currentGrade)) return collegeYearLevels;
  return [...juniorHighGradeLevels, ...seniorHighGradeLevels, ...collegeYearLevels];
}

List<String> programOptionsForGrade(String grade) {
  if (seniorHighGradeLevels.contains(grade)) return seniorHighStrandOptions;
  if (collegeYearLevels.contains(grade)) return collegeProgramOptions;
  return const [];
}
