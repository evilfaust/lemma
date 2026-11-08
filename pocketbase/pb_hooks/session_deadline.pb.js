/// <reference path="../pb_data/types.d.ts" />
// Защита также для старых вкладок и REST/batch.
onRecordCreateRequest((e) => {
  return require(`${__hooks}/session_deadline_lib.js`).guard(e, true);
}, 'attempts', 'attempt_answers');
onRecordUpdateRequest((e) => {
  return require(`${__hooks}/session_deadline_lib.js`).guard(e, false);
}, 'attempts', 'attempt_answers');
