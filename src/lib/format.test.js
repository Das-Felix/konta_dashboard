import { describe, expect, it } from 'vitest';
import {
	changeRatio,
	describeUserAgent,
	formatChange,
	formatDate,
	formatDateTime,
	formatDayHeading,
	formatDayLabel,
	formatEuro,
	formatNumber,
	formatPercent,
	formatRelative,
	viennaDayKey
} from './format.js';

describe('format', () => {
	it('formatiert Zahlen und Beträge nach Styleguide', () => {
		expect(formatNumber(1402)).toBe('1.402');
		expect(formatEuro(1402.8)).toBe('1.402,80 €');
		expect(formatEuro(565, { whole: true })).toBe('565 €');
		expect(formatPercent(0.42)).toBe('42 %');
		expect(formatNumber(null)).toBe('—');
	});

	it('nutzt Wiener Zeit und Jänner', () => {
		// 23:30 UTC am 31.12. ist in Wien schon der 1. Jänner.
		expect(formatDate(new Date('2025-12-31T23:30:00Z'))).toBe('1. Jänner 2026');
		expect(formatDateTime(new Date('2026-07-01T10:05:00Z'))).toBe('01.07.2026, 12:05');
		expect(viennaDayKey(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
		expect(formatDayLabel('2026-10-04')).toBe('4. Okt');
	});

	it('beschreibt relative Zeiten', () => {
		const now = new Date('2026-10-07T12:00:00Z');
		expect(formatRelative(new Date('2026-10-07T11:59:30Z'), now)).toBe('gerade eben');
		expect(formatRelative(new Date('2026-10-07T11:00:00Z'), now)).toBe('vor 1 Std.');
		expect(formatRelative(new Date('2026-10-06T12:00:00Z'), now)).toBe('gestern');
		expect(formatRelative(new Date('2026-10-12T12:00:00Z'), now)).toBe('in 5 Tagen');
		expect(formatDayHeading(new Date('2026-10-07T08:00:00Z'), now)).toBe('Heute');
		expect(formatDayHeading(new Date('2026-10-06T08:00:00Z'), now)).toBe('Gestern');
	});

	it('rechnet Veränderungen ohne Gedankenstrich', () => {
		expect(changeRatio(15, 10)).toBe(0.5);
		expect(changeRatio(5, 0)).toBeNull();
		expect(formatChange(0.5)).toBe('+50 %');
		expect(formatChange(-0.1)).toBe('−10 %');
	});

	it('erkennt Browser und System', () => {
		expect(
			describeUserAgent(
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
			)
		).toBe('Chrome · macOS');
		expect(describeUserAgent(null)).toBe('Unbekanntes Gerät');
	});
});
