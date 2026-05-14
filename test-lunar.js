import { Lunar } from 'lunar-javascript';
const l = Lunar.fromDate(new Date('2026-05-14T12:00:00Z'));
console.log('Month Ganzhi exact:', l.getMonthInGanZhiExact());
console.log('Month Ganzhi:', l.getMonthInGanZhi());
