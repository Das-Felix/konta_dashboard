import { describe, expect, it } from 'vitest';
import {
	insightsRange,
	normalizeBreakdown,
	normalizeChart,
	normalizeEvent,
	normalizeOverview,
	parseTimestamp,
	summarizeProfile,
	toPathname
} from './openpanel.js';

describe('openpanel', () => {
	it('liest Zeitstempel ohne Zone als UTC', () => {
		expect(parseTimestamp('2026-10-07 10:00:00.000').toISOString()).toBe(
			'2026-10-07T10:00:00.000Z'
		);
		expect(parseTimestamp('2026-10-07T10:00:00+02:00').toISOString()).toBe(
			'2026-10-07T08:00:00.000Z'
		);
	});

	it('normalisiert Ereignisse in camelCase und snake_case', () => {
		const camel = normalizeEvent({
			id: '1',
			name: 'signin',
			profileId: 'u1',
			sessionId: 's',
			createdAt: '2026-10-07 10:00:00'
		});
		const snake = normalizeEvent({
			id: '2',
			name: 'signin',
			profile_id: 'u1',
			session_id: 's',
			created_at: '2026-10-07 10:00:00'
		});
		expect(camel.profileId).toBe('u1');
		expect(snake.profileId).toBe('u1');
		expect(snake.createdAt.toISOString()).toBe('2026-10-07T10:00:00.000Z');
		expect(snake.properties).toEqual({});
	});

	it('normalisiert Chart-Reihen samt Breakdown', () => {
		const series = normalizeChart(
			{
				series: [
					{
						names: ['screen_view'],
						event: { name: 'screen_view' },
						metrics: { sum: 7 },
						data: [
							{ date: '2026-10-06T00:00:00', count: 3 },
							{ date: '2026-10-07T00:00:00', count: 4 }
						]
					},
					{ names: ['screen_view', '/belege'], data: [{ date: '2026-10-07', count: 2 }] }
				]
			},
			[{ name: 'screen_view' }]
		);
		expect(series[0]).toEqual({
			name: 'screen_view',
			total: 7,
			points: [
				{ day: '2026-10-06', value: 3 },
				{ day: '2026-10-07', value: 4 }
			]
		});
		expect(series[1].name).toBe('/belege');
		expect(series[1].total).toBe(2);
		expect(normalizeChart(null, [])).toEqual([]);
	});

	it('bringt Reihen in die angefragte Reihenfolge', () => {
		// So liefert OpenPanel: nach Summe sortiert, Name mit Präfix.
		const series = normalizeChart(
			{
				series: [
					{
						names: ['(C) screen_view'],
						event: { id: 'C', name: 'screen_view' },
						metrics: { sum: 8578, count: 72 },
						data: []
					},
					{
						names: ['(A) screen_view'],
						event: { id: 'A', name: 'screen_view' },
						metrics: { sum: 126, count: 72 },
						data: []
					},
					{
						names: ['(B) screen_view'],
						event: { id: 'B', name: 'screen_view' },
						metrics: { sum: 90, count: 72 },
						data: []
					}
				]
			},
			[
				{ name: 'screen_view', segment: 'user' },
				{ name: 'screen_view', segment: 'session' },
				{ name: 'screen_view', segment: 'event' }
			]
		);
		expect(series.map((entry) => entry.total)).toEqual([126, 90, 8578]);
		expect(series[0].name).toBe('screen_view');
	});

	it('liest die Kennzahlen der OpenPanel-Übersicht', () => {
		const overview = normalizeOverview({
			metrics: {
				unique_visitors: 34,
				total_sessions: 136,
				total_screen_views: 8780,
				bounce_rate: 18.38
			},
			series: [
				{
					date: '2026-09-11T00:00:00.000Z',
					unique_visitors: 1,
					total_sessions: 1,
					total_screen_views: 14
				}
			]
		});
		expect(overview.totals.visitors).toBe(34);
		expect(overview.totals.sessions).toBe(136);
		expect(overview.totals.pageViews).toBe(8780);
		expect(overview.points).toEqual([
			{ day: '2026-09-11', visitors: 1, sessions: 1, pageViews: 14 }
		]);
	});

	it('wählt den Zeitraum wie im OpenPanel-Dashboard', () => {
		const now = new Date('2026-10-11T12:00:00Z');
		expect(insightsRange(30, now)).toEqual({ range: '30d' });
		expect(insightsRange(90, now)).toEqual({
			startDate: '2026-07-13',
			endDate: '2026-10-11 23:59:59'
		});
	});

	it('fasst ein Profil zusammen', () => {
		const events = [
			normalizeEvent({
				id: '1',
				name: 'screen_view',
				sessionId: 'a',
				path: 'https://app.konta.at/belege',
				browser: 'Chrome',
				city: 'Wien',
				country: 'AT',
				createdAt: '2026-10-01 10:00:00'
			}),
			normalizeEvent({
				id: '2',
				name: 'screen_view',
				sessionId: 'b',
				path: 'https://app.konta.at/belege',
				browser: 'Chrome',
				createdAt: '2026-10-03 10:00:00'
			}),
			normalizeEvent({
				id: '3',
				name: 'signin',
				sessionId: 'b',
				browser: 'Safari',
				createdAt: '2026-10-02 10:00:00'
			})
		];
		const summary = summarizeProfile(events);
		expect(summary?.sessions).toBe(2);
		expect(summary?.browsers).toEqual(['Chrome', 'Safari']);
		expect(summary?.topPages).toEqual([{ path: '/belege', value: 2 }]);
		expect(summary?.lastSeen.toISOString()).toBe('2026-10-03T10:00:00.000Z');
		expect(summarizeProfile([])).toBeNull();
		expect(toPathname('/x')).toBe('/x');
	});

	it('normalisiert Aufschlüsselungen und sortiert nach Sessions', () => {
		const rows = normalizeBreakdown([
			{ name: 'Google', sessions: 4, pageviews: 9, revenue: 0 },
			{ name: null, sessions: 12, pageviews: 30 },
			{ name: '', sessions: 1, pageViews: 2 }
		]);
		expect(rows).toEqual([
			{ name: null, sessions: 12, pageViews: 30 },
			{ name: 'Google', sessions: 4, pageViews: 9 },
			{ name: null, sessions: 1, pageViews: 2 }
		]);
		expect(normalizeBreakdown({ error: 'x' })).toEqual([]);
	});
});
