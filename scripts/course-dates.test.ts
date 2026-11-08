import {test,expect} from 'bun:test';
import {COURSE_START_UTC, getNextClassAfter, applicationsOpen} from '../src/lib/course-schedule';
import {COURSE_MODEL} from '../src/lib/entitlements';
test('starts Monday December 7 2026 at 9:30 São Paulo',()=>{expect(COURSE_START_UTC.toISOString()).toBe('2026-12-07T12:30:00.000Z');expect(COURSE_START_UTC.getUTCDay()).toBe(1);expect(COURSE_MODEL.cohort_start_date).toBe('2026-12-07')});
test('next weekly Monday remains 09:30 São Paulo',()=>expect(getNextClassAfter(new Date('2026-12-08T00:00:00Z')).toISOString()).toBe('2026-12-14T12:30:00.000Z'));
test('applications include Sunday Jan3 São Paulo and close at midnight',()=>{expect(applicationsOpen(Date.parse('2027-01-04T02:59:59Z'))).toBe(true);expect(applicationsOpen(Date.parse('2027-01-04T03:00:00Z'))).toBe(false)});
