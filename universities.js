// Baguio schools and their courses, used by sign-up, the sell form, Looking For and the filters.
// STARTER LISTS: check each school's official program list and edit freely.
// Every course picker also offers "Other", so a missing course never blocks anyone.
window.UC_SCHOOLS = [
  { code: 'UC', name: 'University of the Cordilleras (UC)', courses: [
    'BS Accountancy', 'BS Business Administration', 'BS Criminology', 'BS Information Technology', 'BS Computer Science',
    'BS Civil Engineering', 'BS Electrical Engineering', 'BS Hospitality Management', 'BS Tourism Management',
    'BS Psychology', 'Bachelor of Elementary Education', 'Bachelor of Secondary Education', 'AB Communication'] },
  { code: 'UB', name: 'University of Baguio (UB)', courses: [
    'BS Nursing', 'BS Medical Technology', 'BS Pharmacy', 'BS Criminology', 'BS Accountancy', 'BS Business Administration',
    'BS Information Technology', 'BS Computer Science', 'BS Civil Engineering', 'BS Hospitality Management',
    'BS Tourism Management', 'BS Psychology', 'Bachelor of Secondary Education'] },
  { code: 'SLU', name: 'Saint Louis University (SLU)', courses: [
    'BS Nursing', 'BS Medical Technology', 'BS Pharmacy', 'BS Accountancy', 'BS Business Administration', 'BS Architecture',
    'BS Civil Engineering', 'BS Electrical Engineering', 'BS Mechanical Engineering', 'BS Computer Science',
    'BS Information Technology', 'BS Psychology', 'AB Communication', 'Bachelor of Secondary Education'] },
  { code: 'UPB', short: 'UP Baguio', name: 'University of the Philippines Baguio (UP Baguio)', courses: [
    'BS Computer Science', 'BS Mathematics', 'BS Biology', 'BS Physics', 'BA Communication', 'BA Language and Literature',
    'BA Social Sciences', 'BS Management', 'BA Fine Arts'] },
  { code: 'BCU', name: 'Baguio Central University (BCU)', courses: [
    'BS Criminology', 'BS Accountancy', 'BS Business Administration', 'BS Information Technology',
    'Bachelor of Elementary Education', 'Bachelor of Secondary Education', 'BS Hospitality Management'] },
  { code: 'BSU', name: 'Benguet State University (BSU)', courses: [
    'BS Agriculture', 'BS Forestry', 'BS Agricultural Engineering', 'BS Nursing', 'BS Information Technology',
    'BS Biology', 'Bachelor of Elementary Education', 'Bachelor of Secondary Education', 'Doctor of Veterinary Medicine'] },
  { code: 'PCC', name: 'Pines City Colleges (PCC)', courses: [
    'BS Nursing', 'BS Pharmacy', 'BS Medical Technology', 'BS Radiologic Technology', 'BS Physical Therapy',
    'BS Psychology', 'BS Accountancy'] },
  { code: 'BCT', name: 'Baguio College of Technology (BCT)', courses: [
    'BS Information Technology', 'BS Computer Engineering', 'BS Criminology', 'BS Hospitality Management',
    'BS Business Administration'] }
];

// Pickup spots per school, shown as "SLU · Library lobby" in listings and meetups.
// DEFAULTS FOR NOW: the same five generic names at every school. They are not real building names
// and not approved by any school. Replace a school's list with its real meetup places when you know them.
window.UC_SPOTS = {
  UC:  ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  UB:  ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  SLU: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  UPB: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  BCU: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  BSU: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  PCC: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'],
  BCT: ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen']
};
window.UC_DEFAULT_SPOTS = ['Library lobby', 'Guard house', 'Gym lobby', 'Student center', 'Canteen'];

// Helpers shared by every page
// A school from its full name, its code ("SLU") or its short name ("UP Baguio"); null if it isn't one of ours
window.UC_SCHOOL_OF = function (value) {
  var n = (value || '').trim().toLowerCase();
  if (!n) return null;
  return window.UC_SCHOOLS.filter(function (s) {
    return s.name.toLowerCase() === n || s.code.toLowerCase() === n || (s.short || '').toLowerCase() === n;
  })[0] || null;
};
// The short label used on chips and cards: "SLU", "UP Baguio"
window.UC_SCHOOL_LABEL = function (s) { return s ? (s.short || s.code) : ''; };
// Pickup spots for a school (by any of its names); the defaults when the school is unknown
window.UC_SPOTS_FOR = function (value) {
  var s = window.UC_SCHOOL_OF(value);
  return (s && window.UC_SPOTS[s.code]) || window.UC_DEFAULT_SPOTS;
};
window.UC_SCHOOL_BY_NAME = function (name) {
  var n = (name || '').trim().toLowerCase();
  return window.UC_SCHOOLS.filter(function (s) { return s.name.toLowerCase() === n; })[0] || null;
};
window.UC_ALL_COURSES = function () {
  var seen = {};
  window.UC_SCHOOLS.forEach(function (s) { s.courses.forEach(function (c) { seen[c] = 1; }); });
  return Object.keys(seen).sort();
};
